/**
 * MIDDLEWARE DE LIMITACIÓN DE TASA (Rate Limiter)
 * Protege el servidor contra ataques de fuerza bruta y denegación de servicio (DoS).
 */
const rateLimit = require('express-rate-limit');
const { errorResponse } = require('../utils/response');

// Limitador general para la API REST (se omiten rutas de telemetría de alta frecuencia)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3000, // Permite navegación fluida entre múltiples terminales tácticos
  skip: (req) => req.baseUrl?.includes('location') || req.path?.includes('location'),
  handler: (req, res) => {
    errorResponse(res, 'Demasiadas solicitudes desde esta IP. Inténtalo de nuevo en unos minutos.', 429);
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Limitador para autenticación y códigos: 30 intentos cada 15 minutos por terminal
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  handler: (req, res) => {
    errorResponse(res, 'Demasiados intentos de acceso o verificación. Bloqueo temporal por seguridad.', 429);
  },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = {
  globalLimiter,
  authLimiter
};
