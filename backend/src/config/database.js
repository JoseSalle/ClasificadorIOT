const mongoose = require('mongoose');
const env = require('./env');

async function connectDatabase() {
  if (!env.mongoUri) {
    console.warn('[db] MONGODB_URI vacío: el backend funciona pero no guarda historial');
    return;
  }
  try {
    await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 5000 });
    console.log('[db] conectado a MongoDB');
  } catch (err) {
    // Sin base de datos la placa sigue recibiendo su clasificación; solo se pierde el historial.
    console.error('[db] no se pudo conectar:', err.message);
  }
}

const isConnected = () => mongoose.connection.readyState === 1;

module.exports = { connectDatabase, isConnected };
