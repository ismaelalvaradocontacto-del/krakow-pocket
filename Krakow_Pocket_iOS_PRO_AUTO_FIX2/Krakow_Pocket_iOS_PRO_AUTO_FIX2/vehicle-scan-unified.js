(() => {
  const form = document.getElementById('vehicleForm');
  const ui = document.querySelector('.vehicle-scan');
  if (!form || !ui || ui.dataset.unifiedOcr === '5') return;
  ui.dataset.unifiedOcr = '5';

  const cameraInput = ui.querySelector('.scan-input-camera');
  const uploadInput = ui.querySelector('.scan-input-upload');
  const cameraButton = ui.querySelector('.scan-camera');
  const uploadButton = ui.querySelector('.scan-upload');
  const progress = ui.querySelector('.vehicle-scan-progress');
  const progressCopy = ui.querySelector('.vehicle-scan-progress-copy');
  const progressBar = ui.querySelector('.vehicle-scan-progress-track i');
  const result = ui.querySelector('.vehicle-scan-result');
  if (!cameraInput || !uploadInput || !cameraButton || !uploadButton || !progress || !progressCopy || !progressBar || !result) return;

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
  let running = false;
  let writing = false;
  let stage = 'base';

  function canonicalBrand(value) {
    const raw = upper(value)
      .replace(/^(?:MARCA|BRAND)\s*[:;,.·\-–—]?\s*/i, '')
      .replace(/[^A-ZÁÉÍÓÚÜÑ0-9 .&+\-/]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (raw.length < 2 || raw.length > 40 || !/[A-ZÁÉÍÓÚÜÑ]{2}/.test(raw)) return '';
    if (/OBSERV|DOCUMENT|MATR[IÍ]CULA|MODELO|BASTIDOR|COMBUSTIBLE|CILINDRADA|POTENCIA/i.test(raw)) return '';
    return window.TRASPASO_CANONICALIZE_MAKE?.(raw) || raw;
  }

  function modelValue(value) {
    const raw = upper(value)
      .replace(/^(?:MODELO|DENOMINACI[ÓO]N\s+COMERCIAL)\s*[:;,.·\-–—]?\s*/i, '')
      .replace(/[^A-Z0-9 .+\-_/]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (raw.length < 2 || raw.length > 55) return '';
    if (/^(?:OBSERVACIONES?|DOCUMENTO|PART[- ]?SIN|D[. ]?[1234]|C[. ]?4)$/i.test(raw)) return '';
    return raw;
  }

  function plateValue(value) {
    const raw = upper(value).replace(/[^A-Z0-9-]/g, '');
    const modern = raw.match(/\d{4}[BCDFGHJKLMNPRSTVWXYZ]{3}/);
    if (modern) return modern[0];
    const historic = raw.match(/^(?:GC|TF|M|B|V|SE|MA|BI|SS|Z|A|AL|AV|BA|BU|C|CA|CC|CO|CR|CS|CU|GE|GR|GU|H|HU|J|L|LE|LO|LU|MU|NA|O|OR|P|PM|PO|S|SA|SG|SO|T|TE|TO|VA|VI|ZA)\d{1,6}[A-Z]{0,2}$/);
    return historic ? historic[0] : '';
  }

  function vinValue(value) {
    const original = upper(value);
    if (!original || /OBSERV|DOCUMENT|FECHA|METRAJ|KILOMET|PR[ÓO]XIMA|ITV|VIGOR/i.test(original)) return '';

    const raw = original.replace(/[^A-Z0-9]/g, '');
    if (raw.length < 17 || raw.length > 24) return '';

    for (let i = 0; i <= raw.length - 17; i += 1) {
      const piece = raw.slice(i, i + 17);
      // Un VIN real mezcla letras y números. Esta regla evita aceptar frases
      // de 17 caracteres (p.ej. OBSERVACIONES) como bastidor.
      const letters = (piece.match(/[A-Z]/g) || []).length;
      const digits = (piece.match(/\d/g) || []).length;
      if (letters < 3 || digits < 3) continue;

      const candidate = piece.replace(/O/g, '0').replace(/I/g, '1').replace(/Q/g, '0');
      if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(candidate)) continue;
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

  [0, 120, 500].forEach(delay => setTimeout(() => {
    names.forEach(name => {
      const input = field(name);
      if (!input?.value) return;
      if (name === 'brand' || name === 'model') input.value = upper(input.value);
      else input.value = upper(input.value).replace(/\s+/g, '');
    });
  }, delay));

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
            base:[12,48,'Leyendo documento…'],
            enhanced:[62,22,'Mejorando lectura…'],
            focus:[86,11,'Completando campos…'],
            rotated:[86,11,'Comprobando orientación…']
          };
          const [start, span, copy] = maps[stage] || maps.base;
          setProgress(start + Math.round(raw * span / 100), copy);
        } else if (/loading|initializing/i.test(message.status || '')) {
          setProgress(7, 'Preparando lector…');
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

  async function fileToCanvas(file) {
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
      if (shortest < 1100) scale = Math.min(maxSide / longest, Math.max(scale, Math.min(2.2, 1400 / Math.max(1, shortest))));
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

  function enhanceCanvas(source) {
    const out = document.createElement('canvas');
    out.width = source.width;
    out.height = source.height;
    const ctx = out.getContext('2d', { alpha:false, willReadFrequently:true });
    ctx.drawImage(source, 0, 0);
    const image = ctx.getImageData(0, 0, out.width, out.height);
    const data = image.data;
    const histogram = new Uint32Array(256);
    for (let i = 0; i < data.length; i += 4) {
      const lum = Math.round(.299*data[i] + .587*data[i+1] + .114*data[i+2]);
      histogram[lum] += 1;
    }
    const total = out.width * out.height;
    let acc = 0, low = 0, high = 255;
    for (let i = 0; i < 256; i += 1) { acc += histogram[i]; if (acc >= total*.012) { low = i; break; } }
    acc = 0;
    for (let i = 0; i < 256; i += 1) { acc += histogram[i]; if (acc >= total*.988) { high = i; break; } }
    if (high - low < 50) { low = Math.max(0, low-25); high = Math.min(255, high+25); }
    const span = Math.max(1, high-low);
    for (let i = 0; i < data.length; i += 4) {
      const lum = .299*data[i] + .587*data[i+1] + .114*data[i+2];
      let value = ((lum-low)*255)/span;
      value = (Math.max(0, Math.min(255, value))-128)*1.22+128;
      value = Math.max(0, Math.min(255, value));
      data[i] = data[i+1] = data[i+2] = value;
      data[i+3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    return out;
  }

  function rotateCanvas(source) {
    const out = document.createElement('canvas');
    out.width = source.height;
    out.height = source.width;
    const ctx = out.getContext('2d', { alpha:false });
    ctx.fillStyle = '#fff';
    ctx.fillRect(0,0,out.width,out.height);
    ctx.translate(out.width/2,out.height/2);
    ctx.rotate(Math.PI/2);
    ctx.drawImage(source,-source.width/2,-source.height/2);
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

  function sameLineValue(lines, codeRegex, validator) {
    for (const line of lines) {
      const match = line.match(codeRegex);
      if (!match) continue;
      const value = validator(match[1] || '');
      if (value) return value;
    }
    return '';
  }

  function parseText(text) {
    const lines = linesOf(text);
    const data = {
      plate: sameLineValue(lines, /^\s*A\s*[:;,.·\-–—]?\s*(.+)$/i, plateValue),
      vin: sameLineValue(lines, /^\s*E\s*[:;,.·\-–—]?\s*(.+)$/i, vinValue),
      brand: sameLineValue(lines, /^\s*[D0]\s*[.·,:;\-]?\s*[1IL]\s*[:;,.·\-–—]?\s*(.+)$/i, canonicalBrand),
      model: sameLineValue(lines, /^\s*[D0]\s*[.·,:;\-]?\s*[3B]\s*[:;,.·\-–—]?\s*(.+)$/i, modelValue)
    };

    if (!data.plate) {
      const modern = upper(text).match(/\b\d{4}\s*[BCDFGHJKLMNPRSTVWXYZ]{3}\b/);
      if (modern) data.plate = modern[0].replace(/\s+/g,'');
    }

    if (!data.brand) {
      const makes = window.TRASPASO_VEHICLE_MAKES_2026 || [];
      for (const line of lines) {
        const key = compact(line);
        const known = makes.find(make => compact(make) === key);
        if (known) { data.brand = known; break; }
      }
    }

    // Deliberadamente NO buscamos VIN por todo el texto. Debe estar asociado a E.
    return data;
  }

  function parseTsv(tsv) {
    const rows = String(tsv || '').split(/\r?\n/);
    const words = [];
    for (let i = 1; i < rows.length; i += 1) {
      const cols = rows[i].split('\t');
      if (cols.length < 12 || Number(cols[0]) !== 5) continue;
      const text = clean(cols.slice(11).join('\t'));
      if (!text) continue;
      const word = {
        text,
        block:Number(cols[2]) || 0,
        par:Number(cols[3]) || 0,
        line:Number(cols[4]) || 0,
        x:Number(cols[6]) || 0,
        y:Number(cols[7]) || 0,
        w:Number(cols[8]) || 0,
        h:Number(cols[9]) || 0
      };
      word.right = word.x + word.w;
      word.cy = word.y + word.h/2;
      words.push(word);
    }
    return words;
  }

  function codeFrom(raw) {
    const key = compact(raw);
    if (key === 'A') return 'plate';
    if (key === 'E') return 'vin';
    if (/^[D0][1IL]$/.test(key)) return 'brand';
    if (/^[D0][3B]$/.test(key)) return 'model';
    return '';
  }

  function validateField(name, raw) {
    if (name === 'plate') return plateValue(raw);
    if (name === 'vin') return vinValue(raw);
    if (name === 'brand') return canonicalBrand(raw);
    if (name === 'model') return modelValue(raw);
    return '';
  }

  function lineGroups(words) {
    const map = new Map();
    words.forEach(word => {
      const key = `${word.block}:${word.par}:${word.line}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(word);
    });
    return [...map.values()].map(group => group.sort((a,b) => a.x-b.x));
  }

  function spatialData(words) {
    const data = {};
    const labels = [];

    // Primero: misma línea OCR.
    for (const group of lineGroups(words)) {
      for (let i = 0; i < group.length; i += 1) {
        let name = codeFrom(group[i].text);
        let used = 1;
        if (!name && i+1 < group.length) {
          name = codeFrom(group[i].text + group[i+1].text);
          if (name) used = 2;
        }
        if (!name || data[name]) continue;
        const raw = group.slice(i+used).map(word => word.text).join(' ');
        const value = validateField(name, raw);
        if (value) data[name] = value;
      }
    }

    // Segundo: geometría, aunque Tesseract haya separado etiqueta y valor.
    for (let i = 0; i < words.length; i += 1) {
      let name = codeFrom(words[i].text);
      let right = words[i].right;
      let cy = words[i].cy;
      let h = words[i].h;
      if (!name && i+1 < words.length) {
        const next = words[i+1];
        if (Math.abs(next.cy-cy) <= Math.max(h,next.h)) {
          name = codeFrom(words[i].text + next.text);
          if (name) {
            right = Math.max(right,next.right);
            cy = (cy+next.cy)/2;
            h = Math.max(h,next.h);
          }
        }
      }
      if (name) labels.push({name,right,cy,h});
    }

    for (const label of labels) {
      if (data[label.name]) continue;
      const tolerance = Math.max(18, label.h*1.35);
      const candidates = words
        .filter(word => word.x > label.right+2 && Math.abs(word.cy-label.cy) <= tolerance)
        .sort((a,b) => a.x-b.x);
      if (!candidates.length) continue;

      const picked = [];
      let lastRight = label.right;
      for (const word of candidates) {
        if (codeFrom(word.text)) break;
        if (picked.length && word.x-lastRight > Math.max(100, word.h*6)) break;
        picked.push(word.text);
        lastRight = word.right;
        const value = validateField(label.name, picked.join(' '));
        if ((label.name === 'plate' || label.name === 'vin') && value) break;
      }
      const value = validateField(label.name, picked.join(' '));
      if (value) data[label.name] = value;
    }

    return data;
  }

  function fromResponse(response) {
    const text = parseText(response?.data?.text || '');
    const spatial = spatialData(parseTsv(response?.data?.tsv || ''));
    const out = {};
    names.forEach(name => { out[name] = spatial[name] || text[name] || ''; });
    return out;
  }

  function count(data) {
    return names.reduce((total,name) => total + (clean(data[name]) ? 1 : 0), 0);
  }

  function merge(primary, secondary) {
    const out = {};
    names.forEach(name => { out[name] = clean(primary[name]) || clean(secondary[name]); });
    return out;
  }

  function crop(source, x, y, w, h) {
    const sx = Math.max(0, Math.round(source.width*x));
    const sy = Math.max(0, Math.round(source.height*y));
    const sw = Math.max(1, Math.min(source.width-sx, Math.round(source.width*w)));
    const sh = Math.max(1, Math.min(source.height-sy, Math.round(source.height*h)));
    const canvas = document.createElement('canvas');
    const scale = Math.max(2, Math.min(5, 1200/Math.max(sw,1)));
    canvas.width = Math.max(1, Math.round(sw*scale));
    canvas.height = Math.max(1, Math.round(sh*scale));
    const ctx = canvas.getContext('2d', {alpha:false, willReadFrequently:true});
    ctx.fillStyle = '#fff';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source,sx,sy,sw,sh,0,0,canvas.width,canvas.height);
    return canvas;
  }

  function buildKnownPermitFocus(source, missing) {
    const ratio = source.width/source.height;
    // Solo se usa si la foto se parece a un permiso completo. En recortes o
    // fotos parciales manda la lectura por etiqueta/posición.
    if (ratio < 1.27 || ratio > 1.53) return null;

    const specs = {
      plate:['A', .075,.025,.405,.09],
      vin:['E', .575,.025,.40,.09],
      brand:['D.1', .095,.705,.39,.09],
      model:['D.3', .095,.825,.39,.095]
    };
    const wanted = missing.map(name => [name, ...(specs[name] || [])]).filter(row => row.length === 6);
    if (!wanted.length) return null;

    const rowHeight = 235;
    const sheet = document.createElement('canvas');
    sheet.width = 1600;
    sheet.height = rowHeight*wanted.length;
    const ctx = sheet.getContext('2d', {alpha:false});
    ctx.fillStyle = '#fff';
    ctx.fillRect(0,0,sheet.width,sheet.height);
    ctx.fillStyle = '#111';
    ctx.font = '700 52px Arial, sans-serif';
    ctx.textBaseline = 'middle';

    wanted.forEach(([name,label,x,y,w,h],index) => {
      const rowY = index*rowHeight;
      ctx.fillText(label, 20, rowY+rowHeight/2);
      const region = crop(source,x,y,w,h);
      ctx.drawImage(region,0,0,region.width,region.height,190,rowY+15,1380,rowHeight-30);
    });
    return sheet;
  }

  async function recognize(worker, canvas, psm, timeout) {
    try {
      await worker.setParameters({
        tessedit_pageseg_mode:String(psm),
        preserve_interword_spaces:'1',
        tessedit_char_whitelist:''
      });
    } catch (_) {}
    return withTimeout(worker.recognize(canvas, {}, {text:true,tsv:true}), timeout);
  }

  function fill(data) {
    writing = true;
    try {
      names.forEach(name => {
        const input = field(name);
        if (!input) return;
        const value = validateField(name, data[name] || '');
        input.value = value;
        if (value) input.dataset.ocrFilled = '1';
        else delete input.dataset.ocrFilled;
        input.dispatchEvent(new Event('input', {bubbles:true}));
        input.dispatchEvent(new Event('change', {bubbles:true}));
      });
    } finally {
      writing = false;
    }
  }

  async function process(file) {
    if (!file || !file.type?.startsWith('image/') || running) return;
    clearVehicleIdentity();
    setBusy(true);
    setResult('');
    setProgress(3,'Preparando imagen…');

    try {
      const source = await fileToCanvas(file);
      const worker = await getWorker();

      stage = 'base';
      const first = await recognize(worker, source, 11, 22000);
      let detected = fromResponse(first);

      if (count(detected) < 4) {
        stage = 'enhanced';
        setProgress(62,'Mejorando imagen…');
        try {
          const second = await recognize(worker, enhanceCanvas(source), 11, 15000);
          detected = merge(detected, fromResponse(second));
        } catch (error) {
          if (error?.code === 'OCR_TIMEOUT') resetWorker();
        }
      }

      if (count(detected) < 4) {
        const missing = names.filter(name => !clean(detected[name]));
        const focus = buildKnownPermitFocus(source, missing);
        if (focus) {
          stage = 'focus';
          setProgress(86,'Completando campos…');
          try {
            const third = await recognize(worker, focus, 6, 11000);
            detected = merge(detected, fromResponse(third));
          } catch (error) {
            if (error?.code === 'OCR_TIMEOUT') resetWorker();
          }
        }
      }

      if (count(detected) <= 1 && source.height > source.width*1.15) {
        stage = 'rotated';
        setProgress(86,'Comprobando orientación…');
        try {
          const fourth = await recognize(worker, rotateCanvas(source), 11, 10000);
          detected = merge(detected, fromResponse(fourth));
        } catch (error) {
          if (error?.code === 'OCR_TIMEOUT') resetWorker();
        }
      }

      fill(detected);
      const found = count({
        brand:field('brand')?.value,
        model:field('model')?.value,
        vin:field('vin')?.value,
        plate:field('plate')?.value
      });
      setProgress(100,'Listo');
      if (found === 4) setResult('4 datos identificados.','success');
      else if (found > 0) setResult(`${found} de 4 datos identificados. Revisa los que faltan.`,'success');
      else setResult('No he podido identificar los datos. Prueba con otra foto o completa los datos manualmente.','error');
    } catch (error) {
      console.error('OCR unificado de vehículo', error);
      if (error?.code === 'OCR_TIMEOUT') {
        resetWorker();
        setResult('La lectura ha tardado demasiado. Puedes volver a intentarlo.','error');
      } else {
        setResult('No se ha podido leer la imagen. Inténtalo de nuevo o completa los datos manualmente.','error');
      }
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

  cameraInput.addEventListener('change', intercept, {capture:true});
  uploadInput.addEventListener('change', intercept, {capture:true});
  window.addEventListener('beforeunload', () => resetWorker());
})();