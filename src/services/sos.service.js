/**
 * ====================================================================
 * SENTINEL CORE - SOS SERVICE (Fase 6)
 * ====================================================================
 * Capa de lógica de emergencia táctica para el Botón SOS.
 * Registra alertas, notifica a amigos autorizados y gestiona el ciclo
 * de vida de la alarma hasta su resolución.
 */

const db = require('../../database/db');
const logger = require('../utils/logger');
const pushService = require('./push.service');

class SosService {
  /**
   * Dispara una alerta de emergencia SOS.
   */
  async triggerAlert(userId, { latitude, longitude, address, batteryLevel }) {
    // 1. Guardar la alerta en la base de datos
    const alertQuery = `
      INSERT INTO sos_alerts (user_id, status, latitude, longitude, address, battery_level)
      VALUES ($1, 'ACTIVE', $2, $3, $4, $5)
      RETURNING *;
    `;
    const alertRes = await db.query(alertQuery, [
      userId,
      latitude,
      longitude,
      address || null,
      batteryLevel || null,
    ]);
    const alert = alertRes.rows[0];

    // 2. Obtener los datos del usuario emisor
    const userRes = await db.query(`SELECT id, name, email, phone FROM users WHERE id = $1;`, [userId]);
    const sender = userRes.rows[0];

    // 3. Obtener automáticamente todos los amigos confirmados
    const friendsQuery = `
      SELECT 
        CASE WHEN requester_id = $1 THEN addressee_id ELSE requester_id END AS friend_id
      FROM friendships
      WHERE (requester_id = $1 OR addressee_id = $1) AND status = 'ACCEPTED';
    `;
    const friendsRes = await db.query(friendsQuery, [userId]);
    const friendIds = friendsRes.rows.map(r => r.friend_id);

    logger.warn(`🚨 ALERTA SOS ACTIVADA por usuario ${sender.name} (${userId}). Notificando a ${friendIds.length} amigos.`);

    // 4. Enviar notificación Push (Firebase) a los dispositivos de los amigos
    if (friendIds.length > 0) {
      await pushService.sendToUsers(friendIds, {
        title: `🚨 EMERGENCIA SOS: ${sender.name}`,
        body: `¡${sender.name} necesita ayuda urgente! Pulsa para abrir el radar táctico.`,
        data: {
          type: 'SOS_ALERT',
          alertId: alert.id,
          userId: sender.id,
          userName: sender.name,
          latitude: String(latitude),
          longitude: String(longitude),
        },
      });
    }

    return {
      alert,
      sender,
      notifiedFriendsCount: friendIds.length,
      friendIds,
    };
  }

  /**
   * Cancela / Resuelve una alerta de SOS activa.
   */
  async resolveAlert(userId, alertId) {
    const query = `
      UPDATE sos_alerts
      SET status = 'RESOLVED', resolved_at = NOW()
      WHERE id = $1 AND user_id = $2 AND status = 'ACTIVE'
      RETURNING *;
    `;
    const res = await db.query(query, [alertId, userId]);

    if (res.rows.length === 0) {
      const err = new Error('No se encontró la alerta SOS activa o no eres el propietario.');
      err.statusCode = 404;
      throw err;
    }

    const alert = res.rows[0];
    logger.info(`✅ Alerta SOS ${alertId} resuelta por usuario ${userId}.`);
    return alert;
  }

  /**
   * Obtiene las alertas SOS activas de los amigos del usuario.
   */
  async getActiveFriendAlerts(userId) {
    const query = `
      SELECT 
        s.id AS alert_id,
        s.user_id,
        u.name AS user_name,
        u.phone AS user_phone,
        u.avatar_url,
        s.latitude,
        s.longitude,
        s.address,
        s.battery_level,
        s.created_at
      FROM sos_alerts s
      JOIN users u ON s.user_id = u.id
      JOIN friendships f ON (
        (f.requester_id = $1 AND f.addressee_id = s.user_id) OR
        (f.addressee_id = $1 AND f.requester_id = s.user_id)
      )
      WHERE s.status = 'ACTIVE' AND f.status = 'ACCEPTED'
      ORDER BY s.created_at DESC;
    `;

    const res = await db.query(query, [userId]);
    return res.rows;
  }
}

module.exports = new SosService();
