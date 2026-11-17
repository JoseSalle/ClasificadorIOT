// Prueba de 10C en la placa: Wi-Fi + envío por HTTPS de una foto guardada en el firmware.
// Al presionar BOOT (GPIO0) manda la foto y escribe la respuesta en el Monitor Serie.
// La cámara, el botón real y las pantallas los integra José (12J) llamando a clasificarFoto().
#include <Arduino.h>
#include <WiFi.h>
#include "clasificador_api.h"

extern const uint8_t foto_inicio[] asm("_binary_data_foto_prueba_jpg_start");
extern const uint8_t foto_fin[] asm("_binary_data_foto_prueba_jpg_end");

static const int PIN_BOOT = 0;

static void enviarYMostrar() {
  size_t len = foto_fin - foto_inicio;
  Serial.printf("\nEnviando foto de prueba (%u bytes)...\n", (unsigned)len);
  Respuesta r = clasificarFoto(foto_inicio, len);
  Serial.printf("estado=%s http=%d total=%u ms\n", nombreEstado(r.estado), r.http, (unsigned)r.total_ms);
  Serial.printf("OLED: %s\n", r.mensaje.c_str());
  if (r.estado == Estado::CLASIFICADO) {
    Serial.printf("categoria=%s etiqueta=%s confianza=%.2f backend=%d ms id=%s\n",
                  r.categoria.c_str(), r.etiqueta.c_str(), r.confianza, r.tiempo_ms, r.id.c_str());
  } else if (r.codigo.length()) {
    Serial.printf("codigo=%s id=%s\n", r.codigo.c_str(), r.id.c_str());
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  pinMode(PIN_BOOT, INPUT_PULLUP);
  Serial.println(conectarWifi() ? "Wi-Fi conectado, IP " + WiFi.localIP().toString() : String("Sin Wi-Fi"));
  Serial.println("Presiona BOOT para clasificar la foto de prueba");
}

void loop() {
  if (digitalRead(PIN_BOOT) == LOW) {
    delay(50); // antirrebote
    if (digitalRead(PIN_BOOT) == LOW) {
      enviarYMostrar();
      while (digitalRead(PIN_BOOT) == LOW) delay(10); // una pulsación = un envío
    }
  }
  delay(10);
}
