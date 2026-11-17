// Pruebas del adaptador de Gemini con respuestas simuladas (no llama a la IA).
// Correr desde backend/:  npm test

const test = require('node:test');
const assert = require('node:assert/strict');
const { clasificarConGemini } = require('../src/proveedores/gemini');

const FOTO = Buffer.from([0xff, 0xd8, 0xff]);
const OK = { categoria: 'organico', etiqueta: 'pan', confianza: 0.9 };

function respuestaOk() {
  return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(OK) }] } }] }) };
}
function respuestaError(status) {
  return { ok: false, status, text: async () => `error ${status}` };
}
// Cambia fetch por una lista de respuestas y cuenta las llamadas.
function simularFetch(t, ...respuestas) {
  let llamadas = 0;
  t.mock.method(globalThis, 'fetch', async (_url, { signal }) => {
    const r = respuestas[Math.min(llamadas++, respuestas.length - 1)];
    if (r === 'lento') {
      return new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason)));
    }
    return r;
  });
  return () => llamadas;
}

test('respuesta normal', async (t) => {
  const llamadas = simularFetch(t, respuestaOk());
  assert.deepEqual(JSON.parse(await clasificarConGemini(FOTO, { apiKey: 'x' })), OK);
  assert.equal(llamadas(), 1);
});

test('503 (saturado) se reintenta una vez', async (t) => {
  const llamadas = simularFetch(t, respuestaError(503), respuestaOk());
  assert.deepEqual(JSON.parse(await clasificarConGemini(FOTO, { apiKey: 'x' })), OK);
  assert.equal(llamadas(), 2);
});

test('503 dos veces → PROVEEDOR_FALLO', async (t) => {
  const llamadas = simularFetch(t, respuestaError(503), respuestaError(503));
  await assert.rejects(clasificarConGemini(FOTO, { apiKey: 'x' }), { codigo: 'PROVEEDOR_FALLO' });
  assert.equal(llamadas(), 2);
});

test('400 (petición mala) no se reintenta', async (t) => {
  const llamadas = simularFetch(t, respuestaError(400), respuestaOk());
  await assert.rejects(clasificarConGemini(FOTO, { apiKey: 'x' }), { codigo: 'PROVEEDOR_FALLO' });
  assert.equal(llamadas(), 1);
});

test('si tarda más del límite → TIEMPO_AGOTADO', async (t) => {
  simularFetch(t, 'lento');
  // El temporizador de AbortSignal.timeout no mantiene vivo el proceso; este sí.
  const vivo = setTimeout(() => {}, 2000);
  await assert.rejects(clasificarConGemini(FOTO, { apiKey: 'x', timeoutMs: 200 }), { codigo: 'TIEMPO_AGOTADO' });
  clearTimeout(vivo);
});

test('sin clave → PROVEEDOR_FALLO sin llamar a Gemini', async (t) => {
  const llamadas = simularFetch(t, respuestaOk());
  await assert.rejects(clasificarConGemini(FOTO, { apiKey: '' }), { codigo: 'PROVEEDOR_FALLO' });
  assert.equal(llamadas(), 0);
});
