# ClasificadorIOT

Clasificador de residuos con ESP32-S3. Al presionar un botón toma una foto, la envía a un servidor que consulta una IA de visión y muestra en pantalla si el residuo es **orgánico**, **inorgánico reciclable** o **inorgánico no reciclable**.

## Cómo funciona

```
Botón → ESP32-S3 + cámara → (HTTPS) → Servidor Node.js → IA de visión
                                            │
Pantalla ← resultado (JSON) ←───────────────┘
                                            └→ MongoDB (solo guarda resultados)
```

El detalle paso a paso está en [`docs/funcionamiento.md`](docs/funcionamiento.md) y el formato de comunicación en [`docs/contrato.md`](docs/contrato.md).

## Estructura

```
backend/     servidor Node.js
firmware/    código de la ESP32-S3 (PlatformIO)
pruebas/     protocolo, matriz de resultados y evidencias
docs/
├── contrato.md        comunicación placa ↔ servidor
├── funcionamiento.md  qué hace el dispositivo
├── hardware/          componentes, pines, conexiones y carcasa 3D
└── informe/           informe del proyecto
```

## Flujo de trabajo

1. **Cada quien trabaja en su propia rama**, creada desde `main` y nombrada con lo que hace: `servidor-clasificar`, `firmware-pantallas`.
2. **Commits pequeños** que digan qué cambió.
3. **Para unir a `main`**, se abre un pull request y otra persona del equipo lo revisa. `main` siempre debe funcionar.
4. **La documentación** (`docs/`, `pruebas/`) puede subirse directo a `main`.

## Cómo usarlo

### Servidor (`backend/`)

```bash
cd backend
cp .env.example .env      # llenar DEVICE_KEY, MONGODB_URI y VISION_API_KEY
npm install
npm run dev               # http://localhost:3000
npm test                  # contrato del endpoint, traductor y adaptador de Gemini
npm run probar-fotos      # 10J: fotos de test/fotos contra Gemini real
```

Solicitudes de prueba del contrato (en local o contra la URL publicada):

```bash
BASE_URL=http://localhost:3000 DEVICE_KEY=<clave> bash scripts/solicitudes.sh foto1.jpg
```

Cada respuesta trae un `id`. El servidor escribe una línea JSON por petición con ese `id` y guarda el registro en la colección `classifications` de MongoDB antes de responder (campos en `docs/contrato.md`).

**Proveedor de IA elegido:** Gemini (`gemini-3.5-flash-lite`, API `generateContent`). El adaptador está en `src/proveedores/gemini.js` y el traductor a las 3 categorías en `src/traductor.js`. Latencia medida en local: ~3.3 s por foto.

**Publicado en Render** (plan gratuito, HTTPS automático) con `render.yaml`: en render.com, **New → Blueprint**, elegir este repositorio y capturar `DEVICE_KEY`, `MONGODB_URI`, `MONGODB_DB` y `VISION_API_KEY`. El plan gratuito se duerme tras ~15 min sin uso y tarda 30–60 s en despertar, más que los 18 s que espera la placa: la primera foto daría "Sin respuesta". Para evitarlo, un monitor gratuito (UptimeRobot o cron-job.org) que llame a `https://<servicio>.onrender.com/health` cada 10 min lo mantiene despierto (las 750 h gratis al mes alcanzan); sin monitor, abrir esa URL y esperar respuesta antes de cada prueba. MongoDB Atlas debe permitir `0.0.0.0/0` en Network Access.

### Firmware (`firmware/`)

Copiar `firmware/include/secrets.example.h` a `secrets.h` y llenarlo (`BACKEND_URL` = `https://<servicio>.onrender.com/api/clasificar`, `DEVICE_KEY` igual a la del servidor). Compilar y subir con PlatformIO.

`clasificarFoto(jpg, len)` (`src/clasificador_api.cpp`) conecta el Wi-Fi si hace falta, manda el JPEG por HTTPS validando el certificado del servidor, espera hasta 18 s y devuelve la respuesta ya interpretada. El `main.cpp` actual es de prueba: al presionar BOOT manda `data/foto_prueba.jpg` y escribe la respuesta en el Monitor Serie (115200).
