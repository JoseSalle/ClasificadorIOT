// Nombres de variables iguales a backend/.env.example.
const env = {
  port: Number(process.env.PORT) || 3000,
  deviceKey: process.env.DEVICE_KEY,
  mongoUri: process.env.MONGODB_URI,
  mongoDb: process.env.MONGODB_DB || undefined, // vacío = la base que venga en la URI
  visionProvider: process.env.VISION_PROVIDER || 'gemini',
  visionApiKey: process.env.VISION_API_KEY,
  visionModel: process.env.VISION_MODEL || undefined, // vacío = el modelo por defecto del adaptador
  timeoutProveedorMs: Number(process.env.TIMEOUT_PROVEEDOR_MS) || 12000,
  umbralConfianza: Number(process.env.UMBRAL_CONFIANZA) || 0.7,
  maxImageBytes: 300 * 1024,
};

if (!env.deviceKey) throw new Error('Falta DEVICE_KEY en backend/.env');
if (env.visionProvider !== 'gemini') throw new Error(`VISION_PROVIDER no soportado: ${env.visionProvider}`);
if (!env.visionApiKey) throw new Error('Falta VISION_API_KEY en backend/.env');

module.exports = env;
