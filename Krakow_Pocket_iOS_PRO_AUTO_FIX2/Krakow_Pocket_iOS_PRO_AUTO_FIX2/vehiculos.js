(() => {
  const { PDFDocument, StandardFonts, rgb } = window.PDFLib || {};
  const form = document.getElementById('vehicleForm');
  if (!form) return;

  const DRAFT_KEY = 'pocket.vehicleDocs.draft.v1';
  const OFFICE_KEY = 'pocket.vehicleDocs.office.v1';
  const officeFields = new Set([
    'manager1_name','manager1_dni','manager1_collegeNo','collegeName','officeName','officeCity','officeStreet','officeNumber','officeCp',
    'manager2_name','manager2_dni','manager2_collegeNo','manager3_name'
  ]);
  const generatedUrls = [];
  let saveTimer = 0;

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
  const clean = v => String(v ?? '').replace(/\s+/g, ' ').trim();
  const upper = v => clean(v).toUpperCase();
  const safeName = v => clean(v).replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim();
  const esc = v => clean(v).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

  function getData() {
    const data = {};
    new FormData(form).forEach((value, key) => { data[key] = clean(value); });
    data.plate = upper(data.plate);
    data.vin = upper(data.vin);
    data.seller_dni = upper(data.seller_dni);
    data.buyer_dni = upper(data.buyer_dni);
    data.seller_second_dni = upper(data.seller_second_dni);
    data.buyer_second_dni = upper(data.buyer_second_dni);
    data.seller_represented_dni = upper(data.seller_represented_dni);
    data.buyer_represented_dni = upper(data.buyer_represented_dni);
    data.manager1_dni = upper(data.manager1_dni);
    data.manager2_dni = upper(data.manager2_dni);
    data.bankAccount = upper(data.bankAccount).replace(/\s+/g, ' ');
    return data;
  }

  function setData(data) {
    for (const [key, value] of Object.entries(data || {})) {
      const node = form.elements.namedItem(key);
      if (node && typeof value === 'string') node.value = value;
    }
  }

  function loadState() {
    try { setData(JSON.parse(localStorage.getItem(OFFICE_KEY) || '{}')); } catch (_) {}
    try { setData(JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}')); } catch (_) {}
    normalizeInputs();
    updateReview();
  }

  function saveState() {
    const data = getData();
    const office = {};
    const draft = {};
    for (const [key, value] of Object.entries(data)) (officeFields.has(key) ? office : draft)[key] = value;
    try {
      localStorage.setItem(OFFICE_KEY, JSON.stringify(office));
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      const node = $('#saveState');
      if (node) { node.textContent = 'Guardado'; setTimeout(() => node.textContent = 'Guardado', 700); }
    } catch (_) {}
  }

  function queueSave() {
    const node = $('#saveState');
    if (node) node.textContent = 'Guardando…';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveState, 280);
  }

  function normalizeInputs() {
    const plate = form.elements.namedItem('plate');
    const vin = form.elements.namedItem('vin');
    if (plate) plate.value = upper(plate.value);
    if (vin) vin.value = upper(vin.value);
  }

  function setStep(name) {
    $$('.step').forEach(b => b.classList.toggle('active', b.dataset.step === name));
    $$('.panel').forEach(p => {
      const active = p.dataset.panel === name;
      p.hidden = !active;
      p.classList.toggle('active', active);
    });
    if (name === 'generar') updateReview();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  $$('.step').forEach(b => b.addEventListener('click', () => setStep(b.dataset.step)));
  $$('.next').forEach(b => b.addEventListener('click', () => setStep(b.dataset.next)));

  form.addEventListener('input', e => {
    if (['plate','vin','seller_dni','buyer_dni','manager1_dni','manager2_dni','bankAccount'].includes(e.target.name)) {
      const pos = e.target.selectionStart;
      e.target.value = e.target.value.toUpperCase();
      try { e.target.setSelectionRange(pos, pos); } catch (_) {}
    }
    queueSave();
    if (!$('[data-panel="generar"]').hidden) updateReview();
  });
  form.addEventListener('change', queueSave);

  $('#newCase').addEventListener('click', () => {
    if (!confirm('¿Crear un expediente nuevo? Se conservarán los datos de la gestoría.')) return;
    const office = {};
    for (const name of officeFields) office[name] = form.elements.namedItem(name)?.value || '';
    form.reset();
    setData(office);
    try { localStorage.removeItem(DRAFT_KEY); } catch (_) {}
    clearDownloads();
    setStep('operacion');
    updateReview();
  });

  function updateReview() {
    const d = getData();
    const model = d.contractModel === 'rehabilitacion' ? 'Rehabilitación' : d.contractModel === 'particulares' ? 'Particulares' : 'Sin seleccionar';
    $('#review').innerHTML = [
      ['Mandato vendedor', d.seller_name || 'Sin datos'],
      ['Mandato comprador', d.buyer_name || 'Sin datos'],
      ['Contrato', model],
      ['Gestor', d.plate || 'Sin matrícula']
    ].map(([k,v]) => `<article class="review-card"><span>${esc(k)}</span><strong>${esc(v)}</strong></article>`).join('');
  }

  function missingFields(d) {
    const base = [
      ['contractModel','modelo de contrato'],['place','lugar'],['date','fecha'],['price','precio'],
      ['seller_name','nombre del vendedor'],['seller_dni','DNI del vendedor'],['buyer_name','nombre del comprador'],['buyer_dni','DNI del comprador'],
      ['brand','marca'],['model','modelo'],['vin','bastidor'],['plate','matrícula'],
      ['manager1_name','gestor/a'],['manager1_dni','DNI del gestor/a'],['manager1_collegeNo','nº colegiado'],['collegeName','Colegio Oficial'],['officeName','despacho profesional'],
      ['officeCity','municipio del despacho'],['officeStreet','calle del despacho'],['officeCp','C.P. del despacho'],['subject1','asunto del mandato']
    ];
    if (d.contractModel === 'particulares') base.push(['time','hora']);
    return base.filter(([key]) => !clean(d[key])).map(([,label]) => label);
  }

  function clearInvalid() { $$('.field.invalid').forEach(n => n.classList.remove('invalid')); }
  function markMissing(d) {
    clearInvalid();
    const missing = missingFields(d);
    const map = new Map([
      ['modelo de contrato','contractModel'],['lugar','place'],['fecha','date'],['precio','price'],['nombre del vendedor','seller_name'],['DNI del vendedor','seller_dni'],
      ['nombre del comprador','buyer_name'],['DNI del comprador','buyer_dni'],['marca','brand'],['modelo','model'],['bastidor','vin'],['matrícula','plate'],['gestor/a','manager1_name'],
      ['DNI del gestor/a','manager1_dni'],['nº colegiado','manager1_collegeNo'],['Colegio Oficial','collegeName'],['despacho profesional','officeName'],['municipio del despacho','officeCity'],
      ['calle del despacho','officeStreet'],['C.P. del despacho','officeCp'],['asunto del mandato','subject1'],['hora','time']
    ]);
    missing.forEach(label => form.elements.namedItem(map.get(label))?.closest('.field')?.classList.add('invalid'));
    return missing;
  }

  const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  function dateParts(value) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(clean(value));
    if (!m) return { day:'', month:'', year:'', year2:'', display:'' };
    const year = m[1], monthNo = Math.max(1, Math.min(12, Number(m[2]))), day = String(Number(m[3]));
    return { day, month: months[monthNo - 1], year, year2: year.slice(-2), display: `${String(Number(m[3])).padStart(2,'0')}/${String(monthNo).padStart(2,'0')}/${year}` };
  }

  function templateBytes(base64) {
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  function fitSize(font, text, maxWidth, start = 8, min = 5.2) {
    let size = start;
    while (size > min && font.widthOfTextAtSize(text, size) > maxWidth) size -= .2;
    return size;
  }

  function drawAt(page, font, value, x, top, maxWidth, start = 8, min = 5.2, opts = {}) {
    const text = clean(value);
    if (!text) return;
    const size = fitSize(font, text, maxWidth, start, min);
    page.drawText(text, { x, y: page.getHeight() - top - size + (opts.offsetY || 0), size, font, color: opts.color || rgb(0,0,0) });
  }

  function fullStreet(d, prefix) {
    return [d[`${prefix}_street`], d[`${prefix}_number`]].filter(Boolean).join(' ');
  }

  async function makeMandate(d, prefix) {
    const doc = await PDFDocument.load(templateBytes(window.VEHICLE_DOC_TEMPLATES.mandate));
    const page = doc.getPages()[0];
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const date = dateParts(d.date);
    const p = k => d[`${prefix}_${k}`] || '';

    drawAt(page,font,p('name'),80.0,91.8,312,7.2,5.6);
    drawAt(page,font,p('dni'),419.0,91.8,123,7.2,5.6);
    drawAt(page,font,p('second_name'),92.0,102.1,234,7,5.5);
    drawAt(page,font,p('second_dni'),358.0,102.1,90,7,5.5);
    drawAt(page,font,p('represented_name'),68.0,122.8,374,6.9,5.3);
    drawAt(page,font,p('represented_dni'),60.0,133.1,67,6.9,5.2);
    drawAt(page,font,p('city'),294.0,133.1,226,6.9,5.2);
    drawAt(page,font,p('street'),60.0,143.4,223,6.9,5.2);
    drawAt(page,font,p('number'),301.0,143.4,17,6.8,5.0);
    drawAt(page,font,p('cp'),341.0,143.4,41,6.8,5.0);
    drawAt(page,font,p('phone'),458.0,143.4,82,6.6,5.0);
    drawAt(page,font,p('email'),78.0,153.7,242,6.6,5.0);

    drawAt(page,font,d.manager1_name,192.0,184.7,172,6.7,5.1);
    drawAt(page,font,d.manager1_dni,408.0,184.7,82,6.7,5.1);
    drawAt(page,font,d.manager1_collegeNo,92.0,195.0,53,6.5,5.0);
    drawAt(page,font,d.manager2_name,172.0,195.0,218,6.5,5.0);
    drawAt(page,font,d.manager2_dni,420.0,195.0,86,6.5,5.0);
    drawAt(page,font,d.manager2_collegeNo,92.0,205.4,37,6.4,4.9);
    drawAt(page,font,d.manager3_name,167.0,205.4,374,6.4,4.9);
    drawAt(page,font,d.collegeName,312.0,215.7,181,6.5,5.0);
    drawAt(page,font,d.officeName,103.0,226.0,234,6.5,5.0);
    drawAt(page,font,d.officeCity,412.0,226.0,107,6.5,5.0);
    drawAt(page,font,d.officeStreet,60.0,236.3,222,6.5,5.0);
    drawAt(page,font,d.officeNumber,293.0,236.3,25,6.4,4.8);
    drawAt(page,font,d.officeCp,337.0,236.3,62,6.4,4.8);
    drawAt(page,font,d.subject1,60.0,288.0,480,6.8,5.0);
    drawAt(page,font,d.subject2,60.0,308.7,480,6.8,5.0);

    for (const top of [711.5, 804.8]) {
      const xPlace = top === 711.5 ? 180.0 : 190.0;
      const xDay = top === 711.5 ? 273.0 : 272.0;
      const xMonth = top === 711.5 ? 298.0 : 295.0;
      const xYear = top === 711.5 ? 368.0 : 357.0;
      drawAt(page,font,d.place,xPlace,top,top === 711.5 ? 86 : 77,7,5.3);
      drawAt(page,font,date.day,xDay,top,17,7,5.3);
      drawAt(page,font,date.month,xMonth,top,top === 711.5 ? 62 : 55,7,5.0);
      drawAt(page,font,date.year,xYear,top,66,7,5.3);
    }
    return doc.save();
  }

  async function makeContractRehab(d) {
    const doc = await PDFDocument.load(templateBytes(window.VEHICLE_DOC_TEMPLATES.contractRehab));
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const p1 = doc.getPages()[0], p2 = doc.getPages()[1];
    const date = dateParts(d.date);
    drawAt(p1,font,d.seller_name,204,174.9,252,8.7,6.0);
    drawAt(p1,font,d.seller_city,205.9,190.3,180,8.5,5.8);
    drawAt(p1,font,d.seller_street,72,205.7,315,8.5,5.6);
    drawAt(p1,font,d.seller_number,482.9,205.7,40,8.2,5.4);
    drawAt(p1,font,d.seller_province,85.4,221.1,80,8.2,5.4);
    drawAt(p1,font,d.seller_cp,189.9,221.1,37,8.2,5.4);
    drawAt(p1,font,d.seller_dni,289.9,221.1,124,8.2,5.4);
    drawAt(p1,font,d.buyer_name,200.7,251.8,224,8.7,5.8);
    drawAt(p1,font,d.buyer_city,181,267.2,168,8.4,5.7);
    drawAt(p1,font,d.buyer_street,72,282.6,203,8.3,5.5);
    drawAt(p1,font,d.buyer_number,352.2,282.6,40,8.1,5.4);
    drawAt(p1,font,d.buyer_province,422.2,282.6,80,8.1,5.3);
    drawAt(p1,font,d.buyer_cp,72,297.9,37,8.1,5.3);
    drawAt(p1,font,d.buyer_dni,185.5,297.9,124,8.1,5.3);
    drawAt(p1,font,d.brand,104.9,420.9,125,8.2,5.4);
    drawAt(p1,font,d.model,301.3,420.9,171,8.2,5.4);
    drawAt(p1,font,d.plate,123.6,436.3,90,8.2,5.4);
    drawAt(p1,font,d.vin,322.8,436.3,161,8.1,5.1);
    drawAt(p1,font,dateParts(d.itvDate).display,293.5,605.4,121,8.1,5.2);
    drawAt(p1,font,d.seller_name,169.4,697.7,204,8.2,5.3);
    drawAt(p1,font,d.buyer_name,276.6,713.0,214,8.2,5.3);
    drawAt(p1,font,d.price,276.0,728.4,88,8.2,5.3);
    drawAt(p2,font,d.courtCity,72,425.1,128,8.2,5.4);
    drawAt(p2,font,d.place,164.2,609.6,120,8.2,5.4);
    drawAt(p2,font,date.day,301.8,609.6,24,8.2,5.4);
    drawAt(p2,font,date.month,346.9,609.6,63,8.2,5.0);
    drawAt(p2,font,date.year2,444,609.6,18,8.2,5.4);
    return doc.save();
  }

  async function makeContractParticulares(d) {
    const doc = await PDFDocument.load(templateBytes(window.VEHICLE_DOC_TEMPLATES.contractParticulares));
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const p1 = doc.getPages()[0], p2 = doc.getPages()[1];
    const date = dateParts(d.date);
    drawAt(p1,font,d.place,103.0,145.0,106,9,5.8);
    drawAt(p1,font,date.day,217.0,145.0,20,9,5.8);
    drawAt(p1,font,date.month,250.0,145.0,60,9,5.3);
    drawAt(p1,font,date.year,323.0,145.0,40,9,5.5);
    drawAt(p1,font,d.time,389.0,145.0,40,9,5.5);
    drawAt(p1,font,d.seller_name,89.0,200.2,240,9,5.8);
    drawAt(p1,font,d.seller_dni,386.0,200.2,100,9,5.8);
    drawAt(p1,font,d.seller_city,164.0,214.0,107,9,5.5);
    drawAt(p1,font,fullStreet(d,'seller'),302.0,214.0,186,9,5.5);
    drawAt(p1,font,d.buyer_name,89.0,255.4,240,9,5.8);
    drawAt(p1,font,d.buyer_dni,386.0,255.4,100,9,5.8);
    drawAt(p1,font,d.buyer_city,164.0,269.2,107,9,5.5);
    drawAt(p1,font,fullStreet(d,'buyer'),302.0,269.2,186,9,5.5);
    const vehicleRows = [
      ['brand',324.4],['model',338.2],['version',352.0],['engine',365.8],['vin',379.6],['plate',393.4],['extras',407.2],['km',421.0],['vehicleState',434.8]
    ];
    vehicleRows.forEach(([key,top]) => drawAt(p1,font,d[key],202,top,305,key === 'vehicleState' ? 8 : 9,5.4));
    drawAt(p1,font,d.price,257.0,572.8,67,9,5.5);
    drawAt(p1,font,d.bankAccount,89.0,614.2,253,8.7,5.4);
    drawAt(p1,font,d.paymentDays,229.0,628.0,33,9,5.5);
    drawAt(p2,font,dateParts(d.insuranceUntil).display,254.0,209.2,84,9,5.3);
    drawAt(p2,font,d.courtCity,102.0,333.4,93,9,5.3);
    return doc.save();
  }

  function splitLines(font, text, size, maxWidth) {
    const words = clean(text).split(' ').filter(Boolean);
    const lines = [];
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(test, size) <= maxWidth || !line) line = test;
      else { lines.push(line); line = word; }
    }
    if (line) lines.push(line);
    return lines;
  }

  async function makeManagerPdf(d) {
    const doc = await PDFDocument.create();
    const regular = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    let page = doc.addPage();
    page.setSize(595.28, 841.89);
    const W = page.getWidth(), H = page.getHeight(), M = 44;
    let y = H - 48;
    const ink = rgb(.09,.13,.10), muted = rgb(.42,.46,.43), line = rgb(.87,.89,.87), accent = rgb(.19,.36,.26);

    const ensure = needed => { if (y - needed < 48) { page = doc.addPage(); page.setSize(595.28,841.89); y = H - 48; } };
    const text = (value,x,yy,size=9,font=regular,color=ink) => { if (clean(value)) page.drawText(clean(value),{x,y:yy,size,font,color}); };
    const hr = () => { page.drawLine({start:{x:M,y},end:{x:W-M,y},thickness:.6,color:line}); y -= 16; };
    const section = title => { ensure(42); y -= 4; text(title.toUpperCase(),M,y,7.5,bold,accent); y -= 14; };
    const pair = (label,value,x,width) => {
      const v = clean(value) || '—';
      text(label,x,y,7.2,bold,muted);
      const lines = splitLines(regular,v,9,width);
      let yy = y - 12;
      lines.slice(0,3).forEach(l => { text(l,x,yy,9,regular,ink); yy -= 11; });
      return 16 + (Math.min(lines.length,3)-1)*11;
    };
    const row2 = (a,b) => { ensure(52); const used=Math.max(pair(a[0],a[1],M,230),pair(b[0],b[1],315,236)); y -= Math.max(34,used+8); };
    const row1 = (label,value) => { ensure(46); const used=pair(label,value,M,W-2*M); y -= Math.max(30,used+6); };

    text('POCKET · FICHA DE GESTIÓN',M,y,8,bold,accent); y -= 24;
    const title = d.plate ? `Transferencia · ${d.plate}` : 'Transferencia de vehículo';
    text(title,M,y,22,bold,ink); y -= 17;
    text(d.reference ? `Ref. ${d.reference}` : 'Expediente de transferencia',M,y,9,regular,muted); y -= 22; hr();

    section('Operación');
    row2(['Lugar',d.place],['Fecha / hora',[dateParts(d.date).display,d.time].filter(Boolean).join(' · ')]);
    row2(['Precio',d.price ? `${d.price} €` : ''],['Contrato',d.contractModel === 'rehabilitacion' ? 'Rehabilitación' : 'Particulares']);
    row2(['Juzgados / Tribunales',d.courtCity],['Plazo de pago',d.paymentDays ? `${d.paymentDays} días` : '']);
    row1('Cuenta de pago',d.bankAccount); hr();

    section('Vendedor');
    row2(['Nombre',d.seller_name],['DNI / NIE',d.seller_dni]);
    row2(['Municipio',d.seller_city],['C.P.',d.seller_cp]);
    row1('Domicilio',[d.seller_street,d.seller_number,d.seller_province].filter(Boolean).join(' · '));
    row2(['Teléfono',d.seller_phone],['Email',d.seller_email]); hr();

    section('Comprador');
    row2(['Nombre',d.buyer_name],['DNI / NIE',d.buyer_dni]);
    row2(['Municipio',d.buyer_city],['C.P.',d.buyer_cp]);
    row1('Domicilio',[d.buyer_street,d.buyer_number,d.buyer_province].filter(Boolean).join(' · '));
    row2(['Teléfono',d.buyer_phone],['Email',d.buyer_email]); hr();

    section('Vehículo');
    row2(['Marca',d.brand],['Modelo',d.model]);
    row2(['Matrícula',d.plate],['Bastidor',d.vin]);
    row2(['Versión',d.version],['Motor',d.engine]);
    row2(['Kilómetros',d.km],['ITV',dateParts(d.itvDate).display]);
    row1('Extras',d.extras); row1('Estado del vehículo',d.vehicleState); hr();

    section('Gestoría');
    row2(['Gestor/a',d.manager1_name],['Nº colegiado',d.manager1_collegeNo]);
    row1('Colegio Oficial',d.collegeName);
    row1('Despacho',d.officeName);
    row1('Asunto',[d.subject1,d.subject2].filter(Boolean).join(' · '));
    row1('Notas',d.managerNotes);

    return doc.save();
  }

  function clearDownloads() {
    generatedUrls.splice(0).forEach(url => URL.revokeObjectURL(url));
    const box = $('#downloads');
    box.innerHTML = '';
    box.hidden = true;
  }

  function addDownload(bytes, filename, label) {
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    generatedUrls.push(url);
    const row = document.createElement('div');
    row.className = 'download-row';
    const copy = document.createElement('div'); copy.className = 'download-copy';
    const strong = document.createElement('strong'); strong.textContent = label;
    const span = document.createElement('span'); span.textContent = filename;
    copy.append(strong, span);
    const link = document.createElement('a'); link.className = 'download-link'; link.href = url; link.download = filename; link.textContent = 'Descargar';
    row.append(copy, link);
    $('#downloads').appendChild(row);
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    clearInvalid();
    clearDownloads();
    const d = getData();
    const missing = markMissing(d);
    const status = $('#generateStatus');
    if (missing.length) {
      status.textContent = `Faltan ${missing.length} datos: ${missing.slice(0,4).join(', ')}${missing.length > 4 ? '…' : ''}`;
      const first = $('.field.invalid');
      first?.scrollIntoView({behavior:'smooth',block:'center'});
      return;
    }
    if (!window.PDFLib || !window.VEHICLE_DOC_TEMPLATES) {
      status.textContent = 'No se ha podido cargar el generador de PDF.';
      return;
    }
    const btn = $('#generateBtn');
    btn.disabled = true;
    btn.textContent = 'Generando…';
    status.textContent = '';
    try {
      saveState();
      const [sellerMandate,buyerMandate,contract,manager] = await Promise.all([
        makeMandate(d,'seller'),
        makeMandate(d,'buyer'),
        d.contractModel === 'rehabilitacion' ? makeContractRehab(d) : makeContractParticulares(d),
        makeManagerPdf(d)
      ]);
      const tag = safeName(d.plate || 'vehiculo');
      addDownload(sellerMandate, `Mandato - Vendedor - ${tag}.pdf`, 'Mandato del vendedor');
      addDownload(buyerMandate, `Mandato - Comprador - ${tag}.pdf`, 'Mandato del comprador');
      addDownload(contract, `Contrato - ${tag}.pdf`, 'Contrato de compraventa');
      addDownload(manager, `Gestor - ${tag}.pdf`, 'Ficha para el gestor');
      $('#downloads').hidden = false;
      status.textContent = '4 PDF preparados.';
    } catch (err) {
      console.error(err);
      status.textContent = 'No se han podido generar los PDF.';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Generar documentación';
    }
  });

  window.addEventListener('beforeunload', () => generatedUrls.forEach(url => URL.revokeObjectURL(url)));
  loadState();
})();
