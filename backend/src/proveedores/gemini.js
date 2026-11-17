// Adaptador de Gemini: manda la foto a la IA y regresa su respuesta tal cual.
// La traducción a las 3 categorías la hace src/traductor.js.
// Usa fetch de Node 22, no necesita instalar nada.

const URL_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODELO_POR_DEFECTO = 'gemini-3.5-flash-lite';

const INSTRUCCION = `Eres el clasificador de un bote de basura inteligente en México.
Mira la foto y clasifica el residuo principal en UNA categoría:
- "organico": restos de comida, cáscaras, hojas, servilletas de papel con comida.
- "inorganico_reciclable": botellas PET, latas, vidrio, cartón y papel limpios, envases rígidos.
- "inorganico_no_reciclable": envolturas de frituras o dulces, unicel, popotes, toallitas, empaques mezclados o sucios.
- "desconocido": si no se ve un residuo, la foto está borrosa o hay varios residuos distintos.
Responde solo con el JSON pedido. "etiqueta" es el nombre corto del objeto en español.
"confianza" es qué tan seguro estás, de 0 a 1.`;

const ESQUEMA = {
  type: 'OBJECT',
  properties: {
    categoria: {
      type: 'STRING',
      enum: ['organico', 'inorganico_reciclable', 'inorganico_no_reciclable', 'desconocido'],
    },
    etiqueta: { type: 'STRING' },
    confianza: { type: 'NUMBER' },
  },
  required: ['categoria', 'etiqueta', 'confianza'],
};

class ErrorProveedor extends Error {
  constructor(codigo, mensaje) {
    super(mensaje);
    this.codigo = codigo; // PROVEEDOR_FALLO o TIEMPO_AGOTADO, como en el contrato
  }
}

/**
 * @param {Buffer} foto  JPEG en binario
 * @param {{ apiKey: string, modelo?: string, timeoutMs?: number }} opciones
 * @returns {Promise<string>} el texto JSON que contestó Gemini
 */
async function clasificarConGemini(foto, { apiKey, modelo = MODELO_POR_DEFECTO, timeoutMs = 8000 }) {
  if (!apiKey) throw new ErrorProveedor('PROVEEDOR_FALLO', 'Falta VISION_API_KEY');

  const cuerpo = {
    contents: [
      {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: foto.toString('base64') } },
          { text: INSTRUCCION },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
      responseSchema: ESQUEMA,
    },
  };

  let respuesta;
  try {
    respuesta = await fetch(`${URL_BASE}/${modelo}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    if (err.name === 'TimeoutError') {
      throw new ErrorProveedor('TIEMPO_AGOTADO', `Gemini tardó más de ${timeoutMs} ms`);
    }
    throw new ErrorProveedor('PROVEEDOR_FALLO', `No se pudo conectar con Gemini: ${err.message}`);
  }

  if (!respuesta.ok) {
    const detalle = await respuesta.text().catch(() => '');
    throw new ErrorProveedor('PROVEEDOR_FALLO', `Gemini respondió ${respuesta.status}: ${detalle.slice(0, 300)}`);
  }

  const datos = await respuesta.json();
  // Si Gemini bloquea la imagen o no contesta nada, se regresa "" y el traductor
  // lo convierte en NO_CLASIFICABLE.
  const partes = datos?.candidates?.[0]?.content?.parts ?? [];
  return partes.map((p) => p.text ?? '').join('');
}

module.exports = { clasificarConGemini, ErrorProveedor, MODELO_POR_DEFECTO };
