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

**Servidor:** _pendiente — instalar dependencias, copiar `backend/.env.example` a `.env` e iniciar._

**Firmware:** _pendiente — copiar `firmware/include/secrets.example.h` a `secrets.h`, compilar y subir con PlatformIO._
