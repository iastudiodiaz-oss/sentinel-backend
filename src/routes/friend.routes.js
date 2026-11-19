/**
 * RUTAS DE AMIGOS (FriendRoutes)
 */
const { Router } = require('express');
const friendController = require('../controllers/friend.controller');
const { authenticateJwt } = require('../middlewares/auth.middleware');

const router = Router();

// Todas las rutas de amigos requieren JWT
router.use(authenticateJwt);

// Vincular / Añadir amigo por código
router.post('/add', friendController.sendRequest);

// Obtener amigos con su posición GPS y batería en vivo
router.get('/', friendController.getFriends);

// Eliminar amigo
router.delete('/:friendId', friendController.deleteFriend);

module.exports = router;
