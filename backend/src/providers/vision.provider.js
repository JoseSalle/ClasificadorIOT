const env = require('../config/env');

// Adaptador del proveedor de visión. Contrato interno:
//   classify(jpegBuffer, { signal }) -> { etiqueta, material, confianza }
// material es uno de MATERIALES (normalization.js). Cambiar de proveedor =
// agregar un archivo aquí; la ESP32 y la normalización no se enteran.

const mock = {
  async classify() {
    return { etiqueta: 'botella de plastico', material: 'plastico_rigido', confianza: 0.87 };
  },
};

const providers = {
  mock,
  gemini: require('./gemini.provider'),
};

const vision = providers[env.visionProvider];
if (!vision) throw new Error(`VISION_PROVIDER desconocido: ${env.visionProvider}`);

module.exports = vision;
