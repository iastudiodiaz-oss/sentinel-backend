/**
 * VALIDACIÓN DE DATOS DE ENTRADA
 * Comprueba que los campos requeridos estén presentes y tengan el formato adecuado.
 */
const { errorResponse } = require('../utils/response');

const validateRegister = (req, res, next) => {
  const { name, email, password } = req.body;

  if (!name || name.trim().length < 2) {
    return errorResponse(res, 'El nombre debe tener al menos 2 caracteres.', 400);
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email.trim())) {
    return errorResponse(res, 'Debes introducir un correo electrónico válido.', 400);
  }

  if (!password || password.length < 6) {
    return errorResponse(res, 'La contraseña debe contener al menos 6 caracteres.', 400);
  }

  next();
};

const validateLogin = (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return errorResponse(res, 'Debes suministrar email y contraseña.', 400);
  }

  next();
};

const validateVerifyEmail = (req, res, next) => {
  const { email, code } = req.body;

  if (!email || !code || code.trim().length !== 6) {
    return errorResponse(res, 'Debes suministrar el email y el código de 6 dígitos.', 400);
  }

  next();
};

module.exports = {
  validateRegister,
  validateLogin,
  validateVerifyEmail
};
