// 07C/08C: el endpoint cumple docs/contrato.md con el adaptador de Gemini simulado.
process.env.DEVICE_KEY = 'clave-de-prueba';
process.env.VISION_API_KEY = 'clave-falsa';
delete process.env.MONGODB_URI;

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');
const gemini = require('../src/proveedores/gemini');
const db = require('../src/config/database');
const { Classification } = require('../src/modules/classification/classification.model');

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0xff, 0xd9]);
const RESPUESTA_IA = JSON.stringify({ categoria: 'inorganico_reciclable', etiqueta: 'botella de plastico', confianza: 0.87 });
let server, url;

before(() => new Promise((ok) => { server = app.listen(0, () => { url = `http://localhost:${server.address().port}/api/clasificar`; ok(); }); }));
after(() => server.close());

const post = (body, headers = {}) => fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'image/jpeg', 'X-Device-Key': 'clave-de-prueba', ...headers },
  body,
}).then(async (r) => ({ status: r.status, json: await r.json() }));

// Reemplaza la llamada a Gemini solo durante una prueba.
const conIA = (t, fn) => t.mock.method(gemini, 'clasificarConGemini', fn);
const iaFalla = (codigo, mensaje = 'falla') => async () => { throw Object.assign(new Error(mensaje), { codigo }); };

test('200 éxito: campos obligatorios y categoría del traductor', async (t) => {
  conIA(t, async () => RESPUESTA_IA);
  const { status, json } = await post(JPEG);
  assert.equal(status, 200);
  assert.deepEqual(Object.keys(json).sort(), ['categoria', 'confianza', 'etiqueta', 'id', 'mensaje', 'ok', 'tiempo_ms']);
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
  assert.equal((await post(JPEG, { 'Content-Type': 'application/octet-stream' })).status, 400);
});

test('413 IMAGEN_GRANDE por encima de 300 KB', async () => {
  const { status, json } = await post(Buffer.alloc(300 * 1024 + 1, 0xff));
  assert.equal(status, 413);
  assert.equal(json.error.codigo, 'IMAGEN_GRANDE');
});

test('200 NO_CLASIFICABLE bajo el umbral, desconocido o respuesta vacía', async (t) => {
  for (const texto of [
    JSON.stringify({ categoria: 'organico', etiqueta: 'pan', confianza: 0.5 }),
    JSON.stringify({ categoria: 'desconocido', etiqueta: 'mano', confianza: 0.99 }),
    '',
  ]) {
    const mock = conIA(t, async () => texto);
    const { status, json } = await post(JPEG);
    mock.mock.restore();
    assert.equal(status, 200);
    assert.equal(json.ok, false);
    assert.equal(json.error.codigo, 'NO_CLASIFICABLE');
  }
});

test('502 PROVEEDOR_FALLO y 504 TIEMPO_AGOTADO según el adaptador', async (t) => {
  let mock = conIA(t, iaFalla('PROVEEDOR_FALLO'));
  let r = await post(JPEG);
  mock.mock.restore();
  assert.equal(r.status, 502);
  assert.equal(r.json.error.codigo, 'PROVEEDOR_FALLO');
  mock = conIA(t, iaFalla('TIEMPO_AGOTADO'));
  r = await post(JPEG);
  mock.mock.restore();
  assert.equal(r.status, 504);
  assert.equal(r.json.error.codigo, 'TIEMPO_AGOTADO');
});

test('400 IMAGEN_INVALIDA si Gemini no puede leer la imagen', async (t) => {
  conIA(t, iaFalla('PROVEEDOR_FALLO', 'Gemini respondió 400: Unable to process input image'));
  const r = await post(JPEG);
  assert.equal(r.status, 400);
  assert.equal(r.json.error.codigo, 'IMAGEN_INVALIDA');
});

test('cada petición se registra antes de responder con los campos del contrato', async (t) => {
  const guardados = [];
  t.mock.method(db, 'isConnected', () => true);
  t.mock.method(Classification, 'create', async (doc) => { guardados.push(doc); });
  conIA(t, async () => RESPUESTA_IA);

  const ok = await post(JPEG);
  const noAut = await post(JPEG, { 'X-Device-Key': 'otra' });

  assert.equal(guardados.length, 2);
  const campos = ['_id', 'categoria', 'confianza', 'dispositivo', 'error', 'etiqueta', 'fecha', 'ok', 'tiempo_ms'];
  assert.deepEqual(Object.keys(guardados[0]).sort(), campos);
  assert.deepEqual(Object.keys(guardados[1]).sort(), campos);
  assert.equal(guardados[0]._id, ok.json.id);
  assert.equal(guardados[0].categoria, 'inorganico_reciclable');
  assert.equal(guardados[0].error, null);
  assert.equal(guardados[1]._id, noAut.json.id);
  assert.equal(guardados[1].error, 'NO_AUTORIZADO');
  assert.equal(guardados[1].dispositivo, null);
});
