(() => {
  const form = document.getElementById('vehicleForm');
  const panel = document.querySelector('[data-panel="vehiculo"]');
  if (!form || !panel || panel.querySelector('.vehicle-scan')) return;

  const fields = ['brand', 'model', 'vin', 'plate'];
  const field = name => form.elements.namedItem(name);
  const clean = value => String(value ?? '').replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/g, ' ').trim();
  const upper = value => clean(value).toLocaleUpperCase('es-ES');

  const ui = document.createElement('section');
  ui.className = 'vehicle-scan';
  ui.innerHTML = `
    <div class="vehicle-scan-head">
      <div><span class="eyebrow">AUTOMÁTICO</span><strong>Leer documentación</strong></div>
      <span class="vehicle-scan-badge">IA</span>
    </div>
    <div class="vehicle-scan-actions">
      <button type="button" class="scan-action scan-camera" aria-label="Escanear con la cámara">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7.5 9.4 5h5.2L16 7.5h2.2A2.8 2.8 0 0 1 21 10.3v6.9a2.8 2.8 0 0 1-2.8 2.8H5.8A2.8 2.8 0 0 1 3 17.2v-6.9a2.8 2.8 0 0 1 2.8-2.8H8Z"/><circle cx="12" cy="13.5" r="3.2"/></svg>
        <span><strong>Escanear</strong><small>Cámara</small></span>
      </button>
      <button type="button" class="scan-action scan-upload" aria-label="Cargar una foto o PDF">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.8A1.8 1.8 0 0 1 5.8 4h12.4A1.8 1.8 0 0 1 20 5.8v12.4a1.8 1.8 0 0 1-1.8 1.8H5.8A1.8 1.8 0 0 1 4 18.2V5.8Z"/><circle cx="9" cy="9" r="1.4"/><path d="m6.4 17 4.2-4.3 2.6 2.6 1.8-1.8 2.6 3.5"/></svg>
        <span><strong>Cargar archivo</strong><small>Foto o PDF</small></span>
      </button>
    </div>
    <input class="scan-input scan-input-camera" type="file" accept="image/*" capture="environment" hidden>
    <input class="scan-input scan-input-upload" type="file" accept="image/*,application/pdf" hidden>
    <div class="vehicle-scan-progress" hidden>
      <span class="vehicle-scan-progress-copy">Preparando…</span>
      <span class="vehicle-scan-progress-track"><i></i></span>
    </div>
    <div class="vehicle-scan-result" aria-live="polite"></div>
    <p class="vehicle-scan-note">Permiso de circulación · foto o PDF · el archivo no se conserva en Traspaso.</p>`;

  panel.insertBefore(ui, panel.querySelector('.grid.cols-2'));

  const cameraInput = ui.querySelector('.scan-input-camera');
  const uploadInput = ui.querySelector('.scan-input-upload');
  const cameraButton = ui.querySelector('.scan-camera');
  const uploadButton = ui.querySelector('.scan-upload');
  const progress = ui.querySelector('.vehicle-scan-progress');
  const progressCopy = ui.querySelector('.vehicle-scan-progress-copy');
  const progressBar = ui.querySelector('.vehicle-scan-progress-track i');
  const result = ui.querySelector('.vehicle-scan-result');
  let running = false;
  let progressTimer = 0;

  cameraButton.addEventListener('click', () => !running && cameraInput.click());
  uploadButton.addEventListener('click', () => !running && uploadInput.click());
  cameraInput.addEventListener('change', event => processFile(event.target.files?.[0], event.target));
  uploadInput.addEventListener('change', event => processFile(event.target.files?.[0], event.target));

  fields.forEach(name => {
    const input = field(name);
    if (!input) return;
    input.autocapitalize = 'characters';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.addEventListener('blur', () => {
      input.value = name === 'brand' || name === 'model'
        ? upper(input.value)
        : upper(input.value).replace(/[^A-Z0-9]/g, '');
    });
  });

  function setBusy(value) {
    running = value;
    cameraButton.disabled = value;
    uploadButton.disabled = value;
    ui.classList.toggle('busy', value);
    progress.hidden = !value;
    if (!value) {
      clearInterval(progressTimer);
      progressTimer = 0;
      progressBar.style.width = '0%';
    }
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

  function clearVehicle() {
    fields.forEach(name => {
      const input = field(name);
      if (!input) return;
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  function canvasBlob(canvas, type, quality) {
    return new Promise(resolve => canvas.toBlob(resolve, type, quality));
  }

  async function prepareUpload(file) {
    if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '')) return file;
    if (!file.type?.startsWith('image/')) throw new Error('UNSUPPORTED_FILE');

    const url = URL.createObjectURL(file);
    try {
      const image = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
      });
      const longest = Math.max(image.naturalWidth, image.naturalHeight);
      const scale = Math.min(1, 2600 / Math.max(1, longest));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const ctx = canvas.getContext('2d', { alpha: false });
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await canvasBlob(canvas, 'image/jpeg', 0.9);
      return blob ? new File([blob], 'permiso-circulacion.jpg', { type: 'image/jpeg' }) : file;
    } catch (_) {
      return file;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function fillVehicle(vehicle = {}) {
    let count = 0;
    fields.forEach(name => {
      const input = field(name);
      if (!input) return;
      let value = clean(vehicle[name]);
      if (value) value = upper(value);
      if (name === 'vin' || name === 'plate') value = value.replace(/[^A-Z0-9]/g, '');
      input.value = value;
      if (value) count += 1;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    return count;
  }

  async function processFile(file, input) {
    if (!file || running) return;
    if (file.size > 20 * 1024 * 1024) {
      setResult('El archivo es demasiado grande. Máximo 20 MB.', 'error');
      input.value = '';
      return;
    }

    clearVehicle();
    setBusy(true);
    setResult('');
    setProgress(8, 'Preparando documento…');
    let shown = 8;
    progressTimer = setInterval(() => {
      shown = Math.min(88, shown + (shown < 45 ? 6 : shown < 72 ? 3 : 1));
      setProgress(shown, shown < 45 ? 'Preparando documento…' : 'Leyendo datos…');
    }, 650);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    try {
      const prepared = await prepareUpload(file);
      const body = new FormData();
      body.append('file', prepared, prepared.name || file.name || 'documento');
      const response = await fetch('/api/vehicle-read', {
        method: 'POST',
        body,
        signal: controller.signal,
        credentials: 'same-origin',
        headers: { 'x-traspaso-client': 'vehicle-reader-v1' }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) {
        if (data.code === 'NOT_CONFIGURED') throw new Error('NOT_CONFIGURED');
        throw new Error(data.message || `HTTP_${response.status}`);
      }

      setProgress(96, 'Comprobando datos…');
      const count = fillVehicle(data.vehicle);
      setProgress(100, 'Listo');
      if (count === 4) setResult('4 de 4 datos identificados.', 'success');
      else if (count) setResult(`${count} de 4 datos identificados. Revisa los que faltan.`, 'success');
      else setResult('No he podido leer los datos con suficiente seguridad. Completa los campos manualmente.', 'error');
    } catch (error) {
      if (error?.name === 'AbortError') {
        setResult('La lectura ha tardado demasiado. Inténtalo de nuevo.', 'error');
      } else if (error?.message === 'NOT_CONFIGURED') {
        setResult('La lectura automática está pendiente de activar.', 'error');
      } else if (error?.message === 'UNSUPPORTED_FILE') {
        setResult('Selecciona una foto o un PDF.', 'error');
      } else {
        console.error('Lectura de vehículo', error);
        setResult('No se ha podido analizar el documento. Inténtalo de nuevo o completa los datos manualmente.', 'error');
      }
    } finally {
      clearTimeout(timeout);
      setTimeout(() => setBusy(false), 180);
      input.value = '';
    }
  }
})();