const env = require('../../config/env');
const vision = require('../../providers/vision.provider');
const { normalizar, MENSAJES } = require('./normalization');
const { AppError } = require('../../errors');

async function clasificar(jpeg) {
  const t0 = performance.now();
  const signal = AbortSignal.timeout(env.providerTimeoutMs);
  let r;
  try {
    // El race garantiza el límite de 8 s aunque el proveedor ignore el signal.
    r = await Promise.race([
      vision.classify(jpeg, { signal }),
      new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason))),
    ]);
  } catch (err) {
    if (err?.name === 'TimeoutError') throw new AppError('TIEMPO_AGOTADO');
    if (err?.imagenInvalida) throw new AppError('IMAGEN_INVALIDA', { causa: err.message });
    throw new AppError('PROVEEDOR_FALLO', { causa: err?.message });
  }
  const tiempo_ms = Math.round(performance.now() - t0);

  const categoria = normalizar(r?.material);
  const confianza = typeof r?.confianza === 'number' ? r.confianza : null;
  // shortcut: confianza null se acepta (pendiente en docs/contrato.md).
  if (!categoria || (confianza !== null && confianza < env.umbralConfianza)) {
    throw new AppError('NO_CLASIFICABLE', { etiqueta: r?.etiqueta, material: r?.material, confianza, tiempo_ms });
  }
  return { categoria, mensaje: MENSAJES[categoria], etiqueta: r.etiqueta ?? null, confianza, tiempo_ms, material: r.material };
}

module.exports = { clasificar };
