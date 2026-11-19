/**
 * UTILIDADES CRIPTOGRÁFICAS Y GESTIÓN DE TOKENS JWT
 * Maneja hashing de contraseñas con bcrypt, emisión de tokens y códigos aleatorios.
 */
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
require('dotenv').config();

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'sentinel_fallback_access_key_2026';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'sentinel_fallback_refresh_key_2026';
const ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '30d';
const REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '90d';

/**
 * Hash seguro de contraseña con salt rounds de grado militar (10)
 */
const hashPassword = async (plainPassword) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plainPassword, salt);
};

/**
 * Comprobación de contraseña contra hash
 */
const comparePassword = async (plainPassword, hashedPassword) => {
  return bcrypt.compare(plainPassword, hashedPassword);
};

/**
 * Emite un Access Token de corta duración para llamadas autenticadas a la API y WebSocket
 */
const generateAccessToken = (payload) => {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES_IN });
};

/**
 * Emite un Refresh Token de larga duración para renovar sesiones
 */
const generateRefreshToken = (payload) => {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES_IN });
};

/**
 * Verifica y decodifica un Access Token
 */
const verifyAccessToken = (token) => {
  return jwt.verify(token, ACCESS_SECRET);
};

/**
 * Verifica y decodifica un Refresh Token
 */
const verifyRefreshToken = (token) => {
  return jwt.verify(token, REFRESH_SECRET);
};

/**
 * Genera un código criptográfico de 6 dígitos para verificación por email
 */
const generateSixDigitCode = () => {
  return crypto.randomInt(100000, 999999).toString();
};

/**
 * Hash de código de verificación para que no se guarde en texto plano en la BD
 */
const hashCode = (code) => {
  return crypto.createHash('sha256').update(code).digest('hex');
};

module.exports = {
  hashPassword,
  comparePassword,
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  generateSixDigitCode,
  hashCode
};
