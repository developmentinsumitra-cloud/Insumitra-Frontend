<?php
/**
 * Same-origin API Reverse Proxy for Hostinger (insumitr.exportshub.in)
 * Routes Frontend API requests to the Render backend without browser CORS errors.
 * Includes cold-start retry handling for Render free-tier instances.
 */

@set_time_limit(120);
@ini_set('max_execution_time', '120');

$backendBase = 'https://insumitrabackend-2w2y.onrender.com/api/v1';
$allowedOriginHeader = 'https://insumitr.exportshub.in';

// Handle CORS preflight if called cross-origin
$requestOrigin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '*';
header('Access-Control-Allow-Origin: ' . $requestOrigin);
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Tenant-ID, Accept');
header('Access-Control-Expose-Headers: Content-Disposition');

$method = isset($_SERVER['REQUEST_METHOD']) ? strtoupper($_SERVER['REQUEST_METHOD']) : 'GET';
if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Resolve endpoint path (support both __path and _path)
$rawPath = '';
if (!empty($_GET['__path'])) {
    $rawPath = $_GET['__path'];
} elseif (!empty($_GET['_path'])) {
    $rawPath = $_GET['_path'];
} elseif (!empty($_SERVER['PATH_INFO'])) {
    $rawPath = $_SERVER['PATH_INFO'];
} else {
    $uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    $rawPath = preg_replace('#^/(api-proxy\.php|api/v1)#', '', $uri);
}

$path = '/' . ltrim((string)$rawPath, '/');
if ($path === '/' || $path === '') {
    $path = '/health';
}

// Build query string excluding internal path parameters
$queryParams = $_GET;
unset($queryParams['__path'], $queryParams['_path']);
$queryString = http_build_query($queryParams);

$targetUrl = rtrim($backendBase, '/') . $path . ($queryString ? '?' . $queryString : '');

// Collect request headers
$incomingHeaders = function_exists('getallheaders') ? getallheaders() : [];
$authHeader = '';
foreach ($incomingHeaders as $k => $v) {
    if (strtolower($k) === 'authorization') {
        $authHeader = $v;
        break;
    }
}
if (!$authHeader) {
    if (!empty($_SERVER['HTTP_AUTHORIZATION'])) {
        $authHeader = $_SERVER['HTTP_AUTHORIZATION'];
    } elseif (!empty($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        $authHeader = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    }
}

$contentType = '';
if (!empty($_SERVER['CONTENT_TYPE'])) {
    $contentType = $_SERVER['CONTENT_TYPE'];
} elseif (!empty($_SERVER['HTTP_CONTENT_TYPE'])) {
    $contentType = $_SERVER['HTTP_CONTENT_TYPE'];
}

$forwardHeaders = [
    'Origin: ' . $allowedOriginHeader,
];
if ($authHeader) {
    $forwardHeaders[] = 'Authorization: ' . $authHeader;
}
if (!empty($_SERVER['HTTP_X_TENANT_ID'])) {
    $forwardHeaders[] = 'X-Tenant-ID: ' . $_SERVER['HTTP_X_TENANT_ID'];
}
if (!empty($_SERVER['HTTP_ACCEPT'])) {
    $forwardHeaders[] = 'Accept: ' . $_SERVER['HTTP_ACCEPT'];
}

// Handle request payload for write methods
$postFields = null;
$rawBody = null;
if (in_array($method, ['POST', 'PUT', 'PATCH', 'DELETE'], true)) {
    if (!empty($_FILES) || stripos($contentType, 'multipart/form-data') !== false) {
        $postFields = $_POST;
        foreach ($_FILES as $field => $fileInfo) {
            if (is_array($fileInfo['tmp_name'])) {
                foreach ($fileInfo['tmp_name'] as $idx => $tmpName) {
                    if ($tmpName && is_uploaded_file($tmpName)) {
                        $postFields[$field . '[' . $idx . ']'] = new CURLFile(
                            $tmpName,
                            $fileInfo['type'][$idx] ?? 'application/octet-stream',
                            $fileInfo['name'][$idx] ?? 'file'
                        );
                    }
                }
            } elseif (!empty($fileInfo['tmp_name']) && is_uploaded_file($fileInfo['tmp_name'])) {
                $postFields[$field] = new CURLFile(
                    $fileInfo['tmp_name'],
                    $fileInfo['type'] ?? 'application/octet-stream',
                    $fileInfo['name'] ?? 'file'
                );
            }
        }
    } else {
        $rawBody = file_get_contents('php://input');
        if ($contentType) {
            $forwardHeaders[] = 'Content-Type: ' . $contentType;
        }
    }
}

// Execute cURL with automatic retry on cold start (up to 3 attempts)
$maxAttempts = 3;
$response = false;
$statusCode = 0;
$headerSize = 0;
$lastErr = '';

for ($attempt = 1; $attempt <= $maxAttempts; $attempt++) {
    $ch = curl_init($targetUrl);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HEADER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 20);
    curl_setopt($ch, CURLOPT_TIMEOUT, 60);

    if ($postFields !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, $postFields);
    } elseif ($rawBody !== null && $rawBody !== '') {
        curl_setopt($ch, CURLOPT_POSTFIELDS, $rawBody);
    }
    curl_setopt($ch, CURLOPT_HTTPHEADER, $forwardHeaders);

    $response = curl_exec($ch);
    $lastErr = curl_error($ch);
    $statusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    curl_close($ch);

    // If we received a valid HTTP response (< 500), return immediately
    if ($response !== false && $statusCode > 0 && $statusCode < 500) {
        break;
    }

    // If Render returned 502/503/504 or connection timed out during cold start, wait and retry
    if ($attempt < $maxAttempts && ($response === false || $statusCode >= 500)) {
        sleep(2);
        continue;
    }
}

if ($response === false) {
    http_response_code(502);
    header('Content-Type: application/json');
    echo json_encode(['statusCode' => 502, 'message' => 'Backend is waking up or unreachable. Please refresh in a few seconds. (' . $lastErr . ')']);
    exit;
}

$rawResponseHeaders = substr($response, 0, $headerSize);
$responseBody = substr($response, $headerSize);

http_response_code($statusCode ?: 200);

$headerLines = explode("\r\n", $rawResponseHeaders);
foreach ($headerLines as $line) {
    if (stripos($line, 'Content-Type:') === 0 || stripos($line, 'Content-Disposition:') === 0) {
        header($line, true);
    }
}

echo $responseBody;
