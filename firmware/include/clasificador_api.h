// 10C: Wi-Fi y envío de la foto al backend según docs/contrato.md.
#pragma once
#include <Arduino.h>

enum class Estado {
  CLASIFICADO,       // HTTP 200, ok:true → mostrar mensaje
  NO_CLASIFICABLE,   // HTTP 200, ok:false → mostrar error.mensaje ("Intenta de nuevo")
  ERROR_SERVIDOR,    // 400/401/413/502/504 con error.codigo del contrato
  SIN_WIFI,          // errores que detecta la placa (no vienen del backend):
  SIN_CONEXION,      //   no se pudo abrir TCP/TLS (servidor caído, certificado inválido)
  TIEMPO_AGOTADO,    //   más de 18 s sin respuesta
  RESPUESTA_INVALIDA // JSON que no se puede leer
};

struct Respuesta {
  Estado estado;
  int http = 0;          // código HTTP, o negativo si falló antes (HTTPClient)
  String categoria;      // organico | inorganico_reciclable | inorganico_no_reciclable
  String mensaje;        // texto listo para la OLED (del backend o fijo de la placa)
  String codigo;         // error.codigo del contrato, si hubo error del backend
  String etiqueta;
  float confianza = -1;  // -1 = no vino o fue null
  String id;
  int tiempo_ms = -1;    // latencia medida por el backend
  uint32_t total_ms = 0; // latencia total medida por la placa
};

// Conecta (o reconecta) al Wi-Fi de secrets.h. Devuelve true si quedó conectado.
bool conectarWifi(uint32_t timeout_ms = 10000);

// Manda el JPEG por HTTPS y devuelve la respuesta ya interpretada. Bloquea hasta 18 s.
Respuesta clasificarFoto(const uint8_t *jpg, size_t len);

const char *nombreEstado(Estado e);
