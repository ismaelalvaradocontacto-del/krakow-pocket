(() => {
  const form = document.getElementById('vehicleForm');
  const ui = document.querySelector('.vehicle-scan');
  if (!form || !ui || ui.dataset.newSourceReset === '1') return;
  ui.dataset.newSourceReset = '1';

  const reset = event => {
    const file = event.target.files?.[0];
    if (!file) return;

    window.__TRASPASO_VEHICLE_FILE = file;
    window.__TRASPASO_VEHICLE_SCAN_SEQ = Number(window.__TRASPASO_VEHICLE_SCAN_SEQ || 0) + 1;

    ['brand','model','vin','plate'].forEach(name => {
      const input = form.elements.namedItem(name);
      if (!input) return;
      input.value = '';
      delete input.dataset.ocrFilled;
      delete input.dataset.manualAfterOcr;
    });
  };

  ui.querySelector('.scan-input-camera')?.addEventListener('change', reset, true);
  ui.querySelector('.scan-input-upload')?.addEventListener('change', reset, true);

  window.addEventListener('beforeunload', () => {
    window.__TRASPASO_VEHICLE_FILE = null;
  });
})();