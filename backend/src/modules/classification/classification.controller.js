const { clasificar } = require('./classification.service');
const { isJpeg } = require('./classification.validator');
const { registrar } = require('./classification.model');
const { AppError } = require('../../errors');

async function postClasificar(req, res, next) {
  try {
    if (!isJpeg(req.body)) throw new AppError('IMAGEN_INVALIDA');
    const r = await clasificar(req.body);
    res.locals.log = { categoria: r.categoria, etiqueta: r.etiqueta, confianza: r.confianza, tiempo_ms: r.tiempo_ms };
    await registrar({
      _id: req.id, fecha: req.fecha, dispositivo: req.dispositivo, ok: true,
      categoria: r.categoria, etiqueta: r.etiqueta, confianza: r.confianza, error: null, tiempo_ms: r.tiempo_ms,
    });
    res.json({ ok: true, ...r, id: req.id });
  } catch (err) {
    next(err); // los errores se registran y responden en error.middleware.js
  }
}

module.exports = { postClasificar };
