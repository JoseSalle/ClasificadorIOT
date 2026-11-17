const env = require('../config/env');
const { MATERIALES } = require('../modules/classification/normalization');

const URL_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const PROMPT = `Eres el clasificador de un bote de basura inteligente. Analiza la foto e identifica
el residuo principal que se esta mostrando a la camara. Responde solo con el JSON pedido:
- etiqueta: nombre corto del objeto en espanol, minusculas y sin acentos (ej. "botella de plastico").
- material: el material que decide a que contenedor va. Usa "sanitario" para papel o servilletas
  sucias o usadas, "multicapa" para envolturas metalizadas o tetrapak, "ninguno" si no hay un
  residuo claro en la foto y "otro" si hay un residuo pero no encaja en ninguna opcion.
- confianza: numero de 0 a 1 que indica que tan seguro estas del material.`;

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    etiqueta: { type: 'STRING' },
    material: { type: 'STRING', enum: MATERIALES },
    confianza: { type: 'NUMBER' },
  },
  required: ['etiqueta', 'material', 'confianza'],
};

/** classify(jpeg, { signal }) -> { etiqueta, material, confianza } */
async function classify(jpeg, { signal } = {}) {
  const res = await fetch(`${URL_BASE}/${env.geminiModel}:generateContent`, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.geminiApiKey },
    body: JSON.stringify({
      contents: [{ parts: [
        { inline_data: { mime_type: 'image/jpeg', data: jpeg.toString('base64') } },
        { text: PROMPT },
      ] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0 },
    }),
  });

  if (!res.ok) {
    const cuerpo = await res.text().catch(() => '');
    const err = new Error(`Gemini HTTP ${res.status}: ${cuerpo.slice(0, 300)}`);
    // JPEG con cabecera válida pero contenido corrupto: es culpa de la imagen, no del proveedor.
    if (res.status === 400 && cuerpo.includes('Unable to process input image')) err.imagenInvalida = true;
    throw err;
  }
  const data = await res.json();
  const texto = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('');
  if (!texto) throw new Error(`Gemini sin contenido (finishReason: ${data.candidates?.[0]?.finishReason ?? 'n/a'})`);
  return JSON.parse(texto); // JSON inválido → error → PROVEEDOR_FALLO
}

module.exports = { classify };
