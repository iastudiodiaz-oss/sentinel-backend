/**
 * GESTOR GLOBAL DE ERRORES (Error Handler Middleware)
 * Captura excepciones no controladas y devuelve respuestas JSON limpias y homogéneas.
 */
const logger = require('../utils/logger');
const { errorResponse } = require('../utils/response');

const errorHandler = (err, req, res, next) => {
  logger.error(`Error no controlado en [${req.method}] ${req.originalUrl}:`, err.stack || err.message);

  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' && statusCode === 500
    ? 'Se ha producido un error interno en el servidor.'
    : err.message || 'Error en el servidor.';

  errorResponse(res, message, statusCode, err.errors || null);
};

module.exports = errorHandler;
