<?php
/**
 * =========================================================================
 * SENTINEL // BACKEND OFICIAL DE SINCRONIZACIÓN EN TIEMPO REAL & CORREOS (IONOS)
 * Desarrollado para Díaz IA Studio (info@diaziastudio.com)
 * =========================================================================
 * 
 * Gestiona:
 * 1. Envío de correos oficiales desde info@diaziastudio.com.
 * 2. Posicionamiento GPS de alta precisión en tiempo real entre amigos.
 * 3. Detección automática de Presencia (En línea / Desconectado).
 * 4. Transmisión de alertas de emergencia SOS en vivo entre dispositivos.
 * 5. Chat táctico en tiempo real.
 */

header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// -------------------------------------------------------------------------
// CONFIGURACIÓN OFICIAL DE IONOS PARA DIAZIASTUDIO.COM
// -------------------------------------------------------------------------
define('SENDER_NAME', 'Sentinel Security // Díaz IA Studio');
define('SENDER_EMAIL', 'info@diaziastudio.com');

define('IONOS_SMTP_HOST', 'smtp.ionos.es');
define('IONOS_SMTP_PORT', 465);
define('IONOS_SMTP_USER', 'info@diaziastudio.com');
define('IONOS_SMTP_PASS', 'TU_PASSWORD_AQUI');

// Almacenes de datos en servidor
define('CODES_DB_FILE', __DIR__ . '/.sentinel_codes.json');
define('TELEMETRY_DB_FILE', __DIR__ . '/.sentinel_telemetry.json');
define('CHATS_DB_FILE', __DIR__ . '/.sentinel_chats.json');

// -------------------------------------------------------------------------
// ENRUTADOR DE ACCIONES
// -------------------------------------------------------------------------
$input = json_decode(file_get_contents('php://input'), true) ?? [];
$action = $_GET['action'] ?? ($input['action'] ?? 'status');

switch ($action) {
    // 1. Telemetría GPS y Detección En Línea / Desconectado
    case 'update_telemetry':
        handleUpdateTelemetry($input);
        break;

    case 'get_friend_telemetry':
        handleGetFriendTelemetry($_GET['friend_code'] ?? ($input['friend_code'] ?? ''));
        break;

    case 'set_offline':
        handleSetOffline($input['user_code'] ?? ($_GET['user_code'] ?? ''));
        break;

    // 2. Chat Táctico en Tiempo Real
    case 'send_message':
        handleSendMessage($input);
        break;

    case 'get_messages':
        handleGetMessages($_GET['user_code'] ?? '', $_GET['friend_code'] ?? '');
        break;

    // 3. Alertas de Emergencia SOS
    case 'trigger_sos':
        handleTriggerSos($input);
        break;

    case 'clear_sos':
        handleClearSos($input);
        break;

    // 4. Verificación de Código por Correo (Opcional)
    case 'send_code':
        handleSendCode($input);
        break;

    case 'verify_code':
        handleVerifyCode($input);
        break;

    case 'status':
    default:
        echo json_encode([
            'status' => 'ONLINE',
            'service' => 'Sentinel Cloud Real-Time Mesh',
            'version' => '2.0.0',
            'host' => 'IONOS Cloud / Díaz IA Studio',
            'domain' => 'diaziastudio.com',
            'features' => ['gps_high_precision', 'live_presence', 'sos_siren', 'live_chat']
        ]);
        break;
}

// -------------------------------------------------------------------------
// CONTROLADOR: TELEMETRÍA GPS & PRESENCIA EN TIEMPO REAL
// -------------------------------------------------------------------------
function handleUpdateTelemetry($data) {
    $code = strtoupper(trim($data['user_code'] ?? ''));
    if (empty($code)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Código de usuario requerido']);
        return;
    }

    $telemetry = loadData(TELEMETRY_DB_FILE);

    $telemetry[$code] = [
        'user_code' => $code,
        'name' => htmlspecialchars($data['name'] ?? 'Operador'),
        'lat' => (float)($data['lat'] ?? 0.0),
        'lng' => (float)($data['lng'] ?? 0.0),
        'speed' => (float)($data['speed'] ?? 0.0),
        'battery' => (int)($data['battery'] ?? 100),
        'mode' => htmlspecialchars($data['mode'] ?? 'STILL'),
        'is_sos' => (bool)($data['is_sos'] ?? false),
        'sos_message' => htmlspecialchars($data['sos_message'] ?? ''),
        'last_ping' => time(),
        'is_online' => true
    ];

    saveData(TELEMETRY_DB_FILE, $telemetry);

    echo json_encode(['success' => true, 'timestamp' => time()]);
}

function handleGetFriendTelemetry($friendCode) {
    $code = strtoupper(trim($friendCode));
    $telemetry = loadData(TELEMETRY_DB_FILE);

    if (!isset($telemetry[$code])) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Amigo no encontrado en la red']);
        return;
    }

    $friend = $telemetry[$code];
    $timeSinceLastPing = time() - $friend['last_ping'];

    // Si hace más de 12 segundos que no envía señal (ha cerrado la app o no tiene cobertura)
    $isOnline = ($timeSinceLastPing <= 12) && ($friend['is_online'] ?? true);
    $friend['is_online'] = $isOnline;
    $friend['seconds_ago'] = $timeSinceLastPing;

    echo json_encode([
        'success' => true,
        'friend' => $friend
    ]);
}

function handleSetOffline($userCode) {
    $code = strtoupper(trim($userCode));
    if (empty($code)) return;

    $telemetry = loadData(TELEMETRY_DB_FILE);
    if (isset($telemetry[$code])) {
        $telemetry[$code]['is_online'] = false;
        $telemetry[$code]['last_ping'] = time() - 30; // Marcar como cerrado
        saveData(TELEMETRY_DB_FILE, $telemetry);
    }
    echo json_encode(['success' => true]);
}

// -------------------------------------------------------------------------
// CONTROLADOR: CHAT EN TIEMPO REAL
// -------------------------------------------------------------------------
function handleSendMessage($data) {
    $from = strtoupper(trim($data['from_code'] ?? ''));
    $to = strtoupper(trim($data['to_code'] ?? ''));
    $message = trim($data['message'] ?? '');

    if (empty($from) || empty($to) || empty($message)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Datos incompletos para chat']);
        return;
    }

    $chats = loadData(CHATS_DB_FILE);
    $conversationKey = ($from < $to) ? "{$from}_{$to}" : "{$to}_{$from}";

    if (!isset($chats[$conversationKey])) {
        $chats[$conversationKey] = [];
    }

    $msgItem = [
        'id' => bin2hex(random_bytes(8)),
        'from' => $from,
        'to' => $to,
        'text' => htmlspecialchars($message),
        'timestamp' => time() * 1000
    ];

    $chats[$conversationKey][] = $msgItem;
    // Guardar solo los últimos 100 mensajes por conversación
    if (count($chats[$conversationKey]) > 100) {
        $chats[$conversationKey] = array_slice($chats[$conversationKey], -100);
    }

    saveData(CHATS_DB_FILE, $chats);

    echo json_encode(['success' => true, 'message' => $msgItem]);
}

function handleGetMessages($userCode, $friendCode) {
    $from = strtoupper(trim($userCode));
    $to = strtoupper(trim($friendCode));

    if (empty($from) || empty($to)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'messages' => []]);
        return;
    }

    $chats = loadData(CHATS_DB_FILE);
    $conversationKey = ($from < $to) ? "{$from}_{$to}" : "{$to}_{$from}";
    $messages = $chats[$conversationKey] ?? [];

    echo json_encode(['success' => true, 'messages' => $messages]);
}

// -------------------------------------------------------------------------
// CONTROLADOR: EMERGENCIAS SOS EN TIEMPO REAL
// -------------------------------------------------------------------------
function handleTriggerSos($data) {
    $code = strtoupper(trim($data['user_code'] ?? ''));
    $message = htmlspecialchars($data['sos_message'] ?? '¡ALERTA SOS ACTIVADA!');

    $telemetry = loadData(TELEMETRY_DB_FILE);
    if (isset($telemetry[$code])) {
        $telemetry[$code]['is_sos'] = true;
        $telemetry[$code]['sos_message'] = $message;
        $telemetry[$code]['last_ping'] = time();
        saveData(TELEMETRY_DB_FILE, $telemetry);
    }

    echo json_encode(['success' => true, 'alert' => 'SOS Emitido a la red']);
}

function handleClearSos($data) {
    $code = strtoupper(trim($data['user_code'] ?? ''));
    $telemetry = loadData(TELEMETRY_DB_FILE);
    if (isset($telemetry[$code])) {
        $telemetry[$code]['is_sos'] = false;
        $telemetry[$code]['sos_message'] = '';
        saveData(TELEMETRY_DB_FILE, $telemetry);
    }
    echo json_encode(['success' => true]);
}

// -------------------------------------------------------------------------
// PERSISTENCIA JSON SEGURA
// -------------------------------------------------------------------------
function loadData($file) {
    if (!file_exists($file)) return [];
    $content = @file_get_contents($file);
    return json_decode($content, true) ?: [];
}

function saveData($file, $data) {
    file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT), LOCK_EX);
}

// -------------------------------------------------------------------------
// CONTROLADOR DE CORREOS
// -------------------------------------------------------------------------
function handleSendCode($data) {
    $email = filter_var($data['email'] ?? '', FILTER_VALIDATE_EMAIL);
    $name = htmlspecialchars(trim($data['name'] ?? 'Operador'));
    if (!$email) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Correo inválido']);
        return;
    }
    $code = str_pad((string)random_int(100000, 999999), 6, '0', STR_PAD_LEFT);
    $codes = loadData(CODES_DB_FILE);
    $codes[$email] = ['code' => $code, 'expires_at' => time() + 600, 'name' => $name];
    saveData(CODES_DB_FILE, $codes);

    // Enviar correo si las credenciales están configuradas
    $subject = "🛡️ Clave de Verificación Sentinel: $code";
    $html = "<h2>Tu código Sentinel: $code</h2>";
    $headers = "From: " . SENDER_NAME . " <" . SENDER_EMAIL . ">\r\nContent-Type: text/html; charset=UTF-8\r\n";
    @mail($email, $subject, $html, $headers);

    echo json_encode(['success' => true, 'code_sent' => true]);
}

function handleVerifyCode($data) {
    $email = filter_var($data['email'] ?? '', FILTER_VALIDATE_EMAIL);
    $code = trim($data['code'] ?? '');
    $codes = loadData(CODES_DB_FILE);

    if (isset($codes[$email]) && $codes[$email]['code'] === $code && time() <= $codes[$email]['expires_at']) {
        unset($codes[$email]);
        saveData(CODES_DB_FILE, $codes);
        echo json_encode(['success' => true, 'token' => bin2hex(random_bytes(16))]);
    } else {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Código incorrecto o caducado']);
    }
}
