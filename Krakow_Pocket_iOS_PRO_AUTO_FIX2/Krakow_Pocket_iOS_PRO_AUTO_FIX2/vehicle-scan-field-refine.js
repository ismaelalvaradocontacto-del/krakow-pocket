(() => {
  const form = document.getElementById('vehicleForm');
  const ui = document.querySelector('.vehicle-scan');
  const result = ui?.querySelector('.vehicle-scan-result');
  if (!form || !ui || !result || ui.dataset.fieldRefine === '1') return;
  ui.dataset.fieldRefine = '1';

  const field = name => form.elements.namedItem(name);
  const clean = value => String(value ?? '').replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/g, ' ').trim();
  const upper = value => clean(value).toLocaleUpperCase('es-ES');
  const compact = value => upper(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]/g, '');
  const PROVINCES = ['GC','TF','VI','AB','A','AL','AV','BA','B','BU','CC','CA','CS','CR','CO','C','CU','GE','GR','GU','SS','H','HU','PM','J','LE','L','LO','LU','M','MA','MU','NA','OR','O','P','PO','SA','S','SG','SE','SO','T','TE','TO','V','VA','BI','Z','ZA'].sort((a,b)=>b.length-a.length);

  let modulePromise = null;
  let ocrPromise = null;
  let pdfjsPromise = null;
  let running = false;
  let lastDoneSeq = 0;

  function knownBrand(raw) {
    const direct = window.TRASPASO_CANONICALIZE_MAKE?.(raw);
    if (direct) return direct;
    const source = compact(raw);
    for (const make of window.TRASPASO_VEHICLE_MAKES_2026 || []) {
      const key = compact(make);
      if (key.length >= 3 && source.includes(key)) return make;
    }
    return '';
  }

  function modelValue(raw) {
    const value = upper(raw).replace(/[^A-Z0-9 .+\-_/]/g, ' ').replace(/\s+/g, ' ').trim();
    if (value.length < 2 || value.length > 55) return '';
    if (/PART[- ]?SIN|OBSERVACIONES?|DOCUMENTO|PR[ÓO]XIMA ITV|ESPECIFICAR/i.test(value)) return '';
    if (/^(?:D[. ]?[1234]|C[. ]?4|MARCA|MODELO)$/i.test(value)) return '';
    return value;
  }

  function plateValue(raw) {
    const s = upper(raw).replace(/[^A-Z0-9]/g, '');
    const modern = s.match(/\d{4}[BCDFGHJKLMNPRSTVWXYZ]{3}/);
    if (modern) return modern[0];
    for (const prefix of PROVINCES) {
      const pos = s.indexOf(prefix);
      if (pos < 0) continue;
      const m = s.slice(pos + prefix.length).match(/^(\d{1,6})([A-Z]{0,2})/);
      if (!m) continue;
      if (m[1].length > 4 && m[2]) continue;
      return `${prefix}${m[1]}${m[2]}`;
    }
    return '';
  }

  function vinValue(raw) {
    const s = upper(raw).replace(/[¥]/g,'Y').replace(/[^A-Z0-9]/g,'');
    if (/OBSERV|DOCUMENT|FECHA|KILOMET|ITV|VIGOR|ESPECIFICAR/.test(s)) return '';
    for (let i=0;i<=s.length-17;i+=1) {
      const v = s.slice(i,i+17).replace(/O/g,'0').replace(/I/g,'1').replace(/Q/g,'0');
      if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(v)) continue;
      if ((v.match(/[A-Z]/g)||[]).length < 3 || (v.match(/\d/g)||[]).length < 3) continue;
      return v;
    }
    return '';
  }

  async function getOcr() {
    if (ocrPromise) return ocrPromise;
    ocrPromise = (async () => {
      if (!modulePromise) modulePromise = import('https://cdn.jsdelivr.net/npm/@paddleocr/paddleocr-js@0.4.2/+esm');
      const { PaddleOCR } = await modulePromise;
      return PaddleOCR.create({
        lang:'es',
        ocrVersion:'PP-OCRv5',
        ortOptions:{backend:'auto',wasmPaths:'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/',numThreads:1,simd:true}
      });
    })();
    return ocrPromise;
  }

  async function loadPdfJs() {
    if (pdfjsPromise) return pdfjsPromise;
    pdfjsPromise = import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/legacy/build/pdf.mjs').then(pdfjs => {
      pdfjs.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/legacy/build/pdf.worker.mjs';
      return pdfjs;
    });
    return pdfjsPromise;
  }

  async function fileToCanvas(file) {
    if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '')) {
      const pdfjs = await loadPdfJs();
      const pdf = await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
      const page = await pdf.getPage(1);
      const base = page.getViewport({scale:1});
      const scale = Math.max(2.3, Math.min(4.4, 3400/Math.max(base.width,base.height)));
      const vp = page.getViewport({scale});
      const c=document.createElement('canvas');c.width=Math.ceil(vp.width);c.height=Math.ceil(vp.height);
      const ctx=c.getContext('2d',{alpha:false,willReadFrequently:true});ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);
      await page.render({canvasContext:ctx,viewport:vp}).promise;
      try{await pdf.destroy();}catch(_){ }
      return c;
    }
    const url=URL.createObjectURL(file);
    try {
      const img=await new Promise((resolve,reject)=>{const el=new Image();el.onload=()=>resolve(el);el.onerror=reject;el.src=url;});
      const maxSide=3600,long=Math.max(img.naturalWidth,img.naturalHeight),short=Math.min(img.naturalWidth,img.naturalHeight);
      let scale=Math.min(1,maxSide/long);if(short<1500)scale=Math.min(maxSide/long,Math.max(scale,Math.min(3,1700/Math.max(1,short))));
      const c=document.createElement('canvas');c.width=Math.round(img.naturalWidth*scale);c.height=Math.round(img.naturalHeight*scale);
      const ctx=c.getContext('2d',{alpha:false,willReadFrequently:true});ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(img,0,0,c.width,c.height);return c;
    } finally { URL.revokeObjectURL(url); }
  }

  function crop(source,x,y,w,h){
    const sx=Math.max(0,Math.round(x)),sy=Math.max(0,Math.round(y));
    const sw=Math.max(1,Math.min(source.width-sx,Math.round(w))),sh=Math.max(1,Math.min(source.height-sy,Math.round(h)));
    const c=document.createElement('canvas');c.width=sw;c.height=sh;const ctx=c.getContext('2d',{alpha:false,willReadFrequently:true});ctx.fillStyle='#fff';ctx.fillRect(0,0,sw,sh);ctx.drawImage(source,sx,sy,sw,sh,0,0,sw,sh);return c;
  }

  function densePermitCrop(source){
    const ratio=source.width/source.height;
    if(ratio>=1.12&&ratio<=1.82)return source;
    if(source.height<source.width*1.08)return source;

    const workW=Math.min(620,source.width),scale=workW/source.width,workH=Math.round(source.height*scale);
    const work=document.createElement('canvas');work.width=workW;work.height=workH;
    const ctx=work.getContext('2d',{alpha:false,willReadFrequently:true});ctx.drawImage(source,0,0,workW,workH);
    const data=ctx.getImageData(0,0,workW,workH).data;
    const centers=[];
    const rows=[];
    for(let y=1;y<workH;y+=1){
      let edges=0,dark=0;
      for(let x=1;x<workW;x+=1){
        const i=(y*workW+x)*4,j=((y-1)*workW+x)*4;
        const a=.299*data[i]+.587*data[i+1]+.114*data[i+2];
        const b=.299*data[j]+.587*data[j+1]+.114*data[j+2];
        if(Math.abs(a-b)>12)edges+=1;
        if(a<190)dark+=1;
      }
      if(edges/workW+.2*dark/workW>.22)rows.push(y);
    }
    const groups=[];
    for(const y of rows){
      if(!groups.length||y-groups[groups.length-1][groups[groups.length-1].length-1]>3)groups.push([y]);
      else groups[groups.length-1].push(y);
    }
    groups.forEach(g=>centers.push(g.reduce((a,b)=>a+b,0)/g.length));

    let best=null;
    const minGap=workW*.025,maxGap=workW*.065;
    for(let i=0;i<centers.length-1;i+=1){
      let j=i;
      while(j+1<centers.length){
        const gap=centers[j+1]-centers[j];
        if(gap<minGap||gap>maxGap)break;
        j+=1;
      }
      const count=j-i+1;
      if(count>=5&&(!best||count>best.count))best={i,j,count};
    }
    if(best){
      let last=best.j;
      while(last+1<centers.length&&centers[last+1]-centers[last]<workW*.095)last+=1;
      const pad=workW*.025;
      const y0=Math.max(0,(centers[best.i]-pad)/scale);
      const y1=Math.min(source.height,(centers[last]+pad*1.6)/scale);
      const candidate=crop(source,0,y0,source.width,y1-y0);
      const rr=candidate.width/candidate.height;
      if(rr>=1.05&&rr<=1.95)return candidate;
    }

    const px=data,score=new Float32Array(workH);
    for(let y=1;y<workH;y+=1){let s=0;for(let x=1;x<workW;x+=2){const i=(y*workW+x)*4,j=(y*workW+x-1)*4;const a=.299*px[i]+.587*px[i+1]+.114*px[i+2],b=.299*px[j]+.587*px[j+1]+.114*px[j+2];if(Math.abs(a-b)>20)s+=1;if(a<190)s+=.12;}score[y]=s;}
    const pref=new Float64Array(workH+1);for(let y=0;y<workH;y+=1)pref[y+1]=pref[y]+score[y];let fallback=null;
    for(const r of [1.2,1.32,1.44,1.56,1.68,1.8]){const h=Math.round(workW/r);if(h>=workH)continue;for(let y=0;y+h<=workH;y+=Math.max(3,Math.round(h*.035))){const sc=(pref[y+h]-pref[y])/h;if(!fallback||sc>fallback.score)fallback={y,h,score:sc};}}
    if(!fallback)return source;
    const pad=source.width*.025,sy=Math.max(0,fallback.y/scale-pad),sh=Math.min(source.height-sy,fallback.h/scale+pad*2);
    const c=crop(source,0,sy,source.width,sh),rr=c.width/c.height;
    return rr>=1.05&&rr<=1.95?c:source;
  }

  function detectLines(source,x0,x1){
    const sx=Math.floor(source.width*x0),ex=Math.ceil(source.width*x1),width=ex-sx,workW=Math.min(900,width),scale=workW/width,workH=Math.round(source.height*scale);
    const c=document.createElement('canvas');c.width=workW;c.height=workH;const ctx=c.getContext('2d',{alpha:false,willReadFrequently:true});ctx.drawImage(source,sx,0,width,source.height,0,0,workW,workH);const data=ctx.getImageData(0,0,workW,workH).data;
    const ys=[];for(let y=1;y<workH;y+=1){let edges=0,dark=0;for(let x=1;x<workW;x+=1){const i=(y*workW+x)*4,j=((y-1)*workW+x)*4;const p=.299*data[i]+.587*data[i+1]+.114*data[i+2],q=.299*data[j]+.587*data[j+1]+.114*data[j+2];if(Math.abs(p-q)>12)edges+=1;if(p<190)dark+=1;}if(edges/workW+.3*dark/workW>.18)ys.push(y);}
    const groups=[];for(const y of ys){if(!groups.length||y-groups[groups.length-1][groups[groups.length-1].length-1]>2)groups.push([y]);else groups[groups.length-1].push(y);}return groups.map(g=>g.reduce((a,b)=>a+b,0)/g.length/scale).filter((y,i,a)=>!i||y-a[i-1]>source.height*.012);
  }

  function boxes(permit){
    const left=detectLines(permit,.01,.49),right=detectLines(permit,.52,.99),pad=permit.height*.008;
    const out={},xl=permit.width*.075,wl=permit.width*.405,xr=permit.width*.575,wr=permit.width*.40;
    if(left.length>=6){out.plate={x:xl,y:left[0]+pad,w:wl,h:Math.max(8,left[1]-left[0]-pad*2)};const tail=left.slice(-6);if(tail.length===6){out.brand={x:xl,y:tail[1]+pad,w:wl,h:Math.max(8,tail[2]-tail[1]-pad*2)};out.model={x:xl,y:tail[3]+pad,w:wl,h:Math.max(8,tail[4]-tail[3]-pad*2)};}}
    if(right.length>=2)out.vin={x:xr,y:right[0]+pad,w:wr,h:Math.max(8,right[1]-right[0]-pad*2)};
    out.plate||=( {x:xl,y:permit.height*.025,w:wl,h:permit.height*.075} );out.vin||=( {x:xr,y:permit.height*.025,w:wr,h:permit.height*.075} );out.brand||=( {x:xl,y:permit.height*.705,w:wl,h:permit.height*.075} );out.model||=( {x:xl,y:permit.height*.82,w:wl,h:permit.height*.075} );return out;
  }

  function scaleUp(source,target=1600){const s=Math.max(1,Math.min(6,target/source.width));const c=document.createElement('canvas');c.width=Math.round(source.width*s);c.height=Math.round(source.height*s);const ctx=c.getContext('2d',{alpha:false,willReadFrequently:true});ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(source,0,0,c.width,c.height);return c;}

  function enhance(source,removeLines=false){
    const c=document.createElement('canvas');c.width=source.width;c.height=source.height;const ctx=c.getContext('2d',{alpha:false,willReadFrequently:true});ctx.drawImage(source,0,0);const im=ctx.getImageData(0,0,c.width,c.height),d=im.data,lum=new Uint8Array(c.width*c.height);for(let p=0,i=0;i<d.length;i+=4,p+=1)lum[p]=Math.round(.299*d[i]+.587*d[i+1]+.114*d[i+2]);const rows=new Uint8Array(c.height);if(removeLines){for(let y=0;y<c.height;y+=1){let dark=0;for(let x=0;x<c.width;x+=1)if(lum[y*c.width+x]<185)dark+=1;if(dark/c.width>.42)rows[y]=1;}}
    for(let y=0,p=0;y<c.height;y+=1)for(let x=0;x<c.width;x+=1,p+=1){let v=(lum[p]-128)*1.35+128;if(rows[y]||rows[Math.max(0,y-1)]||rows[Math.min(c.height-1,y+1)])v=255;v=Math.max(0,Math.min(255,v));const i=p*4;d[i]=d[i+1]=d[i+2]=v;d[i+3]=255;}ctx.putImageData(im,0,0);return c;
  }

  async function readVariants(name,row){
    const ocr=await getOcr(),base=scaleUp(row),variants=[base,enhance(base,false),enhance(base,true)];
    const results=await ocr.predict(variants,{textDetLimitSideLen:1600,textDetLimitType:'max',textDetMaxSideLimit:2200,textDetThresh:.14,textDetBoxThresh:.20,textDetUnclipRatio:1.45,textRecScoreThresh:.08});
    const values=[];
    for(const res of results){for(const item of res?.items||[]){const text=clean(item.text),score=Number(item.score??0);let value='';if(name==='brand')value=knownBrand(text);if(name==='model')value=modelValue(text);if(name==='vin')value=vinValue(text);if(name==='plate')value=plateValue(text);if(value)values.push({value,score});}const joined=(res?.items||[]).map(i=>clean(i.text)).join(' ');let combo='';if(name==='brand')combo=knownBrand(joined);if(name==='model')combo=modelValue(joined);if(name==='vin')combo=vinValue(joined);if(name==='plate')combo=plateValue(joined);if(combo)values.push({value:combo,score:.72});}
    if(!values.length)return '';
    const groups=new Map();for(const v of values){const k=compact(v.value);if(!groups.has(k))groups.set(k,{value:v.value,count:0,max:0});const g=groups.get(k);g.count+=1;g.max=Math.max(g.max,v.score);}const ranked=[...groups.values()].map(g=>({...g,rank:g.max+Math.min(.28,(g.count-1)*.11)})).sort((a,b)=>b.rank-a.rank);return ranked[0].value;
  }

  function shouldRun() {
    const seq=Number(window.__TRASPASO_VEHICLE_SCAN_SEQ||0);
    if(!seq||seq===lastDoneSeq||running||!window.__TRASPASO_VEHICLE_FILE)return false;
    const text=result.textContent||'';
    return /datos? identificados?|No he podido|No se ha podido/i.test(text);
  }

  async function refine(){
    if(!shouldRun())return;running=true;const seq=Number(window.__TRASPASO_VEHICLE_SCAN_SEQ||0),file=window.__TRASPASO_VEHICLE_FILE;
    try{
      result.textContent='Verificando campos…';
      const canvas=await fileToCanvas(file),permit=densePermitCrop(canvas),map=boxes(permit);
      const current={brand:clean(field('brand')?.value),model:clean(field('model')?.value),vin:clean(field('vin')?.value),plate:clean(field('plate')?.value)};
      for(const name of ['plate','vin','brand','model']){
        const b=map[name];if(!b)continue;
        const row=crop(permit,b.x,b.y,b.w,b.h),value=await readVariants(name,row);
        const input=field(name);if(!input||input.dataset.manualAfterOcr==='1')continue;
        if(value){input.value=upper(value);input.dataset.ocrFilled='1';input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));}
        else if((name==='plate'||name==='vin'||name==='model')&&current[name]){input.value='';delete input.dataset.ocrFilled;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));}
      }
      const count=['brand','model','vin','plate'].filter(n=>clean(field(n)?.value)).length;
      result.className=`vehicle-scan-result${count?' success':' error'}`;result.textContent=count===4?'4 de 4 datos identificados.':count?`${count} de 4 datos identificados. Revisa los que faltan.`:'No he podido identificar datos con suficiente seguridad.';
      lastDoneSeq=seq;
    }catch(error){console.warn('Verificación OCR de campos',error);}finally{running=false;}
  }

  new MutationObserver(()=>{setTimeout(refine,40);}).observe(result,{childList:true,subtree:true,characterData:true});
  window.addEventListener('beforeunload',async()=>{try{(await ocrPromise)?.dispose?.();}catch(_){ }});
})();