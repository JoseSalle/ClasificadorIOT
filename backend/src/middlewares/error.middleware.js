const { AppError } = require('../errors');
const { registrar } = require('../modules/classification/classification.model');

// Toda respuesta de error sale con el formato del contrato (incluso las de Express)
// y queda registrada en MongoDB antes de responder, como pide docs/contrato.md.
module.exports = async function errorHandler(err, req, res, next) {
  let e = err;
  if (!(e instanceof AppError)) {
    e = err.type === 'entity.too.large'
      ? new AppError('IMAGEN_GRANDE')
      : new AppError('PROVEEDOR_FALLO', { causa: err.message });
  }
  const { etiqueta = null, confianza = null, tiempo_ms = null } = e.detalle;
  res.locals.log = { codigo: e.codigo, ...e.detalle };
  await registrar({
    _id: req.id, fecha: req.fecha, dispositivo: req.dispositivo ?? null, ok: false,
    categoria: null, etiqueta, confianza, error: e.codigo, tiempo_ms,
  });
  res.status(e.http).json({ ok: false, error: { codigo: e.codigo, mensaje: e.message }, id: req.id });
};
