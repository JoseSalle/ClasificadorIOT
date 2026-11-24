// Todos los pines del dispositivo. Si el circuito cambia, solo se cambia este archivo
// (y docs/hardware/pines.md).
// No usar GPIO 35, 36, 37 (PSRAM), 0, 3, 45, 46 (arranque) ni 19, 20 (USB).
#pragma once

// Cámara OV3660 integrada: pinout estándar de las ESP32-S3 N16R8 CAM (Freenove / GOOUUU).
#define CAM_PIN_PWDN  -1
#define CAM_PIN_RESET -1
#define CAM_PIN_XCLK  15
#define CAM_PIN_SIOD  4
#define CAM_PIN_SIOC  5
#define CAM_PIN_D0    11
#define CAM_PIN_D1    9
#define CAM_PIN_D2    8
#define CAM_PIN_D3    10
#define CAM_PIN_D4    12
#define CAM_PIN_D5    18
#define CAM_PIN_D6    17
#define CAM_PIN_D7    16
#define CAM_PIN_VSYNC 6
#define CAM_PIN_HREF  7
#define CAM_PIN_PCLK  13

// shortcut: valores sugeridos, no confirmados; José los ajusta al circuito real.
// Botón: un lado al pin, el otro a GND (usa la resistencia pull-up interna).
#define PIN_BOTON 14

// Pantalla 1 (instrucciones y resultado), bus I2C 0.
#define OLED1_SDA 1
#define OLED1_SCL 2

// Pantalla 2 (Wi-Fi, última clasificación y contador), I2C por software: la cámara ocupa el bus 1.
#define OLED2_SDA 41
#define OLED2_SCL 42
