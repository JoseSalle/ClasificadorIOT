# ClasificadorIOT

Clasificador inteligente de residuos: ESP32-S3 + cámara → backend Node.js (HTTPS) → Gemini → MongoDB.

| Carpeta | Qué es |
|---|---|
| `backend/` | Node.js + Express: endpoint `POST /api/clasificar`, adaptador de visión, normalización y MongoDB |
| `firmware/` | Proyecto PlatformIO de la ESP32-S3 |
| `docs/contrato.md` | Contrato JSON ESP32 ↔ backend. Fuente única; cambiar aquí primero |

## Proveedor de IA elegido

**Gemini** (Google), modelo `gemini-3.5-flash-lite` vía API REST `generateContent`.

- Responde en JSON estructurado (`etiqueta`, `material`, `confianza`) y la normalización a las 3 categorías la hace el backend.
- Latencia medida en local: ~3.3 s por foto, dentro del límite de 8 s del contrato.
- Tiene nivel gratuito con API key de Google AI Studio.
- La `confianza` la reporta el propio modelo (no está calibrada): el umbral de 0.70 se ajusta con la prueba de 15 residuos.

## Backend

Requiere `backend/.env` (no está en el repositorio; pedirlo al equipo) con `DEVICE_KEY`, `MONGODB_URI`, `GEMINI_API_KEY`, `VISION_PROVIDER=gemini`, `GEMINI_MODEL`, `PROVIDER_TIMEOUT_MS=8000` y `UMBRAL_CONFIANZA=0.70`.

```bash
cd backend
npm install
npm run dev               # http://localhost:3000
npm test                  # contrato, adaptador Gemini y casos de normalización
```

Solicitudes de prueba (en local o contra la URL publicada):

```bash
BASE_URL=http://localhost:3000 DEVICE_KEY=<clave> bash scripts/solicitudes.sh foto1.jpg foto2.jpg
```

Cada respuesta trae un `id`. El backend escribe una línea JSON por petición con ese `id` y guarda cada clasificación (resultado o error, sin la foto) en la colección `classifications` de MongoDB con el mismo `id`.

### Cómo clasifica

1. `providers/gemini.provider.js` manda la foto a Gemini y le pide `etiqueta`, `material` (lista cerrada) y `confianza`.
2. `modules/classification/normalization.js` convierte `material` en una de las tres categorías.
3. Si el material es `otro` o `ninguno`, o la confianza queda bajo `UMBRAL_CONFIANZA`, responde `NO_CLASIFICABLE`.

### Despliegue (Render)

`render.yaml` define el servicio. En [render.com](https://render.com): **New → Blueprint**, elegir este repositorio y capturar `DEVICE_KEY`, `MONGODB_URI` y `GEMINI_API_KEY`. Render da HTTPS automático en `https://<servicio>.onrender.com`.

El plan gratuito se duerme tras ~15 min sin uso y tarda en despertar: antes de una demo o prueba, abrir `https://<servicio>.onrender.com/health` y esperar a que responda. MongoDB Atlas debe permitir `0.0.0.0/0` en Network Access (Render no tiene IP fija en el plan gratuito).

## Firmware

Requiere `firmware/include/secrets.h` (no está en el repositorio):

```cpp
#pragma once
#define WIFI_SSID     "red"
#define WIFI_PASSWORD "contrasena"
#define BACKEND_URL   "https://<servicio>.onrender.com/api/clasificar"
#define DEVICE_KEY    "<la misma DEVICE_KEY de backend/.env>"
```

`clasificarFoto(jpg, len)` (en `src/clasificador_api.cpp`) conecta el Wi-Fi si hace falta, manda el JPEG por HTTPS validando el certificado de Google y devuelve la respuesta ya interpretada. El `main.cpp` actual es de prueba: al presionar BOOT manda `data/foto_prueba.jpg` y escribe la respuesta en el Monitor Serie (115200).
