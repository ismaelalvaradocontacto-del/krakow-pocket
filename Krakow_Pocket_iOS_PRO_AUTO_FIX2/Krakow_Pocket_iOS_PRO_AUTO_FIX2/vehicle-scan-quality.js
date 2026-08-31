(() => {
  const form = document.getElementById('vehicleForm');
  const ui = document.querySelector('.vehicle-scan');
  if (!form || !ui || ui.dataset.qualityOcr === '1') return;
  ui.dataset.qualityOcr = '1';

  const cameraInput = ui.querySelector('.scan-input-camera');
  const uploadInput = ui.querySelector('.scan-input-upload');
  const cameraButton = ui.querySelector('.scan-camera');
  const uploadButton = ui.querySelector('.scan-upload');
  const progress = ui.querySelector('.vehicle-scan-progress');
  const progressCopy = ui.querySelector('.vehicle-scan-progress-copy');
  const progressBar = ui.querySelector('.vehicle-scan-progress-track i');
  const result = ui.querySelector('.vehicle-scan-result');
  const note = ui.querySelector('.vehicle-scan-note');
  if (!cameraInput || !uploadInput || !cameraButton || !uploadButton || !progress || !progressCopy || !progressBar || !result) return;

  uploadInput.accept = 'image/*,application/pdf';
  const uploadStrong = uploadButton.querySelector('strong');
  const uploadSmall = uploadButton.querySelector('small');
  if (uploadStrong) uploadStrong.textContent = 'Cargar archivo';
  if (uploadSmall) uploadSmall.textContent = 'Foto o PDF';
  if (note) note.textContent = 'Permiso de circulación · foto o PDF · el archivo no se guarda.';

  const names = ['brand', 'model', 'vin', 'plate'];
  const field = name => form.elements.namedItem(name);
  const clean = value => String(value ?? '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const upper = value => clean(value).toLocaleUpperCase('es-ES');
  const compact = value => upper(value)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]/g, '');

  let tesseractPromise = null;
  let workerPromise = null;
  let pdfjsPromise = null;
  let running = false;
  let writing = false;
  let stage = 'base';

  function setBusy(value) {
    running = value;
    cameraButton.disabled = value;
    uploadButton.disabled = value;
    ui.classList.toggle('busy', value);
    progress.hidden = !value;
    if (!value) progressBar.style.width = '0%';
  }

  function setProgress(percent, text) {
    progress.hidden = false;
    progressCopy.textContent = text;
    progressBar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  }

  function setResult(message, type = '') {
    result.className = `vehicle-scan-result${type ? ` ${type}` : ''}`;
    result.textContent = message;
  }

  function clearVehicleIdentity() {
    writing = true;
    try {
      names.forEach(name => {
        const input = field(name);
        if (!input) return;
        input.value = '';
        delete input.dataset.ocrFilled;
        delete input.dataset.manualAfterOcr;
        input.dispatchEvent(new Event('input', { bubbles:true }));
        input.dispatchEvent(new Event('change', { bubbles:true }));
      });
    } finally {
      writing = false;
    }
  }

  function canonicalBrand(raw) {
    let value = upper(raw)
      .replace(/^(?:D\s*[.·,:;-]?\s*1|MARCA|BRAND)\s*[:;,.·\-–—]?\s*/i, '')
      .replace(/[^A-ZÁÉÍÓÚÜÑ0-9 .&+\-/]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (value.length < 2 || value.length > 40 || !/[A-ZÁÉÍÓÚÜÑ]{2}/.test(value)) return '';
    if (/OBSERV|DOCUMENT|MATR[IÍ]CULA|MODELO|BASTIDOR|COMBUSTIBLE|CILINDRADA|POTENCIA|FECHA|ITV/i.test(value)) return '';
    const canonical = window.TRASPASO_CANONICALIZE_MAKE?.(value);
    if (canonical) return canonical;
    const pieces = [value, ...value.split(/\s{2,}|[|:;]/)].map(clean).filter(Boolean);
    for (const piece of pieces) {
      const match = window.TRASPASO_CANONICALIZE_MAKE?.(piece);
      if (match) return match;
    }
    return value.length <= 24 ? value : '';
  }

  function knownBrandFromText(text) {
    const makes = window.TRASPASO_VEHICLE_MAKES_2026 || [];
    const lines = String(text || '').split(/\r?\n/).map(clean).filter(Boolean);
    for (const line of lines) {
      const canonical = window.TRASPASO_CANONICALIZE_MAKE?.(line);
      if (canonical) return canonical;
      const lineKey = compact(line);
      for (const make of makes) {
        const makeKey = compact(make);
        if (makeKey.length >= 3 && lineKey.includes(makeKey)) return make;
      }
    }
    return '';
  }

  function modelValue(raw) {
    const value = upper(raw)
      .replace(/^(?:D\s*[.·,:;-]?\s*3|DENOMINACI[ÓO]N\s+COMERCIAL|MODELO)\s*[:;,.·\-–—]?\s*/i, '')
      .replace(/[^A-Z0-9 .+\-_/]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (value.length < 2 || value.length > 55) return '';
    if (/^(?:OBSERVACIONES?|DOCUMENTO|PART[- ]?SIN|D[. ]?[1234]|C[. ]?4)$/i.test(value)) return '';
    return value;
  }

  function plateValue(raw) {
    const source = upper(raw).replace(/[^A-Z0-9-]/g, '');
    const modern = source.match(/\d{4}[BCDFGHJKLMNPRSTVWXYZ]{3}/);
    if (modern) return modern[0];
    const historic = source.match(/(?:GC|TF|M|B|V|SE|MA|BI|SS|Z|A|AL|AV|BA|BU|C|CA|CC|CO|CR|CS|CU|GE|GR|GU|H|HU|J|L|LE|LO|LU|MU|NA|O|OR|P|PM|PO|S|SA|SG|SO|T|TE|TO|VA|VI|ZA)\d{1,6}[A-Z]{0,2}/);
    return historic ? historic[0] : '';
  }

  function vinValue(raw) {
    const original = upper(raw)
      .replace(/[¥]/g, 'Y')
      .replace(/[^A-Z0-9]/g, '');
    if (!original || original.length < 17 || original.length > 24) return '';
    if (/OBSERV|DOCUMENT|FECHA|METRAJ|KILOMET|PROXIMA|ITV|VIGOR/.test(original)) return '';
    for (let i = 0; i <= original.length - 17; i += 1) {
      const piece = original.slice(i, i + 17);
      const candidate = piece.replace(/O/g, '0').replace(/I/g, '1').replace(/Q/g, '0');
      if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(candidate)) continue;
      const letters = (candidate.match(/[A-Z]/g) || []).length;
      const digits = (candidate.match(/\d/g) || []).length;
      if (letters < 3 || digits < 3) continue;
      return candidate;
    }
    return '';
  }

  function normalizeField(name, value) {
    if (name === 'brand') return canonicalBrand(value);
    if (name === 'model') return modelValue(value);
    if (name === 'vin') return vinValue(value) || upper(value).replace(/[^A-Z0-9]/g, '');
    if (name === 'plate') return plateValue(value) || upper(value).replace(/[^A-Z0-9-]/g, '');
    return upper(value);
  }

  names.forEach(name => {
    const input = field(name);
    if (!input) return;
    input.autocapitalize = 'characters';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.addEventListener('input', event => {
      if (writing || event.isComposing) return;
      if (name === 'brand' || name === 'model') input.value = upper(input.value);
      else input.value = upper(input.value).replace(/\s+/g, '');
    });
    input.addEventListener('blur', () => {
      const next = normalizeField(name, input.value);
      if (next) input.value = next;
    });
  });

  function loadTesseract() {
    if (window.Tesseract?.createWorker) return Promise.resolve(window.Tesseract);
    if (tesseractPromise) return tesseractPromise;
    tesseractPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[src*="tesseract.js@5"]');
      if (existing) {
        if (window.Tesseract?.createWorker) resolve(window.Tesseract);
        else {
          existing.addEventListener('load', () => resolve(window.Tesseract), { once:true });
          existing.addEventListener('error', reject, { once:true });
        }
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
      script.async = true;
      script.onload = () => resolve(window.Tesseract);
      script.onerror = () => reject(new Error('No se pudo cargar el lector.'));
      document.head.appendChild(script);
    });
    return tesseractPromise;
  }

  async function getWorker() {
    if (workerPromise) return workerPromise;
    workerPromise = loadTesseract().then(Tesseract => Tesseract.createWorker('spa', 1, {
      logger(message) {
        if (message.status === 'recognizing text') {
          const raw = Math.round((message.progress || 0) * 100);
          const maps = {
            base:[15,45,'Leyendo documento…'],
            enhanced:[62,16,'Mejorando lectura…'],
            focus:[80,17,'Leyendo campos…']
          };
          const [start, span, copy] = maps[stage] || maps.base;
          setProgress(start + Math.round(raw * span / 100), copy);
        } else if (/loading|initializing/i.test(message.status || '')) {
          setProgress(8, 'Preparando lector…');
        }
      }
    }));
    return workerPromise;
  }

  function resetWorker() {
    const current = workerPromise;
    workerPromise = null;
    if (current) Promise.resolve(current).then(worker => worker?.terminate?.()).catch(() => {});
  }

  function withTimeout(promise, ms) {
    let timer;
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          const error = new Error('OCR_TIMEOUT');
          error.code = 'OCR_TIMEOUT';
          reject(error);
        }, ms);
      })
    ]).finally(() => clearTimeout(timer));
  }

  async function loadPdfJs() {
    if (pdfjsPromise) return pdfjsPromise;
    pdfjsPromise = import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/legacy/build/pdf.mjs').then(pdfjs => {
      pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/legacy/build/pdf.worker.mjs';
      return pdfjs;
    });
    return pdfjsPromise;
  }

  async function pdfToCanvas(file) {
    setProgress(5, 'Abriendo PDF…');
    const pdfjs = await loadPdfJs();
    const bytes = new Uint8Array(await file.arrayBuffer());
    const pdf = await pdfjs.getDocument({ data:bytes }).promise;
    const page = await pdf.getPage(1);
    const base = page.getViewport({ scale:1 });
    const target = 3000;
    const scale = Math.max(2, Math.min(4, target / Math.max(base.width, base.height)));
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext('2d', { alpha:false, willReadFrequently:true });
    ctx.fillStyle = '#fff';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    await page.render({ canvasContext:ctx, viewport }).promise;
    try { await pdf.destroy(); } catch (_) {}
    return canvas;
  }

  async function imageToCanvas(file) {
    const url = URL.createObjectURL(file);
    try {
      const image = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
      });
      const maxSide = 3000;
      const longest = Math.max(image.naturalWidth, image.naturalHeight);
      const shortest = Math.min(image.naturalWidth, image.naturalHeight);
      let scale = Math.min(1, maxSide / longest);
      if (shortest < 1200) {
        scale = Math.min(maxSide / longest, Math.max(scale, Math.min(2.4, 1400 / Math.max(1, shortest))));
      }
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const ctx = canvas.getContext('2d', { alpha:false, willReadFrequently:true });
      ctx.fillStyle = '#fff';
      ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(image,0,0,canvas.width,canvas.height);
      return canvas;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function fileToCanvas(file) {
    if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '')) return pdfToCanvas(file);
    if (!file.type?.startsWith('image/')) throw new Error('UNSUPPORTED_FILE');
    return imageToCanvas(file);
  }

  function cropCanvas(source, x, y, w, h) {
    const sx = Math.max(0, Math.round(x));
    const sy = Math.max(0, Math.round(y));
    const sw = Math.max(1, Math.min(source.width - sx, Math.round(w)));
    const sh = Math.max(1, Math.min(source.height - sy, Math.round(h)));
    const out = document.createElement('canvas');
    out.width = sw;
    out.height = sh;
    const ctx = out.getContext('2d', { alpha:false, willReadFrequently:true });
    ctx.fillStyle = '#fff';
    ctx.fillRect(0,0,sw,sh);
    ctx.drawImage(source,sx,sy,sw,sh,0,0,sw,sh);
    return out;
  }

  function detectPermitBand(source) {
    const directRatio = source.width / source.height;
    if (directRatio >= 1.18 && directRatio <= 1.72) return source;
    const workWidth = Math.min(900, source.width);
    const scale = workWidth / source.width;
    const workHeight = Math.max(1, Math.round(source.height * scale));
    const work = document.createElement('canvas');
    work.width = workWidth;
    work.height = workHeight;
    const ctx = work.getContext('2d', { alpha:false, willReadFrequently:true });
    ctx.fillStyle = '#fff';
    ctx.fillRect(0,0,workWidth,workHeight);
    ctx.drawImage(source,0,0,workWidth,workHeight);
    const image = ctx.getImageData(0,0,workWidth,workHeight).data;
    const fractions = new Float32Array(workHeight);
    for (let y = 0; y < workHeight; y += 1) {
      let dark = 0;
      const row = y * workWidth * 4;
      for (let x = 0; x < workWidth; x += 1) {
        const i = row + x*4;
        const bright = Math.max(image[i], image[i+1], image[i+2]);
        if (bright < 235) dark += 1;
      }
      fractions[y] = dark / workWidth;
    }
    const candidate = [];
    for (let y = 0; y < workHeight; y += 1) {
      const f = fractions[y];
      if (f > .30 && f < .97) candidate.push(y);
    }
    if (!candidate.length) return source;
    const centers = [];
    let start = candidate[0];
    let prev = candidate[0];
    for (let i = 1; i < candidate.length; i += 1) {
      const y = candidate[i];
      if (y <= prev + 2) prev = y;
      else {
        centers.push(Math.round((start + prev) / 2));
        start = prev = y;
      }
    }
    centers.push(Math.round((start + prev) / 2));
    const minGap = Math.max(6, Math.round(workWidth * .015));
    const maxGap = Math.max(minGap + 1, Math.round(workWidth * .075));
    let best = [];
    for (let i = 0; i < centers.length; i += 1) {
      const seq = [centers[i]];
      for (let j = i + 1; j < centers.length; j += 1) {
        const gap = centers[j] - seq[seq.length - 1];
        if (gap < minGap) continue;
        if (gap > maxGap) break;
        seq.push(centers[j]);
      }
      if (seq.length > best.length) best = seq;
    }
    if (best.length < 6) return source;
    const gaps = [];
    for (let i = 1; i < best.length; i += 1) gaps.push(best[i] - best[i-1]);
    gaps.sort((a,b) => a-b);
    const median = gaps[Math.floor(gaps.length/2)] || Math.round(workWidth*.04);
    const y0w = Math.max(0, Math.round(best[0] - median*.55));
    const y1w = Math.min(workHeight, Math.round(best[best.length-1] + median*.85));
    const y0 = y0w / scale;
    const y1 = y1w / scale;
    const height = y1 - y0;
    const ratio = source.width / Math.max(1, height);
    if (ratio < 1.12 || ratio > 1.85 || height < source.width*.45) return source;
    return cropCanvas(source,0,y0,source.width,height);
  }

  function enhanceCanvas(source) {
    const out = document.createElement('canvas');
    out.width = source.width;
    out.height = source.height;
    const ctx = out.getContext('2d', { alpha:false, willReadFrequently:true });
    ctx.drawImage(source,0,0);
    const image = ctx.getImageData(0,0,out.width,out.height);
    const data = image.data;
    const histogram = new Uint32Array(256);
    for (let i = 0; i < data.length; i += 4) {
      const value = Math.max(data[i], data[i+1], data[i+2]);
      histogram[value] += 1;
      data[i] = data[i+1] = data[i+2] = value;
      data[i+3] = 255;
    }
    const total = out.width*out.height;
    let acc = 0, low = 0, high = 255;
    for (let i = 0; i < 256; i += 1) { acc += histogram[i]; if (acc >= total*.012) { low = i; break; } }
    acc = 0;
    for (let i = 0; i < 256; i += 1) { acc += histogram[i]; if (acc >= total*.988) { high = i; break; } }
    if (high-low < 45) { low = Math.max(0,low-20); high = Math.min(255,high+20); }
    const span = Math.max(1,high-low);
    for (let i = 0; i < data.length; i += 4) {
      let value = ((data[i]-low)*255)/span;
      value = (Math.max(0,Math.min(255,value))-128)*1.15+128;
      value = Math.max(0,Math.min(255,value));
      data[i] = data[i+1] = data[i+2] = value;
    }
    ctx.putImageData(image,0,0);
    return out;
  }

  function linesOf(text) {
    return String(text || '')
      .normalize('NFKC')
      .replace(/\r/g,'\n')
      .replace(/[|¦]/g,'I')
      .split(/\n+/)
      .map(line => line.replace(/[\t ]+/g,' ').trim())
      .filter(Boolean);
  }

  function valueAfterMarker(lines, marker) {
    const patterns = {
      A:/^\s*A\s*[:;,.·\-–—]?\s*(.*)$/i,
      E:/^\s*E\s*[:;,.·\-–—]?\s*(.*)$/i,
      D1:/^\s*[D0]\s*[.·,:;\-]?\s*[1IL]\s*[:;,.·\-–—]?\s*(.*)$/i,
      D3:/^\s*[D0]\s*[.·,:;\-]?\s*[3B]\s*[:;,.·\-–—]?\s*(.*)$/i
    };
    const pattern = patterns[marker];
    for (let i = 0; i < lines.length; i += 1) {
      const match = lines[i].match(pattern);
      if (!match) continue;
      const inline = clean(match[1] || '');
      if (inline) return inline;
      for (let j = 1; j <= 2; j += 1) {
        const next = clean(lines[i+j] || '');
        if (next && !/^[A-Z]\s*[.·]?\s*\d?\s*[:;,.·\-–—]?$/i.test(next)) return next;
      }
    }
    return '';
  }

  function parseText(text) {
    const lines = linesOf(text);
    let brand = canonicalBrand(valueAfterMarker(lines,'D1')) || knownBrandFromText(text);
    let model = modelValue(valueAfterMarker(lines,'D3'));
    if (!model) {
      for (const line of lines) {
        const match = line.match(/(?:DENOMINACI[ÓO]N\s+COMERCIAL|MODELO)\s*[:;,.·\-–—]?\s*(.+)$/i);
        if (match?.[1]) { model = modelValue(match[1]); if (model) break; }
      }
    }
    let plate = plateValue(valueAfterMarker(lines,'A'));
    if (!plate) {
      const source = upper(text).replace(/[_|]/g,' ');
      const modern = source.match(/\b\d{4}\s*[- ]?\s*[BCDFGHJKLMNPRSTVWXYZ]{3}\b/);
      if (modern) plate = modern[0].replace(/[\s-]+/g,'');
      if (!plate) {
        const old = source.match(/\b(?:GC|TF|M|B|V|SE|MA|BI|SS|Z|A|AL|AV|BA|BU|C|CA|CC|CO|CR|CS|CU|GE|GR|GU|H|HU|J|L|LE|LO|LU|MU|NA|O|OR|P|PM|PO|S|SA|SG|SO|T|TE|TO|VA|VI|ZA)\s*[- ]?\s*\d{1,6}\s*[- ]?\s*[A-Z]{0,2}\b/);
        if (old) plate = plateValue(old[0]);
      }
    }
    const vin = vinValue(valueAfterMarker(lines,'E'));
    return { brand, model, vin, plate };
  }

  function count(data) { return names.reduce((total,name) => total + (clean(data[name]) ? 1 : 0),0); }
  function merge(primary, secondary) {
    const out = {};
    names.forEach(name => { out[name] = clean(primary[name]) || clean(secondary[name]); });
    return out;
  }

  const FIELD_SPECS = {
    plate:{ x:.065, y:.018, w:.43, h:.095, whitelist:'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789- ', psm:'7' },
    vin:{ x:.555, y:.018, w:.43, h:.095, whitelist:'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ', psm:'7' },
    brand:{ x:.065, y:.700, w:.43, h:.100, whitelist:'ABCDEFGHIJKLMNOPQRSTUVWXYZÁÉÍÓÚÜÑ- ', psm:'7' },
    model:{ x:.065, y:.810, w:.43, h:.105, whitelist:'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.-_/ ', psm:'7' }
  };

  function fieldCanvas(source, spec, binary = false) {
    const sx = Math.round(source.width*spec.x);
    const sy = Math.round(source.height*spec.y);
    const sw = Math.max(1, Math.round(source.width*spec.w));
    const sh = Math.max(1, Math.round(source.height*spec.h));
    const targetWidth = 1600;
    const scale = Math.max(3, Math.min(7, targetWidth / Math.max(1,sw)));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1,Math.round(sw*scale));
    canvas.height = Math.max(1,Math.round(sh*scale));
    const ctx = canvas.getContext('2d', { alpha:false, willReadFrequently:true });
    ctx.fillStyle = '#fff';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source,sx,sy,sw,sh,0,0,canvas.width,canvas.height);
    const image = ctx.getImageData(0,0,canvas.width,canvas.height);
    const data = image.data;
    const gray = new Uint8ClampedArray(canvas.width*canvas.height);
    const histogram = new Uint32Array(256);
    for (let p = 0, j = 0; p < data.length; p += 4, j += 1) {
      const value = Math.max(data[p],data[p+1],data[p+2]);
      gray[j] = value;
      histogram[value] += 1;
    }
    const total = gray.length;
    let acc = 0, low = 0, high = 255;
    for (let i = 0; i < 256; i += 1) { acc += histogram[i]; if (acc >= total*.02) { low = i; break; } }
    acc = 0;
    for (let i = 0; i < 256; i += 1) { acc += histogram[i]; if (acc >= total*.98) { high = i; break; } }
    if (high-low < 40) { low = Math.max(0,low-20); high = Math.min(255,high+20); }
    const span = Math.max(1,high-low);
    const normalized = new Uint8ClampedArray(total);
    for (let i = 0; i < total; i += 1) normalized[i] = Math.max(0,Math.min(255,((gray[i]-low)*255)/span));
    const lineRows = new Uint8Array(canvas.height);
    for (let y = 0; y < canvas.height; y += 1) {
      let dark = 0;
      const start = y*canvas.width;
      for (let x = 0; x < canvas.width; x += 1) if (normalized[start+x] < 205) dark += 1;
      if (dark/canvas.width > .68) lineRows[y] = 1;
    }
    for (let y = 0; y < canvas.height; y += 1) {
      if (!lineRows[y]) continue;
      for (let yy = Math.max(0,y-2); yy <= Math.min(canvas.height-1,y+2); yy += 1) {
        const start = yy*canvas.width;
        normalized.fill(255,start,start+canvas.width);
      }
    }
    for (let p = 0, j = 0; p < data.length; p += 4, j += 1) {
      let value = normalized[j];
      if (binary) value = value < 178 ? 0 : 255;
      data[p] = data[p+1] = data[p+2] = value;
      data[p+3] = 255;
    }
    ctx.putImageData(image,0,0);
    return canvas;
  }

  function validateFocused(name, raw) {
    if (name === 'brand') return canonicalBrand(raw);
    if (name === 'model') return modelValue(raw);
    if (name === 'vin') return vinValue(raw);
    if (name === 'plate') return plateValue(raw);
    return '';
  }

  async function recognize(worker, canvas, psm, timeout, whitelist = '') {
    try { await worker.setParameters({ tessedit_pageseg_mode:String(psm), preserve_interword_spaces:'1', tessedit_char_whitelist:whitelist }); } catch (_) {}
    return withTimeout(worker.recognize(canvas),timeout);
  }

  async function readFocusedField(worker, permit, name) {
    const spec = FIELD_SPECS[name];
    if (!spec) return '';
    for (const binary of [false,true]) {
      const canvas = fieldCanvas(permit,spec,binary);
      try {
        const response = await recognize(worker,canvas,spec.psm,binary ? 6500 : 8000,spec.whitelist);
        const raw = clean(response?.data?.text || '');
        const value = validateFocused(name,raw);
        if (value) return value;
        if (name === 'brand') {
          const known = knownBrandFromText(raw);
          if (known) return known;
        }
      } catch (error) {
        if (error?.code === 'OCR_TIMEOUT') break;
      }
    }
    return '';
  }

  function fill(data) {
    writing = true;
    try {
      names.forEach(name => {
        const input = field(name);
        if (!input) return;
        const value = validateFocused(name,data[name] || '');
        input.value = value;
        if (value) input.dataset.ocrFilled = '1';
        else delete input.dataset.ocrFilled;
        input.dispatchEvent(new Event('input',{bubbles:true}));
        input.dispatchEvent(new Event('change',{bubbles:true}));
      });
    } finally { writing = false; }
  }

  async function process(file) {
    if (!file || running) return;
    const supported = file.type?.startsWith('image/') || file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
    if (!supported) { setResult('Selecciona una foto o un PDF.','error'); return; }
    clearVehicleIdentity();
    setBusy(true);
    setResult('');
    setProgress(3,'Preparando documento…');
    try {
      const source = await fileToCanvas(file);
      const permit = detectPermitBand(source);
      if (permit !== source) setProgress(11,'Ajustando documento…');
      const worker = await getWorker();
      stage = 'base';
      const first = await recognize(worker,permit,11,22000,'');
      let detected = parseText(first?.data?.text || '');
      if (count(detected) < 4) {
        stage = 'enhanced';
        setProgress(62,'Mejorando lectura…');
        try {
          const enhanced = enhanceCanvas(permit);
          const second = await recognize(worker,enhanced,11,13000,'');
          detected = merge(detected,parseText(second?.data?.text || ''));
        } catch (error) { if (error?.code === 'OCR_TIMEOUT') resetWorker(); }
      }
      const ratio = permit.width / permit.height;
      if (count(detected) < 4 && ratio >= 1.18 && ratio <= 1.75) {
        stage = 'focus';
        const missing = names.filter(name => !clean(detected[name]));
        let done = 0;
        for (const name of missing) {
          done += 1;
          setProgress(80 + Math.round(done*16/Math.max(1,missing.length)), `Leyendo ${name === 'brand' ? 'marca' : name === 'model' ? 'modelo' : name === 'vin' ? 'bastidor' : 'matrícula'}…`);
          const value = await readFocusedField(worker,permit,name);
          if (value) detected[name] = value;
        }
      }
      fill(detected);
      const found = names.reduce((total,name) => total + (clean(field(name)?.value) ? 1 : 0),0);
      setProgress(100,'Listo');
      if (found === 4) setResult('4 datos identificados.','success');
      else if (found > 0) setResult(`${found} de 4 datos identificados. Revisa los que faltan.`,'success');
      else setResult('No he podido identificar los datos. Prueba con el permiso completo o carga el PDF original.','error');
    } catch (error) {
      console.error('OCR de vehículo · calidad',error);
      if (error?.code === 'OCR_TIMEOUT') { resetWorker(); setResult('La lectura ha tardado demasiado. Puedes volver a intentarlo.','error'); }
      else if (error?.message === 'UNSUPPORTED_FILE') setResult('Selecciona una foto o un PDF.','error');
      else setResult('No se ha podido leer el documento. Inténtalo de nuevo o completa los datos manualmente.','error');
    } finally {
      stage = 'base';
      setBusy(false);
    }
  }

  function intercept(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.stopImmediatePropagation();
    process(file).finally(() => { event.target.value = ''; });
  }

  cameraInput.addEventListener('change',intercept,{capture:true});
  uploadInput.addEventListener('change',intercept,{capture:true});
  window.addEventListener('beforeunload',()=>resetWorker());
})();