(() => {
  const form = document.getElementById('vehicleForm');
  const ui = document.querySelector('.vehicle-scan');
  if (!form || !ui || ui.dataset.paddleV6 === '1') return;
  ui.dataset.paddleV6 = '1';

  const cameraInput = ui.querySelector('.scan-input-camera');
  const uploadInput = ui.querySelector('.scan-input-upload');
  const cameraButton = ui.querySelector('.scan-camera');
  const uploadButton = ui.querySelector('.scan-upload');
  const progress = ui.querySelector('.vehicle-scan-progress');
  const progressCopy = ui.querySelector('.vehicle-scan-progress-copy');
  const progressBar = ui.querySelector('.vehicle-scan-progress-track i');
  const result = ui.querySelector('.vehicle-scan-result');
  const note = ui.querySelector('.vehicle-scan-note');
  if (!cameraInput || !uploadInput || !cameraButton || !uploadButton || !progress || !progressCopy || !progressBar || !result) return;

  uploadInput.accept = 'image/*,application/pdf';
  const uploadStrong = uploadButton.querySelector('strong');
  const uploadSmall = uploadButton.querySelector('small');
  if (uploadStrong) uploadStrong.textContent = 'Cargar archivo';
  if (uploadSmall) uploadSmall.textContent = 'Foto o PDF';
  if (note) note.textContent = 'Permiso de circulación · foto o PDF · el archivo no se guarda.';

  const FIELDS = ['brand','model','vin','plate'];
  const field = name => form.elements.namedItem(name);
  const clean = value => String(value ?? '').replace(/[\u200B-\u200D\uFEFF]/g,'').replace(/\s+/g,' ').trim();
  const upper = value => clean(value).toLocaleUpperCase('es-ES');
  const compact = value => upper(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Z0-9]/g,'');

  let paddlePromise = null;
  let modulePromise = null;
  let pdfPromise = null;
  let tesseractPromise = null;
  let tesseractWorkerPromise = null;
  let running = false;
  let writing = false;

  function setBusy(value) {
    running = value;
    cameraButton.disabled = value;
    uploadButton.disabled = value;
    ui.classList.toggle('busy', value);
    progress.hidden = !value;
    if (!value) progressBar.style.width = '0%';
  }
  function setProgress(value, text) {
    progress.hidden = false;
    progressBar.style.width = `${Math.max(0,Math.min(100,value))}%`;
    progressCopy.textContent = text;
  }
  function setResult(text, type='') {
    result.className = `vehicle-scan-result${type ? ` ${type}` : ''}`;
    result.textContent = text;
  }

  function canonicalBrand(raw) {
    let value = upper(raw).replace(/^(?:D\s*[.·,:;-]?\s*[1IL]|MARCA)\s*[:;,.·\-–—]?\s*/i,'')
      .replace(/[^A-ZÁÉÍÓÚÜÑ0-9 .&+\-/]/g,' ').replace(/\s+/g,' ').trim();
    if (value.length < 2 || value.length > 36) return '';
    if (/OBSERV|DOCUMENT|MODELO|BASTIDOR|FECHA|ITV|MATR[IÍ]CULA/i.test(value)) return '';
    return window.TRASPASO_CANONICALIZE_MAKE?.(value) || value;
  }
  function modelValue(raw) {
    const value = upper(raw).replace(/^(?:D\s*[.·,:;-]?\s*[3B]|MODELO|DENOMINACI[ÓO]N\s+COMERCIAL)\s*[:;,.·\-–—]?\s*/i,'')
      .replace(/[^A-Z0-9 .+\-_/]/g,' ').replace(/\s+/g,' ').trim();
    if (value.length < 2 || value.length > 55) return '';
    if (/^(?:OBSERVACIONES?|DOCUMENTO|PART[- ]?SIN|D[. ]?[1234]|C[. ]?4)$/i.test(value)) return '';
    return value;
  }
  const PROVINCES = ['GC','TF','M','B','V','SE','MA','BI','SS','Z','A','AL','AV','BA','BU','C','CA','CC','CO','CR','CS','CU','GE','GI','GR','GU','H','HU','J','L','LE','LO','LU','MU','NA','O','OR','P','PM','PO','S','SA','SG','SO','T','TE','TO','VA','VI','ZA'];
  function plateValue(raw) {
    const source = upper(raw).replace(/[^A-Z0-9]/g,'');
    const modern = source.match(/\d{4}[BCDFGHJKLMNPRSTVWXYZ]{3}/);
    if (modern) return modern[0];
    for (const p of PROVINCES.sort((a,b)=>b.length-a.length)) {
      const m = source.match(new RegExp(`${p}\\d{1,6}[A-Z]{0,2}`));
      if (m) return m[0];
    }
    return '';
  }
  function vinValue(raw) {
    const source = upper(raw).replace(/[¥]/g,'Y').replace(/[^A-Z0-9]/g,'');
    if (source.length < 17 || source.length > 30 || /OBSERV|DOCUMENT|FECHA|KILOMET|PROXIMA|VIGOR/.test(source)) return '';
    for (let i=0;i<=source.length-17;i++) {
      const c = source.slice(i,i+17).replace(/O/g,'0').replace(/I/g,'1').replace(/Q/g,'0');
      if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(c)) continue;
      if ((c.match(/[A-Z]/g)||[]).length < 3 || (c.match(/\d/g)||[]).length < 3) continue;
      return c;
    }
    return '';
  }
  function normalizeField(name, value) {
    if (name==='brand') return canonicalBrand(value);
    if (name==='model') return modelValue(value);
    if (name==='vin') return vinValue(value);
    if (name==='plate') return plateValue(value);
    return upper(value);
  }

  FIELDS.forEach(name => {
    const input = field(name);
    if (!input) return;
    input.autocapitalize = 'characters'; input.autocomplete='off'; input.spellcheck=false;
    input.addEventListener('input', e => {
      if (writing || e.isComposing) return;
      input.dataset.manualAfterOcr = '1';
      input.value = (name==='brand'||name==='model') ? upper(input.value) : upper(input.value).replace(/\s+/g,'');
    });
  });

  function clearIdentity() {
    writing = true;
    try {
      FIELDS.forEach(name => {
        const input = field(name); if (!input) return;
        input.value=''; delete input.dataset.ocrFilled; delete input.dataset.manualAfterOcr;
        input.dispatchEvent(new Event('input',{bubbles:true}));
        input.dispatchEvent(new Event('change',{bubbles:true}));
      });
    } finally { writing=false; }
  }

  async function loadModule() {
    if (modulePromise) return modulePromise;
    modulePromise = (async()=>{
      let last;
      for (const url of [
        'https://cdn.jsdelivr.net/npm/@paddleocr/paddleocr-js@0.4.2/+esm',
        'https://esm.sh/@paddleocr/paddleocr-js@0.4.2?bundle'
      ]) {
        try { const mod = await import(url); if (mod?.PaddleOCR) return mod; } catch(e) { last=e; }
      }
      throw last || new Error('PADDLE_MODULE_UNAVAILABLE');
    })();
    return modulePromise;
  }

  async function getPaddle() {
    if (paddlePromise) return paddlePromise;
    paddlePromise = (async()=>{
      setProgress(7,'Preparando OCR avanzado…');
      const { PaddleOCR } = await loadModule();
      return PaddleOCR.create({
        lang:'es',
        ocrVersion:'PP-OCRv6',
        ortOptions:{
          backend:'wasm',
          wasmPaths:'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/',
          numThreads:1,
          simd:true
        }
      });
    })().catch(e=>{ paddlePromise=null; throw e; });
    return paddlePromise;
  }

  async function loadPdfJs() {
    if (pdfPromise) return pdfPromise;
    pdfPromise = import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/legacy/build/pdf.mjs').then(pdfjs=>{
      pdfjs.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/legacy/build/pdf.worker.mjs';
      return pdfjs;
    });
    return pdfPromise;
  }

  async function pdfToData(file) {
    setProgress(5,'Abriendo PDF…');
    const pdfjs = await loadPdfJs();
    const pdf = await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
    const page = await pdf.getPage(1);
    const text = await page.getTextContent().catch(()=>({items:[]}));
    const items = (text.items||[]).map(it=>({text:it.str||'',score:1,poly:null}));
    const base = page.getViewport({scale:1});
    const scale = Math.max(2.5,Math.min(4.5,3400/Math.max(base.width,base.height)));
    const viewport = page.getViewport({scale});
    const canvas=document.createElement('canvas'); canvas.width=Math.ceil(viewport.width); canvas.height=Math.ceil(viewport.height);
    const ctx=canvas.getContext('2d',{alpha:false,willReadFrequently:true}); ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
    await page.render({canvasContext:ctx,viewport}).promise; try{await pdf.destroy();}catch(_){ }
    return {canvas,items};
  }

  async function imageToCanvas(file) {
    const url=URL.createObjectURL(file);
    try {
      const img=await new Promise((res,rej)=>{const x=new Image();x.onload=()=>res(x);x.onerror=rej;x.src=url;});
      const maxSide=3400, longest=Math.max(img.naturalWidth,img.naturalHeight), shortest=Math.min(img.naturalWidth,img.naturalHeight);
      let scale=Math.min(1,maxSide/longest); if(shortest<1300) scale=Math.min(maxSide/longest,Math.max(scale,Math.min(2.6,1500/Math.max(1,shortest))));
      const c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.naturalWidth*scale));c.height=Math.max(1,Math.round(img.naturalHeight*scale));
      const ctx=c.getContext('2d',{alpha:false,willReadFrequently:true});ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(img,0,0,c.width,c.height);return c;
    } finally { URL.revokeObjectURL(url); }
  }

  function cropCanvas(src,x,y,w,h,scale=1) {
    const sx=Math.max(0,Math.round(x)), sy=Math.max(0,Math.round(y)), sw=Math.max(1,Math.min(src.width-sx,Math.round(w))), sh=Math.max(1,Math.min(src.height-sy,Math.round(h)));
    const c=document.createElement('canvas');c.width=Math.max(1,Math.round(sw*scale));c.height=Math.max(1,Math.round(sh*scale));
    const ctx=c.getContext('2d',{alpha:false,willReadFrequently:true});ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(src,sx,sy,sw,sh,0,0,c.width,c.height);return c;
  }

  function enhanced(src) {
    const c=cropCanvas(src,0,0,src.width,src.height,1);const ctx=c.getContext('2d',{willReadFrequently:true});const im=ctx.getImageData(0,0,c.width,c.height);const d=im.data;
    for(let i=0;i<d.length;i+=4){const g=.28*d[i]+.62*d[i+1]+.10*d[i+2];const v=Math.max(0,Math.min(255,(g-128)*1.32+128));d[i]=d[i+1]=d[i+2]=v;}
    ctx.putImageData(im,0,0);return c;
  }

  function boxOf(item) {
    const p=Array.isArray(item?.poly)?item.poly:[]; const xs=p.map(v=>Number(v?.[0])).filter(Number.isFinite), ys=p.map(v=>Number(v?.[1])).filter(Number.isFinite);
    if(!xs.length||!ys.length) return null; const x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);return{x0,x1,y0,y1,cx:(x0+x1)/2,cy:(y0+y1)/2,w:Math.max(1,x1-x0),h:Math.max(1,y1-y0)};
  }
  function normItems(raw) { return (raw||[]).map(it=>({text:clean(it?.text),score:Number(it?.score??1),box:boxOf(it)})).filter(it=>it.text&&it.score>=.2); }
  function marker(raw) {
    const k=compact(raw); if(k==='A')return'A'; if(k==='E')return'E'; if(/^D[1IL]$/.test(k))return'D1'; if(/^D[3B]$/.test(k))return'D3'; return'';
  }
  function candidate(value='',score=0,source=''){return{value:clean(value),score,source};}
  function better(a,b){if(!a?.value)return b;if(!b?.value)return a;if(b.score>a.score+.02)return b;if(b.value.length>a.value.length+2&&b.score>=a.score-.03)return b;return a;}
  function knownBrand(text){const direct=window.TRASPASO_CANONICALIZE_MAKE?.(text);if(direct)return direct;const s=compact(text);for(const make of window.TRASPASO_VEHICLE_MAKES_2026||[]){const k=compact(make);if(k.length>=3&&s.includes(k))return make;}return'';}

  function rightNeighbor(items,m,validator){
    if(!m.box)return null;const b=m.box;const list=items.filter(x=>x!==m&&x.box&&x.box.x0>=b.x1-10&&Math.abs(x.box.cy-b.cy)<=Math.max(b.h,x.box.h)*1.25+8).sort((a,z)=>a.box.x0-z.box.x0);
    for(const it of list){const v=validator(it.text);if(v)return{value:v,score:(m.score+it.score)/2+.16,item:it};}return null;
  }

  function parseItems(raw) {
    const items=normItems(raw);const out={brand:candidate(),model:candidate(),vin:candidate(),plate:candidate()};const markers={};
    for(const it of items){const mk=marker(it.text);if(mk&&!markers[mk])markers[mk]=it;const p=plateValue(it.text);if(p)out.plate=better(out.plate,candidate(p,it.score+.06,'pattern'));const v=vinValue(it.text);if(v)out.vin=better(out.vin,candidate(v,it.score+.08,'pattern'));const b=knownBrand(it.text);if(b)out.brand=better(out.brand,candidate(b,it.score+.08,'catalog'));}
    if(markers.A){const f=rightNeighbor(items,markers.A,plateValue);if(f)out.plate=better(out.plate,candidate(f.value,f.score+.2,'A'));}
    if(markers.E){const f=rightNeighbor(items,markers.E,vinValue);if(f)out.vin=better(out.vin,candidate(f.value,f.score+.22,'E'));}
    if(markers.D1){const f=rightNeighbor(items,markers.D1,canonicalBrand);if(f)out.brand=better(out.brand,candidate(f.value,f.score+.18,'D1'));}
    if(markers.D3){const f=rightNeighbor(items,markers.D3,modelValue);if(f)out.model=better(out.model,candidate(f.value,f.score+.18,'D3'));}
    return {out,items,markers};
  }

  async function paddlePredict(input, params={}) {
    const p=await getPaddle();
    const [r]=await p.predict(input,{textDetLimitSideLen:2400,textDetLimitType:'max',textDetMaxSideLimit:3800,textDetThresh:.22,textDetBoxThresh:.35,textDetUnclipRatio:1.6,textRecScoreThresh:.20,...params});
    return r;
  }

  async function refineRows(canvas, parsed) {
    const jobs=[];
    const configs=[['plate','A',plateValue],['vin','E',vinValue],['brand','D1',canonicalBrand],['model','D3',modelValue]];
    for(const [name,code,validator] of configs){
      const current=parsed.out[name]; const m=parsed.markers[code];
      if(!m?.box) continue;
      if(current?.value && current.score>=.88 && !(name==='plate'&&current.source==='pattern') && !(name==='vin'&&current.source==='pattern')) continue;
      const b=m.box; const x=Math.max(0,b.x1-6); const y=Math.max(0,b.y0-b.h*.85); const w=Math.min(canvas.width-x,canvas.width*(code==='E'?.43:.48)); const h=Math.min(canvas.height-y,b.h*2.7);
      jobs.push({name,validator,canvas:enhanced(cropCanvas(canvas,x,y,w,h,3.0))});
    }
    if(!jobs.length)return parsed.out;
    setProgress(80,'Verificando campos…');
    try{
      const p=await getPaddle(); const results=await p.predict(jobs.map(j=>j.canvas),{textDetLimitSideLen:1800,textDetLimitType:'max',textDetMaxSideLimit:2600,textDetThresh:.18,textDetBoxThresh:.28,textDetUnclipRatio:1.4,textRecScoreThresh:.15});
      results.forEach((r,i)=>{const job=jobs[i];const texts=(r?.items||[]).sort((a,b)=>(boxOf(a)?.x0||0)-(boxOf(b)?.x0||0)).map(x=>clean(x.text)).filter(Boolean);const joined=texts.join(' ');let value=job.validator(joined);if(!value){for(const t of texts){value=job.validator(t);if(value)break;}}if(value)parsed.out[job.name]=better(parsed.out[job.name],candidate(value,.98,'row-refine'));});
    }catch(e){console.warn('Refinado de filas',e);}
    return parsed.out;
  }

  async function tesseractFallback(canvas) {
    if(tesseractPromise===null)tesseractPromise=new Promise((res,rej)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';s.onload=()=>res(window.Tesseract);s.onerror=rej;document.head.appendChild(s);});
    const T=await tesseractPromise;if(!tesseractWorkerPromise)tesseractWorkerPromise=T.createWorker('spa');const w=await tesseractWorkerPromise;const {data}=await w.recognize(canvas);const text=data?.text||'';return{brand:candidate(knownBrand(text),.55,'fallback'),model:candidate(),vin:candidate(vinValue(text),.50,'fallback'),plate:candidate(plateValue(text),.50,'fallback')};
  }

  function count(out){return FIELDS.reduce((n,k)=>n+(out[k]?.value?1:0),0);}
  function fill(out){let n=0;writing=true;try{FIELDS.forEach(name=>{const input=field(name);if(!input)return;const v=normalizeField(name,out[name]?.value||'');input.value=v||'';if(v){input.dataset.ocrFilled='1';n++;}else delete input.dataset.ocrFilled;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));});}finally{writing=false;}return n;}

  async function processFile(file) {
    if(!file||running)return;const isPdf=file.type==='application/pdf'||/\.pdf$/i.test(file.name||'');if(!isPdf&&!file.type?.startsWith('image/')){setResult('Selecciona una foto o un PDF.','error');return;}
    setBusy(true);setResult('');setProgress(3,'Preparando documento…');clearIdentity();
    try{
      let canvas, parsed={out:{brand:candidate(),model:candidate(),vin:candidate(),plate:candidate()},items:[],markers:{}};
      if(isPdf){const d=await pdfToData(file);canvas=d.canvas;if(d.items.length){const text=d.items.map(x=>x.text).join('\n');parsed.out.brand=candidate(knownBrand(text),.9,'pdf-text');parsed.out.vin=candidate(vinValue(text),.9,'pdf-text');parsed.out.plate=candidate(plateValue(text),.9,'pdf-text');}}
      else canvas=await imageToCanvas(file);
      setProgress(18,'Leyendo con OCR avanzado…');
      try{const r=await paddlePredict(canvas);const p=parseItems(r?.items||[]);for(const k of FIELDS)parsed.out[k]=better(parsed.out[k],p.out[k]);parsed.items=p.items;parsed.markers=p.markers;parsed.out=await refineRows(canvas,parsed);}catch(e){console.warn('PP-OCRv6 no disponible',e);setProgress(68,'Usando lector de respaldo…');const fb=await tesseractFallback(canvas);for(const k of FIELDS)parsed.out[k]=better(parsed.out[k],fb[k]);}
      if(count(parsed.out)<4){setProgress(70,'Afinando lectura…');try{const r2=await paddlePredict(enhanced(canvas),{textRecScoreThresh:.15,textDetBoxThresh:.28});const p2=parseItems(r2?.items||[]);for(const k of FIELDS)parsed.out[k]=better(parsed.out[k],p2.out[k]);if(Object.keys(p2.markers).length){p2.out=parsed.out;parsed.out=await refineRows(canvas,p2);}}catch(_){} }
      setProgress(96,'Validando datos…');const n=fill(parsed.out);setProgress(100,'Listo');if(n===4)setResult('4 de 4 datos identificados.','success');else if(n)setResult(`${n} de 4 datos identificados. Revisa los que faltan.`,'success');else setResult('No he podido identificar datos con suficiente seguridad.','error');
    }catch(e){console.error('OCR PP-OCRv6',e);setResult('No se ha podido leer el documento. Inténtalo de nuevo.','error');}finally{setBusy(false);}
  }

  function intercept(e){const file=e.target.files?.[0];if(!file)return;e.stopImmediatePropagation();processFile(file).finally(()=>{e.target.value='';});}
  cameraInput.addEventListener('change',intercept,true);uploadInput.addEventListener('change',intercept,true);
  window.addEventListener('beforeunload',async()=>{try{(await paddlePromise)?.dispose?.();}catch(_){ }try{(await tesseractWorkerPromise)?.terminate?.();}catch(_){ }});
})();