/**
 * GESTOR PRINCIPAL DE WEBSOCKETS (Socket.IO)
 * Conexión autenticada por JWT, presencia en vivo y enrutamiento de eventos tácticos.
 */
const { Server } = require('socket.io');
const { verifyAccessToken } = require('../utils/token');
const db = require('../../database/db');
const logger = require('../utils/logger');

let io = null;

const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    },
    pingInterval: 10000,
    pingTimeout: 5000
  });

  // Middleware de Autenticación de WebSocket en el Handshake
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];

    if (!token) {
      return next(new Error('Autenticación fallida: Token no suministrado.'));
    }

    try {
      const decoded = verifyAccessToken(token);
      socket.user = decoded; // { id, email, friendCode }
      next();
    } catch (err) {
      next(new Error('Autenticación fallida: Token inválido o expirado.'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.user.id;
    const friendCode = socket.user.friendCode;
    logger.info(`[SOCKET] Usuario conectado: ${friendCode} (${socket.id})`);

    // 1. Unirse a salas privadas personales para recibir mensajes directos y alertas
    socket.join(`user:${userId}`);
    socket.join(`code:${friendCode}`);

    // 2. Marcar al usuario como EN LÍNEA en la base de datos
    try {
      await db.query(
        `INSERT INTO telemetry_live (user_id, latitude, longitude, is_online, updated_at)
         VALUES ($1, 0.0, 0.0, TRUE, CURRENT_TIMESTAMP)
         ON CONFLICT (user_id) DO UPDATE SET is_online = TRUE, updated_at = CURRENT_TIMESTAMP`,
        [userId]
      );

      // Notificar a todos sus amigos que ha entrado en línea
      notifyFriendsPresence(socket, userId, true);
    } catch (err) {
      logger.error('[SOCKET] Error actualizando estado online:', err.message);
    }

    // 3. Evento: Actualización de Ubicación GPS en tiempo real
    socket.on('location:update', async (data) => {
      try {
        const { latitude, longitude, speed = 0, battery = 100, mode = 'STILL', bearing = 0, accuracy = 0, city = '' } = data;

        await db.query(
          `UPDATE telemetry_live 
           SET latitude = $1, longitude = $2, speed = $3, battery_percentage = $4, activity_type = $5, 
               bearing = $6, accuracy = $7, city = $8, is_online = TRUE, updated_at = CURRENT_TIMESTAMP
           WHERE user_id = $9`,
          [latitude, longitude, speed, battery, mode, bearing, accuracy, city, userId]
        );

        // Transmitir posición GPS solo a amigos autorizados
        broadcastToFriends(userId, 'location:changed', {
          userId,
          friendCode,
          latitude,
          longitude,
          speed,
          battery,
          mode,
          city,
          timestamp: Date.now()
        });
      } catch (err) {
        logger.error('[SOCKET] Error procesando ubicación:', err.message);
      }
    });

    // 4. Evento: Envío de Mensaje de Chat en Tiempo Real
    socket.on('chat:send', async (data, ack) => {
      try {
        const { toUserId, toFriendCode, content, type = 'TEXT', mediaUrl = null } = data;

        // Guardar mensaje en base de datos
        // ... (Se delega o inserta directamente)
        const msgPayload = {
          id: require('crypto').randomUUID(),
          fromUserId: userId,
          fromFriendCode: friendCode,
          content,
          type,
          mediaUrl,
          status: 'SENT',
          timestamp: Date.now()
        };

        // Emitir a la sala del destinatario
        io.to(`user:${toUserId}`).to(`code:${toFriendCode}`).emit('chat:message', msgPayload);

        if (typeof ack === 'function') ack({ success: true, message: msgPayload });
      } catch (err) {
        if (typeof ack === 'function') ack({ success: false, error: err.message });
      }
    });

    // 5. Evento: Indicador de "Escribiendo..."
    socket.on('chat:typing', (data) => {
      const { toUserId, isTyping } = data;
      socket.to(`user:${toUserId}`).emit('chat:user_typing', {
        fromUserId: userId,
        fromFriendCode: friendCode,
        isTyping
      });
    });

    // 6. Evento: Disparo de Alerta de Emergencia SOS
    socket.on('sos:trigger', async (data) => {
      try {
        const { latitude, longitude, message = '¡EMERGENCIA SOS ACTIVADA!' } = data;

        await db.query(
          `INSERT INTO sos_alerts (user_id, latitude, longitude, message, is_active)
           VALUES ($1, $2, $3, $4, TRUE)`,
          [userId, latitude, longitude, message]
        );

        await db.query(
          'UPDATE telemetry_live SET is_sos = TRUE, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1',
          [userId]
        );

        // Notificar con máxima prioridad a todos los amigos autorizados
        broadcastToFriends(userId, 'sos:alert', {
          userId,
          friendCode,
          name: socket.user.name || 'Amigo',
          latitude,
          longitude,
          message,
          timestamp: Date.now()
        });

        logger.warn(`[SOS] Alerta activada por usuario ${friendCode} en (${latitude}, ${longitude})`);
      } catch (err) {
        logger.error('[SOCKET] Error activando SOS:', err.message);
      }
    });

    // 7. Evento: Cancelación de Alerta SOS
    socket.on('sos:cancel', async () => {
      try {
        await db.query('UPDATE sos_alerts SET is_active = FALSE, resolved_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND is_active = TRUE', [userId]);
        await db.query('UPDATE telemetry_live SET is_sos = FALSE, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1', [userId]);

        broadcastToFriends(userId, 'sos:cancelled', { userId, friendCode });
      } catch (err) {
        logger.error('[SOCKET] Error cancelando SOS:', err.message);
      }
    });

    // 8. Desconexión: Marcar inmediatamente como DESCONECTADO
    socket.on('disconnect', async () => {
      logger.info(`[SOCKET] Usuario desconectado: ${friendCode}`);
      try {
        await db.query('UPDATE telemetry_live SET is_online = FALSE, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1', [userId]);
        notifyFriendsPresence(socket, userId, false);
      } catch (err) {
        logger.error('[SOCKET] Error marcando offline:', err.message);
      }
    });
  });

  return io;
};

/**
 * Notifica a los amigos cuando un usuario entra o sale de la app
 */
async function notifyFriendsPresence(socket, userId, isOnline) {
  try {
    const friendsRes = await db.query(
      `SELECT CASE WHEN requester_id = $1 THEN addressee_id ELSE requester_id END AS friend_id
       FROM friendships
       WHERE (requester_id = $1 OR addressee_id = $1) AND status = 'ACCEPTED'`,
      [userId]
    );

    friendsRes.rows.forEach((row) => {
      io.to(`user:${row.friend_id}`).emit('presence:changed', {
        userId,
        friendCode: socket.user?.friendCode,
        isOnline,
        timestamp: Date.now()
      });
    });
  } catch (err) {
    logger.error('[SOCKET] Error notificando presencia a amigos:', err.message);
  }
}

/**
 * Emite un evento únicamente a la lista de amigos autorizados del usuario
 */
async function broadcastToFriends(userId, eventName, payload) {
  if (!io) return;
  try {
    const friendsRes = await db.query(
      `SELECT CASE WHEN requester_id = $1 THEN addressee_id ELSE requester_id END AS friend_id
       FROM friendships
       WHERE (requester_id = $1 OR addressee_id = $1) AND status = 'ACCEPTED'`,
      [userId]
    );

    friendsRes.rows.forEach((row) => {
      io.to(`user:${row.friend_id}`).emit(eventName, payload);
    });
  } catch (err) {
    logger.error(`[SOCKET] Error en broadcastToFriends (${eventName}):`, err.message);
  }
}

const getIo = () => io;

module.exports = {
  initSocket,
  getIo
};
