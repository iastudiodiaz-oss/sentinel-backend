/**
 * CONEXIÓN Y POOL DE BASE DE DATOS (PostgreSQL)
 * Maneja pool de conexiones de alta velocidad y consultas parametrizadas contra inyección SQL.
 */
const { Pool } = require('pg');
require('dotenv').config();

const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'sentinel_db',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      max: 20, // Máximo 20 conexiones simultáneas por instancia
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000
    };

const pool = new Pool(poolConfig);

pool.on('connect', () => {
  // Conexión viva en el pool
});

pool.on('error', (err) => {
  console.error('[DATABASE] Error crítico en el pool de PostgreSQL:', err.message);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
  pool
};
