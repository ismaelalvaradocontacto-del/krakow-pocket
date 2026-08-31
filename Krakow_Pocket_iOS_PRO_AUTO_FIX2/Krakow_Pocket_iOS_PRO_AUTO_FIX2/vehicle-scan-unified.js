(() => {
  const form = document.getElementById('vehicleForm');
  const ui = document.querySelector('.vehicle-scan');
  if (!form || !ui || ui.dataset.unifiedOcr === '6') return;
  ui.dataset.unifiedOcr = '6';

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
    let raw = upper(value)
      .replace(/^(?:D\s*[.·,:;-]?\s*1|MARCA|BRAND)\s*[:;,.·\-–—]?\s*/i, '')
      .replace(/[^A-ZÁÉÍÓÚÜÑ0-9 .&+\-/]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!raw || raw.length < 2 || raw.length > 40 || !/[A-ZÁÉÍÓÚÜÑ]{2}/.test(raw)) return '';
    if (/OBSERV|DOCUMENT|MATR[IÍ]CULA|MODELO|BASTIDOR|COMBUSTIBLE|CILINDRADA|POTENCIA|PART[- ]?SIN/i.test(raw)) return '';

    const known = window.TRASPASO_VEHICLE_MAKES_2026 || [];
    const rawKey = compact(raw);
    const exact = known.find(make => compact(make) === rawKey);
    if (exact) return exact;

    const canon = window.TRASPASO_CANONICALIZE_MAKE?.(raw);
    return canon || raw;
  }

  function modelValue(value) {
    const raw = upper(value)
      .replace(/^(?:D\s*[.·,:;-]?\s*3|MODELO|DENOMINACI[ÓO]N\s+COMERCIAL)\s*[:;,.·\-–—]?\s*/i, '')
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
    if (raw.length < 17 || raw.length > 22) return '';

    for (let i = 0; i <= raw.length - 17; i += 1) {
      const piece = raw.slice(i, i + 17);
      const letters = (piece.match(/[A-Z]/g) || []).length;
      const digits = (piece.match(/\d/g) || []).length;
      if (letters < 3 || digits < 3) continue;

      const candidate = piece.replace(/O/g, '0').replace(/I/g, '1').replace(/Q/g, '0');
      if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(candidate)) continue;
      return candidate;
    }
    return '';
  }

  function validate(name, value) {
    if (name === 'brand') return canonicalBrand(value);
    if (name === 'model') return modelValue(value);
    if (name === 'vin') return vinValue(value);
    if (name === 'plate') return plateValue(value);
    return '';
  }

  function normalizeManual(name, value) {
    const raw = upper(value);
    if (name === 'brand' || name === 'model') return raw;
    return raw.replace(/\s+/g, '');
  }

  names.forEach(name => {
    const input = field(name);
    if (!input) return;
    input.autocapitalize = 'characters';
    input.autocomplete = 'off';
    input.spellcheck = false;

    input.addEventListener('input', event => {
      if (writing || event.isComposing) return;
      input.value = normalizeManual(name, input.value);
    });

    input.addEventListener('blur', () => {
      const checked = validate(name, input.value);
      if (checked) input.value = checked;
    });
  });

  [0, 120, 500].forEach(delay => setTimeout(() => {
    names.forEach(name => {
      const input = field(name);
      if (input?.value) input.value = normalizeManual(name, input.value);
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
            template:[8,58,'Leyendo campos…'],
            base:[12,48,'Leyendo documento…'],
            enhanced:[62,25,'Mejorando lectura…'],
            rotated:[88,9,'Comprobando orientación…']
          };
          const [start, span, copy] = maps[stage] || maps.base;
          setProgress(start + Math.round(raw * span / 100), copy);
        } else if (/loading|initializing/i.test(message.status || '')) {
          setProgress(6, 'Preparando lector…');
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

      if (shortest < 1100) {
        scale = Math.min(maxSide / longest, Math.max(scale, Math.min(2.2, 1400 / Math.max(1, shortest))));
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
      const lum = Math.round(.299*data[i] + .587*data[i+1] + .114*data[i+2]);
      histogram[lum] += 1;
    }

    const total = out.width*out.height;
    let acc = 0;
    let low = 0;
    let high = 255;

    for (let i = 0; i < 256; i += 1) {
      acc += histogram[i];
      if (acc >= total*.012) { low = i; break; }
    }

    acc = 0;
    for (let i = 0; i < 256; i += 1) {
      acc += histogram[i];
      if (acc >= total*.988) { high = i; break; }
    }

    if (high-low < 50) {
      low = Math.max(0,low-25);
      high = Math.min(255,high+25);
    }

    const span = Math.max(1,high-low);

    for (let i = 0; i < data.length; i += 4) {
      const lum = .299*data[i] + .587*data[i+1] + .114*data[i+2];
      let value = ((lum-low)*255)/span;
      value = (Math.max(0,Math.min(255,value))-128)*1.22+128;
      value = Math.max(0,Math.min(255,value));
      data[i] = data[i+1] = data[i+2] = value;
      data[i+3] = 255;
    }

    ctx.putImageData(image,0,0);
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

  function isKnownPermitLayout(source) {
    const ratio = source.width/source.height;
    return source.width > source.height && ratio >= 1.28 && ratio <= 1.55;
  }

  const TEMPLATE_ROWS = {
    plate:{x:.09,y:.025,w:.38,h:.085, whitelist:'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-'},
    vin:{x:.575,y:.025,w:.405,h:.085, whitelist:'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'},
    brand:{x:.09,y:.705,w:.39,h:.09, whitelist:'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .&+-/'},
    model:{x:.09,y:.835,w:.39,h:.065, whitelist:'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .+-/_'}
  };

  function cropRow(source, spec, enhanced = false) {
    const sx = Math.max(0,Math.round(source.width*spec.x));
    const sy = Math.max(0,Math.round(source.height*spec.y));
    const sw = Math.max(1,Math.min(source.width-sx,Math.round(source.width*spec.w)));
    const sh = Math.max(1,Math.min(source.height-sy,Math.round(source.height*spec.h)));

    const scale = Math.max(3, Math.min(6, 1700/Math.max(sw,1)));
    const out = document.createElement('canvas');
    out.width = Math.max(1,Math.round(sw*scale));
    out.height = Math.max(1,Math.round(sh*scale));

    const ctx = out.getContext('2d', { alpha:false, willReadFrequently:true });
    ctx.fillStyle = '#fff';
    ctx.fillRect(0,0,out.width,out.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source,sx,sy,sw,sh,0,0,out.width,out.height);

    if (!enhanced) return out;

    const image = ctx.getImageData(0,0,out.width,out.height);
    const data = image.data;
    for (let i = 0; i < data.length; i += 4) {
      const lum = .299*data[i] + .587*data[i+1] + .114*data[i+2];
      let value = (lum-128)*1.45+128;
      value = Math.max(0,Math.min(255,value));
      data[i] = data[i+1] = data[i+2] = value;
      data[i+3] = 255;
    }
    ctx.putImageData(image,0,0);
    return out;
  }

  function cropText(name, text) {
    const lines = String(text || '')
      .replace(/\r/g,'\n')
      .split(/\n+/)
      .map(line => clean(line))
      .filter(Boolean);

    for (const line of lines) {
      const value = validate(name,line);
      if (value) return value;
    }

    const joined = clean(lines.join(' '));
    return validate(name,joined);
  }

  async function recognize(worker, canvas, psm, timeout, whitelist = '') {
    try {
      await worker.setParameters({
        tessedit_pageseg_mode:String(psm),
        preserve_interword_spaces:'1',
        tessedit_char_whitelist:whitelist
      });
    } catch (_) {}

    return withTimeout(worker.recognize(canvas, {}, { text:true, tsv:true }), timeout);
  }

  async function readTemplateRows(worker, source) {
    if (!isKnownPermitLayout(source)) return {};

    stage = 'template';
    const out = {};
    const order = ['plate','vin','brand','model'];

    for (let i = 0; i < order.length; i += 1) {
      const name = order[i];
      const spec = TEMPLATE_ROWS[name];
      setProgress(8 + i*13, `Leyendo ${name === 'plate' ? 'matrícula' : name === 'vin' ? 'bastidor' : name === 'brand' ? 'marca' : 'modelo'}…`);

      try {
        const first = await recognize(worker,cropRow(source,spec,false),7,7500,spec.whitelist);
        out[name] = cropText(name,first?.data?.text || '');

        if (!out[name]) {
          const second = await recognize(worker,cropRow(source,spec,true),7,6500,spec.whitelist);
          out[name] = cropText(name,second?.data?.text || '');
        }
      } catch (error) {
        if (error?.code === 'OCR_TIMEOUT') resetWorker();
      }
    }

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

  function sameLineValue(lines, regex, validator) {
    for (const line of lines) {
      const match = line.match(regex);
      if (!match) continue;
      const value = validator(match[1] || '');
      if (value) return value;
    }
    return '';
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

  function spatialData(words) {
    const out = {};
    const labels = [];

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
      if (out[label.name]) continue;

      const tolerance = Math.max(18,label.h*1.4);
      const candidates = words
        .filter(word => word.x > label.right+2 && Math.abs(word.cy-label.cy) <= tolerance)
        .sort((a,b) => a.x-b.x);

      if (!candidates.length) continue;

      const picked = [];
      let lastRight = label.right;

      for (const word of candidates) {
        if (codeFrom(word.text)) break;
        if (picked.length && word.x-lastRight > Math.max(100,word.h*6)) break;

        picked.push(word.text);
        lastRight = word.right;

        const value = validate(label.name,picked.join(' '));
        if ((label.name === 'plate' || label.name === 'vin') && value) break;
      }

      const value = validate(label.name,picked.join(' '));
      if (value) out[label.name] = value;
    }

    return out;
  }

  function parseGeneric(response) {
    const text = response?.data?.text || '';
    const lines = linesOf(text);
    const out = {
      plate:sameLineValue(lines,/^\s*A\s*[:;,.·\-–—]?\s*(.+)$/i,plateValue),
      vin:sameLineValue(lines,/^\s*E\s*[:;,.·\-–—]?\s*(.+)$/i,vinValue),
      brand:sameLineValue(lines,/^\s*[D0]\s*[.·,:;\-]?\s*[1IL]\s*[:;,.·\-–—]?\s*(.+)$/i,canonicalBrand),
      model:sameLineValue(lines,/^\s*[D0]\s*[.·,:;\-]?\s*[3B]\s*[:;,.·\-–—]?\s*(.+)$/i,modelValue)
    };

    const spatial = spatialData(parseTsv(response?.data?.tsv || ''));
    names.forEach(name => {
      if (!out[name] && spatial[name]) out[name] = spatial[name];
    });

    if (!out.plate) {
      const modern = upper(text).match(/\b\d{4}\s*[BCDFGHJKLMNPRSTVWXYZ]{3}\b/);
      if (modern) out.plate = modern[0].replace(/\s+/g,'');
    }

    if (!out.brand) {
      const makes = window.TRASPASO_VEHICLE_MAKES_2026 || [];
      for (const line of lines) {
        const key = compact(line);
        const known = makes.find(make => compact(make) === key);
        if (known) {
          out.brand = known;
          break;
        }
      }
    }

    return out;
  }

  function merge(primary, secondary) {
    const out = {};
    names.forEach(name => {
      out[name] = clean(primary[name]) || clean(secondary[name]);
    });
    return out;
  }

  function count(data) {
    return names.reduce((total,name) => total + (clean(data[name]) ? 1 : 0),0);
  }

  function fill(data) {
    writing = true;
    try {
      names.forEach(name => {
        const input = field(name);
        if (!input) return;

        const value = validate(name,data[name] || '');
        input.value = value;

        if (value) input.dataset.ocrFilled = '1';
        else delete input.dataset.ocrFilled;

        input.dispatchEvent(new Event('input',{bubbles:true}));
        input.dispatchEvent(new Event('change',{bubbles:true}));
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

      let detected = {};

      if (isKnownPermitLayout(source)) {
        detected = await readTemplateRows(worker,source);
      }

      if (count(detected) < 4) {
        stage = 'base';
        setProgress(62,'Completando lectura…');
        try {
          const response = await recognize(worker,source,11,18000,'');
          detected = merge(detected,parseGeneric(response));
        } catch (error) {
          if (error?.code === 'OCR_TIMEOUT') resetWorker();
        }
      }

      if (count(detected) < 4) {
        stage = 'enhanced';
        setProgress(78,'Mejorando imagen…');
        try {
          const response = await recognize(worker,enhanceCanvas(source),11,13000,'');
          detected = merge(detected,parseGeneric(response));
        } catch (error) {
          if (error?.code === 'OCR_TIMEOUT') resetWorker();
        }
      }

      if (count(detected) <= 1 && source.height > source.width*1.15) {
        stage = 'rotated';
        setProgress(88,'Comprobando orientación…');
        try {
          const response = await recognize(worker,rotateCanvas(source),11,10000,'');
          detected = merge(detected,parseGeneric(response));
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

      if (found === 4) {
        setResult('4 datos identificados.','success');
      } else if (found > 0) {
        setResult(`${found} de 4 datos identificados. Revisa los que faltan.`,'success');
      } else {
        setResult('No he podido identificar los datos con seguridad. Prueba con otra foto o complétalos manualmente.','error');
      }
    } catch (error) {
      console.error('OCR vehículo v6',error);
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
    process(file).finally(() => {
      event.target.value = '';
    });
  }

  cameraInput.addEventListener('change',intercept,{capture:true});
  uploadInput.addEventListener('change',intercept,{capture:true});
  window.addEventListener('beforeunload',() => resetWorker());
})();