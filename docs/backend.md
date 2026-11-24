# Backend: documentación del código

Servidor Node.js que recibe la foto de la placa, la clasifica con una IA de visión (Gemini) y responde con una de 3 categorías. Guarda un registro de cada petición en MongoDB.

- **Publicado en:** `https://clasificador-iot-backend.onrender.com` (Render, plan gratuito, HTTPS automático)
- **Formato de comunicación:** [`contrato.md`](contrato.md). Si este documento y el contrato no coinciden, manda el contrato.
- **Tecnologías:** Node.js 22, Express 5, Mongoose 8. No hay más dependencias: Gemini se llama con el `fetch` de Node.

## Índice

1. [Estructura](#estructura)
2. [Recorrido de una petición](#recorrido-de-una-petición)
3. [Archivos uno por uno](#archivos-uno-por-uno)
4. [Respuestas y errores](#respuestas-y-errores)
5. [Registro en MongoDB](#registro-en-mongodb)
6. [Configuración](#configuración)
7. [Tiempos](#tiempos)
8. [Seguridad](#seguridad)
9. [Pruebas y scripts](#pruebas-y-scripts)
10. [Correrlo y publicarlo](#correrlo-y-publicarlo)
11. [Operación: logs, salud y servidor dormido](#operación-logs-salud-y-servidor-dormido)
12. [Cómo cambiar cosas comunes](#cómo-cambiar-cosas-comunes)
13. [Límites conocidos](#límites-conocidos)

## Estructura

```
backend/
├── package.json             scripts y dependencias
├── .env.example             variables que hay que llenar (copiar a .env)
├── scripts/
│   └── solicitudes.sh       peticiones de prueba del contrato contra cualquier URL
├── src/
│   ├── server.js            arranque: conecta MongoDB y abre el puerto
│   ├── app.js               Express: id por petición, log, rutas
│   ├── errors.js            los 6 códigos de error del contrato
│   ├── traductor.js         respuesta de la IA → 3 categorías (José, 07J)
│   ├── config/
│   │   ├── env.js           lee y valida las variables de entorno
│   │   └── database.js      conexión a MongoDB
│   ├── middlewares/
│   │   ├── device-auth.middleware.js   revisa X-Device-Key
│   │   └── error.middleware.js         todo error → formato del contrato + registro
│   ├── proveedores/
│   │   └── gemini.js        llamada a Gemini (José, 07J)
│   └── modules/classification/
│       ├── classification.routes.js      POST /api/clasificar
│       ├── classification.controller.js  coordina la petición
│       ├── classification.service.js     Gemini + traductor + tiempo
│       ├── classification.validator.js   ¿es un JPEG?
│       └── classification.model.js       registro en MongoDB
└── test/
    ├── clasificar.test.js   el endpoint cumple el contrato (IA simulada)
    ├── traductor.test.js    reglas del traductor
    ├── gemini.test.js       adaptador de Gemini (fetch simulado)
    ├── probar-fotos.js      12 fotos reales contra Gemini (10J)
    └── fotos/               fotos RealWaste por categoría (CC BY-NC-SA)
```

## Recorrido de una petición

```
ESP32 ──HTTPS──► Render ──► app.js            id c-xxxxxxxx + fecha
                              │
                              ▼
                   device-auth.middleware     ¿X-Device-Key correcta?        no → 401
                              │
                              ▼
                   express.raw (300 KB)       ¿cabe en 300 KB?              no → 413
                              │
                              ▼
                   controller → isJpeg        ¿FF D8 FF … FF D9?            no → 400
                              │
                              ▼
                   service → gemini.js        foto a Gemini (≤ 12 s)
                              │                 imagen ilegible           → 400
                              │                 Gemini falla              → 502
                              │                 Gemini tarda              → 504
                              ▼
                   traductor.js               ¿categoría válida y
                              │                confianza ≥ 0.70?          no → 200 NO_CLASIFICABLE
                              ▼
                   registrar() en MongoDB     se guarda ANTES de responder
                              │
                              ▼
                   200 { ok:true, categoria, mensaje, etiqueta, confianza, id, tiempo_ms }
```

Cualquier error en cualquier paso salta a `error.middleware.js`. Ese middleware también registra la petición en MongoDB y responde con el formato de error del contrato.

El orden importa. La clave se revisa **antes** de leer el cuerpo, para no recibir 300 KB de alguien sin permiso. El formato se revisa **antes** de llamar a Gemini, para no gastar la API en algo que no es una foto.

## Archivos uno por uno

### `src/server.js`
Llama a `connectDatabase()` y, haya conectado o no, abre el puerto `PORT`. Si MongoDB no está disponible el servidor arranca igual: la placa recibe su clasificación y solo se pierde el registro. El HTTPS no lo maneja Node: Render lo pone por delante.

### `src/app.js`
Arma la aplicación Express.
- **Middleware inicial:** le da a cada petición `req.id` (`c-` + 8 caracteres de un UUID aleatorio) y `req.fecha`. Por eso hasta un 401 tiene `id`.
- **Log:** al terminar cada petición escribe una línea JSON, excepto para `/health`:
  `{"id":"c-9f71ed7e","ruta":"POST /api/clasificar","http":200,"categoria":"organico",...}`.
  Los datos extra salen de `res.locals.log`, que llenan el controlador y el manejador de errores.
- **Rutas:** `GET /health` → `{"ok":true}` y `/api` → rutas de clasificación.
- `x-powered-by` está apagado para no anunciar que es Express.

### `src/config/env.js`
Lee las variables de entorno con valores por defecto. **Si falta `DEVICE_KEY` o `VISION_API_KEY`, o si `VISION_PROVIDER` no es `gemini`, el servidor no arranca.** Es mejor que falle al encender que en medio de una prueba. `maxImageBytes` (300 KB) es fijo porque lo define el contrato.

### `src/config/database.js`
- `connectDatabase()`: se conecta con `mongoose.connect`. Espera como máximo 5 s a encontrar el servidor; si `MONGODB_DB` está vacío, usa la base que venga en la URI. Si falla, solo escribe el error en el log.
- `isConnected()`: `true` si la conexión está abierta. `registrar()` lo consulta antes de guardar.

### `src/middlewares/device-auth.middleware.js`
Compara `X-Device-Key` con `DEVICE_KEY` usando `crypto.timingSafeEqual`, que tarda lo mismo acierte o no; así nadie puede adivinar la clave midiendo tiempos. Si no coincide, lanza `NO_AUTORIZADO`. Si coincide, marca `req.dispositivo = 'clasificador-001'`: hoy una clave equivale a un dispositivo.

### `src/modules/classification/classification.routes.js`
Define `POST /api/clasificar` con tres pasos en orden: `deviceAuth` → `express.raw({ type: 'image/jpeg', limit: 300 KB })` → `postClasificar`.
- Con `express.raw` el cuerpo llega como `Buffer`, es decir, los bytes tal cual.
- Si el `Content-Type` no es `image/jpeg`, el cuerpo no se lee y el validador lo rechaza.

### `src/modules/classification/classification.validator.js`
`isJpeg(buf)`: `true` si el buffer empieza con `FF D8 FF` y termina con `FF D9`, que son las marcas de inicio y fin de un JPEG. Es una revisión barata que se hace antes de gastar en la IA.

### `src/modules/classification/classification.controller.js`
`postClasificar(req, res, next)`:
1. Si no es JPEG, lanza `IMAGEN_INVALIDA`.
2. Llama a `clasificar(req.body)`.
3. Llena `res.locals.log` para el log.
4. Hace `await registrar({...})` con `ok: true`.
5. Responde `{ ok: true, categoria, mensaje, etiqueta, confianza, tiempo_ms, id }`.

Cualquier excepción va a `next(err)`, es decir, a `error.middleware.js`.

### `src/modules/classification/classification.service.js`
`clasificar(jpeg)` une el proveedor con el traductor y mide el tiempo:
1. Llama a `gemini.clasificarConGemini(jpeg, { apiKey, modelo, timeoutMs })`. Pasa por el objeto del módulo para que las pruebas puedan sustituirlo.
2. Si Gemini falla:
   - mensaje `Unable to process input image` → `IMAGEN_INVALIDA` (tenía cabecera de JPEG pero el contenido estaba roto);
   - `codigo === 'TIEMPO_AGOTADO'` → `TIEMPO_AGOTADO`;
   - cualquier otro → `PROVEEDOR_FALLO`.
3. `traducir(texto, { umbral })`. Si el resultado no es válido, lanza `NO_CLASIFICABLE` con la etiqueta y la confianza, para que queden en el registro.
4. Devuelve `{ categoria, mensaje, etiqueta, confianza, tiempo_ms }`.

`tiempo_ms` cuenta desde que se llama a Gemini hasta que termina la traducción.

### `src/proveedores/gemini.js` (José)
`clasificarConGemini(foto, { apiKey, modelo, timeoutMs })` → `Promise<string>` con el texto JSON que contestó Gemini.
- **API:** `POST https://generativelanguage.googleapis.com/v1beta/models/<modelo>:generateContent`, con la clave en el header `x-goog-api-key`. La foto va en Base64 dentro de `inlineData`.
- **Instrucción fija** (`INSTRUCCION`): describe el bote de basura en México y las 4 categorías posibles (las 3 del contrato más `desconocido`), con ejemplos de cada una.
- **Salida estructurada:** `responseMimeType: application/json` y `responseSchema` obligan a Gemini a contestar exactamente `{categoria, etiqueta, confianza}`. `temperature: 0` hace que la misma foto dé la misma respuesta.
- **Reintentos:** hasta 2 intentos, y solo cuando Gemini responde 503 (saturado) o 429 (límite por minuto). Todos los intentos comparten los 12 s, y no se reintenta si quedan menos de 2 s.
- **Errores:** lanza `ErrorProveedor` con `codigo` `PROVEEDOR_FALLO` o `TIEMPO_AGOTADO`.
- Si Gemini bloquea la imagen o no contesta texto, devuelve `""`, y el traductor lo convierte en `NO_CLASIFICABLE`.

### `src/traductor.js` (José)
`traducir(respuesta, { umbral })` convierte lo que contestó la IA en la respuesta del contrato. No llama a la IA ni guarda nada.
- **Lectura:** acepta texto JSON, un objeto, o JSON envuelto en un bloque de código (```` ```json ````).
- **`normalizarCategoria`:** quita acentos, mayúsculas, espacios y guiones (`"Inorgánico reciclable"` → `inorganico_reciclable`). Cualquier valor fuera de las 3 categorías se rechaza.
- **`normalizarConfianza`:** número entre 0 y 1; convierte porcentajes (`87` → `0.87`); si no es un número válido, `null`.
- **Etiqueta:** recorta espacios y la deja en máximo 60 caracteres.
- **Reglas:**
  1. Solo las 3 categorías del contrato; `desconocido` o algo raro → `NO_CLASIFICABLE`.
  2. Confianza menor al umbral → `NO_CLASIFICABLE`. Una confianza `null` se acepta, tal como dice el contrato.
- **`mensaje`** es el texto para la pantalla: `Organico`, `Reciclable` o `No reciclable`.

### `src/errors.js`
Es el único lugar donde están los códigos del contrato (`CODIGOS`), con su código HTTP y su mensaje. `AppError(codigo, detalle)` crea el error con `.codigo`, `.http` y `.detalle`.

`detalle` (causa, etiqueta, confianza, tiempo) **solo va al log y a MongoDB**, nunca a la placa. Así no se filtran detalles internos.

### `src/middlewares/error.middleware.js`
Recibe todo error:
1. Si no es `AppError`: un cuerpo demasiado grande (`entity.too.large`) → `IMAGEN_GRANDE`; cualquier otro → `PROVEEDOR_FALLO`.
2. Guarda el registro con `ok: false`, `categoria: null` y `error: <codigo>`. Si existen, también guarda la etiqueta, la confianza y el tiempo.
3. Responde `{ ok: false, error: { codigo, mensaje }, id }` con el código HTTP del contrato.

### `src/modules/classification/classification.model.js`
- `Classification`: modelo de Mongoose para la colección `classifications`, con los campos del contrato. Sin `__v`.
- `registrar(doc)`: si MongoDB está conectado, guarda el documento. **Si el guardado falla, solo escribe en el log.** La placa siempre recibe su respuesta.

## Respuestas y errores

| Caso | HTTP | `error.codigo` | `mensaje` (lo que ve la pantalla) |
|---|---|---|---|
| Clasificó | 200 | — | `Organico` / `Reciclable` / `No reciclable` |
| IA insegura, sin residuo o foto borrosa | 200 | `NO_CLASIFICABLE` | `Intenta de nuevo` |
| No es JPEG o Gemini no pudo leerla | 400 | `IMAGEN_INVALIDA` | `Imagen invalida` |
| Falta la clave o es incorrecta | 401 | `NO_AUTORIZADO` | `No autorizado` |
| Más de 300 KB | 413 | `IMAGEN_GRANDE` | `Imagen muy grande` |
| Gemini respondió con error | 502 | `PROVEEDOR_FALLO` | `Servicio no disponible` |
| Gemini tardó más de 12 s | 504 | `TIEMPO_AGOTADO` | `Tiempo agotado` |

`NO_CLASIFICABLE` es 200 porque el sistema funcionó; solo la IA no estaba segura. La placa lo distingue por `ok: false`.

## Registro en MongoDB

Colección `classifications`, un documento por petición (incluidos los errores):

```json
{ "_id": "c-9f71ed7e", "fecha": "2026-11-17T22:31:25.581Z", "dispositivo": "clasificador-001",
  "ok": true, "categoria": "organico", "etiqueta": "rama con hojas",
  "confianza": 0.98, "error": null, "tiempo_ms": 1701 }
```

- `_id` es el mismo `id` que recibe la placa y que sale en el Monitor Serie. Con él se encuentra el registro de cualquier prueba.
- Peticiones sin clave: `dispositivo: null`.
- **La foto no se guarda.**
- La placa nunca consulta la base.
- Hoy la base es `test`, porque `MONGODB_DB` está vacío y la URI no trae nombre de base.

## Configuración

Variables de entorno: en local, `backend/.env` (copia de `.env.example`); en Render, *Environment*.

| Variable | Obligatoria | Por defecto | Para qué |
|---|---|---|---|
| `DEVICE_KEY` | Sí | — | Clave que manda la placa en `X-Device-Key`. Debe ser igual a la de `firmware/include/secrets.h` |
| `VISION_API_KEY` | Sí | — | Clave de la API de Gemini |
| `VISION_PROVIDER` | No | `gemini` | Único proveedor soportado |
| `VISION_MODEL` | No | `gemini-3.5-flash-lite` | Modelo de Gemini |
| `MONGODB_URI` | No | — | Sin ella el servidor funciona, pero no guarda registros |
| `MONGODB_DB` | No | la de la URI | Nombre de la base |
| `TIMEOUT_PROVEEDOR_MS` | No | `12000` | Límite para Gemini |
| `UMBRAL_CONFIANZA` | No | `0.70` | Por debajo, `NO_CLASIFICABLE` |
| `PORT` | No | `3000` | Render lo pone solo |

`.env` está en `.gitignore`: **nunca se sube**.

## Tiempos

| Límite | Valor | Quién lo controla |
|---|---|---|
| Gemini (con reintento) | 12 s | `gemini.js` con `AbortSignal.timeout` |
| Espera máxima de la placa | 18 s | `firmware/src/clasificador_api.cpp` |
| Búsqueda de MongoDB al arrancar | 5 s | `database.js` |

Los 6 s de diferencia entre 12 y 18 cubren la red, el TLS y el guardado. Así el servidor siempre contesta antes de que la placa se rinda.

Medido en Render: entre 1.4 y 7.7 s por foto. Las evidencias están en `pruebas/evidencias/`.

## Seguridad

Son las mitigaciones del Hito 6 que aplican al backend:

- **Cifrado:** HTTPS de Render; la placa valida el certificado con GTS Root R4.
- **Autenticación del dispositivo:** `X-Device-Key` comparada en tiempo constante.
- **Validación de entrada antes de gastar en la IA:** clave → tamaño → tipo → formato JPEG.
- **Secretos fuera del código:** `.env` y `secrets.h` no se suben, y Render guarda las variables aparte.
- **Errores sin detalles internos:** la placa solo recibe el código y un mensaje corto; la causa va al log.
- **Sin datos personales:** no se guarda la foto.

## Pruebas y scripts

| Comando (desde `backend/`) | Qué hace | Necesita |
|---|---|---|
| `npm test` | 25 pruebas: contrato del endpoint con la IA simulada, traductor y adaptador de Gemini | Nada (ni internet ni claves) |
| `npm run probar-fotos` | Manda las fotos de `test/fotos/<categoria>/` a Gemini real y escribe `test/resultados-10J-<modelo>.csv` (ignorado por git) | `.env` con `VISION_API_KEY` |
| `bash scripts/solicitudes.sh foto.jpg …` | Prueba en vivo los casos del contrato (`/health`, 401, 400, 413, JPEG corrupto) y las fotos que se le pasen | `BASE_URL` y `DEVICE_KEY` |

En `clasificar.test.js`, `t.mock.method` reemplaza `gemini.clasificarConGemini` solo durante cada prueba, y también simula MongoDB para comprobar que cada petición se registra con los campos del contrato.

## Correrlo y publicarlo

**En local**, solo para cambiar código o probar:

```bash
cd backend
cp .env.example .env      # llenar DEVICE_KEY, VISION_API_KEY y MONGODB_URI
npm install
npm run dev               # http://localhost:3000, se reinicia al guardar
```

**En Render.** No hace falta levantarlo a mano:
- `render.yaml` (en la raíz) define el servicio: plan gratuito, Oregon, carpeta `backend`, `npm ci --omit=dev`, `npm start`, health check en `/health`.
- Render lee la rama `main`: cada push a `main` vuelve a publicar.
- Las claves se capturan en *Environment* del servicio.
- MongoDB Atlas debe permitir `0.0.0.0/0` en *Network Access*, porque Render no tiene una IP fija.

## Operación: logs, salud y servidor dormido

- **¿Está vivo?** `https://clasificador-iot-backend.onrender.com/health` → `{"ok":true}`. La raíz `/` da "Cannot GET /" y es normal, porque no hay página web.
- **Logs:** Render → servicio → *Logs*. Hay una línea JSON por petición, con su `id`. Al arrancar, `[db] conectado a MongoDB (base: …)` confirma la base.
- **Servidor dormido:** el plan gratuito se duerme tras ~15 min sin uso y tarda 30–60 s en despertar. Hay dos soluciones:
  - el firmware llama a `/health` al encender;
  - un monitor externo (UptimeRobot o cron-job.org) que abra `/health` cada 10 min lo mantiene despierto.

## Cómo cambiar cosas comunes

| Quiero… | Dónde |
|---|---|
| Cambiar el umbral de confianza | `UMBRAL_CONFIANZA` en Render (sin tocar código) |
| Cambiar de modelo de Gemini | `VISION_MODEL` en Render |
| Cambiar de proveedor de IA | Nuevo adaptador en `src/proveedores/` que devuelva `{categoria, etiqueta, confianza}` como texto; usarlo en `classification.service.js` y aceptar su nombre en `env.js`. La placa no cambia |
| Cambiar las categorías o los textos de pantalla | `CATEGORIAS` en `traductor.js` y la instrucción de `gemini.js`; actualizar `contrato.md` |
| Agregar otro dispositivo | Hoy hay una sola clave. Habría que mapear clave → nombre en `device-auth.middleware.js` |
| Cambiar un código o mensaje de error | `errors.js` y `contrato.md` en el mismo commit |

## Límites conocidos

- **Una clave = un dispositivo** (`clasificador-001`).
- **Las peticiones sin clave también se guardan**, porque el contrato pide "cada petición". Con una URL pública, alguien podría llenar la base. Con la carga de la clase el riesgo es bajo.
- **`confianza: null` se acepta.** Sigue pendiente en el contrato.
- **Antirrepetición (`X-Request-Nonce`) y firma de respuestas (HMAC)** del Hito 6: pendientes en el contrato, no implementados.
- **Cualquier error inesperado de Express sale como `PROVEEDOR_FALLO`** (502), aunque no sea culpa de Gemini.
