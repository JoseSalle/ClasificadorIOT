// 07J: casos de normalización reproducibles (material del proveedor → categoría del contrato).
const { test } = require('node:test');
const assert = require('node:assert');
const { normalizar, MATERIALES } = require('../src/modules/classification/normalization');

const CASOS = [
  // [residuo de ejemplo, material que debe dar la IA, categoría esperada]
  ['botella PET', 'plastico_rigido', 'inorganico_reciclable'],
  ['lata de aluminio', 'metal', 'inorganico_reciclable'],
  ['caja de carton', 'carton', 'inorganico_reciclable'],
  ['hoja de papel', 'papel', 'inorganico_reciclable'],
  ['frasco de vidrio', 'vidrio', 'inorganico_reciclable'],
  ['cascara de platano', 'organico', 'organico'],
  ['restos de comida', 'organico', 'organico'],
  ['papel higienico usado', 'sanitario', 'inorganico_no_reciclable'],
  ['bolsa de plastico', 'plastico_flexible', 'inorganico_no_reciclable'],
  ['vaso de unicel', 'unicel', 'inorganico_no_reciclable'],
  ['envoltura de frituras', 'multicapa', 'inorganico_no_reciclable'],
  ['taza rota', 'ceramica', 'inorganico_no_reciclable'],
  ['objeto no reconocido', 'otro', null],
  ['foto sin residuo', 'ninguno', null],
  ['respuesta inesperada', 'madera', null],
  ['respuesta vacia', undefined, null],
];

for (const [residuo, material, esperado] of CASOS) {
  test(`${residuo}: ${material} → ${esperado}`, () => assert.equal(normalizar(material), esperado));
}

test('todo material que se le ofrece a la IA tiene regla o se rechaza a propósito', () => {
  const sinCategoria = MATERIALES.filter((m) => normalizar(m) === null);
  assert.deepEqual(sinCategoria, ['otro', 'ninguno']);
});
