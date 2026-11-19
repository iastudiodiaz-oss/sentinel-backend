/**
 * CONTROLADOR DE AUTENTICACIÓN (AuthController)
 * Recibe las peticiones HTTP, delega en AuthService y devuelve respuestas estandarizadas.
 */
const authService = require('../services/auth.service');
const { successResponse } = require('../utils/response');

class AuthController {

  async register(req, res, next) {
    try {
      const result = await authService.register(req.body);
      return successResponse(res, result, 'Registro iniciado. Introduce el código enviado a tu correo.', 201);
    } catch (err) {
      next(err);
    }
  }

  async verifyEmail(req, res, next) {
    try {
      const result = await authService.verifyEmail(req.body);
      return successResponse(res, result, 'Cuenta verificada con éxito. Sesión iniciada.', 200);
    } catch (err) {
      next(err);
    }
  }

  async login(req, res, next) {
    try {
      const result = await authService.login(req.body);
      return successResponse(res, result, 'Inicio de sesión correcto.', 200);
    } catch (err) {
      next(err);
    }
  }

  async refreshToken(req, res, next) {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        return res.status(400).json({ success: false, message: 'Refresh token requerido.' });
      }
      const result = await authService.refreshAccessToken(refreshToken);
      return successResponse(res, result, 'Token renovado con éxito.', 200);
    } catch (err) {
      next(err);
    }
  }

  async logout(req, res, next) {
    try {
      const { refreshToken } = req.body;
      const result = await authService.logout(refreshToken);
      return successResponse(res, result, 'Sesión finalizada.');
    } catch (err) {
      next(err);
    }
  }

  async forgotPassword(req, res, next) {
    try {
      const { email } = req.body;
      if (!email || !email.includes('@')) {
        return res.status(400).json({ success: false, message: 'Por favor, introduce un correo electrónico válido.' });
      }
      const result = await authService.forgotPassword(email);
      return successResponse(res, result, result.message, 200);
    } catch (err) {
      next(err);
    }
  }

  async getMe(req, res) {
    return successResponse(res, { user: req.user }, 'Perfil de usuario autenticado.');
  }
}

module.exports = new AuthController();
