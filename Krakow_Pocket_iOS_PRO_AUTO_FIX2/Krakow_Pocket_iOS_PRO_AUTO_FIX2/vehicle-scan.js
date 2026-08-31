(() => {
  const form = document.getElementById('vehicleForm');
  const panel = document.querySelector('[data-panel="vehiculo"]');
  if (!form || !panel || panel.querySelector('.vehicle-scan')) return;

  const field = name => form.elements.namedItem(name);
  const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
  const upper = value => clean(value).toUpperCase();
  const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const ui = document.createElement('section');
  ui.className = 'vehicle-scan';
  ui.innerHTML = `
    <div class="vehicle-scan-head">
      <div>
        <span class="eyebrow">AUTOMÁTICO</span>
        <strong>Leer documentación</strong>
      </div>
      <span class="vehicle-scan-badge">Gratis</span>
    </div>
    <div class="vehicle-scan-actions">
      <button type="button" class="scan-action scan-camera" aria-label="Escanear con la cámara">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7.5 9.4 5h5.2L16 7.5h2.2A2.8 2.8 0 0 1 21 10.3v6.9a2.8 2.8 0 0 1-2.8 2.8H5.8A2.8 2.8 0 0 1 3 17.2v-6.9a2.8 2.8 0 0 1 2.8-2.8H8Z"/><circle cx="12" cy="13.5" r="3.2"/></svg>
        <span><strong>Escanear</strong><small>Cámara</small></span>
      </button>
      <button type="button" class="scan-action scan-upload" aria-label="Cargar una foto">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.8A1.8 1.8 0 0 1 5.8 4h12.4A1.8 1.8 0 0 1 20 5.8v12.4a1.8 1.8 0 0 1-1.8 1.8H5.8A1.8 1.8 0 0 1 4 18.2V5.8Z"/><circle cx="9" cy="9" r="1.4"/><path d="m6.4 17 4.2-4.3 2.6 2.6 1.8-1.8 2.6 3.5"/></svg>
        <span><strong>Cargar foto</strong><small>Fotos</small></span>
      </button>
    </div>
    <input class="scan-input scan-input-camera" type="file" accept="image/*" capture="environment" hidden>
    <input class="scan-input scan-input-upload" type="file" accept="image/*" hidden>
    <div class="vehicle-scan-progress" hidden>
      <span class="vehicle-scan-progress-copy">Preparando…</span>
      <span class="vehicle-scan-progress-track"><i></i></span>
    </div>
    <div class="vehicle-scan-result" aria-live="polite"></div>
    <p class="vehicle-scan-note">Permiso de circulación o ficha técnica · la imagen no se guarda.</p>`;

  const targetGrid = panel.querySelector('.grid.cols-2');
  panel.insertBefore(ui, targetGrid);

  const cameraInput = ui.querySelector('.scan-input-camera');
  const uploadInput = ui.querySelector('.scan-input-upload');
  const cameraButton = ui.querySelector('.scan-camera');
  const uploadButton = ui.querySelector('.scan-upload');
  const progress = ui.querySelector('.vehicle-scan-progress');
  const progressCopy = ui.querySelector('.vehicle-scan-progress-copy');
  const progressBar = ui.querySelector('.vehicle-scan-progress-track i');
  const result = ui.querySelector('.vehicle-scan-result');

  cameraButton.addEventListener('click', () => cameraInput.click());
  uploadButton.addEventListener('click', () => uploadInput.click());
  cameraInput.addEventListener('change', event => handleFile(event.target.files?.[0], event.target));
  uploadInput.addEventListener('change', event => handleFile(event.target.files?.[0], event.target));

  let tesseractPromise = null;
  let workerPromise = null;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-vehicle-ocr="${src}"]`);
      if (existing) {
        if (window.Tesseract) resolve();
        else existing.addEventListener('load', resolve, { once:true });
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.dataset.vehicleOcr = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error('No se pudo cargar el lector de documentos.'));
      document.head.appendChild(script);
    });
  }

  async function ensureTesseract() {
    if (window.Tesseract?.createWorker) return window.Tesseract;
    if (!tesseractPromise) {
      tesseractPromise = loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js').then(() => {
        if (!window.Tesseract?.createWorker) throw new Error('El lector no está disponible.');
        return window.Tesseract;
      });
    }
    return tesseractPromise;
  }

  async function getWorker() {
    const Tesseract = await ensureTesseract();
    if (!workerPromise) {
      workerPromise = Tesseract.createWorker('spa', 1, {
        logger(message) {
          if (message.status === 'recognizing text') {
            setProgress(Math.max(12, Math.round((message.progress || 0) * 100)), 'Leyendo documento…');
          } else if (/loading|initializing/i.test(message.status || '')) {
            setProgress(8, 'Preparando lector…');
          }
        }
      });
    }
    return workerPromise;
  }

  function setBusy(isBusy) {
    cameraButton.disabled = isBusy;
    uploadButton.disabled = isBusy;
    ui.classList.toggle('busy', isBusy);
    progress.hidden = !isBusy;
    if (!isBusy) progressBar.style.width = '0%';
  }

  function setProgress(percent, text) {
    progress.hidden = false;
    progressBar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
    progressCopy.textContent = text;
  }

  function setResult(message, type = '') {
    result.className = `vehicle-scan-result${type ? ` ${type}` : ''}`;
    result.textContent = message;
  }

  async function prepareImage(file) {
    const url = URL.createObjectURL(file);
    try {
      const image = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
      });
      const maxSide = 2200;
      const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { alpha:false });
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(image, 0, 0, width, height);
      return canvas;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function normalizedLines(text) {
    return String(text || '')
      .replace(/\r/g, '\n')
      .split(/\n+/)
      .map(line => line.replace(/[|¦]/g, 'I').replace(/\s+/g, ' ').trim())
      .filter(Boolean);
  }

  function codePattern(code) {
    const parts = code.split('.').map(escapeRegex);
    const flexible = parts.join('\\s*[.·,:;-]?\\s*');
    return new RegExp(`^\\s*${flexible}\\s*(?:[):;,.\\-]|\\s)\\s*(.+?)\\s*$`, 'i');
  }

  function afterCode(lines, codes) {
    for (const code of [].concat(codes)) {
      const pattern = codePattern(code);
      for (let i = 0; i < lines.length; i += 1) {
        const match = lines[i].match(pattern);
        if (match && clean(match[1])) return clean(match[1]);
        const bare = lines[i].replace(/[\s.·,:;()\-]/g, '').toUpperCase();
        const wanted = code.replace(/\./g, '').toUpperCase();
        if (bare === wanted && lines[i + 1]) return clean(lines[i + 1]);
      }
    }
    return '';
  }

  function afterLabel(lines, labels) {
    for (const line of lines) {
      for (const label of labels) {
        const match = line.match(new RegExp(`${label}\\s*[:.-]?\\s*(.+)$`, 'i'));
        if (match && clean(match[1])) return clean(match[1]);
      }
    }
    return '';
  }

  function pickPlate(text, lines) {
    const codeValue = afterCode(lines, ['A']);
    const haystack = `${codeValue} ${text}`.toUpperCase();
    const modern = haystack.match(/\b\d{4}\s*[BCDFGHJKLMNPRSTVWXYZ]{3}\b/);
    if (modern) return modern[0].replace(/\s+/g, '');
    const old = haystack.match(/\b[A-Z]{1,2}\s*[- ]?\s*\d{4}\s*[- ]?\s*[A-Z]{1,2}\b/);
    return old ? old[0].replace(/[\s-]+/g, '') : '';
  }

  function pickVin(text, lines) {
    const codeValue = afterCode(lines, ['E']);
    const source = `${codeValue} ${text}`.toUpperCase().replace(/[^A-Z0-9]/g, ' ');
    const matches = source.match(/\b[A-HJ-NPR-Z0-9]{17}\b/g) || [];
    return matches.find(value => /[A-Z]/.test(value) && /\d/.test(value)) || '';
  }

  function tidyField(value) {
    return clean(value)
      .replace(/^[:.\-–—]+\s*/, '')
      .replace(/\s+[A-Z]\.?\d?(?:\.\d)?\s*[:.-].*$/i, '')
      .trim();
  }

  function parseDocument(text) {
    const lines = normalizedLines(text);
    const plate = pickPlate(text, lines);
    const vin = pickVin(text, lines);
    const brand = tidyField(afterCode(lines, ['D.1', 'D1']) || afterLabel(lines, ['MARCA']));
    const version = tidyField(afterCode(lines, ['D.2', 'D2']) || afterLabel(lines, ['TIPO\\s*/?\\s*VARIANTE\\s*/?\\s*VERSI[ÓO]N', 'VARIANTE\\s*/?\\s*VERSI[ÓO]N']));
    const model = tidyField(afterCode(lines, ['D.3', 'D3']) || afterLabel(lines, ['DENOMINACI[ÓO]N COMERCIAL', 'MODELO']));
    const displacement = tidyField(afterCode(lines, ['P.1', 'P1']) || afterLabel(lines, ['CILINDRADA']));
    const power = tidyField(afterCode(lines, ['P.2', 'P2']) || afterLabel(lines, ['POTENCIA']));
    const fuel = tidyField(afterCode(lines, ['P.3', 'P3']) || afterLabel(lines, ['COMBUSTIBLE']));
    const engineBits = [];
    if (displacement) engineBits.push(/cm|cc/i.test(displacement) ? displacement : `${displacement} cm³`);
    if (power) engineBits.push(/kw|cv/i.test(power) ? power : `${power} kW`);
    if (fuel) engineBits.push(fuel);

    return {
      plate,
      brand,
      model,
      version,
      vin,
      engine: engineBits.join(' · ')
    };
  }

  function fillDetected(data) {
    const order = ['plate', 'brand', 'model', 'version', 'vin', 'engine'];
    const filled = [];
    const skipped = [];
    order.forEach(name => {
      const value = clean(data[name]);
      const input = field(name);
      if (!input || !value) return;
      if (clean(input.value)) {
        skipped.push(name);
        return;
      }
      input.value = ['plate','vin'].includes(name) ? upper(value) : value;
      input.dispatchEvent(new Event('input', { bubbles:true }));
      input.dispatchEvent(new Event('change', { bubbles:true }));
      filled.push(name);
    });
    return { filled, skipped };
  }

  async function handleFile(file, input) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setResult('Selecciona una imagen.', 'error');
      input.value = '';
      return;
    }
    setBusy(true);
    setResult('');
    setProgress(4, 'Preparando imagen…');
    try {
      const image = await prepareImage(file);
      const worker = await getWorker();
      setProgress(15, 'Leyendo documento…');
      const { data } = await worker.recognize(image);
      setProgress(96, 'Completando datos…');
      const detected = parseDocument(data?.text || '');
      const { filled, skipped } = fillDetected(detected);
      setProgress(100, 'Listo');
      if (filled.length) {
        const extra = skipped.length ? ` · ${skipped.length} ya tenían valor` : '';
        setResult(`${filled.length} ${filled.length === 1 ? 'dato completado' : 'datos completados'}${extra}. Revísalos antes de continuar.`, 'success');
      } else if (Object.values(detected).some(Boolean)) {
        setResult('He leído el documento, pero los datos detectados ya estaban completados.', 'success');
      } else {
        setResult('No he podido identificar los datos. Prueba con una foto más recta, nítida y con todo el documento visible.', 'error');
      }
    } catch (error) {
      console.error('OCR vehículo', error);
      setResult('No se ha podido leer la imagen. Puedes intentarlo de nuevo o rellenar los datos manualmente.', 'error');
    } finally {
      setTimeout(() => setBusy(false), 220);
      input.value = '';
    }
  }

  window.addEventListener('beforeunload', async () => {
    try {
      const worker = await workerPromise;
      await worker?.terminate?.();
    } catch (_) {}
  });
})();