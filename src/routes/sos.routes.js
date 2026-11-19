/**
 * ====================================================================
 * SENTINEL CORE - SOS ROUTES (Fase 6)
 * ====================================================================
 */

const express = require('express');
const router = express.Router();
const sosController = require('../controllers/sos.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');

// Ruta pública de emergencia sin token para acceso de Policía/Familiares por enlace
router.get('/public-view/:alertId', (req, res, next) => sosController.getPublicSosView(req, res, next));

router.use(authenticateToken);

router.post('/trigger', (req, res, next) => sosController.triggerAlert(req, res, next));
router.post('/resolve/:alertId', (req, res, next) => sosController.resolveAlert(req, res, next));
router.get('/active', (req, res, next) => sosController.getActiveFriendAlerts(req, res, next));

module.exports = router;
