/**
 * ====================================================================
 * SENTINEL CORE - SCRIPT AUTOMATIZADO DE MIGRACIÓN DE BASE DE DATOS
 * ====================================================================
 * Ejecuta el esquema DDL relacional (schema.sql) en PostgreSQL/Supabase.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const logger = require('../src/utils/logger');

async function runMigration() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    logger.error('ERROR: DATABASE_URL no está definida en el archivo .env');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    logger.info('🔗 Conectando con la base de datos PostgreSQL...');
    const client = await pool.connect();
    logger.info('✅ Conexión establecida con éxito.');

    const schemaPath = path.join(__dirname, 'schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');

    logger.info('🚀 Ejecutando esquema DDL de Sentinel (11 tablas + índices + extensiones)...');
    await client.query(sql);

    logger.info('====================================================');
    logger.info('✅ MIGRACIÓN COMPLETADA EXITOSAMENTE:');
    logger.info('  1. users (Cuentas y perfiles)');
    logger.info('  2. email_verifications (Códigos de 6 cifras)');
    logger.info('  3. refresh_tokens (Sesiones rotativas)');
    logger.info('  4. friendships (Amistades y solicitudes)');
    logger.info('  5. telemetry_live (GPS en tiempo real)');
    logger.info('  6. location_history (Histórico táctico)');
    logger.info('  7. chats (Canales 1-a-1 y grupos)');
    logger.info('  8. chat_participants (Membresías)');
    logger.info('  9. messages (Mensajes cifrados)');
    logger.info(' 10. sos_alerts (Alertas de emergencia)');
    logger.info(' 11. user_devices (Tokens Push FCM)');
    logger.info('====================================================');

    client.release();
    await pool.end();
    process.exit(0);
  } catch (err) {
    logger.error('❌ Error durante la migración de base de datos:', err.message);
    await pool.end();
    process.exit(1);
  }
}

runMigration();
