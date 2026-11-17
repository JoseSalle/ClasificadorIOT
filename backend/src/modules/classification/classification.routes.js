const express = require('express');
const env = require('../../config/env');
const deviceAuth = require('../../middlewares/device-auth.middleware');
const { postClasificar } = require('./classification.controller');

const router = express.Router();

// Autenticar antes de leer el cuerpo: no se aceptan 300 KB de alguien sin clave.
router.post('/clasificar',
  deviceAuth,
  express.raw({ type: 'image/jpeg', limit: env.maxImageBytes }),
  postClasificar);

module.exports = router;
