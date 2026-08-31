(() => {
  const form = document.getElementById('vehicleForm');
  const ui = document.querySelector('.vehicle-scan');
  if (!form || !ui || ui.dataset.fastOcr === '3') return;
  ui.dataset.fastOcr = '3';

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
  const compact = value => upper(value)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]/g, '');

  let tesseractPromise = null;
  let workerPromise = null;
  let applying = false;
  let running = false;
  let stage = 'base';

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
          existing.addEventListener('load', () => resolve(window.Tesseract), { once: true });
          existing.addEventListener('error', reject, { once: true });
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
          const ranges = {
            base: [10, 58, 'Leyendo documento…'],
            enhanced: [61, 24, 'Mejorando lectura…'],
            focus: [86, 11, 'Completando campos…'],
            rotated: [86, 11, 'Comprobando orientación…']
          };
          const [start, width, copy] = ranges[stage] || ranges.base;
          setProgress(start + Math.round(raw * width / 100), copy);
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

      const maxSide = 2800;
      const naturalMax = Math.max(image.naturalWidth, image.naturalHeight);
      const naturalMin = Math.min(image.naturalWidth, image.naturalHeight);
      let scale = Math.min(1, maxSide / naturalMax);
      if (naturalMin < 900) scale = Math.min(maxSide / naturalMax, Math.max(scale, Math.min(2, 1200 / Math.max(1, naturalMin))));

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
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
    const ctx = out.getContext('2d', { alpha: false, willReadFrequently: true });
    ctx.drawImage(source, 0, 0);

    const image = ctx.getImageData(0, 0, out.width, out.height);
    const data = image.data;
    const histogram = new Uint32Array(256);
    for (let i = 0; i < data.length; i += 4) {
      const lum = Math.round(.299 * data[i] + .587 * data[i + 1] + .114 * data[i + 2]);
      histogram[lum] += 1;
    }

    const total = out.width * out.height;
    const lowTarget = total * .015;
    const highTarget = total * .985;
    let acc = 0;
    let low = 0;
    let high = 255;

    for (let i = 0; i < 256; i += 1) {
      acc += histogram[i];
      if (acc >= lowTarget) { low = i; break; }
    }
    acc = 0;
    for (let i = 0; i < 256; i += 1) {
      acc += histogram[i];
      if (acc >= highTarget) { high = i; break; }
    }
    if (high - low < 55) {
      low = Math.max(0, low - 25);
      high = Math.min(255, high + 25);
    }

    const span = Math.max(1, high - low);
    for (let i = 0; i < data.length; i += 4) {
      const lum = .299 * data[i] + .587 * data[i + 1] + .114 * data[i + 2];
      let value = ((lum - low) * 255) / span;
      value = Math.max(0, Math.min(255, value));
      value = (value - 128) * 1.18 + 128;
      value = Math.max(0, Math.min(255, value));
      data[i] = data[i + 1] = data[i + 2] = value;
      data[i + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    return out;
  }

  function rotateCanvas(source, clockwise = true) {
    const out = document.createElement('canvas');
    out.width = source.height;
    out.height = source.width;
    const ctx = out.getContext('2d', { alpha: false });
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.translate(out.width / 2, out.height / 2);
    ctx.rotate((clockwise ? 1 : -1) * Math.PI / 2);
    ctx.drawImage(source, -source.width / 2, -source.height / 2);
    return out;
  }

  function rawLines(text) {
    return String(text || '')
      .normalize('NFKC')
      .replace(/\r/g, '\n')
      .replace(/[|¦]/g, 'I')
      .split(/\n+/)
      .map(line => line.replace(/[\t ]+/g, ' ').trim())
      .filter(Boolean);
  }

  const codePatterns = {
    A: /^\s*A\s*[:;,.·\-–—]?\s*(.*)$/i,
    E: /^\s*E\s*[:;,.·\-–—]?\s*(.*)$/i,
    D1: /^\s*[D0]\s*[.·,:;\-]?\s*[1IL]\s*[:;,.·\-–—]?\s*(.*)$/i,
    D3: /^\s*[D0]\s*[.·,:;\-]?\s*[3B]\s*[:;,.·\-–—]?\s*(.*)$/i
  };

  function looksLikeCode(line) {
    return /^(?:A|B|H|I|E|F\s*[.·]?\s*[12]|G|K|P\s*[.·]?\s*[123]|Q|S\s*[.·]?\s*[12]|C\s*[.·]?\s*[0-9]|D\s*[.·]?\s*[1234])\b/i.test(line.replace(/\s+/g, ' '));
  }

  function cutFollowingCode(value) {
    return clean(String(value || '').replace(/\s+(?=(?:[A-Z]\s*[.·]?\s*\d|[A-Z])\s*[:;,.·\-–—]?)/g, '\n').split('\n')[0]);
  }

  function valueAfterCode(lines, code) {
    const pattern = codePatterns[code];
    if (!pattern) return '';
    for (let i = 0; i < lines.length; i += 1) {
      const match = lines[i].match(pattern);
      if (!match) continue;
      let inline = cutFollowingCode(match[1] || '');
      if (inline && !looksLikeCode(inline)) return inline;

      for (let j = 1; j <= 2; j += 1) {
        const next = clean(lines[i + j] || '');
        if (!next || looksLikeCode(next)) continue;
        return cutFollowingCode(next);
      }
    }
    return '';
  }

  function canonicalBrand(value) {
    const raw = upper(value)
      .replace(/^(MARCA|BRAND)\s*[:;,.·\-–—]?\s*/i, '')
      .replace(/[^A-ZÁÉÍÓÚÜÑ0-9 .&+\-/]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (raw.length < 2 || raw.length > 40 || !/[A-ZÁÉÍÓÚÜÑ]{2}/.test(raw)) return '';
    if (/^(DOCUMENTO|OBSERVACIONES|MATRICULA|MATRÍCULA|MODELO|BASTIDOR|TIPO|VARIANTE|VERSION|VERSIÓN)$/i.test(raw)) return '';
    return window.TRASPASO_CANONICALIZE_MAKE?.(raw) || raw;
  }

  function brandFrom(text) {
    const lines = rawLines(text);
    const byCode = canonicalBrand(valueAfterCode(lines, 'D1'));
    if (byCode) return byCode;

    const makes = window.TRASPASO_VEHICLE_MAKES_2026 || [];
    for (const line of lines) {
      const lineKey = compact(line);
      if (!lineKey || lineKey.length > 30) continue;
      for (const make of makes) {
        if (lineKey === compact(make)) return make;
      }
    }
    return '';
  }

  function modelFrom(text) {
    const lines = rawLines(text);
    let value = valueAfterCode(lines, 'D3');
    if (!value) {
      for (const line of lines) {
        const match = line.match(/(?:DENOMINACI[ÓO]N\s+COMERCIAL|MODELO)\s*[:;,.·\-–—]?\s*(.+)$/i);
        if (match?.[1]) { value = match[1]; break; }
      }
    }
    value = upper(value).replace(/[^A-Z0-9 .+\-_/]/g, ' ').replace(/\s+/g, ' ').trim();
    return value.length >= 2 && value.length <= 55 ? value : '';
  }

  function plateCandidate(raw) {
    const value = upper(raw).replace(/[^A-Z0-9\-]/g, '');
    if (value.length < 4 || value.length > 14) return '';
    if (!/\d/.test(value) || !/[A-Z]/.test(value)) return '';
    return value;
  }

  function plateFrom(text) {
    const lines = rawLines(text);
    const byCode = plateCandidate(valueAfterCode(lines, 'A'));
    if (byCode) return byCode;

    const source = upper(text).replace(/[_|]/g, ' ');
    const current = source.match(/\b\d{4}\s*[- ]?\s*[BCDFGHJKLMNPRSTVWXYZ]{3}\b/);
    if (current) return current[0].replace(/[\s-]+/g, '');
    const old = source.match(/\b(?:GC|TF|M|B|V|SE|MA|BI|SS|Z|A|AL|AV|BA|BU|C|CA|CC|CO|CR|CS|CU|GE|GR|GU|H|HU|J|L|LE|LO|LU|MU|NA|O|OR|P|PM|PO|S|SA|SG|SO|T|TE|TO|VA|VI|ZA)-?\d{1,6}-?[A-Z]{0,2}\b/);
    return old ? old[0].replace(/\s+/g, '') : '';
  }

  function standardVin(raw) {
    const source = upper(raw).replace(/[^A-Z0-9]/g, '');
    if (source.length < 17) return '';
    for (let i = 0; i <= source.length - 17; i += 1) {
      const value = source.slice(i, i + 17).replace(/O/g, '0').replace(/I/g, '1').replace(/Q/g, '0');
      if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(value)) continue;
      if (!/[A-Z]/.test(value) || !/\d/.test(value)) continue;
      if (/FECHA|METRAJ|KILOMET|DOCUMENT|OBSERV/.test(value)) continue;
      return value;
    }
    return '';
  }

  function labeledVin(raw) {
    const value = upper(raw).replace(/[^A-Z0-9\-]/g, '');
    if (value.length < 5 || value.length > 25) return '';
    if (!/[A-Z]/.test(value) || !/\d/.test(value)) return '';
    if (/FECHA|METRAJ|KILOMET|DOCUMENT|OBSERV/.test(value)) return '';
    return value.length === 17 ? value.replace(/O/g, '0').replace(/I/g, '1').replace(/Q/g, '0') : value;
  }

  function vinFrom(text) {
    const lines = rawLines(text);
    const byCode = labeledVin(valueAfterCode(lines, 'E'));
    if (byCode) return byCode;
    for (const line of lines) {
      const vin = standardVin(line);
      if (vin) return vin;
    }
    return standardVin(text);
  }

  function parse(text) {
    return {
      brand: brandFrom(text),
      model: modelFrom(text),
      vin: vinFrom(text),
      plate: plateFrom(text)
    };
  }

  function count(data) {
    return fields.reduce((total, name) => total + (clean(data[name]) ? 1 : 0), 0;
  }

  function merge(primary, secondary) {
    const out = {};
    fields.forEach(name => { out[name] = clean(primary[name]) || clean(secondary[name]); });
    return out;
  }

  function rect(canvas, x, y, w, h) {
    return {
      x: Math.max(0, Math.round(canvas.width * x)),
      y: Math.max(0, Math.round(canvas.height * y)),
      w: Math.max(1, Math.min(canvas.width, Math.round(canvas.width * w))),
      h: Math.max(1, Math.min(canvas.height, Math.round(canvas.height * h)))
    };
  }

  function buildFocusSheet(source, missing) {
    const ratio = source.width / source.height;
    if (ratio < 1.18 || ratio > 1.72) return null;

    const specs = {
      plate: ['A', rect(source, .035, .00, .47, .13)],
      vin: ['E', rect(source, .53, .00, .45, .13)],
      brand: ['D.1', rect(source, .035, .69, .47, .115)],
      model: ['D.3', rect(source, .035, .80, .47, .12)]
    };
    const regions = missing.map(name => specs[name]).filter(Boolean);
    if (!regions.length) return null;

    const rowHeight = 220;
    const width = 1500;
    const sheet = document.createElement('canvas');
    sheet.width = width;
    sheet.height = rowHeight * regions.length;
    const ctx = sheet.getContext('2d', { alpha: false, willReadFrequently: true });
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, sheet.width, sheet.height);
    ctx.fillStyle = '#111';
    ctx.font = '700 48px Arial, sans-serif';
    ctx.textBaseline = 'middle';

    regions.forEach(([label, box], index) => {
      const y = index * rowHeight;
      ctx.fillText(label, 18, y + rowHeight / 2);
      ctx.drawImage(source, box.x, box.y, box.w, box.h, 145, y + 10, width - 165, rowHeight - 20);
      ctx.fillRect(0, y + rowHeight - 2, width, 2);
    });
    return sheet;
  }

  function clearPreviousOcrValues() {
    applying = true;
    try {
      fields.forEach(name => {
        const input = field(name);
        if (!input) return;

        // Si el usuario corrigió el campo manualmente después del OCR,
        // se conserva. Todo valor procedente de una lectura anterior se
        // elimina para que dos permisos distintos nunca se mezclen.
        if (input.dataset.manualAfterOcr === '1') return;
        if (input.dataset.ocrFilled === '1') {
          input.value = '';
          delete input.dataset.ocrFilled;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
    } finally {
      applying = false;
    }
  }

  function fill(data) {
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
        input.value = upper(value);
        input.dataset.ocrFilled = '1';
        delete input.dataset.manualAfterOcr;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
    } finally {
      applying = false;
    }
    return preserved;
  }

  async function recognize(worker, canvas, psm, timeout) {
    try {
      await worker.setParameters({
        tessedit_pageseg_mode: String(psm),
        preserve_interword_spaces: '1',
        tessedit_char_whitelist: ''
      });
    } catch (_) {}
    return withTimeout(worker.recognize(canvas), timeout);
  }

  async function process(file) {
    if (!file || !file.type?.startsWith('image/')) {
      setResult('Selecciona una imagen.', 'error');
      return;
    }
    if (running) return;

    // Cada imagen representa una nueva fuente documental. Antes de leerla,
    // se retiran los valores que vinieron del OCR anterior para impedir que
    // queden datos de dos vehículos mezclados si el nuevo OCR no detecta todo.
    clearPreviousOcrValues();

    setBusy(true);
    setResult('');
    setProgress(3, 'Preparando imagen…');

    try {
      const source = await fileToCanvas(file);
      const worker = await getWorker();

      stage = 'base';
      const first = await recognize(worker, source, 11, 22000);
      let detected = parse(first?.data?.text || '');

      const firstCount = count(detected);
      if (firstCount < 4) {
        if (firstCount <= 2 || source.width / source.height < 1.18 || source.width / source.height > 1.72) {
          stage = 'enhanced';
          setProgress(61, 'Mejorando imagen…');
          try {
            const enhanced = enhanceCanvas(source);
            const second = await recognize(worker, enhanced, 11, 15000);
            detected = merge(detected, parse(second?.data?.text || ''));
          } catch (error) {
            if (error?.code === 'OCR_TIMEOUT') resetWorker();
          }
        }

        if (count(detected) < 4) {
          const stillMissing = fields.filter(name => !clean(detected[name]));
          const focus = buildFocusSheet(source, stillMissing);
          if (focus) {
            stage = 'focus';
            setProgress(86, 'Completando campos…');
            try {
              const third = await recognize(worker, focus, 6, 11000);
              detected = merge(detected, parse(third?.data?.text || ''));
            } catch (error) {
              if (error?.code === 'OCR_TIMEOUT') resetWorker();
            }
          }
        }

        if (count(detected) <= 1 && source.height > source.width * 1.2) {
          stage = 'rotated';
          setProgress(86, 'Comprobando orientación…');
          try {
            const rotated = rotateCanvas(source, true);
            const fourth = await recognize(worker, rotated, 11, 11000);
            detected = merge(detected, parse(fourth?.data?.text || ''));
          } catch (error) {
            if (error?.code === 'OCR_TIMEOUT') resetWorker();
          }
        }
      }

      setProgress(98, 'Completando datos…');
      const found = count(detected);
      const preserved = fill(detected);
      setProgress(100, 'Listo');

      if (found === 4) {
        const extra = preserved ? ` · ${preserved} conservado${preserved === 1 ? '' : 's'}` : '';
        setResult(`4 datos identificados${extra}.`, 'success');
      } else if (found > 0) {
        setResult(`${found} de 4 datos identificados. Revisa los que faltan.`, 'success');
      } else {
        setResult('No he podido identificar los datos. Prueba con más parte del documento o completa los datos manualmente.', 'error');
      }
    } catch (error) {
      console.error('OCR vehículo adaptable', error);
      if (error?.code === 'OCR_TIMEOUT') {
        resetWorker();
        setResult('La lectura ha tardado demasiado. Traspaso ha detenido el proceso para que puedas volver a intentarlo.', 'error');
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

  cameraInput.addEventListener('change', intercept, { capture: true });
  uploadInput.addEventListener('change', intercept, { capture: true });

  window.addEventListener('beforeunload', () => resetWorker());
})();