# Funcionamiento del dispositivo

## Encendido
1. Se enciende con el interruptor. La batería pasa por el MT3608, que entrega 5 V a la ESP32-S3.
2. La placa inicia la cámara OV3660, las dos pantallas y el Wi-Fi.
3. Pantalla 1: "Coloca el residuo y presiona el botón". Pantalla 2: estado del Wi-Fi.

## Ciclo de clasificación
4. Se presiona el botón (una foto por pulsación).
5. La cámara toma la foto en JPEG. Pantalla 1: "Procesando...".
6. La placa manda la foto por HTTPS al servidor (`POST /api/clasificar`). Espera hasta 15 s.
7. El servidor revisa la clave y la foto (JPEG, máximo 300 KB) y la manda a la IA (espera hasta 8 s).
8. El servidor convierte la respuesta en una de las 3 categorías; si la confianza es menor a 0.70 responde `NO_CLASIFICABLE`.
9. El servidor guarda el resultado en MongoDB (sin la foto) y responde con el JSON de `contrato.md`. La placa nunca consulta la base.
10. Pantalla 1 muestra el resultado o el error. Pantalla 2 actualiza la última clasificación y el contador.
11. Después de unos segundos vuelve al paso 3.

Errores que detecta la placa: sin Wi-Fi, fallo de HTTPS, más de 15 s sin respuesta o respuesta ilegible. Muestra un mensaje y vuelve a esperar.

## Carga
12. Con el interruptor apagado se conecta el USB al TP4056. Por la guía de luz se ve un LED mientras carga y otro cuando termina.
