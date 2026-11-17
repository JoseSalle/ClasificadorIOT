// Códigos de error del contrato (docs/contrato.md). Único lugar donde viven.
const CODIGOS = {
  NO_CLASIFICABLE: { http: 200, mensaje: 'Intenta de nuevo' },
  IMAGEN_INVALIDA: { http: 400, mensaje: 'Imagen invalida' },
  NO_AUTORIZADO: { http: 401, mensaje: 'No autorizado' },
  IMAGEN_GRANDE: { http: 413, mensaje: 'Imagen muy grande' },
  PROVEEDOR_FALLO: { http: 502, mensaje: 'Servicio no disponible' },
  TIEMPO_AGOTADO: { http: 504, mensaje: 'Tiempo agotado' },
};

class AppError extends Error {
  constructor(codigo, detalle = {}) {
    super(CODIGOS[codigo].mensaje);
    this.codigo = codigo;
    this.http = CODIGOS[codigo].http;
    this.detalle = detalle; // solo para el log, nunca se envía a la placa
  }
}

module.exports = { AppError, CODIGOS };
