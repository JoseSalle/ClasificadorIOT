// Programa del clasificador (docs/funcionamiento.md):
// botón → foto → servidor → resultado en pantalla 1; estado del dispositivo en pantalla 2.
#include <Arduino.h>
#include <WiFi.h>
#include "camara.h"
#include "clasificador_api.h"
#include "pantallas.h"
#include "pines.h"

static const uint32_t RESULTADO_MS = 5000;    // cuánto se ve el resultado antes de volver a esperar
static const uint32_t REVISAR_WIFI_MS = 2000; // cada cuánto se revisa el Wi-Fi para la pantalla 2

static bool camaraLista = false;
static bool wifiMostrado = false;
static String ultima;      // última categoría clasificada (pantalla 2)
static unsigned contador = 0;

static void mostrarEspera() {
  pantallaMensaje("Clasificador", "Coloca el residuo", "y presiona el botón");
}

static void mostrarEstado() {
  wifiMostrado = WiFi.status() == WL_CONNECTED;
  pantallaEstado(wifiMostrado, ultima, contador);
}

static Respuesta tomarYClasificar() {
  if (!camaraLista) camaraLista = iniciarCamara(); // reintenta si falló al encender
  camera_fb_t *fb = camaraLista ? esp_camera_fb_get() : nullptr;
  if (!fb) {
    Respuesta r;
    r.estado = Estado::ERROR_CAMARA;
    r.mensaje = "Error de cámara";
    return r;
  }
  Respuesta r = clasificarFoto(fb->buf, fb->len);
  esp_camera_fb_return(fb);
  return r;
}

static void cicloDeClasificacion() {
  pantallaMensaje("Procesando...");
  Respuesta r = tomarYClasificar();
  Serial.printf("%s http=%d id=%s %s %s total=%u ms\n", nombreEstado(r.estado), r.http, r.id.c_str(),
                r.categoria.c_str(), r.codigo.c_str(), (unsigned)r.total_ms);

  if (r.estado == Estado::CLASIFICADO) {
    ultima = r.mensaje;
    contador++;
  }
  pantallaResultado(r);
  mostrarEstado();
  delay(RESULTADO_MS);
  mostrarEspera();
}

void setup() {
  Serial.begin(115200);
  pinMode(PIN_BOTON, INPUT_PULLUP);
  iniciarPantallas();
  pantallaMensaje("Iniciando...");
  mostrarEstado();

  camaraLista = iniciarCamara();
  if (!camaraLista) Serial.println("La camara no responde");

  pantallaMensaje("Conectando", "a Wi-Fi...");
  conectarWifi();
  mostrarEstado();
  if (wifiMostrado) {
    pantallaMensaje("Preparando", "servidor...");
    despertarServidor();
  }
  mostrarEspera();
}

void loop() {
  static uint32_t ultimaRevision = 0;
  if (millis() - ultimaRevision > REVISAR_WIFI_MS) {
    ultimaRevision = millis();
    if ((WiFi.status() == WL_CONNECTED) != wifiMostrado) mostrarEstado(); // el Wi-Fi reconecta solo
  }

  if (digitalRead(PIN_BOTON) == LOW) {
    delay(50); // antirrebote
    if (digitalRead(PIN_BOTON) == LOW) {
      cicloDeClasificacion(); // las pulsaciones durante el ciclo no se leen
      while (digitalRead(PIN_BOTON) == LOW) delay(10); // una pulsación = una foto
    }
  }
  delay(10);
}
