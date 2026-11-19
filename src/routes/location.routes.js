/**
 * ====================================================================
 * SENTINEL CORE - LOCATION ROUTES (Fase 4 & 5)
 * ====================================================================
 */

const express = require('express');
const router = express.Router();
const locationController = require('../controllers/location.controller');
const { authenticateJwt } = require('../middlewares/auth.middleware');

router.use(authenticateJwt);

router.post('/update', (req, res, next) => locationController.updateTelemetry(req, res, next));
router.post('/offline', (req, res, next) => locationController.setOffline(req, res, next));
router.get('/friends', (req, res, next) => locationController.getFriendsTelemetry(req, res, next));

module.exports = router;
