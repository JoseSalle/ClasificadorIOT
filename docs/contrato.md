# Contrato ESP32 ↔ backend (v0.1, preliminar)

Fuente única para firmware y backend. Si cambia, se cambia aquí y en ambos lados en el mismo commit.

## Petición

```http
POST https://<backend>/api/clasificar
Content-Type: image/jpeg
X-Device-Key: <clave del dispositivo>
```

Cuerpo: la foto JPEG en binario (no Base64, no JSON), máximo **300 KB**.

## Respuesta exitosa (HTTP 200)

```json
{ "ok": true, "categoria": "inorganico_reciclable", "mensaje": "Reciclable",
  "etiqueta": "botella de plastico", "confianza": 0.87, "id": "c-0142", "tiempo_ms": 1840 }
```

| Campo | Obligatorio | Para qué |
|---|---|---|
| `ok` | Sí | La placa decide si muestra resultado o error |
| `categoria` | Sí | Solo `organico`, `inorganico_reciclable` o `inorganico_no_reciclable` |
| `mensaje` | Sí | Texto corto listo para la OLED |
| `etiqueta` | No | Qué vio la IA; para la matriz de 15 residuos |
| `confianza` | No | 0 a 1, o `null` si el proveedor no da uno fiable |
| `id` | Sí | Une la prueba con el log del backend |
| `tiempo_ms` | Sí | Latencia medida en el backend |

## Respuesta con error (mismo formato para todos los códigos)

```json
{ "ok": false, "error": { "codigo": "NO_CLASIFICABLE", "mensaje": "Intenta de nuevo" }, "id": "c-0143" }
```

| Código | HTTP | Cuándo |
|---|---:|---|
| `NO_CLASIFICABLE` | 200 | La IA no está segura o la confianza quedó bajo el umbral |
| `IMAGEN_INVALIDA` | 400 | No llegó un JPEG válido |
| `NO_AUTORIZADO` | 401 | Falta la clave del dispositivo o es incorrecta |
| `IMAGEN_GRANDE` | 413 | La foto pasa de 300 KB |
| `PROVEEDOR_FALLO` | 502 | La API de visión respondió con error |
| `TIEMPO_AGOTADO` | 504 | La API de visión tardó más de 8 s |

Errores que detecta la placa (no llegan del backend): sin Wi-Fi, fallo TLS, más de 15 s sin respuesta, JSON ilegible. Muestra un mensaje fijo y vuelve a `ESPERANDO`.

## Parámetros iniciales (por confirmar en 05J / 06C)

| Parámetro | Valor |
|---|---:|
| Tamaño máximo | 300 KB |
| Timeout del proveedor (backend) | 8 s |
| Timeout total (ESP32) | 15 s |
| Umbral de confianza | 0.70 |

## Pendientes

- `confianza: null` → ¿se acepta o se responde `NO_CLASIFICABLE`? (hoy: se acepta)
- `X-Request-Nonce` (antireplay, probado en Hito 6) y HMAC de la respuesta (Hito 6, riesgo 4): ¿opcionales desde v0.1 o después?
