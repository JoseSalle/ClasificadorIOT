const env = {
  port: Number(process.env.PORT) || 3000,
  deviceKey: process.env.DEVICE_KEY,
  mongoUri: process.env.MONGODB_URI,
  visionProvider: process.env.VISION_PROVIDER || 'mock',
  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiModel: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
  providerTimeoutMs: Number(process.env.PROVIDER_TIMEOUT_MS) || 8000,
  umbralConfianza: Number(process.env.UMBRAL_CONFIANZA) || 0.7,
  maxImageBytes: 300 * 1024,
};

if (!env.deviceKey) throw new Error('Falta DEVICE_KEY en backend/.env');
if (env.visionProvider === 'gemini' && !env.geminiApiKey) {
  throw new Error('VISION_PROVIDER=gemini requiere GEMINI_API_KEY en backend/.env');
}

module.exports = env;
