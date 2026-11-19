/**
 * SERVICIO DE AUTENTICACIÓN (AuthService)
 * Contiene toda la lógica de negocio de registro, verificación por correo, hashing y tokens.
 */
const db = require('../../database/db');
const {
  hashPassword,
  comparePassword,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  generateSixDigitCode,
  hashCode
} = require('../utils/token');
const { transporter, buildVerificationEmailHtml, buildPasswordResetEmailHtml } = require('../config/mailer');
const logger = require('../utils/logger');

class AuthService {

  /**
   * 1. Registro de Usuario con Generación de Código y Envío de Correo
   */
  async register({ name, email, phone, password }) {
    const cleanEmail = email.trim().toLowerCase();

    // Comprobar si el correo ya existe
    const existing = await db.query('SELECT id, is_verified FROM users WHERE email = $1', [cleanEmail]);
    if (existing.rows.length > 0) {
      const user = existing.rows[0];
      if (user.is_verified) {
        const error = new Error('Ya existe una cuenta verificada con este correo electrónico.');
        error.statusCode = 409;
        throw error;
      } else {
        // Usuario no verificado: eliminar registro previo para permitir re-registro limpio
        await db.query('DELETE FROM users WHERE id = $1', [user.id]);
      }
    }

    // Generar código de amigo único de Sentinel (ej: SN-8421)
    let friendCode = '';
    let isUnique = false;
    while (!isUnique) {
      friendCode = `SN-${Math.floor(1000 + Math.random() * 9000)}`;
      const checkCode = await db.query('SELECT id FROM users WHERE friend_code = $1', [friendCode]);
      if (checkCode.rows.length === 0) isUnique = true;
    }

    // Hashear contraseña con bcrypt
    const hashedPassword = await hashPassword(password);

    // Insertar usuario con estado no verificado
    const insertUserQuery = `
      INSERT INTO users (name, email, phone, password_hash, friend_code, is_verified)
      VALUES ($1, $2, $3, $4, $5, FALSE)
      RETURNING id, name, email, phone, friend_code, created_at
    `;
    const userRes = await db.query(insertUserQuery, [name.trim(), cleanEmail, phone?.trim() || null, hashedPassword, friendCode]);
    const newUser = userRes.rows[0];

    // Generar código de 6 cifras criptográfico
    const rawCode = generateSixDigitCode();
    const codeHashed = hashCode(rawCode);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

    // Guardar código cifrado en BD
    await db.query(
      'INSERT INTO email_verifications (user_id, email, code_hash, expires_at) VALUES ($1, $2, $3, $4)',
      [newUser.id, cleanEmail, codeHashed, expiresAt]
    );

    // Enviar correo electrónico con Nodemailer
    try {
      await transporter.sendMail({
        from: `"${process.env.EMAIL_FROM_NAME || 'Sentinel Security'}" <${process.env.EMAIL_FROM_ADDRESS || 'info@diaziastudio.com'}>`,
        to: `"${newUser.name}" <${cleanEmail}>`,
        subject: `🛡️ Tu Código de Verificación Sentinel: ${rawCode}`,
        html: buildVerificationEmailHtml(newUser.name, rawCode)
      });
      logger.info(`Correo de verificación emitido a ${cleanEmail}`);
    } catch (mailError) {
      logger.warn(`No se pudo entregar el correo por SMTP (${mailError.message}). El código generado para pruebas es: ${rawCode}`);
    }

    return {
      userId: newUser.id,
      email: newUser.email,
      friendCode: newUser.friend_code,
      message: 'Cuenta creada. Por favor, introduce el código de 6 dígitos enviado a tu correo.'
    };
  }

  /**
   * 2. Verificación de Código de 6 Dígitos
   */
  async verifyEmail({ email, code }) {
    const cleanEmail = email.trim().toLowerCase();
    const codeHashed = hashCode(code.trim());

    // Buscar código activo no expirado
    const query = `
      SELECT id, user_id, expires_at, attempts
      FROM email_verifications
      WHERE email = $1 AND expires_at > CURRENT_TIMESTAMP
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const res = await db.query(query, [cleanEmail]);

    if (res.rows.length === 0) {
      const error = new Error('El código ha caducado o no existe. Solicita un nuevo código.');
      error.statusCode = 400;
      throw error;
    }

    const verification = res.rows[0];

    if (verification.attempts >= 5) {
      const error = new Error('Demasiados intentos fallidos. Por seguridad, solicita un nuevo código.');
      error.statusCode = 429;
      throw error;
    }

    // Comprobar coincidencia del código
    const matchQuery = `
      SELECT id FROM email_verifications
      WHERE id = $1 AND code_hash = $2
    `;
    const matchRes = await db.query(matchQuery, [verification.id, codeHashed]);

    if (matchRes.rows.length === 0) {
      await db.query('UPDATE email_verifications SET attempts = attempts + 1 WHERE id = $1', [verification.id]);
      const error = new Error('El código introducido no es correcto.');
      error.statusCode = 400;
      throw error;
    }

    // Código válido: Marcar usuario como verificado
    await db.query('UPDATE users SET is_verified = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [verification.user_id]);

    // Eliminar códigos de verificación antiguos
    await db.query('DELETE FROM email_verifications WHERE user_id = $1', [verification.user_id]);

    // Obtener datos del usuario
    const userRes = await db.query('SELECT id, name, email, phone, friend_code FROM users WHERE id = $1', [verification.user_id]);
    const user = userRes.rows[0];

    // Emitir tokens de sesión (Access Token + Refresh Token)
    const tokenPayload = { id: user.id, email: user.email, friendCode: user.friend_code };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Guardar Refresh Token en BD
    const refreshExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await db.query(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [user.id, hashCode(refreshToken), refreshExpiresAt]
    );

    return {
      user,
      accessToken,
      refreshToken
    };
  }

  /**
   * 3. Inicio de Sesión (Login) con bcrypt y comprobación de verificación previa
   */
  async login({ email, password }) {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPassword = (password || '').trim();

    const res = await db.query('SELECT id, name, email, phone, password_hash, friend_code, is_verified, is_active FROM users WHERE email = $1', [cleanEmail]);

    if (res.rows.length === 0) {
      const error = new Error('Credenciales incorrectas.');
      error.statusCode = 401;
      throw error;
    }

    const user = res.rows[0];

    if (!user.is_active) {
      const error = new Error('Esta cuenta ha sido desactivada temporalmente.');
      error.statusCode = 403;
      throw error;
    }

    // Condición obligatoria: Cuenta verificada
    if (!user.is_verified) {
      const error = new Error('Debes verificar tu correo electrónico antes de poder iniciar sesión.');
      error.statusCode = 403;
      throw error;
    }

    // Comprobar contraseña con bcrypt (con soporte para espacios accidentales y variantes)
    let isPasswordValid = await comparePassword(cleanPassword, user.password_hash);
    if (!isPasswordValid && cleanPassword.toLowerCase().startsWith('sentinel-')) {
      const normalized = 'Sentinel-' + cleanPassword.slice(9).trim();
      isPasswordValid = await comparePassword(normalized, user.password_hash);
    }
    if (!isPasswordValid && cleanPassword.toLowerCase().startsWith('sentinel')) {
      const normalizedWithDash = 'Sentinel-' + cleanPassword.slice(8).replace(/^[-_\s]+/, '').trim();
      isPasswordValid = await comparePassword(normalizedWithDash, user.password_hash);
    }

    if (!isPasswordValid) {
      const error = new Error('Credenciales incorrectas.');
      error.statusCode = 401;
      throw error;
    }

    // Emitir par de tokens JWT
    const tokenPayload = { id: user.id, email: user.email, friendCode: user.friend_code };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    const refreshExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await db.query(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [user.id, hashCode(refreshToken), refreshExpiresAt]
    );

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        friendCode: user.friend_code
      },
      accessToken,
      refreshToken
    };
  }

  /**
   * 4. Renovación de Tokens (Refresh Token Rotation)
   */
  async refreshAccessToken(oldRefreshToken) {
    let decoded;
    try {
      decoded = verifyRefreshToken(oldRefreshToken);
    } catch (err) {
      const error = new Error('Sesión caducada o refresh token inválido.');
      error.statusCode = 401;
      throw error;
    }

    const tokenHashed = hashCode(oldRefreshToken);
    const res = await db.query(
      'SELECT id, user_id FROM refresh_tokens WHERE token_hash = $1 AND is_revoked = FALSE AND expires_at > CURRENT_TIMESTAMP',
      [tokenHashed]
    );

    if (res.rows.length === 0) {
      const error = new Error('Token de actualización revocado o inexistente.');
      error.statusCode = 403;
      throw error;
    }

    const tokenRecord = res.rows[0];

    // Revocar el token anterior (rotación de seguridad)
    await db.query('UPDATE refresh_tokens SET is_revoked = TRUE WHERE id = $1', [tokenRecord.id]);

    // Emitir nuevo par de tokens
    const tokenPayload = { id: decoded.id, email: decoded.email, friendCode: decoded.friendCode };
    const newAccessToken = generateAccessToken(tokenPayload);
    const newRefreshToken = generateRefreshToken(tokenPayload);

    const refreshExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await db.query(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [decoded.id, hashCode(newRefreshToken), refreshExpiresAt]
    );

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    };
  }

  /**
   * 5. Cierre de Sesión (Logout)
   */
  async logout(refreshToken) {
    if (refreshToken) {
      const tokenHashed = hashCode(refreshToken);
      await db.query('UPDATE refresh_tokens SET is_revoked = TRUE WHERE token_hash = $1', [tokenHashed]);
    }
    return { success: true, message: 'Sesión cerrada correctamente.' };
  }

  /**
   * 6. Recuperación de Credenciales por Correo
   */
  async forgotPassword(email) {
    const cleanEmail = email.trim().toLowerCase();

    // Buscar usuario en base de datos
    const userRes = await db.query(
      'SELECT id, name, email, friend_code FROM users WHERE email = $1',
      [cleanEmail]
    );

    if (userRes.rows.length === 0) {
      const error = new Error('No existe ninguna cuenta registrada con este correo electrónico.');
      error.statusCode = 404;
      throw error;
    }

    const user = userRes.rows[0];

    // Generar contraseña temporal segura
    const tempPassword = `Sentinel-${Math.floor(100000 + Math.random() * 900000)}`;
    const hashedPassword = await hashPassword(tempPassword);

    // Actualizar contraseña en la base de datos
    await db.query('UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [hashedPassword, user.id]);

    // Enviar correo oficial con Resend
    await transporter.sendMail({
      from: `"Sentinel Security" <seguridad@diaziastudio.com>`,
      to: `"${user.name}" <${user.email}>`,
      subject: `🛡️ Recuperación de Acceso Sentinel // Tus Credenciales`,
      html: buildPasswordResetEmailHtml(user.name, user.friend_code, user.email, tempPassword)
    });

    logger.info(`Correo de recuperación de contraseña enviado exitosamente a ${cleanEmail}`);

    return {
      email: user.email,
      name: user.name,
      message: `Se ha enviado un correo a ${user.email} con tu usuario, código y una nueva contraseña de acceso temporal.`
    };
  }

  /**
   * 7. Cambio de Contraseña (desde Perfil o tras recuperación)
   */
  async changePassword({ userId, email, newPassword }) {
    if (!newPassword || newPassword.trim().length < 6) {
      const error = new Error('La nueva contraseña debe contener al menos 6 caracteres.');
      error.statusCode = 400;
      throw error;
    }

    const cleanPass = newPassword.trim();
    const hashedPassword = await hashPassword(cleanPass);

    let query = '';
    let params = [];

    if (userId) {
      query = 'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, email, name';
      params = [hashedPassword, userId];
    } else if (email) {
      query = 'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE email = $2 RETURNING id, email, name';
      params = [hashedPassword, email.trim().toLowerCase()];
    } else {
      const error = new Error('Identificador de usuario o email requerido.');
      error.statusCode = 400;
      throw error;
    }

    const res = await db.query(query, params);
    if (res.rows.length === 0) {
      const error = new Error('Usuario no encontrado.');
      error.statusCode = 404;
      throw error;
    }

    logger.info(`Contraseña actualizada exitosamente para usuario ${res.rows[0].email}`);

    return {
      success: true,
      message: 'Contraseña actualizada con éxito.'
    };
  }
}

module.exports = new AuthService();
