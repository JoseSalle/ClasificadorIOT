#include "camara.h"
#include "pines.h"

bool iniciarCamara() {
  camera_config_t c = {};
  c.pin_pwdn = CAM_PIN_PWDN;
  c.pin_reset = CAM_PIN_RESET;
  c.pin_xclk = CAM_PIN_XCLK;
  c.pin_sccb_sda = CAM_PIN_SIOD;
  c.pin_sccb_scl = CAM_PIN_SIOC;
  c.pin_d0 = CAM_PIN_D0;
  c.pin_d1 = CAM_PIN_D1;
  c.pin_d2 = CAM_PIN_D2;
  c.pin_d3 = CAM_PIN_D3;
  c.pin_d4 = CAM_PIN_D4;
  c.pin_d5 = CAM_PIN_D5;
  c.pin_d6 = CAM_PIN_D6;
  c.pin_d7 = CAM_PIN_D7;
  c.pin_vsync = CAM_PIN_VSYNC;
  c.pin_href = CAM_PIN_HREF;
  c.pin_pclk = CAM_PIN_PCLK;
  c.xclk_freq_hz = 20000000;
  c.ledc_timer = LEDC_TIMER_0;
  c.ledc_channel = LEDC_CHANNEL_0;
  c.pixel_format = PIXFORMAT_JPEG;
  c.frame_size = FRAMESIZE_VGA; // 640x480: ~30-60 KB, muy debajo de los 300 KB del contrato
  c.jpeg_quality = 12;
  c.fb_count = 2;
  c.fb_location = CAMERA_FB_IN_PSRAM;
  c.grab_mode = CAMERA_GRAB_LATEST; // la foto es la del momento de la pulsación, no una vieja

  if (esp_camera_init(&c) != ESP_OK) return false;

  // Ajustes de la OV3660 del ejemplo oficial CameraWebServer.
  sensor_t *s = esp_camera_sensor_get();
  if (s->id.PID == OV3660_PID) {
    s->set_vflip(s, 1);
    s->set_brightness(s, 1);
    s->set_saturation(s, -2);
  }
  return true;
}
