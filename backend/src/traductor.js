// Traductor de la IA (tarea 07J)
//
// Toma lo que contestó el proveedor de visión y lo convierte en la respuesta
// del contrato (docs/contrato.md). No llama a la IA ni guarda nada: solo traduce.
// El servidor agrega después `id` y `tiempo_ms`.

const CATEGORIAS = {
  organico: 'Organico',
  inorganico_reciclable: 'Reciclable',
  inorganico_no_reciclable: 'No reciclable',
};

const MENSAJE_NO_CLASIFICABLE = 'Intenta de nuevo';
const UMBRAL_POR_DEFECTO = 0.7;
const LARGO_MAX_ETIQUETA = 60;

// Acepta variantes que la IA podría escribir ("Orgánico", "inorganico reciclable",
// "inorgánico-no-reciclable") y las deja como en el contrato.
function normalizarCategoria(valor) {
  if (typeof valor !== 'string') return null;
  const limpio = valor
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita acentos
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  return Object.hasOwn(CATEGORIAS, limpio) ? limpio : null;
}

// Devuelve un número entre 0 y 1, o null si la IA no dio uno fiable.
function normalizarConfianza(valor) {
  const n = typeof valor === 'string' ? Number(valor) : valor;
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) return null;
  if (n <= 1) return n;
  if (n <= 100) return n / 100; // la IA contestó en porcentaje (87 → 0.87)
  return null;
}

function normalizarEtiqueta(valor) {
  if (typeof valor !== 'string') return null;
  const limpio = valor.trim().replace(/\s+/g, ' ');
  return limpio ? limpio.slice(0, LARGO_MAX_ETIQUETA) : null;
}

// La respuesta puede llegar como texto JSON o ya como objeto.
// Algunos modelos envuelven el JSON en ```json ... ```; eso también se acepta.
function leerRespuesta(respuesta) {
  if (respuesta && typeof respuesta === 'object') return respuesta;
  if (typeof respuesta !== 'string') return null;
  const sinBloque = respuesta.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    const datos = JSON.parse(sinBloque);
    return datos && typeof datos === 'object' ? datos : null;
  } catch {
    return null;
  }
}

function noClasificable(etiqueta = null, confianza = null) {
  return {
    ok: false,
    error: { codigo: 'NO_CLASIFICABLE', mensaje: MENSAJE_NO_CLASIFICABLE },
    etiqueta,
    confianza,
  };
}

/**
 * @param {string|object} respuesta  Lo que contestó la IA: { categoria, etiqueta, confianza }
 * @param {{ umbral?: number }} [opciones]
 * @returns respuesta del contrato, sin `id` ni `tiempo_ms`
 */
function traducir(respuesta, { umbral = UMBRAL_POR_DEFECTO } = {}) {
  const datos = leerRespuesta(respuesta);
  if (!datos) return noClasificable();

  const categoria = normalizarCategoria(datos.categoria);
  const etiqueta = normalizarEtiqueta(datos.etiqueta);
  const confianza = normalizarConfianza(datos.confianza);

  // Regla 1: solo las 3 categorías del contrato. Cualquier otra cosa no se adivina.
  if (!categoria) return noClasificable(etiqueta, confianza);

  // Regla 2: bajo el umbral no se responde categoría.
  // confianza null se acepta (pendiente en docs/contrato.md).
  if (confianza !== null && confianza < umbral) return noClasificable(etiqueta, confianza);

  return { ok: true, categoria, mensaje: CATEGORIAS[categoria], etiqueta, confianza };
}

module.exports = { traducir, normalizarCategoria, normalizarConfianza, CATEGORIAS };
