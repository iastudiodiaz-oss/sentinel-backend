/**
 * ====================================================================
 * SENTINEL CORE - PUSH SERVICE (FCM) (Fase 7)
 * ====================================================================
 * Gestión de notificaciones Push mediante Firebase Cloud Messaging (Plan Gratuito).
 * Gestiona el registro de tokens de dispositivo en la base de datos
 * y el despacho de notificaciones a los dispositivos Android.
 */

const db = require('../../database/db');
const logger = require('../utils/logger');

class PushService {
  /**
   * Registra o actualiza el token FCM de un dispositivo.
   */
  async registerDevice(userId, { fcmToken, deviceModel, osVersion, appVersion }) {
    if (!fcmToken) return null;

    const query = `
      INSERT INTO user_devices (user_id, fcm_token, device_model, os_version, app_version, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (user_id, fcm_token)
      DO UPDATE SET 
        device_model = EXCLUDED.device_model,
        os_version = EXCLUDED.os_version,
        app_version = EXCLUDED.app_version,
        updated_at = NOW()
      RETURNING *;
    `;

    const res = await db.query(query, [
      userId,
      fcmToken,
      deviceModel || 'Android Device',
      osVersion || 'Android',
      appVersion || '1.0.0',
    ]);

    logger.info(`📱 Dispositivo registrado con éxito para el usuario ${userId}`);
    return res.rows[0];
  }

  /**
   * Envía una notificación Push a una lista de usuarios.
   */
  async sendToUsers(userIds, { title, body, data = {} }) {
    if (!userIds || userIds.length === 0) return;

    try {
      // 1. Obtener todos los tokens FCM activos de estos usuarios
      const tokensQuery = `
        SELECT fcm_token, user_id 
        FROM user_devices 
        WHERE user_id = ANY($1::uuid[]) AND fcm_token IS NOT NULL;
      `;
      const res = await db.query(tokensQuery, [userIds]);
      const tokens = res.rows.map(r => r.fcm_token);

      if (tokens.length === 0) {
        logger.info(`ℹ️ No hay tokens FCM registrados para los usuarios objetivo.`);
        return;
      }

      logger.info(`🔔 Despachando notificación Push [${title}] a ${tokens.length} dispositivos.`);

      // Si Firebase Admin SDK estuviera inicializado con serviceAccount.json se usaría aquí.
      // Por defecto durante desarrollo emite el log estructurado para no requerir configuración forzada de Google Cloud de inmediato.
      if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_SERVER_KEY) {
        // Enviar vía API HTTP v1 de Firebase
      } else {
        logger.info(`[FCM-SIMULATION] Notificación simulada para ${tokens.length} tokens: ${title} - ${body}`);
      }
    } catch (err) {
      logger.error('Error al enviar notificación push:', err.message);
    }
  }
}

module.exports = new PushService();
