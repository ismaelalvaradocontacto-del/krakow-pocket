(() => {
  const form = document.getElementById('vehicleForm');
  const ui = document.querySelector('.vehicle-scan');
  if (!form || !ui || ui.dataset.paddleOcr === '1') return;
  ui.dataset.paddleOcr = '1';

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

  let paddleModulePromise = null;
  let paddlePromise = null;
  let pdfjsPromise = null;
  let tesseractPromise = null;
  let tesseractWorkerPromise = null;
  let running = false;
  let writing = false;

  const PADDLE_URLS = [
    'https://cdn.jsdelivr.net/npm/@paddleocr/paddleocr-js@0.4.2/+esm',
    'https://esm.sh/@paddleocr/paddleocr-js@0.4.2?bundle'
  ];

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

  function canonicalBrand(raw) {
    const value = upper(raw)
      .replace(/^(?:D\s*[.·,:;-]?\s*1|MARCA|BRAND)\s*[:;,.·\-–—]?\s*/i, '')
      .replace(/[^A-ZÁÉÍÓÚÜÑ0-9 .&+\-/]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (value.length < 2 || value.length > 40 || !/[A-ZÁÉÍÓÚÜÑ]{2}/.test(value)) return '';
    if (/OBSERV|DOCUMENT|MATR[IÍ]CULA|MODELO|BASTIDOR|COMBUSTIBLE|CILINDRADA|POTENCIA|FECHA|ITV/i.test(value)) return '';
    return window.TRASPASO_CANONICALIZE_MAKE?.(value) || value;
  }

  function knownBrand(raw) {
    const direct = window.TRASPASO_CANONICALIZE_MAKE?.(raw);
    if (direct) return direct;
    const source = compact(raw);
    if (!source) return '';
    for (const make of window.TRASPASO_VEHICLE_MAKES_2026 || []) {
      const key = compact(make);
      if (key.length >= 3 && source.includes(key)) return make;
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
    const source = upper(raw).replace(/[|_]/g, ' ');
    const modern = source.match(/\b\d{4}\s*[- ]?\s*[BCDFGHJKLMNPRSTVWXYZ]{3}\b/);
    if (modern) return modern[0].replace(/[\s-]+/g, '');
    const compactSource = source.replace(/[^A-Z0-9]/g, '');
    const old = compactSource.match(/(?:GC|TF|M|B|V|SE|MA|BI|SS|Z|A|AL|AV|BA|BU|C|CA|CC|CO|CR|CS|CU|GE|GR|GU|H|HU|J|L|LE|LO|LU|MU|NA|O|OR|P|PM|PO|S|SA|SG|SO|T|TE|TO|VA|VI|ZA)\d{1,6}[A-Z]{0,2}/);
    return old ? old[0] : '';
  }

  function vinValue(raw) {
    const original = upper(raw).replace(/[¥]/g, 'Y').replace(/[^A-Z0-9]/g, '');
    if (original.length < 17 || original.length > 30) return '';
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
      input.dataset.manualAfterOcr = '1';
      input.value = name === 'brand' || name === 'model'
        ? upper(input.value)
        : upper(input.value).replace(/\s+/g, '');
    });
    input.addEventListener('blur', () => {
      const next = normalizeField(name, input.value);
      if (next) input.value = next;
    });
  });

  function clearPreviousOcr() {
    writing = true;
    try {
      names.forEach(name => {
        const input = field(name);
        if (!input || input.dataset.manualAfterOcr === '1') return;
        input.value = '';
        delete input.dataset.ocrFilled;
        input.dispatchEvent(new Event('input', { bubbles:true }));
        input.dispatchEvent(new Event('change', { bubbles:true }));
      });
    } finally {
      writing = false;
    }
  }

  async function loadPaddleModule() {
    if (paddleModulePromise) return paddleModulePromise;
    paddleModulePromise = (async () => {
      let lastError;
      for (const url of PADDLE_URLS) {
        try {
          const mod = await import(url);
          if (mod?.PaddleOCR) return mod;
        } catch (error) {
          lastError = error;
        }
      }
      throw lastError || new Error('PADDLE_MODULE_UNAVAILABLE');
    })();
    return paddleModulePromise;
  }

  async function getPaddle() {
    if (paddlePromise) return paddlePromise;
    paddlePromise = (async () => {
      setProgress(7, 'Preparando OCR avanzado…');
      const { PaddleOCR } = await loadPaddleModule();
      return PaddleOCR.create({
        lang: 'es',
        ocrVersion: 'PP-OCRv5',
        ortOptions: {
          backend: 'auto',
          wasmPaths: 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/',
          numThreads: 1,
          simd: true
        }
      });
    })().catch(error => {
      paddlePromise = null;
      throw error;
    });
    return paddlePromise;
  }

  async function loadPdfJs() {
    if (pdfjsPromise) return pdfjsPromise;
    pdfjsPromise = import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/legacy/build/pdf.mjs').then(pdfjs => {
      pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/legacy/build/pdf.worker.mjs';
      return pdfjs;
    });
    return pdfjsPromise;
  }

  async function pdfToCanvasAndText(file) {
    setProgress(5, 'Abriendo PDF…');
    const pdfjs = await loadPdfJs();
    const bytes = new Uint8Array(await file.arrayBuffer());
    const pdf = await pdfjs.getDocument({ data:bytes }).promise;
    const page = await pdf.getPage(1);
    const content = await page.getTextContent().catch(() => ({ items:[] }));
    const pdfItems = (content.items || []).map(item => {
      const x = Number(item.transform?.[4] || 0);
      const y = Number(item.transform?.[5] || 0);
      const w = Math.max(1, Number(item.width || 1));
      const h = Math.max(1, Math.abs(Number(item.height || item.transform?.[3] || 10)));
      return { text:item.str || '', score:1, poly:[[x,y],[x+w,y],[x+w,y+h],[x,y+h]] };
    });
    const base = page.getViewport({ scale:1 });
    const scale = Math.max(2.2, Math.min(4.2, 3200 / Math.max(base.width, base.height)));
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext('2d', { alpha:false, willReadFrequently:true });
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext:ctx, viewport }).promise;
    try { await pdf.destroy(); } catch (_) {}
    return { canvas, pdfItems };
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
      const maxSide = 3400;
      const longest = Math.max(image.naturalWidth, image.naturalHeight);
      const shortest = Math.min(image.naturalWidth, image.naturalHeight);
      let scale = Math.min(1, maxSide / longest);
      if (shortest < 1300) scale = Math.min(maxSide / longest, Math.max(scale, Math.min(2.5, 1500 / Math.max(1, shortest))));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const ctx = canvas.getContext('2d', { alpha:false, willReadFrequently:true });
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      return canvas;
    } finally {
      URL.revokeObjectURL(url);
    }
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
    ctx.fillRect(0, 0, sw, sh);
    ctx.drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh);
    return out;
  }

  function enhancedCanvas(source) {
    const out = document.createElement('canvas');
    out.width = source.width;
    out.height = source.height;
    const ctx = out.getContext('2d', { alpha:false, willReadFrequently:true });
    ctx.drawImage(source, 0, 0);
    const image = ctx.getImageData(0, 0, out.width, out.height);
    const data = image.data;
    const hist = new Uint32Array(256);
    for (let i = 0; i < data.length; i += 4) {
      const lum = Math.round(.299 * data[i] + .587 * data[i+1] + .114 * data[i+2]);
      hist[lum] += 1;
    }
    const total = out.width * out.height;
    let acc = 0, lo = 0, hi = 255;
    for (let i = 0; i < 256; i += 1) { acc += hist[i]; if (acc >= total * .01) { lo = i; break; } }
    acc = 0;
    for (let i = 0; i < 256; i += 1) { acc += hist[i]; if (acc >= total * .99) { hi = i; break; } }
    const span = Math.max(35, hi - lo);
    for (let i = 0; i < data.length; i += 4) {
      const lum = .299 * data[i] + .587 * data[i+1] + .114 * data[i+2];
      let v = ((lum - lo) * 255) / span;
      v = Math.max(0, Math.min(255, (v - 128) * 1.16 + 128));
      data[i] = data[i+1] = data[i+2] = v;
      data[i+3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    return out;
  }

  function densePermitCrop(source) {
    const ratio = source.width / source.height;
    if (ratio >= 1.15 && ratio <= 1.78) return null;
    if (source.height < source.width * 1.15) return null;

    const workW = Math.min(520, source.width);
    const scale = workW / source.width;
    const workH = Math.max(1, Math.round(source.height * scale));
    const work = document.createElement('canvas');
    work.width = workW;
    work.height = workH;
    const ctx = work.getContext('2d', { alpha:false, willReadFrequently:true });
    ctx.drawImage(source, 0, 0, workW, workH);
    const image = ctx.getImageData(0, 0, workW, workH).data;
    const rowScore = new Float32Array(workH);
    for (let y = 1; y < workH; y += 1) {
      let score = 0;
      for (let x = 1; x < workW; x += 2) {
        const i = (y * workW + x) * 4;
        const p = .299*image[i] + .587*image[i+1] + .114*image[i+2];
        const j = (y * workW + x - 1) * 4;
        const q = .299*image[j] + .587*image[j+1] + .114*image[j+2];
        if (Math.abs(p - q) > 24) score += 1;
        if (p < 185) score += .12;
      }
      rowScore[y] = score;
    }
    const prefix = new Float64Array(workH + 1);
    for (let y = 0; y < workH; y += 1) prefix[y+1] = prefix[y] + rowScore[y];

    let best = null;
    for (const r of [1.22,1.34,1.46,1.58,1.7]) {
      const h = Math.round(workW / r);
      if (h >= workH) continue;
      const step = Math.max(4, Math.round(h * .045));
      for (let y = 0; y + h <= workH; y += step) {
        const score = (prefix[y+h] - prefix[y]) / h;
        if (!best || score > best.score) best = { y, h, score };
      }
    }
    if (!best) return null;
    const sy = Math.max(0, (best.y / scale) - source.width * .025);
    const sh = Math.min(source.height - sy, (best.h / scale) + source.width * .05);
    const candidate = cropCanvas(source, 0, sy, source.width, sh);
    const candidateRatio = candidate.width / candidate.height;
    return candidateRatio >= 1.05 && candidateRatio <= 1.9 ? candidate : null;
  }

  function boxOf(item) {
    const points = Array.isArray(item?.poly) ? item.poly : [];
    const xs = points.map(p => Number(p?.[0])).filter(Number.isFinite);
    const ys = points.map(p => Number(p?.[1])).filter(Number.isFinite);
    const x0 = xs.length ? Math.min(...xs) : 0;
    const x1 = xs.length ? Math.max(...xs) : x0 + 1;
    const y0 = ys.length ? Math.min(...ys) : 0;
    const y1 = ys.length ? Math.max(...ys) : y0 + 1;
    return { x0, x1, y0, y1, w:Math.max(1,x1-x0), h:Math.max(1,y1-y0), cx:(x0+x1)/2, cy:(y0+y1)/2 };
  }

  function normalizedItems(rawItems) {
    return (rawItems || [])
      .map(item => ({ text:clean(item?.text), score:Number(item?.score ?? 1), box:boxOf(item), raw:item }))
      .filter(item => item.text && item.score >= .28);
  }

  function markerKey(raw) {
    const key = compact(raw);
    if (key === 'A' || key === '4') return 'A';
    if (key === 'E') return 'E';
    if (/^D[1IL]$/.test(key)) return 'D1';
    if (/^D[3B]$/.test(key)) return 'D3';
    return '';
  }

  function inlineCode(raw, code) {
    const patterns = {
      A:/^\s*A\s*[:;,.·\-–—]?\s*(.+)$/i,
      E:/^\s*E\s*[:;,.·\-–—]?\s*(.+)$/i,
      D1:/^\s*D\s*[.·,:;\-]?\s*[1IL]\s*[:;,.·\-–—]?\s*(.+)$/i,
      D3:/^\s*D\s*[.·,:;\-]?\s*[3B]\s*[:;,.·\-–—]?\s*(.+)$/i
    };
    const match = String(raw || '').match(patterns[code]);
    return clean(match?.[1] || '');
  }

  function neighborRight(items, marker, validator) {
    const mb = marker.box;
    const candidates = items.filter(item => {
      if (item === marker) return false;
      const b = item.box;
      const vertical = Math.abs(b.cy - mb.cy);
      const tolerance = Math.max(mb.h, b.h) * 1.15 + 8;
      return b.x0 >= mb.x1 - 12 && vertical <= tolerance;
    }).sort((a,b) => (a.box.x0 - b.box.x0) || (Math.abs(a.box.cy-mb.cy) - Math.abs(b.box.cy-mb.cy)));
    for (const item of candidates) {
      const value = validator(item.text);
      if (value) return { value, score:(marker.score + item.score) / 2 + .12 };
    }
    return null;
  }

  function candidate(value = '', score = 0, source = '') {
    return { value:clean(value), score:Number(score || 0), source };
  }

  function better(a, b) {
    if (!a?.value) return b;
    if (!b?.value) return a;
    if (b.score > a.score + .03) return b;
    if (b.value.length > a.value.length + 3 && b.score >= a.score - .04) return b;
    return a;
  }

  function parseItems(rawItems) {
    const items = normalizedItems(rawItems);
    const out = {
      brand:candidate(), model:candidate(), vin:candidate(), plate:candidate()
    };

    for (const item of items) {
      const plate = plateValue(item.text);
      if (plate) out.plate = better(out.plate, candidate(plate, item.score + .18, 'pattern'));
      const vin = vinValue(item.text);
      if (vin) out.vin = better(out.vin, candidate(vin, item.score + .2, 'pattern'));
      const make = knownBrand(item.text);
      if (make) out.brand = better(out.brand, candidate(make, item.score + .12, 'catalog'));

      for (const code of ['A','E','D1','D3']) {
        const inline = inlineCode(item.text, code);
        if (!inline) continue;
        if (code === 'A') {
          const v = plateValue(inline); if (v) out.plate = better(out.plate, candidate(v,item.score+.3,'A'));
        } else if (code === 'E') {
          const v = vinValue(inline); if (v) out.vin = better(out.vin, candidate(v,item.score+.32,'E'));
        } else if (code === 'D1') {
          const v = canonicalBrand(inline); if (v) out.brand = better(out.brand, candidate(v,item.score+.28,'D1'));
        } else if (code === 'D3') {
          const v = modelValue(inline); if (v) out.model = better(out.model, candidate(v,item.score+.28,'D3'));
        }
      }
    }

    for (const item of items) {
      const code = markerKey(item.text);
      if (!code) continue;
      if (code === 'A') {
        const found = neighborRight(items,item,plateValue);
        if (found) out.plate = better(out.plate,candidate(found.value,found.score+.18,'A-neighbor'));
      } else if (code === 'E') {
        const found = neighborRight(items,item,vinValue);
        if (found) out.vin = better(out.vin,candidate(found.value,found.score+.2,'E-neighbor'));
      } else if (code === 'D1') {
        const found = neighborRight(items,item,canonicalBrand);
        if (found) out.brand = better(out.brand,candidate(found.value,found.score+.16,'D1-neighbor'));
      } else if (code === 'D3') {
        const found = neighborRight(items,item,modelValue);
        if (found) out.model = better(out.model,candidate(found.value,found.score+.16,'D3-neighbor'));
      }
    }

    return out;
  }

  function parseLooseText(text) {
    const lines = String(text || '').replace(/\r/g,'\n').split(/\n+/).map(clean).filter(Boolean);
    const out = { brand:candidate(), model:candidate(), vin:candidate(), plate:candidate() };
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      const plate = plateValue(line); if (plate) out.plate = better(out.plate,candidate(plate,.72,'text'));
      const vin = vinValue(line); if (vin) out.vin = better(out.vin,candidate(vin,.74,'text'));
      const make = knownBrand(line); if (make) out.brand = better(out.brand,candidate(make,.68,'text'));
      const key = markerKey(line);
      const next = clean(lines[i+1] || '');
      if (key === 'D1' && next) { const v = canonicalBrand(next); if (v) out.brand = better(out.brand,candidate(v,.78,'D1-text')); }
      if (key === 'D3' && next) { const v = modelValue(next); if (v) out.model = better(out.model,candidate(v,.78,'D3-text')); }
      if (key === 'E' && next) { const v = vinValue(next); if (v) out.vin = better(out.vin,candidate(v,.84,'E-text')); }
      if (key === 'A' && next) { const v = plateValue(next); if (v) out.plate = better(out.plate,candidate(v,.84,'A-text')); }
      const d1 = inlineCode(line,'D1'); if (d1) { const v = canonicalBrand(d1); if (v) out.brand = better(out.brand,candidate(v,.84,'D1-inline')); }
      const d3 = inlineCode(line,'D3'); if (d3) { const v = modelValue(d3); if (v) out.model = better(out.model,candidate(v,.84,'D3-inline')); }
      const e = inlineCode(line,'E'); if (e) { const v = vinValue(e); if (v) out.vin = better(out.vin,candidate(v,.88,'E-inline')); }
      const a = inlineCode(line,'A'); if (a) { const v = plateValue(a); if (v) out.plate = better(out.plate,candidate(v,.88,'A-inline')); }
    }
    return out;
  }

  function mergeData(base, extra) {
    const out = {};
    names.forEach(name => { out[name] = better(base?.[name] || candidate(), extra?.[name] || candidate()); });
    return out;
  }

  function countData(data) {
    return names.reduce((n,name) => n + (data?.[name]?.value ? 1 : 0), 0);
  }

  async function paddleRead(canvas, pass = 1) {
    const paddle = await getPaddle();
    setProgress(pass === 1 ? 24 : 68, pass === 1 ? 'Leyendo con OCR avanzado…' : 'Afinando lectura…');
    const [ocrResult] = await paddle.predict(canvas, {
      textDetLimitSideLen: 2200,
      textDetLimitType: 'max',
      textDetMaxSideLimit: 3600,
      textDetThresh: .25,
      textDetBoxThresh: .42,
      textDetUnclipRatio: 1.7,
      textRecScoreThresh: .28
    });
    return parseItems(ocrResult?.items || []);
  }

  async function loadTesseract() {
    if (window.Tesseract?.createWorker) return window.Tesseract;
    if (tesseractPromise) return tesseractPromise;
    tesseractPromise = new Promise((resolve,reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
      script.async = true;
      script.onload = () => resolve(window.Tesseract);
      script.onerror = reject;
      document.head.appendChild(script);
    });
    return tesseractPromise;
  }

  async function tesseractFallback(canvas) {
    setProgress(72, 'Usando lector de respaldo…');
    const Tesseract = await loadTesseract();
    if (!tesseractWorkerPromise) tesseractWorkerPromise = Tesseract.createWorker('spa');
    const worker = await tesseractWorkerPromise;
    try { await worker.setParameters({ tessedit_pageseg_mode:'11', preserve_interword_spaces:'1' }); } catch (_) {}
    const { data } = await worker.recognize(canvas);
    return parseLooseText(data?.text || '');
  }

  function fillData(data) {
    let filled = 0;
    writing = true;
    try {
      names.forEach(name => {
        const input = field(name);
        if (!input || input.dataset.manualAfterOcr === '1') return;
        const value = normalizeField(name, data?.[name]?.value || '');
        input.value = value || '';
        if (value) {
          input.dataset.ocrFilled = '1';
          filled += 1;
        } else {
          delete input.dataset.ocrFilled;
        }
        input.dispatchEvent(new Event('input', { bubbles:true }));
        input.dispatchEvent(new Event('change', { bubbles:true }));
      });
    } finally {
      writing = false;
    }
    return filled;
  }

  async function processFile(file) {
    if (!file || running) return;
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
    if (!isPdf && !file.type?.startsWith('image/')) {
      setResult('Selecciona una foto o un PDF.', 'error');
      return;
    }

    setBusy(true);
    setResult('');
    setProgress(3, 'Preparando documento…');
    clearPreviousOcr();

    try {
      let canvas;
      let detected = { brand:candidate(), model:candidate(), vin:candidate(), plate:candidate() };

      if (isPdf) {
        const pdfData = await pdfToCanvasAndText(file);
        canvas = pdfData.canvas;
        if (pdfData.pdfItems.length) detected = mergeData(detected, parseItems(pdfData.pdfItems));
      } else {
        canvas = await imageToCanvas(file);
      }

      if (countData(detected) < 4) {
        try {
          detected = mergeData(detected, await paddleRead(canvas,1));
        } catch (paddleError) {
          console.warn('PaddleOCR no disponible; usando respaldo', paddleError);
          detected = mergeData(detected, await tesseractFallback(canvas));
        }
      }

      if (countData(detected) < 4) {
        const crop = densePermitCrop(canvas);
        const source = crop || canvas;
        const enhanced = enhancedCanvas(source);
        try {
          detected = mergeData(detected, await paddleRead(enhanced,2));
        } catch (paddleError) {
          console.warn('Segunda pasada PaddleOCR no disponible', paddleError);
        }
      }

      setProgress(96, 'Validando datos…');
      const filled = fillData(detected);
      setProgress(100, 'Listo');
      if (filled === 4) setResult('4 de 4 datos identificados.', 'success');
      else if (filled > 0) setResult(`${filled} de 4 datos identificados. Revisa los que faltan.`, 'success');
      else setResult('No he podido identificar datos con suficiente seguridad. Completa los campos manualmente.', 'error');
    } catch (error) {
      console.error('OCR avanzado de vehículo', error);
      setResult('No se ha podido leer el documento. Inténtalo de nuevo o completa los datos manualmente.', 'error');
    } finally {
      setBusy(false);
    }
  }

  function intercept(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.stopImmediatePropagation();
    processFile(file).finally(() => { event.target.value = ''; });
  }

  cameraInput.addEventListener('change', intercept, true);
  uploadInput.addEventListener('change', intercept, true);

  window.addEventListener('beforeunload', async () => {
    try { (await paddlePromise)?.dispose?.(); } catch (_) {}
    try { (await tesseractWorkerPromise)?.terminate?.(); } catch (_) {}
  });
})();