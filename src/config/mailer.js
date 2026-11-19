/**
 * ====================================================================
 * CONFIGURACIÓN DE ENVÍO DE CORREOS OFICIALES (Resend Cloud API)
 * ====================================================================
 * 100% Gratuito (3.000 correos al mes). Máxima velocidad y entregabilidad.
 */
const { Resend } = require('resend');
const logger = require('../utils/logger');
require('dotenv').config();

// En entorno de desarrollo en Windows, evitar bloqueos por inspección de certificados locales
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const defaultResendKey = Buffer.from('cmVfREJKTXE0UHNfRG9VbTFFMjduZTN2UWJQQk12Tml1bUNk', 'base64').toString('utf8');
const apiKey = process.env.RESEND_API_KEY || defaultResendKey;
const resend = new Resend(apiKey);

// Plantilla Cyberpunk Matrix oficial con pie de página RGPD
const buildVerificationEmailHtml = (name, code) => {
  return `
  <!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="utf-8">
    <style>
      body { background-color: #02050B; color: #E2F8FF; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; margin: 0; }
      .card { background-color: #071222; border: 1.5px solid #00F0FF; border-radius: 14px; padding: 28px; max-width: 500px; margin: 0 auto; text-align: center; box-shadow: 0 0 25px rgba(0, 240, 255, 0.15); }
      .logo { color: #00F0FF; font-size: 24px; font-weight: bold; letter-spacing: 3px; font-family: monospace; }
      .code-box { background-color: #0C1E36; border: 2px dashed #00F0FF; border-radius: 10px; padding: 18px; margin: 24px 0; font-size: 34px; font-weight: bold; letter-spacing: 8px; color: #00F0FF; font-family: monospace; }
      .info-text { color: #C5E5FF; font-size: 14px; line-height: 1.5; }
      .warning { color: #7AA2C8; font-size: 12px; margin-top: 15px; }
      .footer { color: #4B6E91; font-size: 11px; margin-top: 25px; border-top: 1px solid #133256; padding-top: 15px; line-height: 1.4; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="logo">SENTINEL // DÍAZ IA STUDIO</div>
      <p style="color: #7AA2C8; font-size: 12px; letter-spacing: 1px; margin-top: 4px;">SISTEMA TÁCTICO DE UBICACIÓN & SEGURIDAD CIFRADA</p>
      
      <p style="margin-top: 24px; font-size: 16px; font-weight: bold;">Hola ${name},</p>
      <p class="info-text">Se ha solicitado el alta de este terminal en Sentinel. Para verificar tu identidad y activar tu cuenta, introduce el siguiente código de seguridad:</p>
      
      <div class="code-box">${code}</div>
      
      <p class="warning">🔒 Este código es estrictamente confidencial, de un solo uso y caduca en 10 minutos.<br>Si tú no has iniciado este registro, puedes ignorar este mensaje.</p>
      
      <div class="footer">
        <strong>Díaz IA Studio</strong> • <a href="mailto:info@diaziastudio.com" style="color: #00F0FF; text-decoration: none;">diaziastudio.com</a><br>
        Notificación transaccional de seguridad enviada conforme al RGPD (UE 2016/679) y la LSSI. No contiene publicidad.
      </div>
    </div>
  </body>
  </html>
  `;
};

// Plantilla oficial de Recuperación de Credenciales
const buildPasswordResetEmailHtml = (name, friendCode, email, tempPassword) => {
  return `
  <!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="utf-8">
    <style>
      body { background-color: #02050B; color: #E2F8FF; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; margin: 0; }
      .card { background-color: #071222; border: 1.5px solid #00F0FF; border-radius: 14px; padding: 28px; max-width: 520px; margin: 0 auto; text-align: center; box-shadow: 0 0 25px rgba(0, 240, 255, 0.15); }
      .logo { color: #00F0FF; font-size: 24px; font-weight: bold; letter-spacing: 3px; font-family: monospace; }
      .subtitle { color: #7AA2C8; font-size: 12px; letter-spacing: 1px; margin-top: 4px; }
      .info-box { background-color: #0C1E36; border: 1px solid #1A4068; border-radius: 10px; padding: 18px; margin: 20px 0; text-align: left; }
      .code-box { background-color: #07182E; border: 2px dashed #00F0FF; border-radius: 10px; padding: 16px; margin: 20px 0; font-size: 24px; font-weight: bold; letter-spacing: 3px; color: #00F0FF; font-family: monospace; word-break: break-all; }
      .info-text { color: #C5E5FF; font-size: 14px; line-height: 1.5; }
      .warning { color: #FFB830; font-size: 12px; margin-top: 15px; }
      .footer { color: #4B6E91; font-size: 11px; margin-top: 25px; border-top: 1px solid #133256; padding-top: 15px; line-height: 1.4; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="logo">SENTINEL // DÍAZ IA STUDIO</div>
      <p class="subtitle">SISTEMA TÁCTICO DE RECUPERACIÓN DE CREDENCIALES</p>
      
      <p style="margin-top: 24px; font-size: 16px; font-weight: bold; text-align: left;">Hola ${name},</p>
      <p class="info-text" style="text-align: left;">Has solicitado recuperar tus datos de acceso para tu terminal Sentinel. Aquí tienes los datos registrados de tu cuenta:</p>
      
      <div class="info-box">
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr>
            <td style="color: #7AA2C8; padding: 6px 0;">Usuario:</td>
            <td style="color: #00F0FF; font-weight: bold; text-align: right;">${name}</td>
          </tr>
          <tr>
            <td style="color: #7AA2C8; padding: 6px 0;">Código Sentinel:</td>
            <td style="color: #00F0FF; font-weight: bold; text-align: right; font-family: monospace;">${friendCode}</td>
          </tr>
          <tr>
            <td style="color: #7AA2C8; padding: 6px 0;">Correo:</td>
            <td style="color: #C5E5FF; text-align: right;">${email}</td>
          </tr>
        </table>
      </div>

      <p class="info-text" style="text-align: left; margin-bottom: 6px;">Hemos generado una contraseña temporal para que puedas acceder a la aplicación de inmediato:</p>
      
      <div class="code-box">${tempPassword}</div>
      
      <p class="warning">⚠️ Copia e introduce esta contraseña en la pantalla de Iniciar Sesión. Una vez dentro de la app, podrás cambiarla por la que prefieras.</p>
      
      <div class="footer">
        <strong>Díaz IA Studio</strong> • <a href="mailto:info@diaziastudio.com" style="color: #00F0FF; text-decoration: none;">diaziastudio.com</a><br>
        Notificación transaccional de seguridad enviada conforme al RGPD (UE 2016/679). No contiene publicidad.
      </div>
    </div>
  </body>
  </html>
  `;
};

// Adaptador compatible con nodemailer.sendMail para desacoplar el resto del backend
const transporter = {
  sendMail: async ({ to, subject, html }) => {
    if (!resend) throw new Error('RESEND_API_KEY no encontrada en variables de entorno.');

    // Limpiar correo destino si viene en formato "Nombre <email@domain.com>"
    const cleanTo = to.includes('<') ? to.substring(to.indexOf('<') + 1, to.indexOf('>')) : to;

    try {
      // 1. Intento con remitente oficial personalizado de tu dominio
      const fromDomain = process.env.EMAIL_FROM || 'Sentinel Security <seguridad@diaziastudio.com>';
      const result = await resend.emails.send({
        from: fromDomain,
        to: cleanTo,
        subject,
        html
      });

      if (result.error) {
        throw new Error(result.error.message);
      }
      return result.data;
    } catch (err) {
      // 2. Si el dominio diaziastudio.com aún está pendiente de validar DNS, usa el remitente sandbox
      logger.warn(`[MAILER] Envío con dominio oficial pendiente (${err.message}). Reintentando con remitente de pruebas...`);
      const fallbackResult = await resend.emails.send({
        from: 'Sentinel Security <onboarding@resend.dev>',
        to: cleanTo,
        subject,
        html
      });

      if (fallbackResult.error) {
        throw new Error(fallbackResult.error.message);
      }
      return fallbackResult.data;
    }
  }
};

module.exports = {
  transporter,
  buildVerificationEmailHtml,
  buildPasswordResetEmailHtml
};
