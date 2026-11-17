// 08C: une el adaptador de Gemini (src/proveedores/gemini.js) con el traductor (src/traductor.js).
const env = require('../../config/env');
const gemini = require('../../proveedores/gemini');
const { traducir } = require('../../traductor');
const { AppError } = require('../../errors');

async function clasificar(jpeg) {
  const t0 = performance.now();
  const ms = () => Math.round(performance.now() - t0);
  let texto;
  try {
    // El adaptador ya respeta el límite de 12 s, incluidos sus reintentos.
    texto = await gemini.clasificarConGemini(jpeg, {
      apiKey: env.visionApiKey,
      modelo: env.visionModel,
      timeoutMs: env.timeoutProveedorMs,
    });
  } catch (err) {
    const detalle = { causa: err.message, tiempo_ms: ms() };
    // JPEG con cabecera válida pero contenido corrupto: es la imagen, no el proveedor.
    if (err.message?.includes('Unable to process input image')) throw new AppError('IMAGEN_INVALIDA', detalle);
    throw new AppError(err.codigo === 'TIEMPO_AGOTADO' ? 'TIEMPO_AGOTADO' : 'PROVEEDOR_FALLO', detalle);
  }

  const r = traducir(texto, { umbral: env.umbralConfianza });
  const tiempo_ms = ms();
  if (!r.ok) throw new AppError('NO_CLASIFICABLE', { etiqueta: r.etiqueta, confianza: r.confianza, tiempo_ms });
  return { categoria: r.categoria, mensaje: r.mensaje, etiqueta: r.etiqueta, confianza: r.confianza, tiempo_ms };
}

module.exports = { clasificar };
