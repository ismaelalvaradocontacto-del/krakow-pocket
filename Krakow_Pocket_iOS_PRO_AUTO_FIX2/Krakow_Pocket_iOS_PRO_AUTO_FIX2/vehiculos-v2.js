(() => {
  const form = document.getElementById('vehicleForm');
  if (!form) return;

  const DRAFT_KEY = 'pocket.vehicleDocs.draft.v1';
  const OFFICE_KEY = 'pocket.vehicleDocs.office.v1';
  const DEFAULTS_KEY = 'pocket.vehicleDocs.defaults.v1';
  const officeFields = [
    'manager1_name','manager1_dni','manager1_collegeNo','collegeName','officeName','officeCity','officeStreet','officeNumber','officeCp',
    'manager2_name','manager2_dni','manager2_collegeNo','manager3_name'
  ];
  const defaultFields = ['place','courtCity','bankAccount','paymentDays'];
  let combinedUrl = '';
  let mergeBusy = false;

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
  const clean = v => String(v ?? '').replace(/\s+/g, ' ').trim();
  const esc = v => clean(v).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const value = name => clean(form.elements.namedItem(name)?.value || '');

  function readStore(key) {
    try { return JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch (_) { return {}; }
  }

  function writeStore(key, data) {
    try { localStorage.setItem(key, JSON.stringify(data)); } catch (_) {}
  }

  function setValues(data, onlyBlank = false) {
    for (const [name, val] of Object.entries(data || {})) {
      const node = form.elements.namedItem(name);
      if (!node || typeof val !== 'string') continue;
      if (onlyBlank && clean(node.value)) continue;
      node.value = val;
    }
  }

  function hasLastOperation() {
    const d = readStore(DRAFT_KEY);
    return ['seller_name','buyer_name','plate','vin','price','contractModel'].some(k => clean(d[k]));
  }

  function setFreshDefaults() {
    const now = new Date();
    const date = form.elements.namedItem('date');
    const time = form.elements.namedItem('time');
    const subject = form.elements.namedItem('subject1');
    if (date && !date.value) {
      const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
      date.value = local.toISOString().slice(0,10);
    }
    if (time && !time.value) time.value = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    if (subject && !subject.value) subject.value = 'TRANSFERENCIA DE VEHÍCULO';
  }

  function saveDefaults() {
    const data = {};
    defaultFields.forEach(name => { data[name] = value(name); });
    writeStore(DEFAULTS_KEY, data);
  }

  function currentDraftWithoutOffice() {
    const data = {};
    new FormData(form).forEach((v,k) => { if (!officeFields.includes(k)) data[k] = clean(v); });
    return data;
  }

  function showStep(name) {
    $$('.step').forEach(b => b.classList.toggle('active', b.dataset.step === name));
    $$('.panel').forEach(p => {
      const active = p.dataset.panel === name;
      p.hidden = !active;
      p.classList.toggle('active', active);
    });
    if (name === 'generar') setTimeout(updateReview, 0);
    window.scrollTo({top:0, behavior:'smooth'});
  }

  function requirements() {
    const operation = ['contractModel','place','date','price'];
    if (value('contractModel') === 'particulares') operation.push('time');
    return {
      operacion: operation,
      partes: ['seller_name','seller_dni','buyer_name','buyer_dni'],
      vehiculo: ['brand','model','vin','plate'],
      office: ['manager1_name','manager1_dni','manager1_collegeNo','collegeName','officeName','officeCity','officeStreet','officeCp','subject1']
    };
  }

  function missingNames(names) { return names.filter(name => !value(name)); }

  function updateProgress() {
    const req = requirements();
    const mapping = {operacion:req.operacion, partes:req.partes, vehiculo:req.vehiculo};
    for (const [step,names] of Object.entries(mapping)) {
      const node = $(`.step[data-step="${step}"] [data-step-state]`);
      if (!node) continue;
      const missing = missingNames(names).length;
      node.textContent = missing ? String(missing) : '✓';
      node.classList.toggle('done', !missing);
    }
    const all = [...req.operacion,...req.partes,...req.vehiculo,...req.office];
    const finalMissing = missingNames(all).length;
    const finalNode = $('.step[data-step="generar"] [data-step-state]');
    if (finalNode) {
      finalNode.textContent = finalMissing ? String(finalMissing) : '✓';
      finalNode.classList.toggle('done', !finalMissing);
    }
  }

  function updateLastNote(text) {
    const note = $('#lastOperationNote');
    if (!note) return;
    if (text) { note.innerHTML = text; return; }
    note.innerHTML = hasLastOperation()
      ? '<strong>Última transferencia recuperada.</strong> Pocket conserva solo esta operación y la sustituirá cuando empieces otra.'
      : '<strong>Una sola operación.</strong> Pocket conservará esta transferencia por si necesitas corregirla o volver a generar los documentos.';
  }

  function updateReview() {
    const box = $('#review');
    if (!box) return;
    const req = requirements();
    const all = [...req.operacion,...req.partes,...req.vehiculo,...req.office];
    const missing = missingNames(all);
    const contract = value('contractModel') === 'rehabilitacion' ? 'Rehabilitación' : value('contractModel') === 'particulares' ? 'Entre particulares' : 'Sin seleccionar';
    const people = [value('seller_name') || 'Vendedor sin completar', value('buyer_name') || 'Comprador sin completar'];
    const vehicle = [value('brand'), value('model')].filter(Boolean).join(' ') || 'Vehículo sin completar';
    const meta = [value('plate'), value('price') ? `${value('price')} €` : ''].filter(Boolean).join(' · ');
    box.innerHTML = `
      <div class="review-hero ${missing.length ? 'pending' : 'ready'}">
        <div><span class="eyebrow">ESTADO</span><strong>${missing.length ? `Faltan ${missing.length} datos` : 'Todo listo'}</strong><small>${missing.length ? 'Puedes tocar una sección para completarla.' : 'La documentación está preparada para generarse.'}</small></div>
        <span class="status-dot">${missing.length ? missing.length : '✓'}</span>
      </div>
      <div class="review-list">
        <button type="button" class="review-line" data-go="operacion"><span><small>Operación</small><strong>${esc(contract)}${value('price') ? ` · ${esc(value('price'))} €` : ''}</strong></span><b>Editar</b></button>
        <button type="button" class="review-line" data-go="partes"><span><small>Personas</small><strong>${esc(people[0])} → ${esc(people[1])}</strong></span><b>Editar</b></button>
        <button type="button" class="review-line" data-go="vehiculo"><span><small>Vehículo</small><strong>${esc(vehicle)}${meta ? ` · ${esc(meta)}` : ''}</strong></span><b>Editar</b></button>
        <button type="button" class="review-line" data-go="office"><span><small>Gestoría</small><strong>${esc(value('manager1_name') || 'Configuración pendiente')}</strong></span><b>Editar</b></button>
      </div>`;
    $$('[data-go]', box).forEach(btn => btn.addEventListener('click', () => {
      if (btn.dataset.go === 'office') {
        showStep('operacion');
        const details = $('.office-settings');
        if (details) details.open = true;
        setTimeout(() => details?.scrollIntoView({behavior:'smooth',block:'start'}), 80);
      } else showStep(btn.dataset.go);
    }));
  }

  function clearCombined() {
    if (combinedUrl) URL.revokeObjectURL(combinedUrl);
    combinedUrl = '';
    $('.download-row.combined')?.remove();
  }

  async function mergeDownloads() {
    const downloads = $('#downloads');
    if (!downloads || downloads.hidden || mergeBusy || $('.download-row.combined', downloads)) return;
    const links = $$('.download-row:not(.combined) .download-link', downloads).slice(0,4);
    if (links.length < 4 || !window.PDFLib) return;
    mergeBusy = true;
    try {
      const merged = await window.PDFLib.PDFDocument.create();
      for (const link of links) {
        const bytes = await fetch(link.href).then(r => r.arrayBuffer());
        const source = await window.PDFLib.PDFDocument.load(bytes);
        const pages = await merged.copyPages(source, source.getPageIndices());
        pages.forEach(page => merged.addPage(page));
      }
      const bytes = await merged.save();
      const plate = value('plate').toUpperCase() || 'vehiculo';
      const filename = `Transferencia completa - ${plate}.pdf`;
      const blob = new Blob([bytes], {type:'application/pdf'});
      combinedUrl = URL.createObjectURL(blob);

      const row = document.createElement('div');
      row.className = 'download-row combined';
      row.innerHTML = `<div class="download-copy"><strong>Expediente completo</strong><span>${esc(filename)} · todos los documentos en un PDF</span></div><div class="download-actions"></div>`;
      const actions = $('.download-actions', row);
      const download = document.createElement('a');
      download.className = 'download-link';
      download.href = combinedUrl;
      download.download = filename;
      download.textContent = 'Guardar';
      actions.appendChild(download);

      const file = new File([blob], filename, {type:'application/pdf'});
      if (navigator.share && (!navigator.canShare || navigator.canShare({files:[file]}))) {
        const share = document.createElement('button');
        share.type = 'button';
        share.className = 'download-link share-link';
        share.textContent = 'Compartir';
        share.addEventListener('click', async () => {
          try { await navigator.share({files:[file], title:'Transferencia de vehículo'}); } catch (err) { if (err?.name !== 'AbortError') console.error(err); }
        });
        actions.prepend(share);
      }
      downloads.prepend(row);
      const status = $('#generateStatus');
      if (status) status.textContent = 'Documentación preparada. Esta operación se conservará hasta que inicies otra.';
    } catch (err) {
      console.error('No se pudo crear el PDF completo', err);
    } finally {
      mergeBusy = false;
    }
  }

  const observer = new MutationObserver(() => setTimeout(mergeDownloads, 20));
  const downloads = $('#downloads');
  if (downloads) observer.observe(downloads, {childList:true, subtree:false, attributes:true, attributeFilter:['hidden']});

  $('#newCase')?.addEventListener('click', e => {
    e.preventDefault();
    e.stopImmediatePropagation();
    if (!confirm('¿Empezar una transferencia nueva? La operación actual dejará de conservarse. Los datos de gestoría y tus valores habituales se mantendrán.')) return;

    const office = {};
    officeFields.forEach(name => { office[name] = value(name); });
    const defaults = {};
    defaultFields.forEach(name => { defaults[name] = value(name); });
    writeStore(OFFICE_KEY, office);
    writeStore(DEFAULTS_KEY, defaults);

    form.reset();
    setValues(office);
    setValues(defaults);
    setFreshDefaults();
    clearCombined();
    if (downloads) { downloads.innerHTML = ''; downloads.hidden = true; }
    const status = $('#generateStatus');
    if (status) status.textContent = '';
    try { localStorage.removeItem(DRAFT_KEY); } catch (_) {}
    setTimeout(() => writeStore(DRAFT_KEY, currentDraftWithoutOffice()), 420);
    showStep('operacion');
    updateProgress();
    updateReview();
    updateLastNote('<strong>Nueva transferencia.</strong> La anterior ya no se conserva; esta será la única operación guardada mientras trabajas.');
  }, true);

  form.addEventListener('input', e => {
    if (defaultFields.includes(e.target.name)) saveDefaults();
    updateProgress();
    if (!$('[data-panel="generar"]')?.hidden) setTimeout(updateReview,0);
  });
  form.addEventListener('change', e => {
    if (defaultFields.includes(e.target.name)) saveDefaults();
    updateProgress();
    if (!$('[data-panel="generar"]')?.hidden) setTimeout(updateReview,0);
  });

  $$('.step, .next').forEach(node => node.addEventListener('click', () => {
    setTimeout(() => { updateProgress(); if (!$('[data-panel="generar"]')?.hidden) updateReview(); }, 0);
  }));

  form.addEventListener('submit', () => {
    clearCombined();
    setTimeout(() => {
      const invalid = $('.field.invalid');
      if (!invalid) return;
      const details = invalid.closest('details');
      if (details) details.open = true;
      const panel = invalid.closest('.panel');
      if (panel?.dataset.panel && panel.hidden) showStep(panel.dataset.panel);
      setTimeout(() => invalid.scrollIntoView({behavior:'smooth', block:'center'}), 80);
    }, 0);
  });

  const hadLast = hasLastOperation();
  if (!hadLast) setValues(readStore(DEFAULTS_KEY), true);
  setFreshDefaults();
  updateProgress();
  updateLastNote();
  setTimeout(updateReview,0);

  window.addEventListener('beforeunload', clearCombined);
})();
