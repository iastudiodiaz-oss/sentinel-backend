/**
 * ====================================================================
 * SENTINEL CORE - CHAT CONTROLLER (Fase 5)
 * ====================================================================
 */

const chatService = require('../services/chat.service');
const { sendSuccess } = require('../utils/response');

class ChatController {
  async getOrCreateDirectChat(req, res, next) {
    try {
      const { friendId } = req.body;
      const chat = await chatService.getOrCreateDirectChat(req.user.id, friendId);
      return sendSuccess(res, chat, 'Chat obtenido correctamente.');
    } catch (err) {
      next(err);
    }
  }

  async getUserChats(req, res, next) {
    try {
      const chats = await chatService.getUserChats(req.user.id);
      return sendSuccess(res, chats);
    } catch (err) {
      next(err);
    }
  }

  async getChatMessages(req, res, next) {
    try {
      const { chatId } = req.params;
      const limit = parseInt(req.query.limit, 10) || 50;
      const offset = parseInt(req.query.offset, 10) || 0;
      const messages = await chatService.getChatMessages(req.user.id, chatId, limit, offset);
      return sendSuccess(res, messages);
    } catch (err) {
      next(err);
    }
  }

  async createGroupChat(req, res, next) {
    try {
      const { name, memberIds } = req.body;
      const group = await chatService.createGroupChat(req.user.id, name, memberIds);
      return sendSuccess(res, group, 'Grupo táctico creado con éxito.', 201);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ChatController();
