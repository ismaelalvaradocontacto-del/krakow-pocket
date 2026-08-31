(() => {
  const form = document.getElementById('vehicleForm');
  const ui = document.querySelector('.vehicle-scan');
  if (!form || !ui || ui.dataset.versionRefiner === '2') return;
  ui.dataset.versionRefiner = '2';

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
      for (let i = 0; i < 100; i += 1) {
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
      const maxSide = 3200;
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

  function cropD2(source, mode = 'gray') {
    const ratio = source.width / source.height;
    if (ratio < 1.2 || ratio > 1.65) return null;

    // Permiso español horizontal: fila D.2 exacta, sin invadir D.1 ni D.3.
    const x = Math.round(source.width * .075);
    const y = Math.round(source.height * .785);
    const w = Math.round(source.width * .405);
    const h = Math.round(source.height * .057);
    const scale = 6;

    const out = document.createElement('canvas');
    out.width = Math.max(1, w * scale);
    out.height = Math.max(1, h * scale);
    const ctx = out.getContext('2d', { alpha:false, willReadFrequently:true });
    ctx.fillStyle = '#fff';
    ctx.fillRect(0,0,out.width,out.height);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(source,x,y,w,h,0,0,out.width,out.height);

    const image = ctx.getImageData(0,0,out.width,out.height);
    const data = image.data;
    for (let i = 0; i < data.length; i += 4) {
      const lum = .299*data[i] + .587*data[i+1] + .114*data[i+2];
      let v = lum;
      if (mode === 'contrast') v = Math.max(0, Math.min(255, (lum - 128) * 2 + 128));
      if (mode === 'threshold') v = lum > 150 ? 255 : 0;
      data[i] = data[i+1] = data[i+2] = v;
      data[i+3] = 255;
    }
    ctx.putImageData(image,0,0);
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
      .replace(/[-_.*]{2,}$/,'')
      .replace(/^[-/]+|[-/]+$/g,'');
    if (value.length < 4 || value.length > 40) return '';
    return value;
  }

  function score(value) {
    if (!value) return -99;
    let points = 0;
    if (/[A-Z]/.test(value)) points += 2;
    if (/\d/.test(value)) points += 2;
    if (value.includes('/')) points += 5;
    if (value.includes('-')) points += 4;
    if (/^[A-Z]-[A-Z]\/[A-Z0-9]+/.test(value)) points += 6;
    if (/^[A-Z]{7,}$/.test(value)) points -= 5;
    if (/[!|]/.test(value)) points -= 6;
    if (/\.[A-Z]?$/.test(value)) points -= 4;
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
      const gray = cropD2(source,'gray');
      const contrast = cropD2(source,'contrast');
      const threshold = cropD2(source,'threshold');
      if (!gray || !contrast || !threshold) return;

      const worker = await getWorker();
      const whitelist = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_/.*';
      const candidates = [
        await recognize(worker,gray,6,whitelist),
        await recognize(worker,gray,7,whitelist),
        await recognize(worker,contrast,6,whitelist),
        await recognize(worker,contrast,7,whitelist),
        await recognize(worker,threshold,6,whitelist)
      ].filter(Boolean);

      const best = candidates.sort((a,b) => score(b) - score(a))[0] || '';
      if (!best || score(best) < 6) return;

      const current = normalize(versionInput.value);
      if (best === current) return;
      if (!current || score(best) >= score(current) + 2) {
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
    setTimeout(() => refine(pendingFile), 100);
  });
  observer.observe(result,{childList:true,subtree:true,characterData:true});

  window.addEventListener('beforeunload', async () => {
    try { const worker = await workerPromise; await worker?.terminate?.(); } catch (_) {}
  });
})();