# SENTINEL // BACKEND EN IONOS (Díaz IA Studio)

Este backend permite enviar correos oficiales desde **info@diaziastudio.com** a cualquier usuario que se registre en la aplicación Sentinel, con validación de código de 6 dígitos en servidor y cumplimiento 100% de la normativa RGPD/LSSI de la Unión Europea.

---

## OPCIÓN 1: Hosting Web de IONOS (PHP) — La más rápida (1 minuto)

No necesitas instalar servidores ni usar terminales. Cualquier Hosting Web de IONOS tiene PHP y SSL activo de serie.

### Pasos de instalación:
1. Accede a tu panel de control de **IONOS** (https://my.ionos.es).
2. Ve a **Hosting** > **Espacio Web** (o Administrador de Archivos / WebFTP).
3. Entra en tu carpeta web pública (suele llamarse `public_html`, `htdocs` o la raíz de tu dominio `diaziastudio.com`).
4. Crea una carpeta llamada `sentinel`.
5. Sube el archivo `sentinel_api.php` dentro de esa carpeta.
6. Abre `sentinel_api.php` en el editor de IONOS y en la línea 32:
   ```php
   define('IONOS_SMTP_PASS', 'TU_PASSWORD_AQUI');
   ```
   Escribe la contraseña de tu cuenta de correo `info@diaziastudio.com`.
7. ¡Listo! Tu backend ya está funcionando en:
   `https://diaziastudio.com/sentinel/sentinel_api.php`

### Cómo probarlo:
Abre en tu navegador:
`https://diaziastudio.com/sentinel/sentinel_api.php`
Deberás ver una respuesta JSON como esta:
```json
{
  "status": "ONLINE",
  "service": "Sentinel Authentication Core",
  "domain": "diaziastudio.com"
}
```

---

## OPCIÓN 2: Servidor VPS / Cloud IONOS (Node.js)

Si tienes un servidor VPS Linux en IONOS con Node.js:
1. Sube los archivos `server.js` y `package.json` a tu servidor.
2. Ejecuta:
   ```bash
   npm install
   IONOS_PASS="tu_contraseña" node server.js
   ```
3. Tu API responderá en `https://api.diaziastudio.com/api/send-code` y `/api/verify-code`.

---

## Endpoints de la API

### 1. Enviar código de verificación
- **URL**: `POST /sentinel/sentinel_api.php?action=send_code`
- **Body JSON**:
  ```json
  {
    "name": "Carlos García",
    "email": "usuario@ejemplo.com",
    "phone": "+34612345678"
  }
  ```
- **Respuesta**:
  ```json
  {
    "success": true,
    "message": "Código de verificación enviado correctamente a usuario@ejemplo.com",
    "expires_in_seconds": 600
  }
  ```

### 2. Verificar código
- **URL**: `POST /sentinel/sentinel_api.php?action=verify_code`
- **Body JSON**:
  ```json
  {
    "email": "usuario@ejemplo.com",
    "code": "123456"
  }
  ```
- **Respuesta**:
  ```json
  {
    "success": true,
    "message": "Usuario verificado correctamente en Sentinel",
    "token": "token_criptografico_de_sesion"
  }
  ```
