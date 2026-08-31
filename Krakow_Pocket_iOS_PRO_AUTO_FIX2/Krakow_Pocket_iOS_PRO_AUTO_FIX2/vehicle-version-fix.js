(() => {
  const form = document.getElementById('vehicleForm');
  const ui = document.querySelector('.vehicle-scan');
  if (!form || !ui || ui.dataset.versionRefiner === '1') return;
  ui.dataset.versionRefiner = '1';

  const versionInput = form.elements.namedItem('version');
  const result = ui.querySelector('.vehicle-scan-result');
  const cameraInput = ui.querySelector('.scan-input-camera');
  const uploadInput = ui.querySelector('.scan-input-upload');
  if (!versionInput || !result || !cameraInput || !uploadInput) return;

  let pendingFile = null;
  let workerPromise = null;
  let running = false;
  let lastSignature = '';

  function captureFile(event) {
    const file = event.target.files?.[0];
    if (file?.type?.startsWith('image/')) pendingFile = file;
  }
  cameraInput.addEventListener('change', captureFile, { capture:true });
  uploadInput.addEventListener('change', captureFile, { capture:true });

  async function getWorker() {
    if (workerPromise) return workerPromise;
    const wait = async () => {
      for (let i = 0; i < 80; i += 1) {
        if (window.Tesseract?.createWorker) return window.Tesseract;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      throw new Error('Tesseract no disponible');
    };
    workerPromise = wait().then(Tesseract => Tesseract.createWorker('eng'));
    return workerPromise;
  }

  async function loadCanvas(file) {
    const url = URL.createObjectURL(file);
    try {
      const image = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
      });
      const maxSide = 3000;
      const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
      const source = document.createElement('canvas');
      source.width = Math.max(1, Math.round(image.naturalWidth * scale));
      source.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const ctx = source.getContext('2d', { alpha:false, willReadFrequently:true });
      ctx.fillStyle = '#fff';
      ctx.fillRect(0,0,source.width,source.height);
      ctx.drawImage(image,0,0,source.width,source.height);
      return source;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function cropD2(source, threshold = false) {
    const ratio = source.width / source.height;
    if (ratio < 1.2 || ratio > 1.65) return null;
    const x = Math.round(source.width * .09);
    const y = Math.round(source.height * .765);
    const w = Math.round(source.width * .39);
    const h = Math.round(source.height * .115);
    const scale = 3;
    const out = document.createElement('canvas');
    out.width = w * scale;
    out.height = h * scale;
    const ctx = out.getContext('2d', { alpha:false, willReadFrequently:true });
    ctx.fillStyle = '#fff';
    ctx.fillRect(0,0,out.width,out.height);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(source,x,y,w,h,0,0,out.width,out.height);

    if (threshold) {
      const image = ctx.getImageData(0,0,out.width,out.height);
      const data = image.data;
      for (let i = 0; i < data.length; i += 4) {
        const lum = .299*data[i] + .587*data[i+1] + .114*data[i+2];
        const v = lum > 186 ? 255 : 0;
        data[i] = data[i+1] = data[i+2] = v;
        data[i+3] = 255;
      }
      ctx.putImageData(image,0,0);
    }
    return out;
  }

  function normalize(raw) {
    let value = String(raw || '').toUpperCase().replace(/\s+/g,'').trim();
    value = value
      .replace(/[—–_]+/g,'-')
      .replace(/[^A-Z0-9\-\/.*]/g,'')
      .replace(/^[D0]?2[.:-]?/,'')
      .replace(/[.*]+$/,'')
      .replace(/\/{2,}/g,'/')
      .replace(/-{2,}$/,'')
      .replace(/^[-/]+|[-/]+$/g,'');
    if (value.length < 4 || value.length > 40) return '';
    return value;
  }

  function score(value) {
    if (!value) return -99;
    let points = 0;
    if (/[A-Z]/.test(value)) points += 2;
    if (/\d/.test(value)) points += 2;
    if (value.includes('/')) points += 4;
    if (value.includes('-')) points += 3;
    if (/^[A-Z]-[A-Z]\/[A-Z0-9]+/.test(value)) points += 4;
    if (/\.$/.test(value)) points -= 4;
    if (/^[A-Z]{7,}$/.test(value)) points -= 3;
    if (/[!|]/.test(value)) points -= 5;
    return points;
  }

  async function recognize(worker, canvas, psm, whitelist) {
    try {
      await worker.setParameters({
        tessedit_pageseg_mode:String(psm),
        preserve_interword_spaces:'1',
        tessedit_char_whitelist:whitelist
      });
    } catch (_) {}
    const { data } = await worker.recognize(canvas);
    return normalize(data?.text || '');
  }

  async function refine(file) {
    if (!file || running || versionInput.dataset.manualAfterOcr === '1') return;
    const signature = `${file.name}|${file.size}|${file.lastModified}`;
    if (signature === lastSignature) return;
    lastSignature = signature;
    running = true;
    try {
      const source = await loadCanvas(file);
      const normal = cropD2(source,false);
      const highContrast = cropD2(source,true);
      if (!normal || !highContrast) return;
      const worker = await getWorker();
      const whitelist = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_/.*';
      const candidates = [];
      candidates.push(await recognize(worker,normal,7,whitelist));
      candidates.push(await recognize(worker,highContrast,7,whitelist));
      candidates.push(await recognize(worker,normal,13,whitelist));
      const best = candidates.filter(Boolean).sort((a,b) => score(b) - score(a))[0] || '';
      if (!best || score(best) < 4) return;

      const current = normalize(versionInput.value);
      if (best === current) return;
      if (score(best) >= score(current) + 2 || !current) {
        versionInput.value = best;
        versionInput.dataset.ocrFilled = '1';
        versionInput.dispatchEvent(new Event('input',{bubbles:true}));
        versionInput.dispatchEvent(new Event('change',{bubbles:true}));
        delete versionInput.dataset.manualAfterOcr;
        if (result.textContent && !/versión comprobada/i.test(result.textContent)) {
          result.textContent = `${result.textContent.replace(/\s*$/,'')} · Versión comprobada.`;
        }
      }
    } catch (error) {
      console.warn('No se pudo refinar D.2', error);
    } finally {
      running = false;
      pendingFile = null;
    }
  }

  const observer = new MutationObserver(() => {
    if (!pendingFile || running) return;
    const text = result.textContent.trim();
    if (!text || /leyendo|preparando|comprobando/i.test(text)) return;
    setTimeout(() => refine(pendingFile), 80);
  });
  observer.observe(result,{childList:true,subtree:true,characterData:true});

  window.addEventListener('beforeunload', async () => {
    try { const worker = await workerPromise; await worker?.terminate?.(); } catch (_) {}
  });
})();