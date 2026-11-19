/**
 * ====================================================================
 * SENTINEL CORE - CHAT SERVICE (Fase 5)
 * ====================================================================
 * Capa de lógica de negocio para la mensajería táctica cifrada,
 * historial de conversaciones, estados de lectura y chats grupales.
 */

const db = require('../../database/db');
const logger = require('../utils/logger');

class ChatService {
  /**
   * Obtiene o crea un chat privado directo (1 a 1) entre dos usuarios.
   */
  async getOrCreateDirectChat(userId, friendId) {
    // Buscar si ya existe un chat directo entre ambos
    const existingQuery = `
      SELECT c.id, c.type, c.created_at
      FROM chats c
      JOIN chat_participants cp1 ON c.id = cp1.chat_id AND cp1.user_id = $1
      JOIN chat_participants cp2 ON c.id = cp2.chat_id AND cp2.user_id = $2
      WHERE c.type = 'DIRECT'
      LIMIT 1;
    `;
    const existing = await db.query(existingQuery, [userId, friendId]);
    if (existing.rows.length > 0) {
      return existing.rows[0];
    }

    // Si no existe, crear chat y participantes de forma atómica
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      const createChatRes = await client.query(
        `INSERT INTO chats (type) VALUES ('DIRECT') RETURNING *;`
      );
      const newChat = createChatRes.rows[0];

      await client.query(
        `INSERT INTO chat_participants (chat_id, user_id, role) VALUES ($1, $2, 'MEMBER'), ($1, $3, 'MEMBER');`,
        [newChat.id, userId, friendId]
      );

      await client.query('COMMIT');
      return newChat;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Lista todos los chats del usuario con último mensaje y badge de no leídos.
   */
  async getUserChats(userId) {
    const query = `
      SELECT 
        c.id AS chat_id,
        c.name AS group_name,
        c.type,
        c.created_at,
        (
          SELECT json_build_object(
            'id', m.id,
            'sender_id', m.sender_id,
            'message_type', m.message_type,
            'content', m.content,
            'created_at', m.created_at
          )
          FROM messages m
          WHERE m.chat_id = c.id
          ORDER BY m.created_at DESC
          LIMIT 1
        ) AS last_message,
        (
          SELECT COUNT(*)::int
          FROM messages m
          WHERE m.chat_id = c.id 
            AND m.sender_id != $1 
            AND m.status != 'READ'
        ) AS unread_count,
        (
          SELECT json_agg(
            json_build_object(
              'id', u.id,
              'name', u.name,
              'avatar_url', u.avatar_url,
              'is_online', u.is_online,
              'last_seen', u.last_seen
            )
          )
          FROM chat_participants cp
          JOIN users u ON cp.user_id = u.id
          WHERE cp.chat_id = c.id AND u.id != $1
        ) AS other_participants
      FROM chats c
      JOIN chat_participants cp ON c.id = cp.chat_id
      WHERE cp.user_id = $1
      ORDER BY c.created_at DESC;
    `;

    const res = await db.query(query, [userId]);
    return res.rows;
  }

  /**
   * Obtiene el historial de mensajes de un chat con paginación optimizada.
   */
  async getChatMessages(userId, chatId, limit = 50, offset = 0) {
    // Validar que el usuario pertenece al chat
    const membership = await db.query(
      `SELECT role FROM chat_participants WHERE chat_id = $1 AND user_id = $2;`,
      [chatId, userId]
    );

    if (membership.rows.length === 0) {
      const err = new Error('No tienes autorización para ver este chat.');
      err.statusCode = 403;
      throw err;
    }

    const messagesQuery = `
      SELECT 
        m.id,
        m.chat_id,
        m.sender_id,
        u.name AS sender_name,
        u.avatar_url AS sender_avatar,
        m.message_type,
        m.content,
        m.media_url,
        m.metadata,
        m.status,
        m.created_at
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.chat_id = $1
      ORDER BY m.created_at DESC
      LIMIT $2 OFFSET $3;
    `;

    const res = await db.query(messagesQuery, [chatId, limit, offset]);

    // Marcar como leídos los mensajes que no sean del usuario
    await db.query(
      `UPDATE messages 
       SET status = 'READ' 
       WHERE chat_id = $1 AND sender_id != $2 AND status != 'READ';`,
      [chatId, userId]
    );

    return res.rows.reverse(); // Devolver cronológico para la UI
  }

  /**
   * Crea un chat de grupo con participantes autorizados.
   */
  async createGroupChat(creatorId, name, memberIds = []) {
    if (!name || name.trim().length === 0) {
      const err = new Error('El nombre del grupo es obligatorio.');
      err.statusCode = 400;
      throw err;
    }

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      const chatRes = await client.query(
        `INSERT INTO chats (name, type, created_by) VALUES ($1, 'GROUP', $2) RETURNING *;`,
        [name.trim(), creatorId]
      );
      const group = chatRes.rows[0];

      // Insertar creador como ADMIN
      await client.query(
        `INSERT INTO chat_participants (chat_id, user_id, role) VALUES ($1, $2, 'ADMIN');`,
        [group.id, creatorId]
      );

      // Insertar los demás miembros como MEMBER
      for (const memberId of memberIds) {
        if (memberId !== creatorId) {
          await client.query(
            `INSERT INTO chat_participants (chat_id, user_id, role) VALUES ($1, $2, 'MEMBER') ON CONFLICT DO NOTHING;`,
            [group.id, memberId]
          );
        }
      }

      await client.query('COMMIT');
      logger.info(`Grupo creado exitosamente: "${name}" (${group.id})`);
      return group;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

module.exports = new ChatService();
