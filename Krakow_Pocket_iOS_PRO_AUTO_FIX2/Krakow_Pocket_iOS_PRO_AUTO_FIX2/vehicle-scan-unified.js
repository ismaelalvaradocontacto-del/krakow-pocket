(() => {
  const form = document.getElementById('vehicleForm');
  const ui = document.querySelector('.vehicle-scan');
  if (!form || !ui || ui.dataset.unifiedOcr === '1') return;
  ui.dataset.unifiedOcr = '1';

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
  const clean = value => String(value ?? '').replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/g, ' ').trim();
  const upper = value => clean(value).toLocaleUpperCase('es-ES');
  const compact = value => upper(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]/g, '');

  let tesseractPromise = null;
  let workerPromise = null;
  let running = false;
  let stage = 'base';
  let writing = false;

  function normalizeField(name, value) {
    let out = upper(value);
    if (!out) return '';
    if (name === 'brand') return window.TRASPASO_CANONICALIZE_MAKE?.(out) || out;
    if (name === 'model') return out.replace(/\s+/g, ' ');
    if (name === 'vin') return out.replace(/[^A-Z0-9]/g, '').replace(/O/g, '0').replace(/I/g, '1').replace(/Q/g, '0');
    if (name === 'plate') return out.replace(/[^A-Z0-9-]/g, '');
    return out;
  }

  names.forEach(name => {
    const input = field(name);
    if (!input) return;
    input.autocapitalize = 'characters';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.addEventListener('input', event => {
      if (writing || event.isComposing) return;
      const next = normalizeField(name, input.value);
      if (input.value !== next) input.value = next;
    });
    input.addEventListener('blur', () => {
      const next = normalizeField(name, input.value);
      if (input.value !== next) input.value = next;
    });
  });

  [0, 100, 400].forEach(delay => setTimeout(() => {
    names.forEach(name => {
      const input = field(name);
      if (input?.value) input.value = normalizeField(name, input.value);
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
          const map = {
            base:[12,52,'Leyendo documento…'],
            enhanced:[66,22,'Mejorando lectura…'],
            focus:[89,8,'Completando campos…'],
            rotated:[89,8,'Comprobando orientación…']
          };
          const [start, span, copy] = map[stage] || map.base;
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
    const hist = new Uint32Array(256);
    for (let i=0;i<data.length;i+=4) {
      const lum = Math.round(.299*data[i] + .587*data[i+1] + .114*data[i+2]);
      hist[lum] += 1;
    }
    const total = out.width*out.height;
    let acc=0, low=0, high=255;
    for (let i=0;i<256;i+=1) { acc += hist[i]; if (acc >= total*.012) { low=i; break; } }
    acc=0;
    for (let i=0;i<256;i+=1) { acc += hist[i]; if (acc >= total*.988) { high=i; break; } }
    if (high-low < 50) { low=Math.max(0,low-25); high=Math.min(255,high+25); }
    const span=Math.max(1,high-low);
    for (let i=0;i<data.length;i+=4) {
      const lum=.299*data[i] + .587*data[i+1] + .114*data[i+2];
      let v=((lum-low)*255)/span;
      v=(Math.max(0,Math.min(255,v))-128)*1.22+128;
      v=Math.max(0,Math.min(255,v));
      data[i]=data[i+1]=data[i+2]=v; data[i+3]=255;
    }
    ctx.putImageData(image,0,0);
    return out;
  }

  function rotateCanvas(source) {
    const out = document.createElement('canvas');
    out.width = source.height;
    out.height = source.width;
    const ctx = out.getContext('2d', { alpha:false });
    ctx.fillStyle='#fff'; ctx.fillRect(0,0,out.width,out.height);
    ctx.translate(out.width/2,out.height/2);
    ctx.rotate(Math.PI/2);
    ctx.drawImage(source,-source.width/2,-source.height/2);
    return out;
  }

  function linesOf(text) {
    return String(text || '').normalize('NFKC').replace(/\r/g,'\n').replace(/[|¦]/g,'I')
      .split(/\n+/).map(line => line.replace(/[\t ]+/g,' ').trim()).filter(Boolean);
  }

  const labelPatterns = {
    A:/^\s*A\s*[:;,.·\-–—]?\s*(.*)$/i,
    E:/^\s*E\s*[:;,.·\-–—]?\s*(.*)$/i,
    D1:/^\s*[D0]\s*[.·,:;\-]?\s*[1IL]\s*[:;,.·\-–—]?\s*(.*)$/i,
    D3:/^\s*[D0]\s*[.·,:;\-]?\s*[3B]\s*[:;,.·\-–—]?\s*(.*)$/i
  };

  function looksCode(value) {
    return /^(?:A|B|E|H|I|F\s*[.·]?\s*[12]|G|K|P\s*[.·]?\s*[123]|Q|S\s*[.·]?\s*[12]|C\s*[.·]?\s*[0-9]|D\s*[.·]?\s*[1234])\b/i.test(clean(value));
  }

  function valueAfter(lines, code) {
    const pattern = labelPatterns[code];
    for (let i=0;i<lines.length;i+=1) {
      const m=lines[i].match(pattern);
      if (!m) continue;
      const inline=clean(m[1]||'');
      if (inline && !looksCode(inline)) return inline;
      for (let j=1;j<=2;j+=1) {
        const next=clean(lines[i+j]||'');
        if (next && !looksCode(next)) return next;
      }
    }
    return '';
  }

  function plateValue(raw) {
    const source=upper(raw).replace(/[^A-Z0-9-]/g,'');
    const modern=source.match(/\d{4}[BCDFGHJKLMNPRSTVWXYZ]{3}/);
    if (modern) return modern[0];
    if (source.length>=4 && source.length<=14 && /\d/.test(source) && /[A-Z]/.test(source)) return source;
    return '';
  }

  function vinValue(raw) {
    const source=upper(raw).replace(/[^A-Z0-9]/g,'');
    for (let i=0;i<=source.length-17;i+=1) {
      const value=source.slice(i,i+17).replace(/O/g,'0').replace(/I/g,'1').replace(/Q/g,'0');
      if (/^[A-HJ-NPR-Z0-9]{17}$/.test(value) && /[A-Z]/.test(value) && /\d/.test(value) && !/FECHA|METRAJ|KILOMET|DOCUMENT|OBSERV/.test(value)) return value;
    }
    return '';
  }

  function brandValue(raw) {
    const value=upper(raw).replace(/[^A-ZÁÉÍÓÚÜÑ0-9 .&+\-/]/g,' ').replace(/\s+/g,' ').trim();
    if (value.length<2 || value.length>40 || !/[A-ZÁÉÍÓÚÜÑ]{2}/.test(value)) return '';
    return window.TRASPASO_CANONICALIZE_MAKE?.(value) || value;
  }

  function modelValue(raw) {
    const value=upper(raw).replace(/[^A-Z0-9 .+\-_/]/g,' ').replace(/\s+/g,' ').trim();
    if (value.length<2 || value.length>55 || looksCode(value)) return '';
    return value;
  }

  function validate(code, raw) {
    if (code==='A') return plateValue(raw);
    if (code==='E') return vinValue(raw);
    if (code==='D1') return brandValue(raw);
    if (code==='D3') return modelValue(raw);
    return '';
  }

  function parseText(text) {
    const lines=linesOf(text);
    const out={
      plate:plateValue(valueAfter(lines,'A')),
      vin:vinValue(valueAfter(lines,'E')),
      brand:brandValue(valueAfter(lines,'D1')),
      model:modelValue(valueAfter(lines,'D3'))
    };
    if (!out.plate) {
      const m=upper(text).match(/\b\d{4}\s*[BCDFGHJKLMNPRSTVWXYZ]{3}\b/);
      if (m) out.plate=m[0].replace(/\s+/g,'');
    }
    if (!out.vin) out.vin=vinValue(text);
    if (!out.brand) {
      const makes=window.TRASPASO_VEHICLE_MAKES_2026 || [];
      for (const line of lines) {
        const lk=compact(line);
        const make=makes.find(item => compact(item)===lk);
        if (make) { out.brand=make; break; }
      }
    }
    return out;
  }

  function parseTsv(tsv) {
    const rows=String(tsv||'').split(/\r?\n/);
    const words=[];
    for (let i=1;i<rows.length;i+=1) {
      const c=rows[i].split('\t');
      if (c.length<12 || Number(c[0])!==5) continue;
      const text=clean(c.slice(11).join('\t'));
      if (!text) continue;
      const w={text,x:Number(c[6])||0,y:Number(c[7])||0,w:Number(c[8])||0,h:Number(c[9])||0,block:Number(c[2])||0,par:Number(c[3])||0,line:Number(c[4])||0};
      w.right=w.x+w.w; w.cy=w.y+w.h/2;
      words.push(w);
    }
    return words;
  }

  function codeFrom(raw) {
    const key=compact(raw);
    if (key==='A') return 'A';
    if (key==='E') return 'E';
    if (/^[D0][1IL]$/.test(key)) return 'D1';
    if (/^[D0][3B]$/.test(key)) return 'D3';
    return '';
  }

  function spatialCodes(words) {
    const out={};
    const labels=[];
    for (let i=0;i<words.length;i+=1) {
      let code=codeFrom(words[i].text), right=words[i].right, cy=words[i].cy, h=words[i].h;
      if (!code && i+1<words.length) {
        const next=words[i+1];
        if (Math.abs(next.cy-cy)<=Math.max(h,next.h)) {
          code=codeFrom(words[i].text+next.text);
          if (code) { right=Math.max(right,next.right); cy=(cy+next.cy)/2; h=Math.max(h,next.h); }
        }
      }
      if (code) labels.push({code,right,cy,h});
    }

    for (const label of labels) {
      if (out[label.code]) continue;
      const tol=Math.max(16,label.h*1.35);
      const candidates=words.filter(w => w.x>label.right+1 && Math.abs(w.cy-label.cy)<=tol).sort((a,b)=>a.x-b.x);
      const picked=[];
      let lastRight=label.right;
      for (const word of candidates) {
        if (codeFrom(word.text)) break;
        if (picked.length && word.x-lastRight>Math.max(95,word.h*6)) break;
        picked.push(word.text); lastRight=word.right;
        if ((label.code==='A'||label.code==='E') && validate(label.code,picked.join(' '))) break;
      }
      const value=validate(label.code,picked.join(' '));
      if (value) out[label.code]=value;
    }
    return out;
  }

  function fromResponse(response) {
    const text=parseText(response?.data?.text || '');
    const codes=spatialCodes(parseTsv(response?.data?.tsv || ''));
    return {
      brand:codes.D1 || text.brand || '',
      model:codes.D3 || text.model || '',
      vin:codes.E || text.vin || '',
      plate:codes.A || text.plate || ''
    };
  }

  function merge(a,b) {
    const out={}; names.forEach(name => { out[name]=clean(a[name]) || clean(b[name]); }); return out;
  }
  function count(data) { return names.reduce((n,name)=>n+(clean(data[name])?1:0),0); }

  function rect(source,x,y,w,h) {
    return {x:Math.round(source.width*x),y:Math.round(source.height*y),w:Math.round(source.width*w),h:Math.round(source.height*h)};
  }

  function focusSheet(source, missing) {
    const ratio=source.width/source.height;
    if (ratio<1.15 || ratio>1.8) return null;
    const specs={plate:['A',rect(source,.03,.00,.48,.14)],vin:['E',rect(source,.52,.00,.47,.14)],brand:['D.1',rect(source,.03,.67,.48,.14)],model:['D.3',rect(source,.03,.79,.48,.14)]};
    const regions=missing.map(name=>specs[name]).filter(Boolean);
    if (!regions.length) return null;
    const sheet=document.createElement('canvas'); sheet.width=1500; sheet.height=220*regions.length;
    const ctx=sheet.getContext('2d',{alpha:false}); ctx.fillStyle='#fff'; ctx.fillRect(0,0,sheet.width,sheet.height); ctx.fillStyle='#111'; ctx.font='700 48px Arial'; ctx.textBaseline='middle';
    regions.forEach(([label,box],i)=>{const y=i*220;ctx.fillText(label,18,y+110);ctx.drawImage(source,box.x,box.y,box.w,box.h,145,y+10,1335,200);});
    return sheet;
  }

  async function recognize(worker, canvas, psm, timeout) {
    try { await worker.setParameters({tessedit_pageseg_mode:String(psm),preserve_interword_spaces:'1',tessedit_char_whitelist:''}); } catch (_) {}
    return withTimeout(worker.recognize(canvas, {}, {text:true,tsv:true}), timeout);
  }

  function fill(data) {
    writing=true;
    try {
      names.forEach(name => {
        const input=field(name); if (!input) return;
        input.value=normalizeField(name,data[name]||'');
        if (input.value) input.dataset.ocrFilled='1'; else delete input.dataset.ocrFilled;
        input.dispatchEvent(new Event('input',{bubbles:true}));
        input.dispatchEvent(new Event('change',{bubbles:true}));
      });
    } finally { writing=false; }
  }

  async function process(file) {
    if (!file || !file.type?.startsWith('image/') || running) return;
    clearVehicleIdentity();
    setBusy(true); setResult(''); setProgress(3,'Preparando imagen…');
    try {
      const source=await fileToCanvas(file);
      const worker=await getWorker();
      stage='base';
      const first=await recognize(worker,source,11,22000);
      let detected=fromResponse(first);

      if (count(detected)<4) {
        stage='enhanced'; setProgress(66,'Mejorando imagen…');
        try {
          const second=await recognize(worker,enhanceCanvas(source),11,15000);
          detected=merge(detected,fromResponse(second));
        } catch (error) { if (error?.code==='OCR_TIMEOUT') resetWorker(); }
      }

      if (count(detected)<4) {
        const missing=names.filter(name=>!clean(detected[name]));
        const focus=focusSheet(source,missing);
        if (focus) {
          stage='focus'; setProgress(89,'Completando campos…');
          try {
            const third=await recognize(worker,focus,6,10000);
            detected=merge(detected,fromResponse(third));
          } catch (error) { if (error?.code==='OCR_TIMEOUT') resetWorker(); }
        }
      }

      if (count(detected)<=1 && source.height>source.width*1.15) {
        stage='rotated'; setProgress(89,'Comprobando orientación…');
        try {
          const fourth=await recognize(worker,rotateCanvas(source),11,10000);
          detected=merge(detected,fromResponse(fourth));
        } catch (error) { if (error?.code==='OCR_TIMEOUT') resetWorker(); }
      }

      fill(detected);
      const found=count(detected); setProgress(100,'Listo');
      if (found===4) setResult('4 datos identificados.','success');
      else if (found>0) setResult(`${found} de 4 datos identificados. Revisa los que faltan.`,'success');
      else setResult('No he podido identificar los datos. Prueba con otra foto o completa los datos manualmente.','error');
    } catch (error) {
      console.error('OCR unificado de vehículo',error);
      if (error?.code==='OCR_TIMEOUT') { resetWorker(); setResult('La lectura ha tardado demasiado. Puedes volver a intentarlo.','error'); }
      else setResult('No se ha podido leer la imagen. Inténtalo de nuevo o completa los datos manualmente.','error');
    } finally { stage='base'; setBusy(false); }
  }

  function intercept(event) {
    const file=event.target.files?.[0];
    if (!file) return;
    event.stopImmediatePropagation();
    process(file).finally(()=>{ event.target.value=''; });
  }

  cameraInput.addEventListener('change',intercept,{capture:true});
  uploadInput.addEventListener('change',intercept,{capture:true});
  window.addEventListener('beforeunload',()=>resetWorker());
})();