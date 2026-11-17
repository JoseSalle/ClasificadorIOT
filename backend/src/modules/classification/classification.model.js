const mongoose = require('mongoose');
const db = require('../../config/database');

// Registro de cada petición, con los campos de docs/contrato.md ("Registro en MongoDB"). Sin la foto.
const Classification = mongoose.model('Classification', new mongoose.Schema({
  _id: String,          // mismo valor que `id` en la respuesta
  fecha: Date,
  dispositivo: String,
  ok: Boolean,
  categoria: String,
  etiqueta: String,
  confianza: Number,
  error: String,        // código de error del contrato, o null
  tiempo_ms: Number,
}, { versionKey: false }), 'classifications');

// Se espera antes de responder (el id de la respuesta es el del registro), pero un
// fallo de la base nunca tumba la respuesta a la placa.
async function registrar(doc) {
  if (!db.isConnected()) return;
  try { await Classification.create(doc); } catch (err) { console.error('[db]', err.message); }
}

module.exports = { Classification, registrar };
