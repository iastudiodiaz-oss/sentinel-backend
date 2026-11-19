/**
 * ====================================================================
 * SENTINEL CORE - DEVICE ROUTES (Fase 7)
 * ====================================================================
 */

const express = require('express');
const router = express.Router();
const pushService = require('../services/push.service');
const { authenticateToken } = require('../middlewares/auth.middleware');
const { sendSuccess } = require('../utils/response');

router.use(authenticateToken);

router.post('/register', async (req, res, next) => {
  try {
    const { fcmToken, deviceModel, osVersion, appVersion } = req.body;
    const device = await pushService.registerDevice(req.user.id, {
      fcmToken,
      deviceModel,
      osVersion,
      appVersion,
    });
    return sendSuccess(res, device, 'Token de dispositivo FCM registrado.');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
