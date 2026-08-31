(() => {
  const form = document.getElementById('vehicleForm');
  const ui = document.querySelector('.vehicle-scan');
  if (!form || !ui || ui.dataset.ocrV3 === '1') return;
  ui.dataset.ocrV3 = '1';

  const cameraInput = ui.querySelector('.scan-input-camera');
  const uploadInput = ui.querySelector('.scan-input-upload');
  const cameraButton = ui.querySelector('.scan-camera');
  const uploadButton = ui.querySelector('.scan-upload');
  const progress = ui.querySelector('.vehicle-scan-progress');
  const progressCopy = ui.querySelector('.vehicle-scan-progress-copy');
  const progressBar = ui.querySelector('.vehicle-scan-progress-track i');
  const result = ui.querySelector('.vehicle-scan-result');
  if (!cameraInput || !uploadInput || !progress || !result) return;

  const field = name => form.elements.namedItem(name);
  const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
  const upper = value => clean(value).toUpperCase();
  const targets = ['plate','brand','model','version','vin','engine'];
  const knownBrands = [
    'ABARTH','ALFA ROMEO','AUDI','BMW','BYD','CHEVROLET','CITROEN','CITROËN','CUPRA','DACIA','DS AUTOMOBILES',
    'FIAT','FORD','HONDA','HYUNDAI','JAGUAR','JEEP','KIA','LAND ROVER','LEXUS','MAZDA','MERCEDES-BENZ','MERCEDES BENZ',
    'MG','MINI','MITSUBISHI','NISSAN','OPEL','PEUGEOT','PORSCHE','RENAULT','SEAT','SKODA','ŠKODA','SMART','SUBARU',
    'SUZUKI','TESLA','TOYOTA','VOLKSWAGEN','VOLVO'
  ];
  const fuels = ['GASOLINA','DIESEL','DIÉSEL','GASÓLEO','GASOLEO','ELÉCTRICO','ELECTRICO','HÍBRIDO','HIBRIDO','GLP','GNC'];

  let scriptPromise = null;
  let workerPromise = null;
  let applying = false;
  let stage = 'base';

  targets.forEach(name => {
    const input = field(name);
    input?.addEventListener('input', () => {
      if (!applying) input.dataset.manualAfterOcr = '1';
    });
  });

  function setBusy(value) {
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
    if (scriptPromise) return scriptPromise;
    scriptPromise = new Promise((resolve, reject) => {
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
    return scriptPromise;
  }

  async function getWorker() {
    if (workerPromise) return workerPromise;
    workerPromise = loadTesseract().then(Tesseract => Tesseract.createWorker('spa', 1, {
      logger(message) {
        if (message.status === 'recognizing text') {
          const raw = Math.round((message.progress || 0) * 100);
          const base = stage === 'base' ? 10 : 50;
          const span = stage === 'base' ? 38 : 42;
          setProgress(base + Math.round(raw * span / 100), stage === 'base' ? 'Leyendo documento…' : 'Comprobando campos…');
        } else if (/loading|initializing/i.test(message.status || '')) {
          setProgress(7, 'Preparando lector…');
        }
      }
    }));
    return workerPromise;
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
      const maxSide = 2800;
      const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const ctx = canvas.getContext('2d', { alpha:false, willReadFrequently:true });
      ctx.fillStyle = '#fff';
      ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.drawImage(image,0,0,canvas.width,canvas.height);
      return canvas;
    } finally {
      URL.revokeObjectURL(url);
    }
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

  function marker(line) {
    const value = upper(line).replace(/[^A-Z0-9]/g,'');
    if (/^P[1IL]$/.test(value)) return 'P1';
    if (/^P[2Z]$/.test(value)) return 'P2';
    if (/^P[3B]$/.test(value)) return 'P3';
    if (/^D[1IL]$/.test(value)) return 'D1';
    if (/^D[2Z]$/.test(value)) return 'D2';
    if (/^D[3B]$/.test(value)) return 'D3';
    return '';
  }

  function nextLineValue(lines, wanted, test = () => true) {
    const index = lines.findIndex(line => marker(line) === wanted);
    if (index < 0) return '';
    for (let i = index + 1; i < Math.min(lines.length, index + 5); i += 1) {
      const candidate = clean(lines[i]);
      if (!candidate || marker(candidate)) continue;
      if (test(candidate)) return candidate;
    }
    return '';
  }

  function knownBrandFrom(text) {
    const source = upper(text).replace(/[^A-ZÁÉÍÓÚÜÑ0-9]+/g,' ');
    return knownBrands.find(brand => new RegExp(`(?:^|\\s)${brand.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}(?:\\s|$)`,'i').test(source)) || '';
  }

  function fuelFrom(text) {
    const source = upper(text);
    return fuels.find(item => source.includes(item)) || '';
  }

  function normalizeVin(raw) {
    const token = upper(raw).replace(/[^A-Z0-9]/g,'');
    if (!token) return '';
    const candidate = token.replace(/O/g,'0').replace(/I/g,'1').replace(/Q/g,'0');
    if (candidate.length !== 17) return '';
    if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(candidate)) return '';
    if (/FECHA|METRAJ|KILOMET|DOCUMENT|OBSERV/.test(candidate)) return '';
    if (!/[A-Z]/.test(candidate) || !/\d/.test(candidate)) return '';
    return candidate;
  }

  function vinFrom(text) {
    for (const line of linesOf(text)) {
      const compact = upper(line).replace(/[^A-Z0-9]/g,'');
      if (compact.length >= 16 && compact.length <= 19) {
        const value = normalizeVin(compact);
        if (value) return value;
      }
    }
    return '';
  }

  function plateFrom(text) {
    const source = upper(text).replace(/[_|]/g,' ');
    const exact = source.match(/\b\d{4}\s*[- ]?\s*[BCDFGHJKLMNPRSTVWXYZ]{3}\b/);
    return exact ? exact[0].replace(/[\s-]+/g,'') : '';
  }

  function numericValue(raw, min, max, decimals = true) {
    const values = String(raw || '').replace(/,/g,'.').match(/\d+(?:\.\d+)?/g) || [];
    for (const part of values) {
      const number = Number(part);
      if (!Number.isFinite(number) || number < min || number > max) continue;
      if (!decimals && !Number.isInteger(number)) continue;
      return part;
    }
    return '';
  }

  function normalizeVersion(raw) {
    let value = upper(raw)
      .replace(/[—–_]+/g,'-')
      .replace(/[^A-Z0-9\-_/.*]/g,'')
      .replace(/[-_/.*]{2,}$/,'')
      .replace(/[!|]+$/,'')
      .trim();
    if (value.length < 4) return '';
    return value;
  }

  function modelFromSparse(lines) {
    const afterD3 = nextLineValue(lines,'D3', value => /^[A-Z0-9][A-Z0-9 .\-_/]{1,40}$/i.test(value));
    if (afterD3) return upper(afterD3.replace(/[|]+$/,''));
    return '';
  }

  function versionFromSparse(lines) {
    const afterD2 = nextLineValue(lines,'D2', value => /[A-Z0-9]/i.test(value));
    if (afterD2) return normalizeVersion(afterD2);
    const d3 = lines.findIndex(line => marker(line) === 'D3');
    if (d3 > 0) {
      for (let i = d3 - 1; i >= Math.max(0,d3 - 4); i -= 1) {
        if (/[-_/]/.test(lines[i]) && /[A-Z0-9]/i.test(lines[i])) {
          const value = normalizeVersion(lines[i]);
          if (value) return value;
        }
      }
    }
    return '';
  }

  function parseSparse(text) {
    const lines = linesOf(text);
    const p1raw = nextLineValue(lines,'P1', value => /\d/.test(value));
    const p2raw = nextLineValue(lines,'P2', value => /\d/.test(value));
    const p1 = numericValue(p1raw, 400, 10000, false);
    const p2 = numericValue(p2raw, 1, 1000, true);
    const fuel = fuelFrom(text);
    return {
      plate: plateFrom(text),
      brand: knownBrandFrom(text),
      model: modelFromSparse(lines),
      version: versionFromSparse(lines),
      vin: vinFrom(text),
      p1,
      p2,
      fuel
    };
  }

  function rect(canvas, x, y, w, h) {
    return {
      left: Math.round(canvas.width * x),
      top: Math.round(canvas.height * y),
      width: Math.max(1, Math.round(canvas.width * w)),
      height: Math.max(1, Math.round(canvas.height * h))
    };
  }

  async function readRegion(worker, canvas, box, whitelist = '') {
    stage = 'focus';
    try {
      await worker.setParameters({
        tessedit_pageseg_mode:'7',
        preserve_interword_spaces:'1',
        tessedit_char_whitelist: whitelist
      });
    } catch (_) {}
    const { data } = await worker.recognize(canvas, { rectangle: box }, { text:true });
    return clean(data?.text || '');
  }

  async function focusedFields(worker, canvas, base) {
    const out = { ...base };
    const landscapePermit = canvas.width / canvas.height > 1.2 && canvas.width / canvas.height < 1.65;
    if (!landscapePermit) return out;

    setProgress(52,'Comprobando matrícula…');
    const plateRaw = await readRegion(worker, canvas, rect(canvas,.077,.029,.402,.087), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789- ');
    out.plate = plateFrom(plateRaw) || out.plate;

    setProgress(60,'Comprobando versión…');
    const versionRaw = await readRegion(worker, canvas, rect(canvas,.077,.785,.402,.081), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_/.* ');
    out.version = normalizeVersion(versionRaw) || out.version;

    if (!out.vin) {
      setProgress(67,'Comprobando bastidor…');
      const vinRaw = await readRegion(worker, canvas, rect(canvas,.572,.029,.398,.087), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ');
      out.vin = vinFrom(vinRaw) || normalizeVin(vinRaw) || out.vin;
    }

    if (!out.brand) {
      setProgress(73,'Comprobando marca…');
      const brandRaw = await readRegion(worker, canvas, rect(canvas,.077,.721,.402,.081), 'ABCDEFGHIJKLMNOPQRSTUVWXYZÁÉÍÓÚÜÑ- ');
      out.brand = knownBrandFrom(brandRaw) || upper(brandRaw.replace(/[^A-ZÁÉÍÓÚÜÑ -]/gi,'').trim());
    }

    if (!out.model) {
      setProgress(79,'Comprobando modelo…');
      const modelRaw = await readRegion(worker, canvas, rect(canvas,.077,.837,.402,.082), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_/ ');
      out.model = upper(modelRaw.replace(/[^A-Z0-9\-_/ ]/gi,'').trim());
    }

    if (!out.p1) {
      setProgress(84,'Comprobando cilindrada…');
      const raw = await readRegion(worker, canvas, rect(canvas,.577,.337,.192,.041), '0123456789., ');
      out.p1 = numericValue(raw,400,10000,false);
    }

    if (!out.p2) {
      setProgress(88,'Comprobando potencia…');
      const raw = await readRegion(worker, canvas, rect(canvas,.577,.39,.192,.06), '0123456789., ');
      out.p2 = numericValue(raw,1,1000,true);
    }

    if (!out.fuel) {
      setProgress(91,'Comprobando combustible…');
      const raw = await readRegion(worker, canvas, rect(canvas,.577,.45,.29,.062), 'ABCDEFGHIJKLMNOPQRSTUVWXYZÁÉÍÓÚÜÑ ');
      out.fuel = fuelFrom(raw) || upper(raw.replace(/[^A-ZÁÉÍÓÚÜÑ ]/gi,'').trim());
    }

    return out;
  }

  function buildEngine(data) {
    return [
      data.p1 ? `${data.p1} cm³` : '',
      data.p2 ? `${data.p2} kW` : '',
      data.fuel || ''
    ].filter(Boolean).join(' · ');
  }

  function fill(data) {
    const values = {
      plate: data.plate,
      brand: data.brand,
      model: data.model,
      version: data.version,
      vin: data.vin,
      engine: buildEngine(data)
    };
    const filled = [];
    const preserved = [];
    applying = true;
    try {
      targets.forEach(name => {
        const input = field(name);
        const value = clean(values[name]);
        if (!input || !value) return;
        if (input.dataset.manualAfterOcr === '1') {
          preserved.push(name);
          return;
        }
        input.value = ['plate','vin','brand','model','version'].includes(name) ? upper(value) : value;
        input.dataset.ocrFilled = '1';
        input.dispatchEvent(new Event('input',{bubbles:true}));
        input.dispatchEvent(new Event('change',{bubbles:true}));
        filled.push(name);
      });
    } finally {
      applying = false;
    }
    return { filled, preserved, values };
  }

  async function process(file) {
    if (!file || !file.type.startsWith('image/')) {
      setResult('Selecciona una imagen.', 'error');
      return;
    }
    setBusy(true);
    setResult('');
    setProgress(3,'Preparando imagen…');
    try {
      const canvas = await imageToCanvas(file);
      const worker = await getWorker();
      stage = 'base';
      try { await worker.setParameters({ tessedit_pageseg_mode:'11', preserve_interword_spaces:'1', tessedit_char_whitelist:'' }); } catch (_) {}
      const first = await worker.recognize(canvas, {}, { text:true });
      let detected = parseSparse(first.data?.text || '');
      detected = await focusedFields(worker, canvas, detected);

      stage = 'focus';
      setProgress(96,'Completando datos…');
      const { filled, preserved, values } = fill(detected);
      const found = targets.filter(name => clean(values[name])).length;
      setProgress(100,'Listo');

      if (filled.length) {
        const extra = preserved.length ? ` · ${preserved.length} conservado${preserved.length === 1 ? '' : 's'}` : '';
        setResult(`${filled.length} ${filled.length === 1 ? 'dato completado' : 'datos completados'}${extra}. Revísalos antes de continuar.`, 'success');
      } else if (found) {
        setResult('Los datos detectados ya estaban completados o se han conservado porque los editaste.', 'success');
      } else {
        setResult('No he podido identificar suficientes datos. Prueba con el documento entero, recto y sin reflejos.', 'error');
      }
    } catch (error) {
      console.error('OCR vehículo v3', error);
      setResult('No se ha podido leer la imagen. Prueba otra foto o rellena los datos manualmente.', 'error');
    } finally {
      stage = 'base';
      setTimeout(() => setBusy(false),250);
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

  window.addEventListener('beforeunload', async () => {
    try { const worker = await workerPromise; await worker?.terminate?.(); } catch (_) {}
  });
})();