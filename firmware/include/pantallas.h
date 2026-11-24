#pragma once
#include <Arduino.h>
#include "clasificador_api.h"

void iniciarPantallas();

// Pantalla 1: instrucciones, "Procesando..." y resultado.
void pantallaMensaje(const char *titulo, const char *linea1 = "", const char *linea2 = "");
void pantallaResultado(const Respuesta &r);

// Pantalla 2: estado del dispositivo.
void pantallaEstado(bool wifi, const String &ultima, unsigned contador);
