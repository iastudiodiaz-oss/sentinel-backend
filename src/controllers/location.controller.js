/**
 * ====================================================================
 * SENTINEL CORE - LOCATION CONTROLLER (Fase 4 & 5)
 * ====================================================================
 */

const locationService = require('../services/location.service');
const { sendSuccess } = require('../utils/response');

class LocationController {
  async updateTelemetry(req, res, next) {
    try {
      const { latitude, longitude, speed, bearing, accuracy, city, activityType, batteryPercentage, isSos } = req.body;
      const telemetry = await locationService.updateTelemetry(req.user.id, {
        latitude,
        longitude,
        speed,
        bearing,
        accuracy,
        city,
        activityType,
        batteryPercentage,
        isSos
      });

      // Emitir vía WebSocket a los amigos si hay conexión
      const io = req.app.get('io');
      if (io) {
        io.emit('location:changed', {
          userId: req.user.id,
          friendCode: req.user.friendCode,
          latitude: telemetry.latitude,
          longitude: telemetry.longitude,
          speed: telemetry.speed,
          battery: telemetry.battery_percentage,
          isSos: telemetry.is_sos,
          isOnline: true
        });
      }

      return sendSuccess(res, telemetry, 'Telemetría actualizada.');
    } catch (err) {
      next(err);
    }
  }

  async setOffline(req, res, next) {
    try {
      const result = await locationService.setOffline(req.user.id);
      const io = req.app.get('io');
      if (io) {
        io.emit('presence:changed', {
          userId: req.user.id,
          friendCode: req.user.friendCode,
          isOnline: false
        });
      }
      return sendSuccess(res, result, 'Estado cambiado a desconectado.');
    } catch (err) {
      next(err);
    }
  }

  async getFriendsTelemetry(req, res, next) {
    try {
      const friends = await locationService.getFriendsTelemetry(req.user.id);
      return sendSuccess(res, friends);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new LocationController();
