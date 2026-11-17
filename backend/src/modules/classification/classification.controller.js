const { clasificar } = require('./classification.service');
const { isJpeg } = require('./classification.validator');
const { registrar } = require('./classification.model');
const { AppError } = require('../../errors');

async function postClasificar(req, res, next) {
  try {
    if (!isJpeg(req.body)) throw new AppError('IMAGEN_INVALIDA');
    const { material, ...r } = await clasificar(req.body);
    res.locals.log = { categoria: r.categoria, etiqueta: r.etiqueta, material, confianza: r.confianza, tiempo_ms: r.tiempo_ms };
    registrar({ _id: req.id, resultado: 'success', ...r, material }); // sin await: no retrasa la respuesta
    res.json({ ok: true, ...r, id: req.id });
  } catch (err) {
    // 401 y 413 no llegan aquí: no se guarda historial de peticiones sin autenticar.
    if (err instanceof AppError) {
      const { causa, ...detalle } = err.detalle;
      registrar({ _id: req.id, resultado: 'error', error_codigo: err.codigo, ...detalle });
    }
    next(err);
  }
}

module.exports = { postClasificar };
