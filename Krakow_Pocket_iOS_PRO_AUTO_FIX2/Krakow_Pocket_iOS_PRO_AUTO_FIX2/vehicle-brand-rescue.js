(() => {
  const form = document.getElementById('vehicleForm');
  const ui = document.querySelector('.vehicle-scan');
  if (!form || !ui || ui.dataset.brandRescue === '1') return;
  ui.dataset.brandRescue = '1';

  const brandInput = form.elements.namedItem('brand');
  const cameraInput = ui.querySelector('.scan-input-camera');
  const uploadInput = ui.querySelector('.scan-input-upload');
  const result = ui.querySelector('.vehicle-scan-result');
  if (!brandInput || !cameraInput || !uploadInput || !result) return;

  let pendingFile = null;
  let running = false;
  let lastSignature = '';

  const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
  const upper = value => clean(value).toUpperCase();

  function captureFile(event) {
    const file = event.target.files?.[0];
    if (file?.type?.startsWith('image/')) pendingFile = file;
  }
  cameraInput.addEventListener('change', captureFile, { capture:true });
  uploadInput.addEventListener('change', captureFile, { capture:true });

  function withTimeout(promise, ms) {
    let timer;
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('BRAND_TIMEOUT')), ms);
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
      const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
      const source = document.createElement('canvas');
      source.width = Math.max(1, Math.round(image.naturalWidth * scale));
      source.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const ctx = source.getContext('2d', { alpha:false, willReadFrequently:true });
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, source.width, source.height);
      ctx.drawImage(image, 0, 0, source.width, source.height);
      return source;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function cropD1(source, threshold = false) {
    const ratio = source.width / source.height;
    if (ratio < 1.2 || ratio > 1.65) return null;

    const x = Math.round(source.width * .055);
    const y = Math.round(source.height * .695);
    const w = Math.round(source.width * .445);
    const h = Math.round(source.height * .105);
    const scale = 5;

    const out = document.createElement('canvas');
    out.width = Math.max(1, w * scale);
    out.height = Math.max(1, h * scale);
    const ctx = out.getContext('2d', { alpha:false, willReadFrequently:true });
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(source, x, y, w, h, 0, 0, out.width, out.height);

    const image = ctx.getImageData(0, 0, out.width, out.height);
    const data = image.data;
    for (let i = 0; i < data.length; i += 4) {
      const lum = .299 * data[i] + .587 * data[i + 1] + .114 * data[i + 2];
      const value = threshold ? (lum > 165 ? 255 : 0) : lum;
      data[i] = data[i + 1] = data[i + 2] = value;
      data[i + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    return out;
  }

  function normalizeBrand(raw) {
    let value = upper(raw)
      .replace(/^.*?D\s*[.·,:;\-]?\s*[1IL]\s*[:;,.\-–—]?\s*/i, '')
      .replace(/\bD\s*[.·,:;\-]?\s*[2Z]\b.*$/i, '')
      .replace(/[^A-ZÁÉÍÓÚÜÑ0-9 .&+\-/]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const lines = value.split(/\n+/).map(clean).filter(Boolean);
    value = lines[0] || value;
    value = value.replace(/^(MARCA|BRAND)\s*[:;,.\-–—]?\s*/i, '').trim();

    if (value.length < 2 || value.length > 30) return '';
    if (!/[A-ZÁÉÍÓÚÜÑ]{2}/.test(value)) return '';
    if (/^(DOCUMENTO|OBSERVACIONES|MATRICULA|MATRÍCULA|MODELO|BASTIDOR)$/i.test(value)) return '';
    return value;
  }

  async function recognizeBrand(worker, canvas) {
    try {
      await worker.setParameters({
        tessedit_pageseg_mode:'7',
        preserve_interword_spaces:'1',
        tessedit_char_whitelist:'ABCDEFGHIJKLMNOPQRSTUVWXYZÁÉÍÓÚÜÑ0123456789 .&+-/'
      });
    } catch (_) {}
    const { data } = await withTimeout(worker.recognize(canvas), 8000);
    return normalizeBrand(data?.text || '');
  }

  async function rescue(file) {
    if (!file || running || clean(brandInput.value) || brandInput.dataset.manualAfterOcr === '1') return;
    const signature = `${file.name}|${file.size}|${file.lastModified}`;
    if (signature === lastSignature) return;
    lastSignature = signature;
    running = true;

    let worker;
    try {
      if (!window.Tesseract?.createWorker) return;
      const source = await fileToCanvas(file);
      const normal = cropD1(source, false);
      const threshold = cropD1(source, true);
      if (!normal || !threshold) return;

      worker = await window.Tesseract.createWorker('spa');
      let brand = await recognizeBrand(worker, normal);
      if (!brand) brand = await recognizeBrand(worker, threshold);
      if (!brand) return;

      brandInput.value = brand;
      brandInput.dataset.ocrFilled = '1';
      brandInput.dispatchEvent(new Event('input', { bubbles:true }));
      brandInput.dispatchEvent(new Event('change', { bubbles:true }));
      delete brandInput.dataset.manualAfterOcr;
      result.className = 'vehicle-scan-result success';
      result.textContent = '4 datos identificados.';
    } catch (error) {
      console.warn('No se pudo rescatar la marca D.1', error);
    } finally {
      try { await worker?.terminate?.(); } catch (_) {}
      running = false;
      pendingFile = null;
    }
  }

  const observer = new MutationObserver(() => {
    if (!pendingFile || running || clean(brandInput.value)) return;
    const text = result.textContent.trim();
    if (!text || /preparando|leyendo|completando/i.test(text)) return;
    if (/datos identificados|no he podido identificar|lectura ha tardado|no se ha podido leer/i.test(text)) {
      setTimeout(() => rescue(pendingFile), 80);
    }
  });
  observer.observe(result, { childList:true, subtree:true, characterData:true });
})();