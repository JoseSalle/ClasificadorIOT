// 07C/08C: el endpoint cumple docs/contrato.md (proveedor simulado).
process.env.DEVICE_KEY = 'clave-de-prueba';
process.env.VISION_PROVIDER = 'mock';
process.env.PROVIDER_TIMEOUT_MS = '200';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const app = require('../src/app');
const vision = require('../src/providers/vision.provider');

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0xff, 0xd9]);
const original = vision.classify;
let server, url;

before(() => new Promise((ok) => { server = app.listen(0, () => { url = `http://localhost:${server.address().port}/api/clasificar`; ok(); }); }));
after(() => server.close());

const post = (body, headers = {}) => fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'image/jpeg', 'X-Device-Key': 'clave-de-prueba', ...headers },
  body,
}).then(async (r) => ({ status: r.status, json: await r.json() }));

const conProveedor = async (fn, cuerpo) => {
  vision.classify = fn;
  try { return await cuerpo(); } finally { vision.classify = original; }
};

test('200 éxito: campos obligatorios y categoría normalizada', async () => {
  const { status, json } = await post(JPEG);
  assert.equal(status, 200);
  assert.deepEqual(Object.keys(json).sort(), ['categoria', 'confianza', 'etiqueta', 'id', 'mensaje', 'ok', 'tiempo_ms']);
  assert.equal(json.ok, true);
  assert.equal(json.categoria, 'inorganico_reciclable');
  assert.equal(json.mensaje, 'Reciclable');
  assert.match(json.id, /^c-/);
  assert.equal(typeof json.tiempo_ms, 'number');
});

test('401 NO_AUTORIZADO sin clave o con clave incorrecta', async () => {
  for (const key of ['', 'otra']) {
    const { status, json } = await post(JPEG, { 'X-Device-Key': key });
    assert.equal(status, 401);
    assert.equal(json.error.codigo, 'NO_AUTORIZADO');
    assert.ok(json.id);
  }
});

test('400 IMAGEN_INVALIDA si no es JPEG o el Content-Type es otro', async () => {
  assert.equal((await post(Buffer.from('hola'))).json.error.codigo, 'IMAGEN_INVALIDA');
  const r = await post(JPEG, { 'Content-Type': 'application/octet-stream' });
  assert.equal(r.status, 400);
});

test('413 IMAGEN_GRANDE por encima de 300 KB', async () => {
  const { status, json } = await post(Buffer.alloc(300 * 1024 + 1, 0xff));
  assert.equal(status, 413);
  assert.equal(json.error.codigo, 'IMAGEN_GRANDE');
});

test('200 NO_CLASIFICABLE bajo el umbral, sin residuo o material desconocido', async () => {
  for (const r of [
    { material: 'organico', confianza: 0.5 },
    { material: 'ninguno', confianza: 0.99 },
    { material: 'madera', confianza: 0.99 },
  ]) {
    const { status, json } = await conProveedor(async () => r, () => post(JPEG));
    assert.equal(status, 200);
    assert.equal(json.ok, false);
    assert.equal(json.error.codigo, 'NO_CLASIFICABLE');
  }
});

test('502 PROVEEDOR_FALLO y 504 TIEMPO_AGOTADO', async () => {
  let r = await conProveedor(async () => { throw new Error('boom'); }, () => post(JPEG));
  assert.equal(r.status, 502);
  assert.equal(r.json.error.codigo, 'PROVEEDOR_FALLO');
  r = await conProveedor(() => new Promise(() => {}), () => post(JPEG));
  assert.equal(r.status, 504);
  assert.equal(r.json.error.codigo, 'TIEMPO_AGOTADO');
});

test('400 IMAGEN_INVALIDA si el proveedor no puede leer la imagen', async () => {
  const r = await conProveedor(async () => { throw Object.assign(new Error('ilegible'), { imagenInvalida: true }); }, () => post(JPEG));
  assert.equal(r.status, 400);
  assert.equal(r.json.error.codigo, 'IMAGEN_INVALIDA');
});
