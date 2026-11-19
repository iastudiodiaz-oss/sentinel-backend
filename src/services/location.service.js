/**
 * ====================================================================
 * SENTINEL CORE - LOCATION & TELEMETRY SERVICE (Fase 4 & 5)
 * ====================================================================
 * Servicio de telemetría de alta frecuencia: GPS satelital, batería,
 * velocidad, cálculo de presencia en línea y radar táctico.
 */

const db = require('../../database/db');
const logger = require('../utils/logger');

class LocationService {
  /**
   * Actualiza la telemetría en vivo del usuario en Supabase PostgreSQL.
   */
  async updateTelemetry(userId, { latitude, longitude, speed = 0.0, bearing = 0.0, accuracy = 0.0, city = '', activityType = 'STILL', batteryPercentage = 100, isSos = false }) {
    const query = `
      INSERT INTO telemetry_live (
        user_id, latitude, longitude, speed, bearing, accuracy, 
        city, activity_type, battery_percentage, is_online, is_sos, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, $10, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        speed = EXCLUDED.speed,
        bearing = EXCLUDED.bearing,
        accuracy = EXCLUDED.accuracy,
        city = EXCLUDED.city,
        activity_type = EXCLUDED.activity_type,
        battery_percentage = EXCLUDED.battery_percentage,
        is_online = TRUE,
        is_sos = EXCLUDED.is_sos,
        updated_at = NOW()
      RETURNING *;
    `;

    const res = await db.query(query, [
      userId,
      parseFloat(latitude),
      parseFloat(longitude),
      parseFloat(speed),
      parseFloat(bearing),
      parseFloat(accuracy),
      city || null,
      activityType || 'STILL',
      parseInt(batteryPercentage, 10),
      isSos === true || isSos === 'true'
    ]);

    // También guardar en el histórico de ubicaciones si hay movimiento significativo
    try {
      await db.query(
        `INSERT INTO location_history (user_id, latitude, longitude, speed, activity_type, battery_percentage, recorded_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW());`,
        [userId, parseFloat(latitude), parseFloat(longitude), parseFloat(speed), activityType, parseInt(batteryPercentage, 10)]
      );
    } catch (e) {
      // No bloqueante
    }

    return res.rows[0];
  }

  /**
   * Marca al usuario como desconectado inmediatamente (al cerrar la app).
   */
  async setOffline(userId) {
    const query = `
      UPDATE telemetry_live
      SET is_online = FALSE, updated_at = NOW()
      WHERE user_id = $1
      RETURNING *;
    `;
    const res = await db.query(query, [userId]);
    return res.rows[0];
  }

  /**
   * Obtiene la telemetría en tiempo real de todos los amigos autorizados.
   * Si un usuario no ha enviado señal en más de 12 segundos, se considera automáticamente 'OFFLINE'.
   */
  async getFriendsTelemetry(userId) {
    const query = `
      SELECT 
        u.id,
        u.name,
        u.email,
        u.friend_code,
        t.latitude,
        t.longitude,
        t.speed,
        t.bearing,
        t.accuracy,
        t.city,
        t.activity_type,
        t.battery_percentage,
        CASE 
          WHEN t.updated_at > (NOW() - INTERVAL '15 seconds') AND t.is_online = TRUE THEN TRUE
          ELSE FALSE
        END AS is_online,
        COALESCE(t.is_sos, FALSE) AS is_sos,
        t.updated_at,
        COALESCE((
          SELECT COUNT(*)::int
          FROM messages m
          JOIN chat_participants cp ON cp.chat_id = m.chat_id AND cp.user_id = $1
          WHERE m.sender_id = u.id AND m.status != 'READ'
        ), 0) AS unread_messages,
        (
          SELECT m.content
          FROM messages m
          JOIN chat_participants cp ON cp.chat_id = m.chat_id AND cp.user_id = $1
          WHERE m.sender_id = u.id AND m.status != 'READ'
          ORDER BY m.created_at DESC
          LIMIT 1
        ) AS last_unread_message,
        (
          SELECT m.id::text
          FROM messages m
          JOIN chat_participants cp ON cp.chat_id = m.chat_id AND cp.user_id = $1
          WHERE m.sender_id = u.id AND m.status != 'READ'
          ORDER BY m.created_at DESC
          LIMIT 1
        ) AS last_unread_message_id
      FROM friendships f
      JOIN users u ON (u.id = CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END)
      LEFT JOIN telemetry_live t ON t.user_id = u.id
      WHERE (f.requester_id = $1 OR f.addressee_id = $1) AND f.status = 'ACCEPTED';
    `;

    const res = await db.query(query, [userId]);
    return res.rows;
  }
}

module.exports = new LocationService();
