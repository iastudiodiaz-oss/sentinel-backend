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

  /**
   * Vista Web Pública de Emergencia para Policía y Familiares (sin necesidad de app instalada)
   */
  async getPublicSosView(req, res, next) {
    try {
      const { alertId } = req.params;
      const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SENTINEL // ALERTA TÁCTICA SOS</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    body { margin: 0; background: #05080E; color: #FFF; font-family: monospace; }
    .header { background: #0B1422; border-bottom: 2px solid #FF1A35; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; }
    .title { font-size: 18px; font-weight: bold; color: #FF1A35; letter-spacing: 2px; }
    .badge { background: #260A0E; color: #FF1A35; border: 1px solid #FF1A35; padding: 4px 8px; border-radius: 4px; font-size: 11px; }
    #map { height: calc(100vh - 120px); width: 100%; }
    .hud { position: absolute; bottom: 20px; left: 20px; right: 20px; z-index: 1000; background: rgba(11, 20, 34, 0.95); border: 1px solid #00F0FF; border-radius: 14px; padding: 14px 18px; }
    .hud h3 { margin: 0 0 6px 0; color: #00F0FF; font-size: 14px; }
    .hud p { margin: 0; font-size: 12px; color: #8DA2B9; }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">🚨 SENTINEL RESCUE PORTAL</div>
    <div class="badge">EMERGENCIA EN VIVO</div>
  </div>
  <div id="map"></div>
  <div class="hud">
    <h3>BALIZA DE RESCATE ACTIVA // ID: ${alertId}</h3>
    <p id="telem">Cargando telemetría de coordenadas y estado en vivo...</p>
  </div>
  <script>
    const map = L.map('map').setView([42.5987, -5.5671], 16);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
    const marker = L.marker([42.5987, -5.5671]).addTo(map).bindPopup('<b>Posición de Emergencia</b>').openPopup();

    async function refreshTelemetry() {
      try {
        const res = await fetch('/api/sos/public-data/${alertId}');
        if (res.ok) {
          const data = await res.json();
          if (data && data.latitude && data.longitude) {
            marker.setLatLng([data.latitude, data.longitude]);
            map.panTo([data.latitude, data.longitude]);
            document.getElementById('telem').innerText = 'Lat: ' + data.latitude + ' • Lng: ' + data.longitude + ' • Batería: ' + (data.battery_level || '90') + '%';
          }
        }
      } catch(e) {}
    }
    setInterval(refreshTelemetry, 5000);
  </script>
</body>
</html>`;
      res.setHeader('Content-Type', 'text/html');
      return res.send(html);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new SosController();
