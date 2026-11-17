// Prueba del traductor con fotos reales (tarea 10J).
//
// Pon las fotos en carpetas con el nombre de la categoría esperada:
//   test/fotos/organico/platano.jpg
//   test/fotos/inorganico_reciclable/botella.jpg
//   test/fotos/inorganico_no_reciclable/frituras.jpg
//
// Correr desde backend/:  npm run probar-fotos
// Resultado: tabla en la terminal y test/resultados-10J.csv

const fs = require('node:fs');
const path = require('node:path');
const { traducir, CATEGORIAS } = require('../src/traductor');
const { clasificarConGemini } = require('../src/proveedores/gemini');

const carpeta = path.resolve(process.argv[2] ?? path.join(__dirname, 'fotos'));
const salida = path.join(__dirname, 'resultados-10J.csv');
const MAX_BYTES = 300 * 1024;

const opciones = {
  apiKey: process.env.VISION_API_KEY,
  modelo: process.env.VISION_MODEL || undefined,
  timeoutMs: Number(process.env.TIMEOUT_PROVEEDOR_MS) || 8000,
};
const umbral = Number(process.env.UMBRAL_CONFIANZA) || 0.7;

function listarFotos() {
  const fotos = [];
  for (const esperada of Object.keys(CATEGORIAS)) {
    const dir = path.join(carpeta, esperada);
    if (!fs.existsSync(dir)) continue;
    for (const archivo of fs.readdirSync(dir).sort()) {
      if (/\.jpe?g$/i.test(archivo)) fotos.push({ esperada, archivo, ruta: path.join(dir, archivo) });
    }
  }
  return fotos;
}

const csv = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (!opciones.apiKey) {
    console.error('Falta VISION_API_KEY en backend/.env');
    process.exit(1);
  }
  const fotos = listarFotos();
  if (fotos.length === 0) {
    console.error(`No hay fotos en ${carpeta}/<categoria>/. Revisa los nombres de las carpetas.`);
    process.exit(1);
  }

  const filas = [];
  for (const { esperada, archivo, ruta } of fotos) {
    const foto = fs.readFileSync(ruta);
    const inicio = Date.now();
    let resultado;
    try {
      const crudo = await clasificarConGemini(foto, opciones);
      resultado = traducir(crudo, { umbral });
    } catch (err) {
      resultado = { ok: false, error: { codigo: err.codigo ?? 'PROVEEDOR_FALLO', mensaje: err.message } };
    }
    const tiempo = Date.now() - inicio;
    const obtenida = resultado.ok ? resultado.categoria : resultado.error.codigo;
    const fila = {
      archivo: `${esperada}/${archivo}`,
      kb: Math.round(foto.length / 1024),
      esperada,
      obtenida,
      etiqueta: resultado.etiqueta ?? '',
      confianza: resultado.confianza ?? '',
      tiempo_ms: tiempo,
      acierto: obtenida === esperada ? 'si' : 'no',
      nota: foto.length > MAX_BYTES ? 'pasa de 300 KB' : resultado.ok ? '' : resultado.error.mensaje,
    };
    filas.push(fila);
    console.log(`${fila.acierto === 'si' ? 'OK ' : 'MAL'} ${fila.archivo} → ${obtenida} (${fila.etiqueta}, ${fila.confianza}, ${tiempo} ms)`);
    await esperar(1000); // para no pasar el límite por minuto de la capa gratuita
  }

  const columnas = Object.keys(filas[0]);
  const texto = [columnas.join(','), ...filas.map((f) => columnas.map((c) => csv(f[c])).join(','))].join('\n');
  fs.writeFileSync(salida, texto + '\n');

  const aciertos = filas.filter((f) => f.acierto === 'si').length;
  const promedio = Math.round(filas.reduce((s, f) => s + f.tiempo_ms, 0) / filas.length);
  console.log(`\nAciertos: ${aciertos}/${filas.length} · Tiempo promedio: ${promedio} ms`);
  console.log(`Guardado en ${path.relative(process.cwd(), salida)}`);
}

main();
