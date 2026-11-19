/**
 * MIDDLEWARE DE LIMITACIÓN DE TASA (Rate Limiter)
 * Protege el servidor contra ataques de fuerza bruta y denegación de servicio (DoS).
 */
const rateLimit = require('express-rate-limit');
const { errorResponse } = require('../utils/response');

// Limitador general para toda la API: 120 peticiones cada 15 minutos por IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  handler: (req, res) => {
    errorResponse(res, 'Demasiadas solicitudes desde esta IP. Inténtalo de nuevo en 15 minutos.', 429);
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Limitador estricto para rutas de autenticación y códigos: 6 intentos cada 15 minutos
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 6,
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
