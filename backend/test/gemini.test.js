// 07J/08C: el adaptador de Gemini con fetch simulado (no llama a la API real).
process.env.DEVICE_KEY = 'clave-de-prueba';
process.env.GEMINI_API_KEY = 'clave-falsa';

const { test, afterEach } = require('node:test');
const assert = require('node:assert');
const gemini = require('../src/providers/gemini.provider');

const realFetch = global.fetch;
afterEach(() => { global.fetch = realFetch; });
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);

const respuesta = (status, body) => async () => new Response(JSON.stringify(body), { status });

test('envía la imagen en base64 con la clave en el header y lee el JSON', async () => {
  let enviado;
  global.fetch = async (url, opts) => {
    enviado = { url, opts };
    return respuesta(200, { candidates: [{ content: { parts: [{ text: '{"etiqueta":"lata","material":"metal","confianza":0.9}' }] } }] })();
  };
  const r = await gemini.classify(JPEG);
  assert.deepEqual(r, { etiqueta: 'lata', material: 'metal', confianza: 0.9 });
  assert.match(enviado.url, /:generateContent$/);
  assert.equal(enviado.opts.headers['x-goog-api-key'], 'clave-falsa');
  assert.equal(JSON.parse(enviado.opts.body).contents[0].parts[0].inline_data.data, JPEG.toString('base64'));
});

test('error HTTP de la API (clave inválida, cuota) → lanza error', async () => {
  global.fetch = respuesta(400, { error: { code: 400, status: 'INVALID_ARGUMENT', message: 'API key not valid' } });
  await assert.rejects(gemini.classify(JPEG), /Gemini HTTP 400/);
});

test('imagen que Gemini no puede leer → error marcado como imagen inválida', async () => {
  global.fetch = respuesta(400, { error: { code: 400, message: 'Unable to process input image. Please retry', status: 'INVALID_ARGUMENT' } });
  await assert.rejects(gemini.classify(JPEG), (err) => err.imagenInvalida === true);
});

test('respuesta sin candidatos o con JSON roto → lanza error', async () => {
  global.fetch = respuesta(200, { candidates: [{ finishReason: 'SAFETY' }] });
  await assert.rejects(gemini.classify(JPEG), /sin contenido/);
  global.fetch = respuesta(200, { candidates: [{ content: { parts: [{ text: '{roto' }] } }] });
  await assert.rejects(gemini.classify(JPEG), SyntaxError);
});
