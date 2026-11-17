// Pruebas del traductor sin llamar a la IA.
// Correr desde backend/:  node --test test/

const test = require('node:test');
const assert = require('node:assert/strict');
const { traducir } = require('../src/traductor');

test('respuesta válida con confianza alta', () => {
  const r = traducir('{"categoria":"inorganico_reciclable","etiqueta":"botella de plastico","confianza":0.87}');
  assert.deepEqual(r, {
    ok: true,
    categoria: 'inorganico_reciclable',
    mensaje: 'Reciclable',
    etiqueta: 'botella de plastico',
    confianza: 0.87,
  });
});

test('acepta objeto, acentos y espacios en la categoría', () => {
  const r = traducir({ categoria: 'Orgánico', etiqueta: ' cáscara  de plátano ', confianza: 0.9 });
  assert.equal(r.ok, true);
  assert.equal(r.categoria, 'organico');
  assert.equal(r.mensaje, 'Organico');
  assert.equal(r.etiqueta, 'cáscara de plátano');
});

test('acepta "inorgánico no reciclable" escrito con espacios', () => {
  const r = traducir({ categoria: 'inorgánico no reciclable', etiqueta: 'envoltura', confianza: 0.8 });
  assert.equal(r.categoria, 'inorganico_no_reciclable');
});

test('confianza bajo el umbral → NO_CLASIFICABLE', () => {
  const r = traducir({ categoria: 'organico', etiqueta: 'hoja', confianza: 0.69 });
  assert.equal(r.ok, false);
  assert.equal(r.error.codigo, 'NO_CLASIFICABLE');
  assert.equal(r.etiqueta, 'hoja'); // se conserva para el registro en MongoDB
  assert.equal(r.confianza, 0.69);
});

test('confianza justo en el umbral se acepta', () => {
  assert.equal(traducir({ categoria: 'organico', confianza: 0.7 }).ok, true);
});

test('umbral configurable', () => {
  assert.equal(traducir({ categoria: 'organico', confianza: 0.8 }, { umbral: 0.85 }).ok, false);
});

test('confianza en porcentaje se convierte', () => {
  assert.equal(traducir({ categoria: 'organico', confianza: 87 }).confianza, 0.87);
});

test('sin confianza se acepta con null', () => {
  const r = traducir({ categoria: 'organico', etiqueta: 'manzana' });
  assert.equal(r.ok, true);
  assert.equal(r.confianza, null);
});

test('categoría "desconocido" o inventada → NO_CLASIFICABLE', () => {
  assert.equal(traducir({ categoria: 'desconocido', confianza: 0.95 }).ok, false);
  assert.equal(traducir({ categoria: 'peligroso', confianza: 0.95 }).ok, false);
});

test('texto que no es JSON, vacío o nulo → NO_CLASIFICABLE', () => {
  for (const entrada of ['es una botella', '', null, undefined, 42]) {
    const r = traducir(entrada);
    assert.equal(r.ok, false);
    assert.equal(r.error.codigo, 'NO_CLASIFICABLE');
  }
});

test('JSON envuelto en ```json se lee', () => {
  const r = traducir('```json\n{"categoria":"organico","etiqueta":"pan","confianza":0.9}\n```');
  assert.equal(r.ok, true);
});
