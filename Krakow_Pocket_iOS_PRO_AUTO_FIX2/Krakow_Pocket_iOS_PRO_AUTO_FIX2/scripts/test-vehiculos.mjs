import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import * as PDFLib from 'pdf-lib';
import { JSDOM } from 'jsdom';

const appDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const html = fs.readFileSync(path.join(appDir, 'vehiculos.html'), 'utf8');
const dom = new JSDOM(html, {
  url: 'https://pocket.test/vehiculos.html',
  runScripts: 'outside-only',
  pretendToBeVisual: true
});

const { window } = dom;
const blobs = [];
window.PDFLib = PDFLib;
window.confirm = () => true;
window.scrollTo = () => {};
window.Element.prototype.scrollIntoView = () => {};
window.URL.createObjectURL = () => `blob:test-${blobs.length + 1}`;
window.URL.revokeObjectURL = () => {};
window.Blob = class TestBlob {
  constructor(parts = [], options = {}) {
    this.parts = parts;
    this.type = options.type || '';
    blobs.push(this);
  }
};

const context = dom.getInternalVMContext();
const scripts = [...window.document.querySelectorAll('script[src]')]
  .map(node => node.getAttribute('src'))
  .filter(Boolean);

const templateScripts = scripts.filter(src => src.startsWith('./vehiculos-tpl-'));
assert.equal(templateScripts.length, 18, 'vehiculos.html debe cargar las 18 partes de las plantillas');

for (const src of templateScripts) {
  const file = src.replace(/^\.\//, '').split('?')[0];
  const full = path.join(appDir, file);
  assert.ok(fs.existsSync(full), `Falta ${file}`);
  vm.runInContext(fs.readFileSync(full, 'utf8'), context, { filename: file });
}

const templates = window.VEHICLE_DOC_TEMPLATES;
assert.ok(templates, 'No se ha creado VEHICLE_DOC_TEMPLATES');

const expectedPages = {
  mandate: 1,
  contractParticulares: 2,
  contractRehab: 2
};

for (const [key, pages] of Object.entries(expectedPages)) {
  const base64 = templates[key];
  assert.ok(base64 && base64.length > 1000, `Plantilla ${key} vacía o incompleta`);
  const bytes = Buffer.from(base64, 'base64');
  assert.equal(bytes.subarray(0, 5).toString('ascii'), '%PDF-', `${key} no comienza como PDF`);
  const pdf = await PDFLib.PDFDocument.load(bytes);
  assert.equal(pdf.getPageCount(), pages, `${key} tiene un número inesperado de páginas`);
  console.log(`${key}: ${bytes.length} bytes · ${pages} pág.`);
}

const appScript = scripts.find(src => src.startsWith('./vehiculos.js'));
assert.ok(appScript, 'vehiculos.html no carga vehiculos.js');
vm.runInContext(
  fs.readFileSync(path.join(appDir, appScript.replace(/^\.\//, '').split('?')[0]), 'utf8'),
  context,
  { filename: 'vehiculos.js' }
);

const form = window.document.getElementById('vehicleForm');
assert.ok(form, 'No existe el formulario de Transferencia');

const sample = {
  contractModel: 'particulares',
  place: 'Las Palmas de Gran Canaria',
  date: '2026-08-31',
  time: '10:30',
  price: '12500',
  courtCity: 'Las Palmas de Gran Canaria',
  seller_name: 'VENDEDOR PRUEBA',
  seller_dni: '00000000T',
  seller_city: 'Agüimes',
  seller_street: 'Calle Prueba',
  seller_number: '1',
  seller_cp: '35260',
  seller_province: 'Las Palmas',
  buyer_name: 'COMPRADOR PRUEBA',
  buyer_dni: '11111111H',
  buyer_city: 'Agüimes',
  buyer_street: 'Calle Prueba',
  buyer_number: '2',
  buyer_cp: '35260',
  buyer_province: 'Las Palmas',
  brand: 'MARCA',
  model: 'MODELO',
  vin: 'TESTVIN1234567890',
  plate: '0000AAA',
  manager1_name: 'GESTOR PRUEBA',
  manager1_dni: '22222222J',
  manager1_collegeNo: '0000',
  collegeName: 'PRUEBA',
  officeName: 'DESPACHO PRUEBA',
  officeCity: 'Las Palmas de Gran Canaria',
  officeStreet: 'Calle Prueba',
  officeNumber: '3',
  officeCp: '35001',
  subject1: 'TRANSFERENCIA DE VEHÍCULO'
};

for (const [name, value] of Object.entries(sample)) {
  const field = form.elements.namedItem(name);
  assert.ok(field, `Falta el campo ${name}`);
  field.value = value;
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitForSuccess(timeout = 10000) {
  const start = Date.now();
  const status = window.document.getElementById('generateStatus');
  while (Date.now() - start < timeout) {
    if (status.textContent === '4 PDF preparados.') return;
    if (status.textContent.startsWith('No se')) throw new Error(status.textContent);
    if (status.textContent.startsWith('Faltan')) throw new Error(status.textContent);
    await sleep(25);
  }
  throw new Error(`Tiempo agotado. Estado: ${status.textContent}`);
}

async function generateAndCheck(model) {
  blobs.splice(0);
  form.elements.namedItem('contractModel').value = model;
  const status = window.document.getElementById('generateStatus');
  status.textContent = '';
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await waitForSuccess();

  assert.equal(blobs.length, 4, `${model}: deben generarse 4 blobs PDF`);
  assert.equal(window.document.querySelectorAll('#downloads .download-row').length, 4, `${model}: deben aparecer 4 descargas`);

  const counts = [];
  for (const blob of blobs) {
    assert.equal(blob.type, 'application/pdf');
    assert.equal(blob.parts.length, 1);
    const pdf = await PDFLib.PDFDocument.load(blob.parts[0]);
    counts.push(pdf.getPageCount());
  }

  assert.deepEqual(counts.slice(0, 3), [1, 1, 2], `${model}: páginas inesperadas en mandato/mandato/contrato`);
  assert.ok(counts[3] >= 1, `${model}: la ficha del gestor debe tener al menos una página`);
  console.log(`${model}: 4 PDF generados · páginas ${counts.join('/')}`);
}

await generateAndCheck('particulares');
await generateAndCheck('rehabilitacion');

console.log('Transferencia: prueba integral superada.');
