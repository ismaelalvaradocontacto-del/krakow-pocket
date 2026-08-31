(() => {
  const form = document.getElementById('vehicleForm');
  const ui = document.querySelector('.vehicle-scan');
  if (!form || !ui || ui.dataset.newSourceReset === '1') return;
  ui.dataset.newSourceReset = '1';

  const reset = event => {
    if (!event.target.files?.[0]) return;
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
})();