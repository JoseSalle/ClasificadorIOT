const express = require('express');
const { randomUUID } = require('node:crypto');
const classificationRoutes = require('./modules/classification/classification.routes');
const errorHandler = require('./middlewares/error.middleware');

const app = express();
app.disable('x-powered-by');

// Cada petición tiene id desde el inicio (incluso si termina en error) y deja
// una línea JSON en el log al terminar: así se traza cualquier prueba por su id.
app.use((req, res, next) => {
  req.id = `c-${randomUUID().slice(0, 8)}`;
  res.on('finish', () => {
    if (req.originalUrl === '/health') return;
    console.log(JSON.stringify({ id: req.id, ruta: `${req.method} ${req.originalUrl}`, http: res.statusCode, ...res.locals.log }));
  });
  next();
});

app.get('/health', (req, res) => res.json({ ok: true }));
app.use('/api', classificationRoutes);
app.use(errorHandler);

module.exports = app;
