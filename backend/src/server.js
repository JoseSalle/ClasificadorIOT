const env = require('./config/env');
const app = require('./app');
const { connectDatabase } = require('./config/database');

// HTTP plano: en el despliegue el HTTPS lo pone la plataforma (Render).
connectDatabase().finally(() => {
  app.listen(env.port, () => {
    console.log(`[api] escuchando en http://localhost:${env.port} | proveedor: ${env.visionProvider} ${env.visionModel ?? ''}`);
  });
});
