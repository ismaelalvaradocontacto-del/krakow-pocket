(() => {
  const form = document.getElementById('vehicleForm');
  const ui = document.querySelector('.vehicle-scan');
  const result = ui?.querySelector('.vehicle-scan-result');
  if (!form || !ui || !result || ui.dataset.markerRefine === '1') return;
  ui.dataset.markerRefine = '1';

  const field = name => form.elements.namedItem(name);
  const clean = value => String(value ?? '').replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/g, ' ').trim();
  const upper = value => clean(value).toLocaleUpperCase('es-ES');
  const compact = value => upper(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]/g, '');
  const FIELDS = ['brand','model','vin','plate'];
  const PROVINCES = ['GC','TF','VI','AB','A','AL','AV','BA','B','BU','CC','CA','CS','CR','CO','C','CU','GE','GI','GR','GU','SS','H','HU','PM','J','LE','L','LO','LU','M','MA','MU','NA','OR','O','P','PO','SA','S','SG','SE','SO','T','TE','TO','V','VA','BI','Z','ZA'].sort((a,b)=>b.length-a.length);

  let modulePromise = null;
  let ocrPromise = null;
  let pdfPromise = null;
  let running = false;
  let lastSeq = 0;

  function canonicalBrand(raw) {
    const value = upper(raw).replace(/^(?:D\s*[.·,:;-]?\s*[1IL]|MARCA)\s*[:;,.·\-–—]?\s*/i,'')
      .replace(/[^A-ZÁÉÍÓÚÜÑ0-9 .&+\-/]/g,' ').replace(/\s+/g,' ').trim();
    if (value.length < 2 || value.length > 36) return '';
    if (/OBSERV|DOCUMENT|MODELO|BASTIDOR|FECHA|ITV|MATR[IÍ]CULA/i.test(value)) return '';
    return window.TRASPASO_CANONICALIZE_MAKE?.(value) || value;
  }

  function knownBrand(raw) {
    const direct = window.TRASPASO_CANONICALIZE_MAKE?.(raw);
    if (direct) return direct;
    const source = compact(raw);
    if (!source) return '';
    for (const make of window.TRASPASO_VEHICLE_MAKES_2026 || []) {
      const key = compact(make);
      if (key.length >= 3 && source.includes(key)) return make;
    }
    return canonicalBrand(raw);
  }

  function modelValue(raw) {
    const value = upper(raw).replace(/^(?:D\s*[.·,:;-]?\s*[3B]|MODELO|DENOMINACI[ÓO]N\s+COMERCIAL)\s*[:;,.·\-–—]?\s*/i,'')
      .replace(/[^A-Z0-9 .+\-_/]/g,' ').replace(/\s+/g,' ').trim();
    if (value.length < 2 || value.length > 55) return '';
    if (/PART[- ]?SIN|OBSERVACIONES?|DOCUMENTO|PR[ÓO]XIMA ITV|ESPECIFICAR/i.test(value)) return '';
    if (/^(?:D[. ]?[1234]|C[. ]?4|MARCA|MODELO)$/i.test(value)) return '';
    return value;
  }

  function plateValue(raw) {
    const source = upper(raw).replace(/[^A-Z0-9]/g,'');
    const modern = source.match(/\d{4}[BCDFGHJKLMNPRSTVWXYZ]{3}/);
    if (modern) return modern[0];
    for (const p of PROVINCES) {
      const pos = source.indexOf(p);
      if (pos < 0) continue;
      const m = source.slice(pos + p.length).match(/^(\d{1,6})([A-Z]{0,2})/);
      if (!m) continue;
      return `${p}${m[1]}${m[2]}`;
    }
    return '';
  }

  function vinCandidates(raw) {
    const source = upper(raw).replace(/[¥]/g,'Y').replace(/[^A-Z0-9]/g,'');
    if (/OBSERV|DOCUMENT|FECHA|KILOMET|PROXIMA|VIGOR|ESPECIFICAR/.test(source)) return [];
    const out = [];
    for (let i = 0; i <= source.length - 17; i += 1) {
      const c = source.slice(i,i+17).replace(/O/g,'0').replace(/I/g,'1').replace(/Q/g,'0');
      if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(c)) continue;
      if ((c.match(/[A-Z]/g)||[]).length < 3 || (c.match(/\d/g)||[]).length < 3) continue;
      out.push(c);
    }
    return [...new Set(out)];
  }

  async function getOcr() {
    if (ocrPromise) return ocrPromise;
    ocrPromise = (async () => {
      if (!modulePromise) modulePromise = import('https://cdn.jsdelivr.net/npm/@paddleocr/paddleocr-js@0.4.2/+esm');
      const { PaddleOCR } = await modulePromise;
      return PaddleOCR.create({
        lang:'es',
        ocrVersion:'PP-OCRv6',
        ortOptions:{backend:'wasm',wasmPaths:'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/',numThreads:1,simd:true}
      });
    })();
    return ocrPromise;
  }

  async function loadPdfJs() {
    if (pdfPromise) return pdfPromise;
    pdfPromise = import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/legacy/build/pdf.mjs').then(pdfjs => {
      pdfjs.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/legacy/build/pdf.worker.mjs';
      return pdfjs;
    });
    return pdfPromise;
  }

  async function fileToCanvas(file) {
    if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '')) {
      const pdfjs = await loadPdfJs();
      const pdf = await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
      const page = await pdf.getPage(1);
      const base = page.getViewport({scale:1});
      const scale = Math.max(2.5,Math.min(4.8,3800/Math.max(base.width,base.height)));
      const vp = page.getViewport({scale});
      const c = document.createElement('canvas');
      c.width=Math.ceil(vp.width); c.height=Math.ceil(vp.height);
      const ctx=c.getContext('2d',{alpha:false,willReadFrequently:true});
      ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);
      await page.render({canvasContext:ctx,viewport:vp}).promise;
      try{await pdf.destroy();}catch(_){ }
      return c;
    }
    const url=URL.createObjectURL(file);
    try {
      const img=await new Promise((resolve,reject)=>{const el=new Image();el.onload=()=>resolve(el);el.onerror=reject;el.src=url;});
      const maxSide=3800,long=Math.max(img.naturalWidth,img.naturalHeight),short=Math.min(img.naturalWidth,img.naturalHeight);
      let scale=Math.min(1,maxSide/long);
      if(short<1600) scale=Math.min(maxSide/long,Math.max(scale,Math.min(3.2,1800/Math.max(1,short))));
      const c=document.createElement('canvas');
      c.width=Math.max(1,Math.round(img.naturalWidth*scale));c.height=Math.max(1,Math.round(img.naturalHeight*scale));
      const ctx=c.getContext('2d',{alpha:false,willReadFrequently:true});
      ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(img,0,0,c.width,c.height);
      return c;
    } finally { URL.revokeObjectURL(url); }
  }

  function crop(src,x,y,w,h,scale=1) {
    const sx=Math.max(0,Math.round(x)), sy=Math.max(0,Math.round(y));
    const sw=Math.max(1,Math.min(src.width-sx,Math.round(w))), sh=Math.max(1,Math.min(src.height-sy,Math.round(h)));
    const c=document.createElement('canvas');c.width=Math.max(1,Math.round(sw*scale));c.height=Math.max(1,Math.round(sh*scale));
    const ctx=c.getContext('2d',{alpha:false,willReadFrequently:true});ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(src,sx,sy,sw,sh,0,0,c.width,c.height);return c;
  }

  function enhance(src, lineRemoval=false) {
    const c=crop(src,0,0,src.width,src.height,1);
    const ctx=c.getContext('2d',{willReadFrequently:true});const im=ctx.getImageData(0,0,c.width,c.height),d=im.data;
    const rows=lineRemoval?new Uint8Array(c.height):null;
    if(rows){for(let y=0;y<c.height;y+=1){let dark=0;for(let x=0;x<c.width;x+=1){const i=(y*c.width+x)*4;const g=.28*d[i]+.62*d[i+1]+.10*d[i+2];if(g<180)dark+=1;}if(dark/c.width>.48)rows[y]=1;}}
    for(let y=0,p=0;y<c.height;y+=1){for(let x=0;x<c.width;x+=1,p+=1){const i=p*4;let g=.28*d[i]+.62*d[i+1]+.10*d[i+2];g=(g-128)*1.38+128;if(rows&&(rows[y]||rows[Math.max(0,y-1)]||rows[Math.min(c.height-1,y+1)]))g=255;g=Math.max(0,Math.min(255,g));d[i]=d[i+1]=d[i+2]=g;d[i+3]=255;}}
    ctx.putImageData(im,0,0);return c;
  }

  function boxOf(item) {
    const pts=Array.isArray(item?.poly)?item.poly:[];
    const xs=pts.map(p=>Number(p?.[0])).filter(Number.isFinite),ys=pts.map(p=>Number(p?.[1])).filter(Number.isFinite);
    if(!xs.length||!ys.length)return null;
    const x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
    return{x0,x1,y0,y1,w:Math.max(1,x1-x0),h:Math.max(1,y1-y0),cx:(x0+x1)/2,cy:(y0+y1)/2};
  }

  function normItems(raw) {
    return (raw||[]).map(item=>({text:clean(item?.text),score:Number(item?.score??0),box:boxOf(item)})).filter(i=>i.text&&i.box&&i.score>=.12);
  }

  function markerKey(raw) {
    const k=compact(raw);
    if(k==='A'||k==='4')return'A';
    if(k==='E')return'E';
    if(/^D[1IL]$/.test(k))return'D1';
    if(/^D[3B]$/.test(k))return'D3';
    return'';
  }

  function markerMap(items) {
    const map={};
    for(const item of items){const key=markerKey(item.text);if(key&&(!map[key]||item.score>map[key].score))map[key]=item;}
    const ds=items.filter(i=>/^D[.·,:;-]?$/.test(upper(i.text)));
    for(const d of ds){
      const near=items.filter(i=>i!==d&&i.box.x0>=d.box.x1-4&&Math.abs(i.box.cy-d.box.cy)<=Math.max(i.box.h,d.box.h)*1.2)
        .sort((a,b)=>a.box.x0-b.box.x0)[0];
      if(!near)continue;
      const n=compact(near.text);
      const key=/^[1IL]$/.test(n)?'D1':/^[3B]$/.test(n)?'D3':'';
      if(key&&!map[key])map[key]={text:`D.${near.text}`,score:(d.score+near.score)/2,box:{x0:d.box.x0,x1:near.box.x1,y0:Math.min(d.box.y0,near.box.y0),y1:Math.max(d.box.y1,near.box.y1),w:near.box.x1-d.box.x0,h:Math.max(d.box.y1,near.box.y1)-Math.min(d.box.y0,near.box.y0),cx:(d.box.x0+near.box.x1)/2,cy:(d.box.cy+near.box.cy)/2}};
    }
    return map;
  }

  function rowFromMarker(source, marker) {
    const b=marker.box;
    const yPad=Math.max(b.h*1.55, source.height*.012);
    const y=Math.max(0,b.cy-yPad),h=Math.min(source.height-y,yPad*2);
    const x=Math.max(0,b.x1+Math.max(3,b.h*.35));
    const rightEdge=b.cx<source.width*.5?source.width*.50:source.width*.985;
    const w=Math.max(20,rightEdge-x);
    return crop(source,x,y,w,h,Math.max(1,Math.min(4,1600/Math.max(1,w))));
  }

  function hamming(a,b) {
    if(a.length!==b.length)return Math.max(a.length,b.length);
    let n=0;for(let i=0;i<a.length;i+=1)if(a[i]!==b[i])n+=1;return n;
  }

  function ranDistance(g,all){
    let best=99;for(const other of all){if(other===g)continue;best=Math.min(best,hamming(compact(g.value),compact(other.value)));}return best===99?0:best;
  }

  function chooseConsensus(name, rawValues) {
    const vals=[];
    for(const x of rawValues){
      const text=clean(x.text),score=Number(x.score||0);let value='';
      if(name==='brand')value=knownBrand(text);
      else if(name==='model')value=modelValue(text);
      else if(name==='plate')value=plateValue(text);
      else if(name==='vin'){
        for(const v of vinCandidates(text)) vals.push({value:v,score});
        continue;
      }
      if(value)vals.push({value,score});
    }
    if(!vals.length)return'';
    const grouped=new Map();
    for(const v of vals){const k=compact(v.value);if(!grouped.has(k))grouped.set(k,{value:v.value,count:0,max:0});const g=grouped.get(k);g.count+=1;g.max=Math.max(g.max,v.score);}
    let ranked=[...grouped.values()].map(g=>({...g,rank:g.max+Math.min(.35,(g.count-1)*.13)})).sort((a,b)=>b.rank-a.rank);
    if((name==='vin'||name==='plate')&&ranked.length>1){ranked=ranked.map(g=>({...g,rank:g.rank-ranDistance(g,ranked)*(name==='vin'?.02:.015)})).sort((a,b)=>b.rank-a.rank);}
    return ranked[0].value;
  }

  async function readRow(name,row) {
    const ocr=await getOcr();
    const variants=[row,enhance(row,false),enhance(row,true)];
    const results=await ocr.predict(variants,{textDetLimitSideLen:1800,textDetLimitType:'max',textDetMaxSideLimit:2400,textDetThresh:.10,textDetBoxThresh:.16,textDetUnclipRatio:1.5,textRecScoreThresh:.04});
    const values=[];
    for(const res of results){
      const items=res?.items||[];
      for(const item of items)values.push({text:item.text,score:item.score});
      const joined=items.map(i=>clean(i.text)).join(' ');
      if(joined)values.push({text:joined,score:.70});
    }
    return chooseConsensus(name,values);
  }

  async function fullItems(canvas) {
    const ocr=await getOcr();
    const variants=[canvas,enhance(canvas,false)];
    const results=await ocr.predict(variants,{textDetLimitSideLen:2600,textDetLimitType:'max',textDetMaxSideLimit:4200,textDetThresh:.12,textDetBoxThresh:.18,textDetUnclipRatio:1.65,textRecScoreThresh:.06});
    const all=[];
    for(const res of results)all.push(...normItems(res?.items||[]));
    return all;
  }

  function fallbackRows(source) {
    return {
      plate: crop(source,source.width*.07,source.height*.02,source.width*.41,source.height*.08,2.8),
      vin: crop(source,source.width*.575,source.height*.02,source.width*.40,source.height*.08,2.8),
      brand: crop(source,source.width*.07,source.height*.70,source.width*.41,source.height*.08,2.8),
      model: crop(source,source.width*.07,source.height*.81,source.width*.41,source.height*.09,2.8)
    };
  }

  function shouldRun() {
    const seq=Number(window.__TRASPASO_VEHICLE_SCAN_SEQ||0);
    if(!seq||seq===lastSeq||running||!window.__TRASPASO_VEHICLE_FILE)return false;
    const text=result.textContent||'';
    return /datos? identificados?|No he podido|No se ha podido/i.test(text);
  }

  async function refine() {
    if(!shouldRun())return;
    running=true;
    const seq=Number(window.__TRASPASO_VEHICLE_SCAN_SEQ||0),file=window.__TRASPASO_VEHICLE_FILE;
    try {
      result.textContent='Verificando campos…';
      const canvas=await fileToCanvas(file);
      const items=await fullItems(canvas);
      const markers=markerMap(items);
      const fallback=fallbackRows(canvas);
      const rows={
        plate:markers.A?rowFromMarker(canvas,markers.A):fallback.plate,
        vin:markers.E?rowFromMarker(canvas,markers.E):fallback.vin,
        brand:markers.D1?rowFromMarker(canvas,markers.D1):fallback.brand,
        model:markers.D3?rowFromMarker(canvas,markers.D3):fallback.model
      };

      for(const name of ['plate','vin','brand','model']){
        const input=field(name);if(!input||input.dataset.manualAfterOcr==='1')continue;
        const value=await readRow(name,rows[name]);
        if(value){input.value=upper(value);input.dataset.ocrFilled='1';}
        input.dispatchEvent(new Event('input',{bubbles:true}));
        input.dispatchEvent(new Event('change',{bubbles:true}));
      }
      const count=FIELDS.filter(n=>clean(field(n)?.value)).length;
      result.className=`vehicle-scan-result${count?' success':' error'}`;
      result.textContent=count===4?'4 de 4 datos identificados.':count?`${count} de 4 datos identificados. Revisa los que faltan.`:'No he podido identificar datos con suficiente seguridad.';
      lastSeq=seq;
    } catch(error) {
      console.warn('Verificación OCR por etiquetas',error);
      lastSeq=seq;
    } finally { running=false; }
  }

  new MutationObserver(()=>setTimeout(refine,60)).observe(result,{childList:true,subtree:true,characterData:true});
  window.addEventListener('beforeunload',async()=>{try{(await ocrPromise)?.dispose?.();}catch(_){ }});
})();