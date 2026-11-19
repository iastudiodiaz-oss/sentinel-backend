/**
 * MIDDLEWARE DE AUTENTICACIÓN JWT
 * Protege rutas privadas extrayendo y validando el Bearer token del encabezado HTTP.
 */
const { verifyAccessToken } = require('../utils/token');
const { errorResponse } = require('../utils/response');

const authenticateJwt = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return errorResponse(res, 'Acceso denegado. Token de autorización no suministrado.', 401);
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = verifyAccessToken(token);
    req.user = decoded; // Inyecta datos del usuario autenticado en la petición (id, email, friend_code)
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return errorResponse(res, 'El token de sesión ha expirado. Utiliza tu refresh token.', 401);
    }
    return errorResponse(res, 'Token de autenticación inválido.', 403);
  }
};

module.exports = {
  authenticateJwt,
  authenticateToken: authenticateJwt
};
