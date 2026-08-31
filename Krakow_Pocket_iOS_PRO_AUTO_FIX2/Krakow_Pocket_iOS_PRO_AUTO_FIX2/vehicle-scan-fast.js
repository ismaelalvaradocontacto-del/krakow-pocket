(() => {
  const form = document.getElementById('vehicleForm');
  const ui = document.querySelector('.vehicle-scan');
  if (!form || !ui || ui.dataset.fastOcr === '1') return;
  ui.dataset.fastOcr = '1';

  const cameraInput = ui.querySelector('.scan-input-camera');
  const uploadInput = ui.querySelector('.scan-input-upload');
  const cameraButton = ui.querySelector('.scan-camera');
  const uploadButton = ui.querySelector('.scan-upload');
  const progress = ui.querySelector('.vehicle-scan-progress');
  const progressCopy = ui.querySelector('.vehicle-scan-progress-copy');
  const progressBar = ui.querySelector('.vehicle-scan-progress-track i');
  const result = ui.querySelector('.vehicle-scan-result');
  if (!cameraInput || !uploadInput || !cameraButton || !uploadButton || !progress || !progressCopy || !progressBar || !result) return;

  const fields = ['brand', 'model', 'vin', 'plate'];
  const field = name => form.elements.namedItem(name);
  const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
  const upper = value => clean(value).toUpperCase();
  const knownBrands = [
    'ABARTH','ALFA ROMEO','AUDI','BMW','BYD','CHEVROLET','CITROEN','CITROËN','CUPRA','DACIA','DS AUTOMOBILES',
    'FIAT','FORD','HONDA','HYUNDAI','JAGUAR','JEEP','KIA','LAND ROVER','LEXUS','MAZDA','MERCEDES-BENZ','MERCEDES BENZ',
    'MG','MINI','MITSUBISHI','NISSAN','OPEL','PEUGEOT','PORSCHE','RENAULT','SEAT','SKODA','ŠKODA','SMART','SUBARU',
    'SUZUKI','TESLA','TOYOTA','VOLKSWAGEN','VOLVO'
  ];

  let tesseractPromise = null;
  let workerPromise = null;
  let applying = false;
  let stage = 'base';
  let running = false;

  fields.forEach(name => {
    const input = field(name);
    input?.addEventListener('input', () => {
      if (!applying) input.dataset.manualAfterOcr = '1';
    });
  });

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
          if (stage === 'base') setProgress(12 + Math.round(raw * .58), 'Leyendo documento…');
          else setProgress(72 + Math.round(raw * .22), 'Completando lectura…');
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

  async function imageToCanvas(file) {
    const url = URL.createObjectURL(file);
    try {
      const image = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
      });
      const maxSide = 2600;
      const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const ctx = canvas.getContext('2d', { alpha:false, willReadFrequently:true });
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      return canvas;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function linesOf(text) {
    return String(text || '')
      .normalize('NFKC')
      .replace(/\r/g, '\n')
      .replace(/[|¦]/g, 'I')
      .split(/\n+/)
      .map(line => line.replace(/[\t ]+/g, ' ').trim())
      .filter(Boolean);
  }

  function knownBrandFrom(text) {
    const source = upper(text).replace(/[^A-ZÁÉÍÓÚÜÑ0-9]+/g, ' ');
    return knownBrands.find(brand => source.includes(brand)) || '';
  }

  function plateFrom(text) {
    const source = upper(text).replace(/[_|]/g, ' ');
    const match = source.match(/\b\d{4}\s*[- ]?\s*[BCDFGHJKLMNPRSTVWXYZ]{3}\b/);
    return match ? match[0].replace(/[\s-]+/g, '') : '';
  }

  function normalizeVin(raw) {
    const source = upper(raw).replace(/[^A-Z0-9]/g, '');
    if (!source) return '';
    for (let i = 0; i <= Math.max(0, source.length - 17); i += 1) {
      const value = source.slice(i, i + 17).replace(/O/g, '0').replace(/I/g, '1').replace(/Q/g, '0');
      if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(value)) continue;
      if (!/[A-Z]/.test(value) || !/\d/.test(value)) continue;
      if (/FECHA|METRAJ|KILOMET|DOCUMENT|OBSERV/.test(value)) continue;
      return value;
    }
    return '';
  }

  function vinFrom(text) {
    for (const line of linesOf(text)) {
      const value = normalizeVin(line);
      if (value) return value;
    }
    return normalizeVin(text);
  }

  function afterCode(lines, code) {
    const patterns = {
      D1: /^\s*D\s*[.·,:;\-]?\s*[1IL]\s*[:;,.\-–—]?\s*(.*)$/i,
      D3: /^\s*D\s*[.·,:;\-]?\s*[3B]\s*[:;,.\-–—]?\s*(.*)$/i
    };
    const pattern = patterns[code];
    if (!pattern) return '';
    for (let i = 0; i < lines.length; i += 1) {
      const match = lines[i].match(pattern);
      if (!match) continue;
      const inline = clean(match[1]);
      if (inline) return inline;
      for (let j = 1; j <= 2; j += 1) {
        const next = clean(lines[i + j] || '');
        if (next && !/^D\s*[.·,:;\-]?\s*[123BIL]/i.test(next)) return next;
      }
    }
    return '';
  }

  function modelFrom(text) {
    const lines = linesOf(text);
    let value = afterCode(lines, 'D3');
    if (!value) {
      for (const line of lines) {
        const match = line.match(/(?:DENOMINACI[ÓO]N\s+COMERCIAL|MODELO)\s*[:;,.\-–—]?\s*(.+)$/i);
        if (match) { value = match[1]; break; }
      }
    }
    value = upper(value).replace(/[^A-Z0-9 .\-_/]/g, '').trim();
    return value.length >= 2 && value.length <= 40 ? value : '';
  }

  function parse(text) {
    return {
      brand: knownBrandFrom(text),
      model: modelFrom(text),
      vin: vinFrom(text),
      plate: plateFrom(text)
    };
  }

  function count(data) {
    return fields.reduce((total, name) => total + (clean(data[name]) ? 1 : 0), 0);
  }

  function rect(canvas, x, y, w, h) {
    return {
      x: Math.round(canvas.width * x),
      y: Math.round(canvas.height * y),
      w: Math.max(1, Math.round(canvas.width * w)),
      h: Math.max(1, Math.round(canvas.height * h))
    };
  }

  function buildFocusSheet(source) {
    const ratio = source.width / source.height;
    if (ratio < 1.2 || ratio > 1.65) return null;

    const regions = [
      ['A', rect(source, .065, .018, .43, .095)],
      ['E', rect(source, .555, .018, .43, .095)],
      ['D.1', rect(source, .065, .705, .43, .09)],
      ['D.3', rect(source, .065, .82, .43, .09)]
    ];

    const rowHeight = 190;
    const width = 1350;
    const sheet = document.createElement('canvas');
    sheet.width = width;
    sheet.height = rowHeight * regions.length;
    const ctx = sheet.getContext('2d', { alpha:false, willReadFrequently:true });
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, sheet.width, sheet.height);
    ctx.fillStyle = '#111';
    ctx.font = '700 44px Arial, sans-serif';
    ctx.textBaseline = 'middle';

    regions.forEach(([label, box], index) => {
      const y = index * rowHeight;
      ctx.fillText(label, 18, y + rowHeight / 2);
      ctx.drawImage(source, box.x, box.y, box.w, box.h, 130, y + 12, width - 150, rowHeight - 24);
      ctx.fillRect(0, y + rowHeight - 2, width, 2);
    });
    return sheet;
  }

  function merge(primary, secondary) {
    const out = {};
    fields.forEach(name => { out[name] = clean(primary[name]) || clean(secondary[name]); });
    return out;
  }

  function fill(data) {
    let changed = 0;
    let preserved = 0;
    applying = true;
    try {
      fields.forEach(name => {
        const input = field(name);
        const value = clean(data[name]);
        if (!input || !value) return;
        if (input.dataset.manualAfterOcr === '1') {
          preserved += 1;
          return;
        }
        const finalValue = upper(value);
        if (input.value !== finalValue) changed += 1;
        input.value = finalValue;
        input.dataset.ocrFilled = '1';
        input.dispatchEvent(new Event('input', { bubbles:true }));
        input.dispatchEvent(new Event('change', { bubbles:true }));
      });
    } finally {
      applying = false;
    }
    return { changed, preserved };
  }

  async function process(file) {
    if (!file || !file.type?.startsWith('image/')) {
      setResult('Selecciona una imagen.', 'error');
      return;
    }
    if (running) return;

    setBusy(true);
    setResult('');
    setProgress(3, 'Preparando imagen…');

    try {
      const canvas = await imageToCanvas(file);
      const worker = await getWorker();
      stage = 'base';
      try { await worker.setParameters({ tessedit_pageseg_mode:'11', preserve_interword_spaces:'1', tessedit_char_whitelist:'' }); } catch (_) {}

      const first = await withTimeout(worker.recognize(canvas), 22000);
      let detected = parse(first?.data?.text || '');

      if (count(detected) < 4) {
        const focus = buildFocusSheet(canvas);
        if (focus) {
          stage = 'focus';
          setProgress(72, 'Completando lectura…');
          try {
            await worker.setParameters({ tessedit_pageseg_mode:'6', preserve_interword_spaces:'1', tessedit_char_whitelist:'' });
            const second = await withTimeout(worker.recognize(focus), 14000);
            detected = merge(detected, parse(second?.data?.text || ''));
          } catch (error) {
            if (error?.code === 'OCR_TIMEOUT') resetWorker();
          }
        }
      }

      setProgress(97, 'Completando datos…');
      const found = count(detected);
      const { changed, preserved } = fill(detected);
      setProgress(100, 'Listo');

      if (found === 4) {
        const extra = preserved ? ` · ${preserved} conservado${preserved === 1 ? '' : 's'}` : '';
        setResult(`4 datos identificados${extra}.`, 'success');
      } else if (found > 0) {
        setResult(`${found} de 4 datos identificados. Revisa los que faltan.`, 'success');
      } else {
        setResult('No he podido identificar los datos. Prueba con el documento entero, recto y sin reflejos.', 'error');
      }
    } catch (error) {
      console.error('OCR vehículo rápido', error);
      if (error?.code === 'OCR_TIMEOUT') {
        resetWorker();
        setResult('La lectura ha tardado demasiado. Inténtalo de nuevo; Traspaso ha detenido el proceso.', 'error');
      } else {
        setResult('No se ha podido leer la imagen. Inténtalo de nuevo o completa los datos manualmente.', 'error');
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

  cameraInput.addEventListener('change', intercept, { capture:true });
  uploadInput.addEventListener('change', intercept, { capture:true });

  window.addEventListener('beforeunload', () => resetWorker());
})();