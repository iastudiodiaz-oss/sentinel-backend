/**
 * ====================================================================
 * SENTINEL CORE - CHAT ROUTES (Fase 5)
 * ====================================================================
 */

const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chat.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');

// Todas las rutas de chat requieren autenticación JWT
router.use(authenticateToken);

router.get('/', (req, res, next) => chatController.getUserChats(req, res, next));
router.post('/direct', (req, res, next) => chatController.getOrCreateDirectChat(req, res, next));
router.get('/:chatId/messages', (req, res, next) => chatController.getChatMessages(req, res, next));
router.post('/group', (req, res, next) => chatController.createGroupChat(req, res, next));

module.exports = router;
