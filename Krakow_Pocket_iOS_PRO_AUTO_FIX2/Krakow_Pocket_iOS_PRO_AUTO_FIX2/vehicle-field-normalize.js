(() => {
  const form = document.getElementById('vehicleForm');
  if (!form || form.dataset.vehicleNormalize === '1') return;
  form.dataset.vehicleNormalize = '1';

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

    if (name === 'model') {
      return out.replace(/\s+/g, ' ');
    }

    if (name === 'vin') {
      return out.replace(/\s+/g, '').replace(/[|¦]/g, 'I');
    }

    if (name === 'plate') {
      return out.replace(/\s+/g, '');
    }

    return out;
  }

  function apply(input, canonical = false) {
    if (!input) return;
    const name = input.name;
    if (!names.includes(name)) return;
    const next = normalize(name, input.value, canonical);
    if (input.value !== next) input.value = next;
  }

  function normalizeAll(canonical = true) {
    names.forEach(name => apply(form.elements.namedItem(name), canonical));
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

  // Corrige también valores recuperados de una operación anterior, aunque se
  // hayan restaurado antes de que esta capa se cargue.
  [0, 80, 300, 1000].forEach(delay => setTimeout(() => normalizeAll(true), delay));

  window.TRASPASO_NORMALIZE_VEHICLE_FIELDS = normalizeAll;
})();
