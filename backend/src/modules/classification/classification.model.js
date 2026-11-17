const mongoose = require('mongoose');
const { isConnected } = require('../../config/database');

// Colección classifications (documento maestro, sección 8.1). Solo metadatos, no fotos.
const Classification = mongoose.model('Classification', new mongoose.Schema({
  _id: String,                                   // mismo id que recibe la placa
  resultado: { type: String, enum: ['success', 'error'], required: true },
  categoria: { type: String, enum: ['organico', 'inorganico_reciclable', 'inorganico_no_reciclable'] },
  mensaje: String,
  etiqueta: String,
  material: String,
  confianza: Number,
  tiempo_ms: Number,
  error_codigo: String,
}, { timestamps: { createdAt: 'created_at', updatedAt: false }, versionKey: false }), 'classifications');

// El historial nunca debe retrasar ni tumbar la respuesta a la placa.
async function registrar(doc) {
  if (!isConnected()) return;
  try { await Classification.create(doc); } catch (err) { console.error('[db]', err.message); }
}

module.exports = { Classification, registrar };
