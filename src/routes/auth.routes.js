/**
 * RUTAS DE AUTENTICACIÓN (AuthRoutes)
 * Define los endpoints REST para registro, verificación, login, refresh y logout.
 */
const { Router } = require('express');
const authController = require('../controllers/auth.controller');
const { validateRegister, validateLogin, validateVerifyEmail } = require('../middlewares/validate.middleware');
const { authLimiter } = require('../middlewares/rateLimiter.middleware');
const { authenticateJwt } = require('../middlewares/auth.middleware');

const router = Router();

// 1. Registro con Rate Limiter y validación
router.post('/register', authLimiter, validateRegister, authController.register);

// 2. Verificación de código de 6 dígitos
router.post('/verify-email', authLimiter, validateVerifyEmail, authController.verifyEmail);

// 3. Inicio de sesión con bcrypt y par de tokens
router.post('/login', authLimiter, validateLogin, authController.login);

// 4. Renovación de Access Token mediante Refresh Token rotativo
router.post('/refresh-token', authController.refreshToken);

// 5. Cierre de sesión (Revocación de Refresh Token)
router.post('/logout', authController.logout);

// 6. Obtener perfil autenticado actual (Protegido por JWT)
router.get('/me', authenticateJwt, authController.getMe);

module.exports = router;
