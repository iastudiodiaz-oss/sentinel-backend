/**
 * SERVICIO DE GESTIÓN DE AMIGOS & ENLACES (FriendService)
 * Controla invitaciones, aceptación, bloqueo, eliminación y consulta de contactos con telemetría en vivo.
 */
const db = require('../../database/db');

class FriendService {

  /**
   * Enviar solicitud de amistad usando el Código Centinela (ej: SN-8421) o Correo
   */
  async sendRequest(requesterId, identifier) {
    const cleanId = identifier.trim().toUpperCase();

    // Buscar al usuario destino
    const targetRes = await db.query(
      'SELECT id, name, friend_code FROM users WHERE friend_code = $1 OR UPPER(email) = $1',
      [cleanId]
    );

    if (targetRes.rows.length === 0) {
      const err = new Error('No se encontró ningún usuario con ese código o correo.');
      err.statusCode = 404;
      throw err;
    }

    const targetUser = targetRes.rows[0];

    if (targetUser.id === requesterId) {
      const err = new Error('No puedes enviarte una solicitud a ti mismo.');
      err.statusCode = 400;
      throw err;
    }

    // Comprobar si ya existe relación previa
    const checkRes = await db.query(
      `SELECT id, status FROM friendships 
       WHERE (requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1)`,
      [requesterId, targetUser.id]
    );

    if (checkRes.rows.length > 0) {
      const existing = checkRes.rows[0];
      if (existing.status === 'ACCEPTED') {
        const err = new Error('Ya eres amigo de este usuario.');
        err.statusCode = 409;
        throw err;
      }
      if (existing.status === 'BLOCKED') {
        const err = new Error('No es posible vincular con este usuario.');
        err.statusCode = 403;
        throw err;
      }
      if (existing.status === 'PENDING') {
        const err = new Error('Ya existe una solicitud pendiente de confirmación entre vosotros.');
        err.statusCode = 409;
        throw err;
      }
    }

    // Insertar solicitud pendiente (o auto-aceptar si se introduce el código directo para facilitar la vinculación)
    const insertRes = await db.query(
      `INSERT INTO friendships (requester_id, addressee_id, status)
       VALUES ($1, $2, 'ACCEPTED')
       RETURNING id, status, created_at`,
      [requesterId, targetUser.id]
    );

    return {
      friendshipId: insertRes.rows[0].id,
      status: insertRes.rows[0].status,
      friend: targetUser
    };
  }

  /**
   * Listar todos los amigos confirmados con su telemetría en tiempo real (GPS, batería, velocidad, presencia)
   */
  async getFriendsWithTelemetry(userId) {
    const query = `
      SELECT 
        u.id, u.name, u.email, u.phone, u.friend_code, u.avatar_url,
        t.latitude, t.longitude, t.speed, t.bearing, t.accuracy, t.city,
        t.activity_type, t.battery_percentage, t.is_online, t.is_sos, t.updated_at
      FROM friendships f
      JOIN users u ON (u.id = CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END)
      LEFT JOIN telemetry_live t ON t.user_id = u.id
      WHERE (f.requester_id = $1 OR f.addressee_id = $1) AND f.status = 'ACCEPTED'
      ORDER BY t.is_sos DESC, t.is_online DESC, u.name ASC
    `;
    const res = await db.query(query, [userId]);
    return res.rows;
  }

  /**
   * Eliminar o romper enlace con un amigo
   */
  async deleteFriend(userId, friendId) {
    await db.query(
      `DELETE FROM friendships 
       WHERE (requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1)`,
      [userId, friendId]
    );
    return { success: true, message: 'Enlace eliminado.' };
  }
}

module.exports = new FriendService();
