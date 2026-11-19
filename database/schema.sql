-- =========================================================================
-- SENTINEL // ESQUEMA RELACIONAL PROFESIONAL DE PRODUCCIÓN (PostgreSQL)
-- Diseñado para alta concurrencia, geolocalización en tiempo real y seguridad.
-- =========================================================================

-- Habilitar extensión para UUID v4
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Habilitar extensión espacial para cálculos geodésicos rápidos
CREATE EXTENSION IF NOT EXISTS "postgis";

-- -------------------------------------------------------------------------
-- 1. TABLA: USUARIOS (users)
-- Almacena las cuentas maestras, credenciales cifradas y estado del perfil.
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(30) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    friend_code VARCHAR(20) UNIQUE NOT NULL,
    avatar_url TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_friend_code ON users(friend_code);

-- -------------------------------------------------------------------------
-- 2. TABLA: VERIFICACIÓN POR CORREO (email_verifications)
-- Códigos de 6 dígitos cifrados para validar la identidad de cada cuenta.
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    code_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    attempts INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_email_verif_user ON email_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verif_email ON email_verifications(email);

-- -------------------------------------------------------------------------
-- 3. TABLA: REFRESH TOKENS (refresh_tokens)
-- Rotación de tokens de sesión para mantener el login seguro sin re-autenticar.
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    is_revoked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);

-- -------------------------------------------------------------------------
-- 4. TABLA: SISTEMA DE AMISTAD & CONTACTOS (friendships)
-- Relaciones de confianza entre dos usuarios con estados estrictos.
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS friendships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    addressee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'BLOCKED')),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_friendship_pair UNIQUE (requester_id, addressee_id)
);

CREATE INDEX IF NOT EXISTS idx_friendships_requester ON friendships(requester_id);
CREATE INDEX IF NOT EXISTS idx_friendships_addressee ON friendships(addressee_id);
CREATE INDEX IF NOT EXISTS idx_friendships_status ON friendships(status);

-- -------------------------------------------------------------------------
-- 5. TABLA: TELEMETRÍA EN VIVO (telemetry_live)
-- Última posición GPS exacta, estado de batería, velocidad y presencia online.
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS telemetry_live (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    altitude DOUBLE PRECISION DEFAULT 0.0,
    speed FLOAT DEFAULT 0.0,
    bearing FLOAT DEFAULT 0.0,
    accuracy FLOAT DEFAULT 0.0,
    city VARCHAR(100),
    province VARCHAR(100),
    country VARCHAR(100),
    activity_type VARCHAR(30) DEFAULT 'STILL' CHECK (activity_type IN ('STILL', 'WALKING', 'ON_BICYCLE', 'IN_VEHICLE', 'RUNNING')),
    battery_percentage INT DEFAULT 100,
    is_charging BOOLEAN DEFAULT FALSE,
    is_online BOOLEAN DEFAULT TRUE,
    is_sos BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_telemetry_live_coords ON telemetry_live(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_telemetry_live_status ON telemetry_live(is_online, is_sos);

-- -------------------------------------------------------------------------
-- 6. TABLA: HISTORIAL DE UBICACIÓN (location_history)
-- Histórico cifrado de trayectorias para auditoría y seguimiento SOS.
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS location_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    speed FLOAT DEFAULT 0.0,
    battery_percentage INT,
    activity_type VARCHAR(30),
    recorded_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_location_history_user_time ON location_history(user_id, recorded_at DESC);

-- -------------------------------------------------------------------------
-- 7. TABLA: CHATS (chats)
-- Salas de conversación privadas (1 a 1) o grupales.
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type VARCHAR(20) NOT NULL CHECK (type IN ('DIRECT', 'GROUP')),
    name VARCHAR(100),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- -------------------------------------------------------------------------
-- 8. TABLA: PARTICIPANTES DE CHAT (chat_participants)
-- Miembros autorizados en cada sala de chat.
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_participants (
    chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'MEMBER' CHECK (role IN ('ADMIN', 'MEMBER')),
    joined_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (chat_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_participants_user ON chat_participants(user_id);

-- -------------------------------------------------------------------------
-- 9. TABLA: MENSAJES (messages)
-- Registro de mensajes de texto, coordenadas o multimedia con acuse de lectura.
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT,
    type VARCHAR(20) DEFAULT 'TEXT' CHECK (type IN ('TEXT', 'LOCATION', 'IMAGE')),
    media_url TEXT,
    status VARCHAR(20) DEFAULT 'SENT' CHECK (status IN ('SENT', 'DELIVERED', 'READ')),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_messages_chat_time ON messages(chat_id, created_at DESC);

-- -------------------------------------------------------------------------
-- 10. TABLA: ALERTAS DE PÁNICO SOS (sos_alerts)
-- Registro de emergencias activadas con coordenadas y seguimiento continuo.
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sos_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    message TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    started_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sos_alerts_active ON sos_alerts(user_id, is_active);

-- -------------------------------------------------------------------------
-- 11. TABLA: DISPOSITIVOS & TOKENS PUSH (user_devices)
-- Tokens de Firebase Cloud Messaging (FCM) para notificaciones instantáneas.
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    fcm_token TEXT NOT NULL UNIQUE,
    device_model VARCHAR(100),
    platform VARCHAR(20) DEFAULT 'ANDROID',
    last_seen TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_devices_user ON user_devices(user_id);
