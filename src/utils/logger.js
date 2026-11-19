/**
 * UTILIDAD: LOGGER DEL SISTEMA CON FORMATO Y MARCAS DE TIEMPO
 */
const logger = {
  info: (msg, meta = '') => console.log(`[${new Date().toISOString()}] [INFO] ${msg}`, meta),
  warn: (msg, meta = '') => console.warn(`[${new Date().toISOString()}] [WARN] ${msg}`, meta),
  error: (msg, err = '') => console.error(`[${new Date().toISOString()}] [ERROR] ${msg}`, err),
  debug: (msg, meta = '') => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[${new Date().toISOString()}] [DEBUG] ${msg}`, meta);
    }
  }
};

module.exports = logger;
