(() => {
  const form = document.getElementById('vehicleForm');
  const ui = document.querySelector('.vehicle-scan');
  if (!form || !ui || ui.dataset.spatialRescue === '1') return;
  ui.dataset.spatialRescue = '1';

  const cameraInput = ui.querySelector('.scan-input-camera');
  const uploadInput = ui.querySelector('.scan-input-upload');
  const result = ui.querySelector('.vehicle-scan-result');
  if (!cameraInput || !uploadInput || !result) return;

  const field = name => form.elements.namedItem(name);
  const names = ['brand', 'model', 'vin', 'plate'];
  const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
  const upper = value => clean(value).toLocaleUpperCase('es-ES');
  const compact = value => upper(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]/g, '');

  let pendingFile = null;
  let running = false;
  let lastSignature = '';

  function capture(event) {
    const file = event.target.files?.[0];
    if (file?.type?.startsWith('image/')) pendingFile = file;
  }
  cameraInput.addEventListener('change', capture, { capture:true });
  uploadInput.addEventListener('change', capture, { capture:true });

  function missingFields() {
    return names.filter(name => !clean(field(name)?.value));
  }

  function withTimeout(promise, ms) {
    let timer;
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('SPATIAL_TIMEOUT')), ms);
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
      if (shortest < 1000) scale = Math.min(maxSide / longest, Math.max(scale, Math.min(2.2, 1350 / Math.max(1, shortest))));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const ctx = canvas.getContext('2d', { alpha:false });
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

  function parseTsv(tsv) {
    const lines = String(tsv || '').split(/\r?\n/);
    const words = [];
    for (let i = 1; i < lines.length; i += 1) {
      const cols = lines[i].split('\t');
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
        h:Number(cols[9]) || 0,
        conf:Number(cols[10]) || 0
      };
      word.right = word.x + word.w;
      word.cy = word.y + word.h / 2;
      words.push(word);
    }
    return words;
  }

  function codeFrom(value) {
    const key = compact(value);
    if (/^D[1IL]$/.test(key) || /^0[1IL]$/.test(key)) return 'D1';
    if (/^D[3B]$/.test(key) || /^0[3B]$/.test(key)) return 'D3';
    if (key === 'A') return 'A';
    if (key === 'E') return 'E';
    return '';
  }

  function plateValue(raw) {
    const value = upper(raw).replace(/[^A-Z0-9-]/g, '');
    const current = value.match(/\d{4}[BCDFGHJKLMNPRSTVWXYZ]{3}/);
    if (current) return current[0];
    if (value.length >= 4 && value.length <= 14 && /\d/.test(value) && /[A-Z]/.test(value)) return value;
    return '';
  }

  function vinValue(raw) {
    const source = upper(raw).replace(/[^A-Z0-9]/g, '');
    for (let i = 0; i <= source.length - 17; i += 1) {
      const value = source.slice(i, i + 17).replace(/O/g,'0').replace(/I/g,'1').replace(/Q/g,'0');
      if (/^[A-HJ-NPR-Z0-9]{17}$/.test(value) && /[A-Z]/.test(value) && /\d/.test(value)) return value;
    }
    return '';
  }

  function brandValue(raw) {
    let value = upper(raw).replace(/[^A-ZÁÉÍÓÚÜÑ0-9 .&+\-/]/g, ' ').replace(/\s+/g, ' ').trim();
    if (value.length < 2 || value.length > 40 || !/[A-ZÁÉÍÓÚÜÑ]{2}/.test(value)) return '';
    value = window.TRASPASO_CANONICALIZE_MAKE?.(value) || value;
    return value;
  }

  function modelValue(raw) {
    const value = upper(raw).replace(/[^A-Z0-9 .+\-_/]/g, ' ').replace(/\s+/g, ' ').trim();
    if (value.length < 2 || value.length > 55) return '';
    if (/^(D1|D3|A|E|DOCUMENTO|OBSERVACIONES)$/i.test(compact(value))) return '';
    return value;
  }

  function validate(code, raw) {
    if (code === 'A') return plateValue(raw);
    if (code === 'E') return vinValue(raw);
    if (code === 'D1') return brandValue(raw);
    if (code === 'D3') return modelValue(raw);
    return '';
  }

  function lineGroups(words) {
    const map = new Map();
    words.forEach(word => {
      const key = `${word.block}:${word.par}:${word.line}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(word);
    });
    return [...map.values()].map(group => group.sort((a,b) => a.x - b.x));
  }

  function extractByLine(words) {
    const out = {};
    for (const group of lineGroups(words)) {
      for (let i = 0; i < group.length; i += 1) {
        let code = codeFrom(group[i].text);
        let used = 1;
        if (!code && i + 1 < group.length) {
          code = codeFrom(group[i].text + group[i + 1].text);
          if (code) used = 2;
        }
        if (!code || out[code]) continue;
        const after = group.slice(i + used).map(w => w.text).join(' ');
        const value = validate(code, after);
        if (value) out[code] = value;
      }
    }
    return out;
  }

  function extractByGeometry(words, existing) {
    const out = { ...existing };
    const labels = [];
    for (let i = 0; i < words.length; i += 1) {
      let code = codeFrom(words[i].text);
      let right = words[i].right;
      let cy = words[i].cy;
      let h = words[i].h;
      if (!code && i + 1 < words.length) {
        const next = words[i + 1];
        if (Math.abs(next.cy - words[i].cy) <= Math.max(words[i].h, next.h) * .8) {
          code = codeFrom(words[i].text + next.text);
          if (code) {
            right = Math.max(right, next.right);
            cy = (cy + next.cy) / 2;
            h = Math.max(h, next.h);
          }
        }
      }
      if (code) labels.push({ code, right, cy, h });
    }

    for (const label of labels) {
      if (out[label.code]) continue;
      const tolerance = Math.max(18, label.h * 1.25);
      const candidates = words
        .filter(w => w.x > label.right + 2 && Math.abs(w.cy - label.cy) <= tolerance)
        .sort((a,b) => a.x - b.x);
      if (!candidates.length) continue;

      const picked = [];
      let lastRight = label.right;
      for (const word of candidates) {
        if (codeFrom(word.text)) break;
        if (picked.length && word.x - lastRight > Math.max(110, word.h * 6)) break;
        picked.push(word.text);
        lastRight = word.right;
        const value = validate(label.code, picked.join(' '));
        if ((label.code === 'A' || label.code === 'E') && value) break;
      }
      const value = validate(label.code, picked.join(' '));
      if (value) out[label.code] = value;
    }
    return out;
  }

  function mapToFields(codes) {
    return {
      plate:codes.A || '',
      vin:codes.E || '',
      brand:codes.D1 || '',
      model:codes.D3 || ''
    };
  }

  function apply(data) {
    let changed = 0;
    for (const name of names) {
      const input = field(name);
      const value = clean(data[name]);
      if (!input || !value || clean(input.value)) continue;
      input.value = upper(value);
      input.dataset.ocrFilled = '1';
      delete input.dataset.manualAfterOcr;
      input.dispatchEvent(new Event('input', { bubbles:true }));
      input.dispatchEvent(new Event('change', { bubbles:true }));
      changed += 1;
    }
    window.TRASPASO_NORMALIZE_VEHICLE_FIELDS?.(true);
    return changed;
  }

  async function rescue(file) {
    if (!file || running || !missingFields().length || !window.Tesseract?.createWorker) return;
    const signature = `${file.name}|${file.size}|${file.lastModified}|${missingFields().join(',')}`;
    if (signature === lastSignature) return;
    lastSignature = signature;
    running = true;
    let worker;
    try {
      const canvas = await fileToCanvas(file);
      worker = await window.Tesseract.createWorker('spa');
      try { await worker.setParameters({ tessedit_pageseg_mode:'11', preserve_interword_spaces:'1' }); } catch (_) {}
      const response = await withTimeout(worker.recognize(canvas, {}, { text:true, tsv:true }), 16000);
      const words = parseTsv(response?.data?.tsv || '');
      if (!words.length) return;
      const byLine = extractByLine(words);
      const byGeometry = extractByGeometry(words, byLine);
      apply(mapToFields(byGeometry));

      const left = missingFields().length;
      if (left === 0) {
        result.className = 'vehicle-scan-result success';
        result.textContent = '4 datos identificados.';
      } else if (left < 4) {
        result.className = 'vehicle-scan-result success';
        result.textContent = `${4-left} de 4 datos identificados. Revisa los que faltan.`;
      }
    } catch (error) {
      console.warn('Rescate espacial de documentación', error);
    } finally {
      try { await worker?.terminate?.(); } catch (_) {}
      running = false;
      pendingFile = null;
    }
  }

  const observer = new MutationObserver(() => {
    if (!pendingFile || running) return;
    const text = result.textContent.trim();
    if (!text || /preparando|leyendo|mejorando|completando|orientaci/i.test(text)) return;
    if (missingFields().length && /datos identificados|no he podido identificar|no se ha podido leer|tardado demasiado/i.test(text)) {
      setTimeout(() => rescue(pendingFile), 50);
    }
  });
  observer.observe(result, { childList:true, subtree:true, characterData:true });
})();
