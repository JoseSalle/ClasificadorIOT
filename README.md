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

Placa ESP32-S3 N16R8 con OV3660 integrada, 2 OLED 0.96" y un botón. **Todos los pines están en `firmware/include/pines.h`**; los del botón y las pantallas son sugeridos y hay que confirmarlos con el circuito.

- Al encender: inicia pantallas, cámara y Wi-Fi, y despierta al servidor (`/health`, hasta 60 s si Render estaba dormido).
- Pantalla 1: "Coloca el residuo y presiona el botón" → "Procesando..." → resultado (categoría, objeto y confianza) o el mensaje de error, 5 s, y vuelve a esperar.
- Pantalla 2: Wi-Fi conectado o sin conexión, última clasificación y número de clasificaciones.
- Cada clasificación deja una línea en el Monitor Serie (115200) con el `id`, que es el mismo `_id` del registro en MongoDB.

Archivos: `main.cpp` (ciclo), `camara.cpp` (OV3660 en JPEG VGA), `pantallas.cpp` (U8g2; si las OLED fueran SH1106 se cambia una línea) y `clasificador_api.cpp` (Wi-Fi y envío HTTPS validando el certificado; espera hasta 18 s). Si el Monitor Serie no muestra nada por el USB nativo de la placa, agregar `-DARDUINO_USB_CDC_ON_BOOT=1` a `build_flags`.
