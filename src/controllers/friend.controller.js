/**
 * CONTROLADOR DE AMISTAD (FriendController)
 */
const friendService = require('../services/friend.service');
const { successResponse } = require('../utils/response');

class FriendController {

  async sendRequest(req, res, next) {
    try {
      const { code } = req.body;
      if (!code) {
        return res.status(400).json({ success: false, message: 'Código o correo requerido.' });
      }
      const result = await friendService.sendRequest(req.user.id, code);
      return successResponse(res, result, 'Amigo vinculado correctamente.', 201);
    } catch (err) {
      next(err);
    }
  }

  async getFriends(req, res, next) {
    try {
      const friends = await friendService.getFriendsWithTelemetry(req.user.id);
      return successResponse(res, { friends }, 'Lista de amigos obtenida.');
    } catch (err) {
      next(err);
    }
  }

  async deleteFriend(req, res, next) {
    try {
      const { friendId } = req.params;
      const result = await friendService.deleteFriend(req.user.id, friendId);
      return successResponse(res, result, 'Amigo eliminado.');
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new FriendController();
