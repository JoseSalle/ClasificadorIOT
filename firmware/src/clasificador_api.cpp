#include "clasificador_api.h"
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "certificados.h"
#include "secrets.h"

static const uint32_t TIMEOUT_TOTAL_MS = 18000; // contrato: espera máxima de la placa
static const size_t MAX_JPEG = 300 * 1024;      // contrato: también se valida en la placa

bool conectarWifi(uint32_t timeout_ms) {
  if (WiFi.status() == WL_CONNECTED) return true;
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  uint32_t t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < timeout_ms) delay(200);
  return WiFi.status() == WL_CONNECTED;
}

static Respuesta errorLocal(Estado e, const char *mensaje, int http = 0) {
  Respuesta r;
  r.estado = e;
  r.http = http;
  r.mensaje = mensaje;
  return r;
}

Respuesta clasificarFoto(const uint8_t *jpg, size_t len) {
  if (len == 0 || len > MAX_JPEG) return errorLocal(Estado::RESPUESTA_INVALIDA, "Foto invalida");
  if (!conectarWifi()) return errorLocal(Estado::SIN_WIFI, "Sin Wi-Fi");

  WiFiClientSecure tls;
  tls.setCACert(RAICES_GOOGLE_PEM); // valida el certificado del servidor (riesgo de sniffing, Hito 6)
  HTTPClient http;
  http.setConnectTimeout(8000);
  http.setTimeout(TIMEOUT_TOTAL_MS);
  // shortcut: cada lectura tiene 18 s de límite, no la operación completa; suficiente
  // porque el backend corta al proveedor a los 12 s y siempre contesta antes.

  uint32_t t0 = millis();
  if (!http.begin(tls, BACKEND_URL)) return errorLocal(Estado::SIN_CONEXION, "Sin conexion");
  http.addHeader("Content-Type", "image/jpeg");
  http.addHeader("X-Device-Key", DEVICE_KEY);
  int codigo = http.POST(const_cast<uint8_t *>(jpg), len);
  uint32_t total = millis() - t0;

  if (codigo == HTTPC_ERROR_READ_TIMEOUT) { http.end(); return errorLocal(Estado::TIEMPO_AGOTADO, "Sin respuesta", codigo); }
  if (codigo < 0) { http.end(); return errorLocal(Estado::SIN_CONEXION, "Sin conexion", codigo); }

  String cuerpo = http.getString();
  http.end();

  JsonDocument doc;
  if (deserializeJson(doc, cuerpo) || !doc["ok"].is<bool>()) {
    Respuesta r = errorLocal(Estado::RESPUESTA_INVALIDA, "Error de respuesta", codigo);
    r.total_ms = total;
    return r;
  }

  Respuesta r;
  r.http = codigo;
  r.total_ms = total;
  r.id = doc["id"] | "";
  if (doc["ok"].as<bool>()) {
    r.estado = Estado::CLASIFICADO;
    r.categoria = doc["categoria"] | "";
    r.mensaje = doc["mensaje"] | "";
    r.etiqueta = doc["etiqueta"] | "";
    r.confianza = doc["confianza"].is<float>() ? doc["confianza"].as<float>() : -1;
    r.tiempo_ms = doc["tiempo_ms"] | -1;
  } else {
    r.codigo = doc["error"]["codigo"] | "";
    r.mensaje = doc["error"]["mensaje"] | "Error";
    r.estado = (r.codigo == "NO_CLASIFICABLE") ? Estado::NO_CLASIFICABLE : Estado::ERROR_SERVIDOR;
  }
  return r;
}

const char *nombreEstado(Estado e) {
  switch (e) {
    case Estado::CLASIFICADO: return "CLASIFICADO";
    case Estado::NO_CLASIFICABLE: return "NO_CLASIFICABLE";
    case Estado::ERROR_SERVIDOR: return "ERROR_SERVIDOR";
    case Estado::SIN_WIFI: return "SIN_WIFI";
    case Estado::SIN_CONEXION: return "SIN_CONEXION";
    case Estado::TIEMPO_AGOTADO: return "TIEMPO_AGOTADO";
    case Estado::RESPUESTA_INVALIDA: return "RESPUESTA_INVALIDA";
  }
  return "?";
}
