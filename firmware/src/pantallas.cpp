#include "pantallas.h"
#include <U8g2lib.h>
#include "pines.h"

// OLED 0.96" SSD1306 128x64. Si fueran SH1106 (1.3"), cambiar SSD1306_128X64_NONAME por SH1106_128X64_NONAME.
// La pantalla 2 va por I2C por software: la cámara ya ocupa el segundo bus I2C del chip.
static U8G2_SSD1306_128X64_NONAME_F_HW_I2C p1(U8G2_R0, U8X8_PIN_NONE, OLED1_SCL, OLED1_SDA);
static U8G2_SSD1306_128X64_NONAME_F_SW_I2C p2(U8G2_R0, OLED2_SCL, OLED2_SDA, U8X8_PIN_NONE);

static const uint8_t *GRANDE = u8g2_font_helvB12_tf; // fuentes _tf: incluyen acentos (UTF-8)
static const uint8_t *CHICA = u8g2_font_6x12_tf;

// Escribe el texto centrado; si no cabe en grande usa la chica, y si aún no cabe lo recorta.
static void centrado(U8G2 &p, int y, String texto, bool grande = false) {
  p.setFont(grande ? GRANDE : CHICA);
  if (grande && p.getUTF8Width(texto.c_str()) > p.getDisplayWidth()) p.setFont(CHICA);
  while (texto.length() && p.getUTF8Width(texto.c_str()) > p.getDisplayWidth()) {
    int i = texto.length() - 1;
    while (i > 0 && (texto[i] & 0xC0) == 0x80) i--; // no partir una letra con acento
    texto.remove(i);
  }
  p.drawUTF8((p.getDisplayWidth() - p.getUTF8Width(texto.c_str())) / 2, y, texto.c_str());
}

void iniciarPantallas() {
  p1.begin();
  p2.begin();
}

void pantallaMensaje(const char *titulo, const char *linea1, const char *linea2) {
  p1.clearBuffer();
  centrado(p1, 20, titulo, true);
  centrado(p1, 42, linea1);
  centrado(p1, 56, linea2);
  p1.sendBuffer();
}

void pantallaResultado(const Respuesta &r) {
  p1.clearBuffer();
  centrado(p1, 20, r.mensaje, true);
  if (r.estado == Estado::CLASIFICADO) {
    centrado(p1, 42, r.etiqueta);
    if (r.confianza >= 0) centrado(p1, 56, "Confianza " + String(lround(r.confianza * 100)) + "%");
  } else if (r.estado != Estado::NO_CLASIFICABLE) {
    centrado(p1, 42, "Vuelve a intentarlo");
  }
  p1.sendBuffer();
}

void pantallaEstado(bool wifi, const String &ultima, unsigned contador) {
  p2.clearBuffer();
  p2.setFont(CHICA);
  p2.drawUTF8(0, 12, wifi ? "Wi-Fi: conectado" : "Wi-Fi: sin conexión");
  p2.drawUTF8(0, 30, "Última:");
  centrado(p2, 44, ultima.length() ? ultima : String("-"));
  p2.drawUTF8(0, 62, ("Clasificaciones: " + String(contador)).c_str());
  p2.sendBuffer();
}
