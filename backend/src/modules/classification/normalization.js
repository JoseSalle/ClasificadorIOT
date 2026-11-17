// Normalización a las tres categorías del proyecto.
// El proveedor solo dice QUÉ material ve; la regla de a qué contenedor va vive aquí,
// así cambiar de proveedor no cambia el criterio de clasificación.
// Ajustar con fotos reales en 10J.

const MATERIALES = [
  'organico', 'papel', 'carton', 'plastico_rigido', 'vidrio', 'metal',
  'plastico_flexible', 'unicel', 'multicapa', 'sanitario', 'ceramica',
  'otro', 'ninguno',
];

const CATEGORIA_POR_MATERIAL = {
  organico: 'organico',              // restos de comida, cáscaras, hojas
  papel: 'inorganico_reciclable',    // limpio y seco
  carton: 'inorganico_reciclable',
  plastico_rigido: 'inorganico_reciclable', // botellas PET, envases HDPE
  vidrio: 'inorganico_reciclable',
  metal: 'inorganico_reciclable',    // latas de aluminio, acero
  plastico_flexible: 'inorganico_no_reciclable', // bolsas, envolturas
  unicel: 'inorganico_no_reciclable',
  multicapa: 'inorganico_no_reciclable', // envolturas de frituras, tetrapak
  sanitario: 'inorganico_no_reciclable', // papel higiénico, servilletas sucias, pañales
  ceramica: 'inorganico_no_reciclable',
  // otro, ninguno → sin categoría: no se fuerza (NO_CLASIFICABLE)
};

const MENSAJES = {
  organico: 'Organico',
  inorganico_reciclable: 'Reciclable',
  inorganico_no_reciclable: 'No reciclable',
};

/** material del proveedor → categoria del contrato, o null si no se debe clasificar. */
const normalizar = (material) => CATEGORIA_POR_MATERIAL[material] ?? null;

module.exports = { MATERIALES, MENSAJES, normalizar };
