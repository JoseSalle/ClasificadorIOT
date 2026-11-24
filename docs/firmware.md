# Firmware: documentación del código

Programa de la ESP32-S3. Al presionar el botón toma una foto, la manda por HTTPS al backend y muestra el resultado en la pantalla 1. La pantalla 2 muestra el estado del dispositivo.

- **Comportamiento esperado:** [`funcionamiento.md`](funcionamiento.md)
- **Formato de comunicación:** [`contrato.md`](contrato.md)
- **Backend:** [`backend.md`](backend.md)
- **Herramientas:** PlatformIO, Arduino (core 2.0.17 de espressif32 6.13.0), ArduinoJson 7, U8g2.

## Índice

1. [Hardware](#hardware)
2. [Estructura](#estructura)
3. [Pines](#pines)
4. [Qué hace el programa](#qué-hace-el-programa)
5. [Archivos uno por uno](#archivos-uno-por-uno)
6. [Lo que muestra cada pantalla](#lo-que-muestra-cada-pantalla)
7. [Tiempos](#tiempos)
8. [Seguridad](#seguridad)
9. [Configuración de compilación](#configuración-de-compilación)
10. [Compilar, subir y ver el Monitor Serie](#compilar-subir-y-ver-el-monitor-serie)
11. [Ajustes al circuito real](#ajustes-al-circuito-real)
12. [Límites conocidos](#límites-conocidos)

## Hardware

| Componente | Cómo lo usa el código |
|---|---|
| ESP32-S3 N16R8 (16 MB flash, 8 MB PSRAM octal) | Todo. Las fotos se guardan en la PSRAM |
| Cámara OV3660 (integrada en la placa) | `camara.cpp`, JPEG 640×480 |
| 2 OLED 0.96" I²C (SSD1306, 128×64) | `pantallas.cpp`; cada una en sus propios pines |
| Botón push | Entrada con pull-up interno (presionado = `LOW`) |
| Batería, TP4056, interruptor, MT3608 | No pasan por el código: son solo energía |

## Estructura

```
firmware/
├── platformio.ini           placa, memoria y librerías
├── include/
│   ├── pines.h              TODOS los pines (el único lugar)
│   ├── secrets.example.h    plantilla de secrets.h
│   ├── secrets.h            Wi-Fi, URL y clave (no se sube a git)
│   ├── certificados.h       raíces de confianza para el HTTPS
│   ├── clasificador_api.h   Estado, Respuesta y funciones de red
│   ├── camara.h
│   └── pantallas.h
└── src/
    ├── main.cpp             ciclo del dispositivo
    ├── clasificador_api.cpp Wi-Fi, /health y envío de la foto
    ├── camara.cpp           inicio de la OV3660
    └── pantallas.cpp        dibujo en las dos OLED
```

Cada archivo tiene un solo trabajo:
- `main.cpp` decide **qué** pasa y **cuándo**.
- Los otros saben **cómo** hablar con un componente.

## Pines

Están en `include/pines.h`. Si el circuito cambia, se cambia solo ese archivo y luego `docs/hardware/pines.md`.

| Señal | GPIO | Estado |
|---|---|---|
| Cámara XCLK / SIOD / SIOC | 15 / 4 / 5 | Estándar de las ESP32-S3 N16R8 CAM |
| Cámara D0–D7 | 11, 9, 8, 10, 12, 18, 17, 16 | Estándar |
| Cámara VSYNC / HREF / PCLK | 6 / 7 / 13 | Estándar |
| Cámara PWDN / RESET | sin pin (−1) | Estándar |
| Botón (a GND) | 14 | **Sugerido: confirmar** |
| OLED 1 SDA / SCL | 1 / 2 | **Sugerido: confirmar** |
| OLED 2 SDA / SCL | 41 / 42 | **Sugerido: confirmar** |

Pines que no se deben usar:
- **35, 36, 37:** los ocupa la PSRAM.
- **0, 3, 45, 46:** deciden cómo arranca la placa.
- **19, 20:** son el USB.

## Qué hace el programa

### Encendido (`setup()`)

| Paso | Pantalla 1 | Pantalla 2 |
|---|---|---|
| 1. Configura el botón e inicia las 2 pantallas | "Iniciando..." | Wi-Fi, última, contador |
| 2. Inicia la cámara (si falla, lo anota y sigue) | | |
| 3. Conecta el Wi-Fi (hasta 10 s) | "Conectando a Wi-Fi..." | Se actualiza el Wi-Fi |
| 4. Si hay Wi-Fi, despierta el servidor (`GET /health`, hasta 60 s) | "Preparando servidor..." | |
| 5. Queda esperando | "Clasificador · Coloca el residuo y presiona el botón" | |

El paso 4 existe porque Render (plan gratuito) se duerme tras ~15 min sin uso y tarda 30–60 s en despertar. Sin este paso, la primera foto pasaría los 18 s y saldría "Sin respuesta".

### Ciclo de clasificación (`loop()`)

1. **Cada 2 s** revisa el Wi-Fi. Si cambió, actualiza la pantalla 2. El Wi-Fi se reconecta solo.
2. **Botón:** si lee `LOW`, espera 50 ms y lo vuelve a leer (**antirrebote**). Si sigue presionado:
   1. Pantalla 1: "Procesando...".
   2. Toma la foto. Si la cámara no había iniciado, lo reintenta aquí.
   3. `clasificarFoto()` manda el JPEG y espera la respuesta (hasta 18 s).
   4. Escribe una línea en el Monitor Serie.
   5. Si clasificó: `ultima = categoría` y `contador + 1`.
   6. Pantalla 1: resultado o error. Pantalla 2: estado actualizado.
   7. Espera 5 s y vuelve a "Coloca el residuo...".
3. Espera a que se suelte el botón: **una pulsación = una foto**. Mientras procesa o muestra un resultado, el botón no se lee, así que no puede haber dos envíos a la vez.

## Archivos uno por uno

### `src/main.cpp`
El ciclo descrito arriba. Constantes:

| Constante | Valor | Para qué |
|---|---|---|
| `RESULTADO_MS` | 5000 | Cuánto se ve el resultado |
| `REVISAR_WIFI_MS` | 2000 | Cada cuánto se revisa el Wi-Fi |

Estado en memoria:
- `camaraLista`;
- `wifiMostrado`, lo último que se dibujó, para redibujar solo si cambia;
- `ultima`;
- `contador`.

El contador y la última clasificación se reinician al apagar.

Funciones internas:
- `mostrarEspera()`: pantalla 1 en espera.
- `mostrarEstado()`: dibuja la pantalla 2.
- `tomarYClasificar()`: foto → `clasificarFoto()` → devuelve el buffer de la cámara. Si no hay foto, regresa `ERROR_CAMARA`.
- `cicloDeClasificacion()`: todo el paso 2 del ciclo.

### `src/clasificador_api.cpp` + `include/clasificador_api.h`
Toda la comunicación con el backend.

**`bool conectarWifi(uint32_t timeout_ms = 10000)`**: si ya está conectado, devuelve `true`. Si no, hace `WiFi.begin(WIFI_SSID, WIFI_PASSWORD)` y espera hasta `timeout_ms`.

**`bool despertarServidor(uint32_t timeout_ms = 60000)`**: `GET` a la URL del backend cambiando `/api/clasificar` por `/health`, por HTTPS y con certificado. Devuelve `true` si responde 200.

**`Respuesta clasificarFoto(const uint8_t *jpg, size_t len)`**:
1. Si la foto está vacía o pasa de 300 KB → `RESPUESTA_INVALIDA` ("Foto invalida"), sin enviar nada.
2. Si no hay Wi-Fi → `conectarWifi()`; si falla → `SIN_WIFI`.
3. `WiFiClientSecure` con `setCACert(RAICES_GOOGLE_PEM)`: **valida el certificado del servidor**.
4. `POST BACKEND_URL` con `Content-Type: image/jpeg` y `X-Device-Key: DEVICE_KEY`. Conexión hasta 8 s, lectura hasta 18 s.
5. Si la lectura pasa del tiempo → `TIEMPO_AGOTADO` ("Sin respuesta"). Si falla la conexión o el TLS → `SIN_CONEXION` ("Sin conexion").
6. Lee el JSON con ArduinoJson. Si no se entiende o falta `ok` → `RESPUESTA_INVALIDA` ("Error de respuesta").
7. Si `ok: true` → `CLASIFICADO` con categoría, mensaje, etiqueta, confianza, `id` y `tiempo_ms`.
8. Si `ok: false` → `NO_CLASIFICABLE` cuando `error.codigo` es `NO_CLASIFICABLE`, y `ERROR_SERVIDOR` en cualquier otro caso. El mensaje es `error.mensaje`.

**`struct Respuesta`**:

| Campo | Contenido |
|---|---|
| `estado` | `Estado` (tabla siguiente) |
| `http` | Código HTTP, o negativo si falló antes de recibir respuesta (códigos de `HTTPClient`) |
| `categoria` | `organico`, `inorganico_reciclable`, `inorganico_no_reciclable` |
| `mensaje` | Texto listo para la pantalla |
| `codigo` | `error.codigo` del contrato |
| `etiqueta` | Qué vio la IA |
| `confianza` | 0 a 1; `-1` si no vino |
| `id` | `id` del backend, igual al `_id` en MongoDB |
| `tiempo_ms` | Latencia medida en el backend; `-1` si no vino |
| `total_ms` | Latencia total medida en la placa |

**`enum class Estado`** y `nombreEstado(e)` (texto para el Monitor Serie):

| Estado | Origen | Cuándo |
|---|---|---|
| `CLASIFICADO` | Backend | HTTP 200, `ok: true` |
| `NO_CLASIFICABLE` | Backend | HTTP 200, `ok: false` |
| `ERROR_SERVIDOR` | Backend | 400 / 401 / 413 / 502 / 504 |
| `SIN_WIFI` | Placa | No se pudo conectar al Wi-Fi |
| `SIN_CONEXION` | Placa | No se abrió la conexión (servidor caído o certificado inválido) |
| `TIEMPO_AGOTADO` | Placa | Más de 18 s sin respuesta |
| `RESPUESTA_INVALIDA` | Placa | JSON ilegible, o foto vacía o de más de 300 KB |
| `ERROR_CAMARA` | Placa | La cámara no inició o no entregó foto |

### `src/camara.cpp` + `include/camara.h`
**`bool iniciarCamara()`**: configura `esp_camera`, que ya viene en el core de Arduino:

| Ajuste | Valor | Por qué |
|---|---|---|
| Formato | JPEG | El contrato pide JPEG binario |
| Tamaño | VGA 640×480 | ~30–60 KB por foto, muy debajo de 300 KB, y suficiente para la IA |
| Calidad | 12 (0 = mejor, 63 = peor) | Buen equilibrio entre tamaño y nitidez |
| Buffers | 2, en PSRAM | La PSRAM tiene espacio de sobra |
| Modo | `CAMERA_GRAB_LATEST` | Entrega la foto del momento de la pulsación, no una vieja guardada |
| XCLK | 20 MHz | Valor estándar |

Si el sensor es OV3660, aplica los ajustes del ejemplo oficial `CameraWebServer`: `vflip` (voltea vertical), brillo +1 y saturación −2.

En `main.cpp` la foto se toma con `esp_camera_fb_get()` y se devuelve con `esp_camera_fb_return()` en cuanto se envía.

### `src/pantallas.cpp` + `include/pantallas.h`
Dibuja con U8g2, que maneja acentos (UTF-8), varias pantallas y varios modelos.
- **Pantalla 1:** `..._F_HW_I2C`, el I²C del chip en los pines `OLED1_*`.
- **Pantalla 2:** `..._F_SW_I2C`, I²C por software en los pines `OLED2_*`. El ESP32-S3 tiene solo 2 controladores I²C y **la cámara ya ocupa el segundo**. Para una pantalla de estado que cambia pocas veces, la velocidad del I²C por software sobra.
- **Fuentes:** `helvB12` (grande) y `6x12` (chica, 21 caracteres por línea). Las dos incluyen acentos.

| Función | Dibuja en | Qué |
|---|---|---|
| `iniciarPantallas()` | Ambas | Las enciende |
| `pantallaMensaje(titulo, linea1, linea2)` | Pantalla 1 | Título grande y 2 líneas chicas, centrados |
| `pantallaResultado(r)` | Pantalla 1 | Mensaje grande; si clasificó: etiqueta y "Confianza N%"; si es error: "Vuelve a intentarlo" |
| `pantallaEstado(wifi, ultima, contador)` | Pantalla 2 | Wi-Fi, última clasificación y número de clasificaciones |

`centrado()` escribe centrado. Si el texto no cabe en letra grande, usa la chica. Si aún no cabe, lo recorta sin partir una letra con acento.

### `include/certificados.h`
`RAICES_GOOGLE_PEM`: certificados raíz GTS Root R1 y R4 (vigentes hasta 2036). `*.onrender.com` encadena WE1 → **GTS Root R4**, comprobado con `openssl` el 17/11. R1 se incluye por si cambian a un certificado RSA.

### `include/secrets.h` (no se sube)
Se copia de `secrets.example.h`:

```c
#define WIFI_SSID     "nombre-de-la-red"
#define WIFI_PASSWORD "contraseña"
#define BACKEND_URL   "https://clasificador-iot-backend.onrender.com/api/clasificar"
#define DEVICE_KEY    "misma clave que DEVICE_KEY del backend"
```

## Lo que muestra cada pantalla

**Pantalla 1**

| Situación | Línea grande | Líneas chicas |
|---|---|---|
| Espera | Clasificador | Coloca el residuo / y presiona el botón |
| Enviando | Procesando... | |
| Clasificó | Organico / Reciclable / No reciclable | etiqueta (p. ej. "lata de aluminio") / Confianza 98% |
| IA insegura | Intenta de nuevo | |
| Error del backend | Imagen invalida / No autorizado / Imagen muy grande / Servicio no disponible / Tiempo agotado | Vuelve a intentarlo |
| Sin Wi-Fi | Sin Wi-Fi | Vuelve a intentarlo |
| Servidor caído o TLS | Sin conexion | Vuelve a intentarlo |
| Más de 18 s | Sin respuesta | Vuelve a intentarlo |
| JSON ilegible / foto inválida | Error de respuesta / Foto invalida | Vuelve a intentarlo |
| Cámara | Error de cámara | Vuelve a intentarlo |

**Pantalla 2**

```
Wi-Fi: conectado
Última:
       Reciclable
Clasificaciones: 3
```

**Monitor Serie (115200):** una línea por foto, para las evidencias. El `id` se busca en MongoDB.

```
CLASIFICADO http=200 id=c-9f71ed7e organico  total=2760 ms
ERROR_SERVIDOR http=401 id=c-8120ca2a  NO_AUTORIZADO total=360 ms
```

## Tiempos

| Qué | Límite | Dónde |
|---|---|---|
| Conectar Wi-Fi | 10 s | `conectarWifi()` |
| Despertar servidor al encender | 60 s | `despertarServidor()` |
| Abrir la conexión HTTPS | 8 s | `clasificarFoto()` |
| Esperar la respuesta | 18 s (contrato) | `clasificarFoto()` |
| Resultado en pantalla | 5 s | `RESULTADO_MS` |
| Antirrebote | 50 ms | `loop()` |

Los 18 s son por lectura, no por toda la operación. Basta porque el backend corta a Gemini a los 12 s y siempre contesta antes.

## Seguridad

Son las mitigaciones del Hito 6 que aplican a la placa:

- **HTTPS con certificado validado** (`setCACert`): evita que alguien en la red lea o cambie la foto o la respuesta (*sniffing* y *man-in-the-middle*).
- **Clave del dispositivo** en cada petición (`X-Device-Key`).
- **Secretos fuera de git:** `secrets.h` está en `.gitignore`.
- **La placa nunca habla con la IA ni con MongoDB**, solo con el backend. Las claves de Gemini y de la base nunca están en la placa.

## Configuración de compilación

`platformio.ini`:

| Opción | Valor | Por qué |
|---|---|---|
| `board` | `esp32-s3-devkitc-1` | Placa base ESP32-S3 |
| `board_build.arduino.memory_type` | `qio_opi` | Flash QIO + **PSRAM octal**, la "R8" de N16R8. Sin esto no hay PSRAM |
| `board_build.flash_size` / `board_upload.flash_size` | `16MB` | La "N16" |
| `board_build.partitions` | `default_16MB.csv` | Aprovecha los 16 MB |
| `build_flags` | `-DBOARD_HAS_PSRAM` | Activa la PSRAM en Arduino |
| `lib_deps` | ArduinoJson 7, U8g2 | JSON y pantallas |

Uso actual: RAM 15.9 %, Flash 14.8 %.

## Compilar, subir y ver el Monitor Serie

1. Copiar `include/secrets.example.h` a `include/secrets.h` y llenarlo.
2. En VS Code con PlatformIO: **Build** (✓), **Upload** (→) y **Monitor** (🔌, 115200). Desde la terminal:

```bash
cd firmware
pio run -t upload -t monitor
```

Si el Monitor Serie no muestra nada usando el puerto **USB nativo** de la placa (no el de "UART"), agregar `-DARDUINO_USB_CDC_ON_BOOT=1` a `build_flags`.

## Ajustes al circuito real

| Si… | Cambiar |
|---|---|
| El botón o las pantallas están en otros pines | `include/pines.h` |
| Las pantallas son SH1106 de 1.3" | En `pantallas.cpp`, `SSD1306_128X64_NONAME` → `SH1106_128X64_NONAME` (2 veces) |
| La foto sale de cabeza o en espejo | En `camara.cpp`, `set_vflip` (0/1) o agregar `s->set_hmirror(s, 1)` |
| La IA falla mucho por foto chica u oscura | En `camara.cpp`: `FRAMESIZE_SVGA` (800×600) o brillo |
| La cámara es la OV2640 de respaldo | Ajustar sus pines en `pines.h`; los ajustes de OV3660 se saltan solos |
| El resultado debe verse más o menos tiempo | `RESULTADO_MS` en `main.cpp` |

## Límites conocidos

- **Probado solo con compilación.** Falta probarlo en la placa armada: pines, modelo de pantalla y orientación de la cámara.
- **El contador y la última clasificación se pierden al apagar** (no se guardan en memoria permanente).
- **El encendido puede tardar hasta ~70 s** si no hay Wi-Fi (10 s) o si Render estaba dormido (60 s). La pantalla 1 dice qué está pasando.
- **Mientras clasifica, la placa no hace otra cosa** (hasta 18 s): ni revisa el Wi-Fi ni lee el botón. Es a propósito: una foto a la vez.
- **La batería no se mide**: no hay un sensor de batería en el circuito.
