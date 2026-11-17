const { AppError } = require('../errors');

// Toda respuesta de error sale con el formato del contrato, incluso las de Express.
module.exports = function errorHandler(err, req, res, next) {
  let e = err;
  if (!(e instanceof AppError)) {
    e = err.type === 'entity.too.large'
      ? new AppError('IMAGEN_GRANDE')
      : new AppError('PROVEEDOR_FALLO', { causa: err.message });
  }
  res.locals.log = { codigo: e.codigo, ...e.detalle };
  res.status(e.http).json({ ok: false, error: { codigo: e.codigo, mensaje: e.message }, id: req.id });
};
