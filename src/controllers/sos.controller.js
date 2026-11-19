/**
 * ====================================================================
 * SENTINEL CORE - SOS CONTROLLER (Fase 6)
 * ====================================================================
 */

const sosService = require('../services/sos.service');
const { sendSuccess } = require('../utils/response');

class SosController {
  async triggerAlert(req, res, next) {
    try {
      const { latitude, longitude, address, batteryLevel } = req.body;
      const result = await sosService.triggerAlert(req.user.id, {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        address,
        batteryLevel: batteryLevel ? parseInt(batteryLevel, 10) : null,
      });

      // Notificar vía Socket.IO si está disponible en la app
      const io = req.app.get('io');
      if (io) {
        result.friendIds.forEach(friendId => {
          io.to(`user:${friendId}`).emit('sos:broadcast', {
            alertId: result.alert.id,
            user: result.sender,
            latitude: result.alert.latitude,
            longitude: result.alert.longitude,
            address: result.alert.address,
            batteryLevel: result.alert.battery_level,
            createdAt: result.alert.created_at,
          });
        });
      }

      return sendSuccess(res, result, 'Alerta SOS activada y transmitida a todos los contactos.', 201);
    } catch (err) {
      next(err);
    }
  }

  async resolveAlert(req, res, next) {
    try {
      const { alertId } = req.params;
      const resolved = await sosService.resolveAlert(req.user.id, alertId);

      const io = req.app.get('io');
      if (io) {
        io.emit('sos:resolved', { alertId, resolvedAt: resolved.resolved_at });
      }

      return sendSuccess(res, resolved, 'Alerta SOS resuelta exitosamente.');
    } catch (err) {
      next(err);
    }
  }

  async getActiveFriendAlerts(req, res, next) {
    try {
      const alerts = await sosService.getActiveFriendAlerts(req.user.id);
      return sendSuccess(res, alerts);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new SosController();
