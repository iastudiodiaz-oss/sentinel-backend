/**
 * =========================================================================
 * SENTINEL CORE // SERVIDOR PRINCIPAL DE PRODUCCIÓN (Node.js + Express + Socket.IO)
 * Diseñado bajo Clean Architecture, Principios SOLID y Ciberseguridad Estricta.
 * =========================================================================
 */
require('dotenv').config();
const http = require('http');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

// Middlewares propios
const { globalLimiter } = require('./src/middlewares/rateLimiter.middleware');
const errorHandler = require('./src/middlewares/error.middleware');
const logger = require('./src/utils/logger');

// Motor de WebSockets
const { initSocket } = require('./src/sockets/socketManager');

// Rutas API
const authRoutes = require('./src/routes/auth.routes');
const friendRoutes = require('./src/routes/friend.routes');
const chatRoutes = require('./src/routes/chat.routes');
const sosRoutes = require('./src/routes/sos.routes');
const deviceRoutes = require('./src/routes/device.routes');
const locationRoutes = require('./src/routes/location.routes');

const app = express();
const server = http.createServer(app);

// Inicializar WebSockets y enlazar con Express
const io = initSocket(server);
app.set('io', io);

// -------------------------------------------------------------------------
// 1. CIBERSEGURIDAD & CABECERAS HTTP
// -------------------------------------------------------------------------
app.use(helmet());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Limitador global de peticiones
app.use('/api/', globalLimiter);

// -------------------------------------------------------------------------
// 2. ENRUTADOR DE LA API REST
// -------------------------------------------------------------------------
app.get('/health', (req, res) => {
  res.json({
    status: 'HEALTHY',
    service: 'Sentinel Core API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/sos', sosRoutes);
app.use('/api/device', deviceRoutes);
app.use('/api/location', locationRoutes);

// Manejador de rutas no encontradas (404)
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Ruta no encontrada: [${req.method}] ${req.originalUrl}`
  });
});

// Middleware Global de Errores (debe ser el último)
app.use(errorHandler);

// -------------------------------------------------------------------------
// 3. WEBSOCKETS INICIALIZADOS CORRECTAMENTE
// -------------------------------------------------------------------------

// -------------------------------------------------------------------------
// 4. ARRANQUE DEL SERVIDOR
// -------------------------------------------------------------------------
const PORT = parseInt(process.env.PORT || '3000', 10);

server.listen(PORT, '0.0.0.0', () => {
  logger.info(`====================================================`);
  logger.info(`🛡️ SENTINEL CORE BACKEND INICIADO EN PUERTO: ${PORT}`);
  logger.info(`🛰️ WebSockets Socket.IO: ACTIVO`);
  logger.info(`🔒 Seguridad (Helmet, JWT, Rate Limiter): ACTIVA`);
  logger.info(`🌐 Escuchando en: http://localhost:${PORT}`);
  logger.info(`====================================================`);
});

// -------------------------------------------------------------------------
// 5. APAGADO ORDENADO (Graceful Shutdown)
// -------------------------------------------------------------------------
const gracefulShutdown = () => {
  logger.info('Cerrando servidor Sentinel de forma ordenada...');
  server.close(() => {
    logger.info('Servidor HTTP y WebSockets cerrados.');
    process.exit(0);
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
