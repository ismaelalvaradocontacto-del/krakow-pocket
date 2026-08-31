import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import * as PDFLib from 'pdf-lib';
import { JSDOM } from 'jsdom';

const appDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const html = fs.readFileSync(path.join(appDir, 'vehiculos.html'), 'utf8');
const dom = new JSDOM(html, { url:'https://pocket.test/vehiculos.html', runScripts:'outside-only', pretendToBeVisual:true });
const { window } = dom;
window.PDFLib = PDFLib;
window.confirm = () => true;
window.scrollTo = () => {};
window.Element.prototype.scrollIntoView = () => {};
const blobs=[];
window.URL.createObjectURL = () => `blob:test-${blobs.length+1}`;
window.URL.revokeObjectURL = () => {};
window.Blob = class TestBlob { constructor(parts=[], options={}) { this.parts=parts; this.type=options.type||''; blobs.push(this); } };

const context = dom.getInternalVMContext();
const scripts=[...window.document.querySelectorAll('script[src]')].map(n=>n.getAttribute('src')).filter(Boolean);
const templateScripts=scripts.filter(src=>src.startsWith('./vehiculos-tpl-'));
console.log(`fragmentos cargados: ${templateScripts.length}`);
for (const src of templateScripts) {
  const file=src.replace(/^\.\//,'').split('?')[0];
  const source=fs.readFileSync(path.join(appDir,file),'utf8');
  const match=source.match(/\+\"([^\"]*)\";\s*$/) || source.match(/\+\=\"([^\"]*)\";\s*$/);
  const chunk=match?.[1]||'';
  const hash=crypto.createHash('sha256').update(chunk,'ascii').digest('hex');
  console.log(`TEMPLATE_CHUNK ${file} len=${chunk.length} sha256=${hash} first=${chunk.slice(0,32)} last=${chunk.slice(-32)}`);
  vm.runInContext(source,context,{filename:file});
}
const templates=window.VEHICLE_DOC_TEMPLATES||{};
const expected={mandate:1,contractParticulares:2,contractRehab:2};
let templateFailure=false;
for (const [key,pages] of Object.entries(expected)) {
  const b64=templates[key]||'';
  const bytes=Buffer.from(b64,'base64');
  const sha=crypto.createHash('sha256').update(bytes).digest('hex');
  console.log(`${key}: b64=${b64.length} bytes=${bytes.length} sha256=${sha} inicio=${bytes.subarray(0,5).toString('ascii')}`);
  try {
    const pdf=await PDFLib.PDFDocument.load(bytes);
    console.log(`${key}: OK · ${pdf.getPageCount()} pág.`);
    if(pdf.getPageCount()!==pages) templateFailure=true;
  } catch(err) {
    templateFailure=true;
    console.log(`${key}: ERROR · ${err?.message||err}`);
  }
}
if(templateFailure) process.exit(2);

const appScript=scripts.find(src=>src.startsWith('./vehiculos.js'));
vm.runInContext(fs.readFileSync(path.join(appDir,appScript.replace(/^\.\//,'').split('?')[0]),'utf8'),context,{filename:'vehiculos.js'});
const form=window.document.getElementById('vehicleForm');
const sample={contractModel:'particulares',place:'Las Palmas de Gran Canaria',date:'2026-08-31',time:'10:30',price:'12500',courtCity:'Las Palmas de Gran Canaria',seller_name:'VENDEDOR PRUEBA',seller_dni:'00000000T',seller_city:'Agüimes',seller_street:'Calle Prueba',seller_number:'1',seller_cp:'35260',seller_province:'Las Palmas',buyer_name:'COMPRADOR PRUEBA',buyer_dni:'11111111H',buyer_city:'Agüimes',buyer_street:'Calle Prueba',buyer_number:'2',buyer_cp:'35260',buyer_province:'Las Palmas',brand:'MARCA',model:'MODELO',vin:'TESTVIN1234567890',plate:'0000AAA',manager1_name:'GESTOR PRUEBA',manager1_dni:'22222222J',manager1_collegeNo:'0000',collegeName:'PRUEBA',officeName:'DESPACHO PRUEBA',officeCity:'Las Palmas de Gran Canaria',officeStreet:'Calle Prueba',officeNumber:'3',officeCp:'35001',subject1:'TRANSFERENCIA DE VEHÍCULO'};
for(const [name,value] of Object.entries(sample)){const field=form.elements.namedItem(name); if(!field) throw new Error(`Falta ${name}`); field.value=value;}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function run(model){
  blobs.splice(0); form.elements.namedItem('contractModel').value=model;
  const status=window.document.getElementById('generateStatus'); status.textContent='';
  form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));
  const start=Date.now();
  while(Date.now()-start<10000 && status.textContent!=='4 PDF preparados.'){if(status.textContent.startsWith('No se')||status.textContent.startsWith('Faltan')) throw new Error(status.textContent); await sleep(25);}
  if(status.textContent!=='4 PDF preparados.') throw new Error(`Estado: ${status.textContent}`);
  if(blobs.length!==4) throw new Error(`${model}: ${blobs.length} PDF`);
  const counts=[]; for(const blob of blobs){const pdf=await PDFLib.PDFDocument.load(blob.parts[0]);counts.push(pdf.getPageCount());}
  console.log(`${model}: 4 PDF · páginas ${counts.join('/')}`);
}
await run('particulares');
await run('rehabilitacion');
console.log('Transferencia: prueba integral superada.');