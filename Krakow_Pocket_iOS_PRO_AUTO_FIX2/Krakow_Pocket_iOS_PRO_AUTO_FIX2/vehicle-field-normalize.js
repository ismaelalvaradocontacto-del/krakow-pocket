(() => {
  const form = document.getElementById('vehicleForm');
  if (!form || form.dataset.vehicleNormalize === '2') return;
  form.dataset.vehicleNormalize = '2';

  const names = ['brand', 'model', 'vin', 'plate'];
  const clean = value => String(value ?? '').replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/g, ' ').trim();
  const upper = value => clean(value).toLocaleUpperCase('es-ES');

  function normalize(name, value, canonical = false) {
    let out = upper(value);
    if (!out) return '';

    if (name === 'brand') {
      out = out.replace(/\s+/g, ' ');
      if (canonical && window.TRASPASO_CANONICALIZE_MAKE) {
        out = window.TRASPASO_CANONICALIZE_MAKE(out) || out;
      }
      return out;
    }

    if (name === 'model') return out.replace(/\s+/g, ' ');
    if (name === 'vin') return out.replace(/\s+/g, '').replace(/[|¦]/g, 'I');
    if (name === 'plate') return out.replace(/\s+/g, '');
    return out;
  }

  function apply(input, canonical = false) {
    if (!input || !names.includes(input.name)) return;
    const next = normalize(input.name, input.value, canonical);
    if (input.value !== next) input.value = next;
  }

  function normalizeAll(canonical = true) {
    names.forEach(name => apply(form.elements.namedItem(name), canonical));
  }

  function clearForNewDocument() {
    names.forEach(name => {
      const input = form.elements.namedItem(name);
      if (!input) return;
      if (input.dataset.manualAfterOcr === '1') return;
      input.value = '';
      delete input.dataset.ocrFilled;
    });
  }

  names.forEach(name => {
    const input = form.elements.namedItem(name);
    if (!input) return;
    input.autocapitalize = 'characters';
    input.autocomplete = 'off';
    input.spellcheck = false;

    input.addEventListener('input', event => {
      if (event.isComposing) return;
      apply(input, false);
    });
    input.addEventListener('change', () => apply(input, true));
    input.addEventListener('blur', () => apply(input, true));
  });

  // Cargar una nueva foto significa cambiar de fuente documental. Se eliminan
  // los datos automáticos/reuperados anteriores antes de que empiece el OCR,
  // evitando mezclar dos vehículos si la nueva imagen no contiene algún campo.
  document.querySelectorAll('.scan-input-camera, .scan-input-upload').forEach(input => {
    input.addEventListener('change', event => {
      if (!event.target.files?.[0]) return;
      clearForNewDocument();
    }, { capture: true });
  });

  // Corrige también valores recuperados de una operación anterior.
  [0, 80, 300, 1000].forEach(delay => setTimeout(() => normalizeAll(true), delay));

  window.TRASPASO_NORMALIZE_VEHICLE_FIELDS = normalizeAll;
})();
