const { timingSafeEqual } = require('node:crypto');
const env = require('../config/env');
const { AppError } = require('../errors');

const expected = Buffer.from(env.deviceKey);

module.exports = function deviceAuth(req, res, next) {
  const key = Buffer.from(req.get('X-Device-Key') || '');
  // Comparación en tiempo constante para no filtrar la clave por tiempos de respuesta.
  if (key.length !== expected.length || !timingSafeEqual(key, expected)) {
    return next(new AppError('NO_AUTORIZADO'));
  }
  next();
};
