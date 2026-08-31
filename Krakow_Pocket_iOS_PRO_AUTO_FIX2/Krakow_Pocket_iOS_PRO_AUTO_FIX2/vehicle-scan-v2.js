(() => {
  const form = document.getElementById('vehicleForm');
  const ui = document.querySelector('.vehicle-scan');
  if (!form || !ui || ui.dataset.ocrV2 === '1') return;
  ui.dataset.ocrV2 = '1';

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
  const detectedOrder = ['plate','brand','model','version','vin','engine'];
  const knownBrands = [
    'ABARTH','ALFA ROMEO','AUDI','BMW','BYD','CHEVROLET','CITROEN','CITROËN','CUPRA','DACIA','DS AUTOMOBILES',
    'FIAT','FORD','HONDA','HYUNDAI','JAGUAR','JEEP','KIA','LAND ROVER','LEXUS','MAZDA','MERCEDES-BENZ','MERCEDES BENZ',
    'MG','MINI','MITSUBISHI','NISSAN','OPEL','PEUGEOT','PORSCHE','RENAULT','SEAT','SKODA','ŠKODA','SMART','SUBARU',
    'SUZUKI','TESLA','TOYOTA','VOLKSWAGEN','VOLVO'
  ];

  let workerPromise = null;
  let scriptPromise = null;
  let secondPass = false;

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

  function loadScript() {
    if (window.Tesseract?.createWorker) return Promise.resolve(window.Tesseract);
    if (scriptPromise) return scriptPromise;
    scriptPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[src*="tesseract.js@5"]');
      if (existing) {
        if (window.Tesseract?.createWorker) resolve(window.Tesseract);
        else {
          existing.addEventListener('load', () => resolve(window.Tesseract), {once:true});
          existing.addEventListener('error', reject, {once:true});
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
    workerPromise = loadScript().then(Tesseract => Tesseract.createWorker('spa', 1, {
      logger(message) {
        if (message.status === 'recognizing text') {
          const raw = Math.round((message.progress || 0) * 100);
          const percent = secondPass ? 55 + Math.round(raw * .38) : 12 + Math.round(raw * .4);
          setProgress(percent, secondPass ? 'Afinando lectura…' : 'Leyendo documento…');
        } else if (/loading|initializing/i.test(message.status || '')) {
          setProgress(8, 'Preparando lector…');
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
      const ctx = canvas.getContext('2d', {alpha:false, willReadFrequently:true});
      ctx.fillStyle = '#fff';
      ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.drawImage(image,0,0,canvas.width,canvas.height);
      return canvas;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function enhancedCanvas(source) {
    const canvas = document.createElement('canvas');
    canvas.width = source.width;
    canvas.height = source.height;
    const ctx = canvas.getContext('2d', {alpha:false, willReadFrequently:true});
    ctx.drawImage(source,0,0);
    const image = ctx.getImageData(0,0,canvas.width,canvas.height);
    const data = image.data;
    let mean = 0;
    for (let i=0;i<data.length;i+=4) mean += .299*data[i] + .587*data[i+1] + .114*data[i+2];
    mean /= Math.max(1,data.length/4);
    const threshold = Math.max(145, Math.min(205, mean * .88));
    for (let i=0;i<data.length;i+=4) {
      const lum = .299*data[i] + .587*data[i+1] + .114*data[i+2];
      const boosted = Math.max(0, Math.min(255, (lum - 128) * 1.6 + 128));
      const v = boosted > threshold ? 255 : 0;
      data[i]=data[i+1]=data[i+2]=v;
      data[i+3]=255;
    }
    ctx.putImageData(image,0,0);
    return canvas;
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

  function codeToken(letter, number) {
    const variants = number === '1' ? '[1IL]' : number === '2' ? '[2Z]' : number === '3' ? '[3B]' : number;
    return new RegExp(`(?:^|[^A-Z0-9])${letter}\\s*[.·,:;\\-]?\\s*${variants}(?!\\d)`, 'i');
  }

  function looksLikeHeader(value) {
    const text = clean(value).toUpperCase();
    return !text || /^(?:A|B|C|D|E|F|G|J|K|P|Q|S)\s*[.·,:;\-]?\s*[0-9ILZB]?\s*$/.test(text) ||
      /^(?:MARCA|MODELO|DENOMINACI[ÓO]N|TIPO|VARIANTE|VERSI[ÓO]N|BASTIDOR|MATR[IÍ]CULA|CILINDRADA|POTENCIA|COMBUSTIBLE)\b/.test(text);
  }

  function tidyCandidate(value, max = 80) {
    let text = clean(value)
      .replace(/^[:;,.\-–—)\]]+\s*/,'')
      .replace(/^(?:MARCA|MODELO|DENOMINACI[ÓO]N(?:\s+COMERCIAL)?|TIPO(?:\s*\/\s*VARIANTE\s*\/\s*VERSI[ÓO]N)?|VARIANTE(?:\s*\/\s*VERSI[ÓO]N)?|BASTIDOR|CILINDRADA|POTENCIA|COMBUSTIBLE)\s*[:;,.\-–—]?\s*/i,'')
      .replace(/\s+(?=[A-Z]\s*[.·,:;\-]?\s*[0-9ILZB](?:\s*[.·,:;\-]?\s*[0-9ILZB])?\b).*$/i,'')
      .trim();
    if (text.length > max) text = text.slice(0,max).trim();
    if (!text || looksLikeHeader(text)) return '';
    return text;
  }

  function afterCode(lines, letter, number, max = 80) {
    const token = codeToken(letter,number);
    for (let i=0;i<lines.length;i++) {
      const match = token.exec(lines[i]);
      if (!match) continue;
      const start = match.index + match[0].length;
      const inline = tidyCandidate(lines[i].slice(start),max);
      if (inline) return inline;
      for (let j=1;j<=3;j++) {
        const candidate = tidyCandidate(lines[i+j] || '',max);
        if (candidate && !looksLikeHeader(candidate)) return candidate;
      }
    }
    return '';
  }

  function afterLabel(lines, patterns, max = 80) {
    for (let i=0;i<lines.length;i++) {
      for (const source of patterns) {
        const re = new RegExp(`${source}\\s*[:;,.\\-–—]?\\s*(.*)$`,'i');
        const match = lines[i].match(re);
        if (!match) continue;
        const inline = tidyCandidate(match[1],max);
        if (inline) return inline;
        for (let j=1;j<=2;j++) {
          const candidate = tidyCandidate(lines[i+j] || '',max);
          if (candidate && !looksLikeHeader(candidate)) return candidate;
        }
      }
    }
    return '';
  }

  function plateFrom(text) {
    const source = upper(text);
    const modern = source.match(/\b\d{4}\s*[- ]?\s*[BCDFGHJKLMNPRSTVWXYZ]{3}\b/);
    if (modern) return modern[0].replace(/[\s-]+/g,'');
    const old = source.match(/\b[A-Z]{1,2}\s*[- ]?\s*\d{4}\s*[- ]?\s*[A-Z]{1,2}\b/);
    return old ? old[0].replace(/[\s-]+/g,'') : '';
  }

  function vinFrom(text, lines) {
    const direct = afterCode(lines,'E','',60) || afterLabel(lines,['(?:N[ÚU]MERO\\s+DE\\s+)?BASTIDOR','VIN'],60);
    const source = `${direct}\n${text}`.toUpperCase();
    const candidates = source.match(/(?:[A-HJ-NPR-Z0-9][\s\-]*){17}/g) || [];
    for (const raw of candidates) {
      const value = raw.replace(/[^A-HJ-NPR-Z0-9]/g,'');
      if (value.length === 17 && /[A-Z]/.test(value) && /\d/.test(value)) return value;
    }
    return '';
  }

  function knownBrandFrom(text) {
    const source = upper(text).replace(/[^A-ZÁÉÍÓÚÜÑ0-9]+/g,' ');
    return knownBrands.find(brand => new RegExp(`(?:^|\\s)${brand.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}(?:\\s|$)`,'i').test(source)) || '';
  }

  function parse(text) {
    const lines = linesOf(text);
    const brand = tidyCandidate(
      afterCode(lines,'D','1',45) ||
      afterLabel(lines,['MARCA(?:\\s+DEL\\s+VEH[IÍ]CULO)?'],45) ||
      knownBrandFrom(text),45
    );
    const model = tidyCandidate(
      afterCode(lines,'D','3',60) ||
      afterLabel(lines,['DENOMINACI[ÓO]N\\s+COMERCIAL','MODELO'],60),60
    );
    const version = tidyCandidate(
      afterCode(lines,'D','2',80) ||
      afterLabel(lines,['TIPO\\s*\\/?\\s*VARIANTE\\s*\\/?\\s*VERSI[ÓO]N','VARIANTE\\s*\\/?\\s*VERSI[ÓO]N','VERSI[ÓO]N'],80),80
    );
    const displacement = tidyCandidate(afterCode(lines,'P','1',24) || afterLabel(lines,['CILINDRADA'],24),24);
    const power = tidyCandidate(afterCode(lines,'P','2',24) || afterLabel(lines,['POTENCIA'],24),24);
    const fuel = tidyCandidate(afterCode(lines,'P','3',32) || afterLabel(lines,['COMBUSTIBLE','CARBURANTE'],32),32);
    const engine = [
      displacement ? (/cm|cc/i.test(displacement) ? displacement : `${displacement} cm³`) : '',
      power ? (/kw|cv/i.test(power) ? power : `${power} kW`) : '',
      fuel
    ].filter(Boolean).join(' · ');
    return {
      plate: plateFrom(text),
      brand,
      model,
      version,
      vin: vinFrom(text,lines),
      engine
    };
  }

  function score(data) {
    return detectedOrder.reduce((total,name) => total + (clean(data[name]) ? 1 : 0),0);
  }

  function merge(primary, secondary) {
    const out = {};
    detectedOrder.forEach(name => { out[name] = clean(primary[name]) || clean(secondary[name]); });
    return out;
  }

  function fill(data) {
    const filled = [];
    const already = [];
    detectedOrder.forEach(name => {
      const input = field(name);
      const value = clean(data[name]);
      if (!input || !value) return;
      if (clean(input.value)) {
        already.push(name);
        return;
      }
      input.value = ['plate','vin'].includes(name) ? upper(value) : value;
      input.dispatchEvent(new Event('input',{bubbles:true}));
      input.dispatchEvent(new Event('change',{bubbles:true}));
      filled.push(name);
    });
    return {filled,already};
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
      const original = await imageToCanvas(file);
      const worker = await getWorker();
      secondPass = false;
      try { await worker.setParameters({tessedit_pageseg_mode:'3', preserve_interword_spaces:'1'}); } catch (_) {}
      const first = await worker.recognize(original);
      let detected = parse(first.data?.text || '');

      if (score(detected) < 4) {
        secondPass = true;
        setProgress(55,'Afinando lectura…');
        const enhanced = enhancedCanvas(original);
        try { await worker.setParameters({tessedit_pageseg_mode:'6', preserve_interword_spaces:'1'}); } catch (_) {}
        const second = await worker.recognize(enhanced);
        detected = merge(detected, parse(second.data?.text || ''));
      }

      secondPass = false;
      setProgress(96,'Completando datos…');
      const {filled,already} = fill(detected);
      setProgress(100,'Listo');
      const found = score(detected);
      if (filled.length) {
        const extra = already.length ? ` · ${already.length} ya tenían valor` : '';
        setResult(`${filled.length} ${filled.length === 1 ? 'dato completado' : 'datos completados'}${extra}. Revísalos antes de continuar.`, 'success');
      } else if (found) {
        setResult('He reconocido datos, pero los campos correspondientes ya estaban completados.', 'success');
      } else {
        setResult('No he podido leer suficiente información. Prueba con el documento entero, recto, sin reflejos y con buena luz.', 'error');
      }
    } catch (error) {
      console.error('OCR vehículo v2',error);
      setResult('No se ha podido leer la imagen. Prueba otra foto o rellena los datos manualmente.', 'error');
    } finally {
      secondPass = false;
      setTimeout(() => setBusy(false),250);
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

  window.addEventListener('beforeunload',async () => {
    try { const worker = await workerPromise; await worker?.terminate?.(); } catch (_) {}
  });
})();