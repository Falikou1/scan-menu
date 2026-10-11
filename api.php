<?php
session_start();

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

$restaurantsFile = __DIR__ . '/data/restaurants.json';
$visitsFile = __DIR__ . '/data/visits.json';
$usersFile = __DIR__ . '/data/users.json';
$configFile = __DIR__ . '/data/config.json';
$activityLogsFile = __DIR__ . '/data/activity_logs.json';

// --- DATA ACCESS HELPERS ---

function getConfig() {
    global $configFile;
    if (!file_exists($configFile)) {
        return ['google_maps_api_key' => '', 'auto_sync_places' => true];
    }
    $json = file_get_contents($configFile);
    return json_decode($json, true) ?: ['google_maps_api_key' => '', 'auto_sync_places' => true];
}

function saveConfig($cfg) {
    global $configFile;
    file_put_contents($configFile, json_encode($cfg, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

function ensureGeocodeSchema(&$restaurants) {
    $modified = false;
    foreach ($restaurants as &$r) {
        if (!array_key_exists('latitude', $r)) {
            $r['latitude'] = null;
            $modified = true;
        }
        if (!array_key_exists('longitude', $r)) {
            $r['longitude'] = null;
            $modified = true;
        }
        if (!array_key_exists('geocode_status', $r)) {
            $hasCoords = !empty($r['latitude']) && !empty($r['longitude']) && is_numeric($r['latitude']) && is_numeric($r['longitude']);
            $r['geocode_status'] = $hasCoords ? 'localise' : 'non_localise';
            $modified = true;
        }
        if (!array_key_exists('coordinates_source', $r)) {
            $r['coordinates_source'] = !empty($r['latitude']) ? 'initial' : null;
            $modified = true;
        }
    }
    return $modified;
}

function getRestaurants() {
    global $restaurantsFile;
    if (!file_exists($restaurantsFile)) return [];
    $json = file_get_contents($restaurantsFile);
    $data = json_decode($json, true) ?: [];
    if (ensureGeocodeSchema($data)) {
        saveRestaurants($data);
    }
    return $data;
}

function saveRestaurants($data) {
    global $restaurantsFile;
    file_put_contents($restaurantsFile, json_encode(array_values($data), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

function getActivityLogs() {
    global $activityLogsFile;
    if (!file_exists($activityLogsFile)) return [];
    $json = file_get_contents($activityLogsFile);
    return json_decode($json, true) ?: [];
}

function saveActivityLogs($data) {
    global $activityLogsFile;
    file_put_contents($activityLogsFile, json_encode(array_values($data), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

function logActivity($actionType, $description, $details = []) {
    $logs = getActivityLogs();
    $currentUser = getCurrentUser();
    $logEntry = [
        'id' => 'LOG-' . strtoupper(substr(uniqid(), -6)),
        'timestamp' => date('Y-m-d H:i:s'),
        'action' => $actionType,
        'description' => $description,
        'user_id' => $currentUser ? $currentUser['id'] : null,
        'user_name' => $currentUser ? $currentUser['name'] : 'Système',
        'role' => $currentUser ? ($currentUser['role'] ?? 'AGENT') : 'SYSTEM',
        'details' => $details
    ];
    array_unshift($logs, $logEntry);
    if (count($logs) > 500) {
        $logs = array_slice($logs, 0, 500);
    }
    saveActivityLogs($logs);
    return $logEntry;
}

function geocodeWithNominatim($restaurant) {
    $address = trim($restaurant['address'] ?? '');
    $quartier = trim($restaurant['quartier'] ?? ($restaurant['zone'] ?? ''));
    $commune = trim($restaurant['commune'] ?? '');
    $name = trim($restaurant['name'] ?? '');

    // Format 1: adresse + quartier + commune + Abidjan, Côte d'Ivoire
    $query1Parts = array_filter([$address, $quartier, $commune, "Abidjan", "Côte d'Ivoire"]);
    $query1 = implode(', ', $query1Parts);
    $url1 = "https://nominatim.openstreetmap.org/search?q=" . urlencode($query1) . "&format=json&limit=1&addressdetails=1";

    $opts = [
        'http' => [
            'method' => 'GET',
            'header' => "User-Agent: MenuScan-Abidjan/1.0 (contact@menuscan.ci)\r\nAccept: application/json\r\n",
            'timeout' => 8
        ]
    ];
    $ctx = stream_context_create($opts);

    // Règle d'usage Nominatim : 1 requête / seconde max
    usleep(1050000); // 1.05s

    $res = @file_get_contents($url1, false, $ctx);
    $data = $res ? json_decode($res, true) : null;

    if (!empty($data) && isset($data[0]['lat']) && isset($data[0]['lon'])) {
        return [
            'success' => true,
            'latitude' => floatval($data[0]['lat']),
            'longitude' => floatval($data[0]['lon']),
            'source' => 'nominatim_address',
            'query' => $query1,
            'display_name' => $data[0]['display_name'] ?? ''
        ];
    }

    // Format 2 (Fallback): nom du restaurant + quartier + commune + Abidjan
    $query2Parts = array_filter([$name, $quartier, $commune, "Abidjan"]);
    $query2 = implode(', ', $query2Parts);
    $url2 = "https://nominatim.openstreetmap.org/search?q=" . urlencode($query2) . "&format=json&limit=1&addressdetails=1";

    usleep(1050000); // 1.05s
    $res2 = @file_get_contents($url2, false, $ctx);
    $data2 = $res2 ? json_decode($res2, true) : null;

    if (!empty($data2) && isset($data2[0]['lat']) && isset($data2[0]['lon'])) {
        return [
            'success' => true,
            'latitude' => floatval($data2[0]['lat']),
            'longitude' => floatval($data2[0]['lon']),
            'source' => 'nominatim_name_fallback',
            'query' => $query2,
            'display_name' => $data2[0]['display_name'] ?? ''
        ];
    }

    return [
        'success' => false,
        'error' => 'Aucune coordonnée trouvée par Nominatim OpenStreetMap',
        'queries_tried' => [$query1, $query2]
    ];
}

function getVisits() {
    global $visitsFile;
    if (!file_exists($visitsFile)) return [];
    $json = file_get_contents($visitsFile);
    return json_decode($json, true) ?: [];
}

function saveVisits($data) {
    global $visitsFile;
    file_put_contents($visitsFile, json_encode(array_values($data), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

function getUsers() {
    global $usersFile;
    if (!file_exists($usersFile)) return [];
    $json = file_get_contents($usersFile);
    return json_decode($json, true) ?: [];
}

function saveUsers($data) {
    global $usersFile;
    file_put_contents($usersFile, json_encode(array_values($data), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

function getCurrentUser() {
    $users = getUsers();
    if (empty($users)) return null;

    // Si l'utilisateur s'est explicitement déconnecté, ne pas ré-authentifier automatiquement
    if (!empty($_SESSION['logged_out'])) {
        return null;
    }

    if (!empty($_SESSION['user_id'])) {
        foreach ($users as $u) {
            if ($u['id'] === $_SESSION['user_id']) {
                unset($u['password_hash']);
                return $u;
            }
        }
    }

    // Fallback : Authentifier automatiquement le premier compte Administrateur si aucune session n'est encore active
    // (seulement si l'utilisateur ne s'est pas explicitement déconnecté)
    foreach ($users as $u) {
        if (($u['role'] ?? '') === 'ADMIN') {
            $_SESSION['user_id'] = $u['id'];
            $_SESSION['logged_out'] = false;
            unset($u['password_hash']);
            return $u;
        }
    }

    $_SESSION['user_id'] = $users[0]['id'];
    $_SESSION['logged_out'] = false;
    $defaultUser = $users[0];
    unset($defaultUser['password_hash']);
    return $defaultUser;
}

// --- GOOGLE PLACES API SYNC ENGINE ---

function fetchGooglePlacesForCommune($commune) {
    $config = getConfig();
    $apiKey = getenv('GOOGLE_MAPS_API_KEY') ?: ($config['google_maps_api_key'] ?? '');

    if (!$apiKey) {
        return ['success' => false, 'error' => 'Clé API Google Maps Platform non configurée.'];
    }

    $query = "restaurants " . $commune . " Abidjan Côte d'Ivoire";
    $url = "https://maps.googleapis.com/maps/api/place/textsearch/json?query=" . urlencode($query) . "&language=fr&key=" . urlencode($apiKey);

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    $response = curl_exec($ch);
    $err = curl_error($ch);
    curl_close($ch);

    if ($err) {
        return ['success' => false, 'error' => 'Erreur de connexion Google API: ' . $err];
    }

    $data = json_decode($response, true);
    if (!isset($data['status']) || ($data['status'] !== 'OK' && $data['status'] !== 'ZERO_RESULTS')) {
        return ['success' => false, 'error' => 'Google API Status: ' . ($data['status'] ?? 'Erreur inconnue')];
    }

    $existingRestaurants = getRestaurants();
    $existingMap = [];
    foreach ($existingRestaurants as $idx => $r) {
        if (!empty($r['google_place_id'])) {
            $existingMap[$r['google_place_id']] = $idx;
        }
    }

    $places = $data['results'] ?? [];
    $importedCount = 0;
    $updatedCount = 0;

    foreach ($places as $p) {
        $placeId = $p['place_id'] ?? null;
        if (!$placeId) continue;

        $lat = $p['geometry']['location']['lat'] ?? 5.3485;
        $lng = $p['geometry']['location']['lng'] ?? -4.0012;
        $name = $p['name'] ?? 'Restaurant';
        $address = $p['formatted_address'] ?? ($commune . ', Abidjan');
        $rating = $p['rating'] ?? null;
        $userRatingsTotal = $p['user_ratings_total'] ?? null;

        $photoRef = null;
        if (!empty($p['photos'][0]['photo_reference'])) {
            $photoRef = "https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=" . $p['photos'][0]['photo_reference'] . "&key=" . $apiKey;
        }

        if (isset($existingMap[$placeId])) {
            // Update existing restaurant while preserving FieldOps prospection status
            $idx = $existingMap[$placeId];
            $existingRestaurants[$idx]['name'] = $name;
            $existingRestaurants[$idx]['address'] = $address;
            $existingRestaurants[$idx]['latitude'] = $lat;
            $existingRestaurants[$idx]['longitude'] = $lng;
            $existingRestaurants[$idx]['rating'] = $rating;
            $existingRestaurants[$idx]['user_ratings_total'] = $userRatingsTotal;
            if ($photoRef) $existingRestaurants[$idx]['photo'] = $photoRef;
            $existingRestaurants[$idx]['last_synced_at'] = date('Y-m-d H:i:s');
            $updatedCount++;
        } else {
            // Insert new restaurant from Google Places
            $newRecord = [
                'id' => 'ABJ-' . strtoupper(substr(md5($placeId), 0, 8)),
                'google_place_id' => $placeId,
                'name' => $name,
                'commune' => $commune,
                'zone' => $commune,
                'quartier' => $commune,
                'address' => $address,
                'latitude' => $lat,
                'longitude' => $lng,
                'phone' => null,
                'website' => null,
                'opening_hours' => null,
                'cuisine' => 'Restaurant / Maquis',
                'price_range' => null,
                'rating' => $rating,
                'user_ratings_total' => $userRatingsTotal,
                'status' => 'A_VISITER',
                'decision_maker' => [
                    'name' => null,
                    'role' => 'Gérant / Direction',
                    'phone' => null
                ],
                'photo' => $photoRef,
                'last_visit' => null,
                'next_follow_up' => null,
                'assigned_to' => null,
                'source' => 'google_places',
                'last_synced_at' => date('Y-m-d H:i:s')
            ];
            $existingRestaurants[] = $newRecord;
            $importedCount++;
        }
    }

    saveRestaurants($existingRestaurants);
    return [
        'success' => true,
        'imported' => $importedCount,
        'updated' => $updatedCount,
        'total_fetched' => count($places)
    ];
}

// --- STATS CALCULATION ---

function calculateStats($restaurants) {
    $total = count($restaurants);
    $aVisiter = 0;
    $visites = 0;
    $aRelancer = 0;
    $aVerifier = 0;

    $communesMap = [
        'Cocody' => ['total' => 0, 'visites' => 0, 'a_visiter' => 0, 'a_relancer' => 0, 'quartiers' => ['Riviera', 'Deux Plateaux', 'Angré', 'Cocody Centre', 'Blockhaus'], 'desc' => 'Riviera, Deux Plateaux, Angré, Cocody Centre, Blockhaus'],
        'Marcory' => ['total' => 0, 'visites' => 0, 'a_visiter' => 0, 'a_relancer' => 0, 'quartiers' => ['Zone 4', 'Biétry', 'Résidentiel', 'Anoumabo'], 'desc' => 'Zone 4, Biétry, Anoumabo, Résidentiel'],
        'Plateau' => ['total' => 0, 'visites' => 0, 'a_visiter' => 0, 'a_relancer' => 0, 'quartiers' => ['Centre des Affaires', 'Administrative'], 'desc' => 'Centre des Affaires, Bd République, Avenue Chardy'],
        'Yopougon' => ['total' => 0, 'visites' => 0, 'a_visiter' => 0, 'a_relancer' => 0, 'quartiers' => ['Selmer', 'Maroc', 'Niangon'], 'desc' => 'Selmer, Maroc, Rue Princesse, Niangon'],
        'Treichville' => ['total' => 0, 'visites' => 0, 'a_visiter' => 0, 'a_relancer' => 0, 'quartiers' => ['Commerciale', 'Avenue 8'], 'desc' => 'Boulevard VGE, Avenue 8, Zone Portuaire'],
        'Koumassi' => ['total' => 0, 'visites' => 0, 'a_visiter' => 0, 'a_relancer' => 0, 'quartiers' => ['Remblais', 'Grand Carrefour'], 'desc' => 'Remblais, Soweto, Grand Carrefour'],
        'Port-Bouët' => ['total' => 0, 'visites' => 0, 'a_visiter' => 0, 'a_relancer' => 0, 'quartiers' => ['Vridi', 'Route Bassam'], 'desc' => 'Vridi, Route de Grand-Bassam, Phare']
    ];

    $totalLocalises = 0;
    $totalNonLocalises = 0;
    $totalCorriges = 0;

    foreach ($restaurants as $r) {
        $st = $r['status'] ?? 'A_VISITER';
        if ($st === 'VISITE') $visites++;
        elseif ($st === 'A_RELANCER') $aRelancer++;
        elseif ($st === 'A_VERIFIER') $aVerifier++;
        else $aVisiter++;

        $c = $r['commune'] ?? 'Autre';
        if (isset($communesMap[$c])) {
            $communesMap[$c]['total']++;
            if ($st === 'VISITE') $communesMap[$c]['visites']++;
            elseif ($st === 'A_RELANCER') $communesMap[$c]['a_relancer']++;
            else $communesMap[$c]['a_visiter']++;
        }

        $geo = $r['geocode_status'] ?? 'non_localise';
        $hasCoords = !empty($r['latitude']) && !empty($r['longitude']) && is_numeric($r['latitude']) && is_numeric($r['longitude']);
        if ($geo === 'corrige_manuellement') {
            $totalCorriges++;
            $totalLocalises++;
        } elseif ($geo === 'localise' || $hasCoords) {
            $totalLocalises++;
        } else {
            $totalNonLocalises++;
        }
    }

    $communesList = [];
    foreach ($communesMap as $name => $cData) {
        $cTotal = $cData['total'];
        $cVisites = $cData['visites'];
        $cov = $cTotal > 0 ? round(($cVisites / $cTotal) * 100) : 0;
        $communesList[] = [
            'name' => $name,
            'total' => $cTotal,
            'visites' => $cVisites,
            'a_visiter' => $cData['a_visiter'],
            'a_relancer' => $cData['a_relancer'],
            'coverage_pct' => $cov,
            'desc' => $cData['desc'],
            'quartiers' => $cData['quartiers']
        ];
    }

    $allVisits = getVisits();
    $allUsers = getUsers();

    $agentPerf = [];
    foreach ($allUsers as $u) {
        $userVisits = array_filter($allVisits, function($v) use ($u) {
            return ($v['user_id'] ?? '') === $u['id'] || strtolower($v['agent'] ?? '') === strtolower($u['name']);
        });
        $lastVisitDate = null;
        if (!empty($userVisits)) {
            $lastVisit = reset($userVisits);
            $lastVisitDate = $lastVisit['date'] ?? null;
        }
        $agentPerf[] = [
            'id' => $u['id'],
            'name' => $u['name'],
            'email' => $u['email'],
            'role' => $u['role'] ?? 'AGENT',
            'visits_count' => count($userVisits),
            'last_visit' => $lastVisitDate
        ];
    }

    $pctVisites = $total > 0 ? round(($visites / $total) * 100) : 0;
    $pctRelances = $total > 0 ? round(($aRelancer / $total) * 100) : 0;
    $pctVisiter = $total > 0 ? (100 - $pctVisites - $pctRelances) : 0;

    return [
        'total' => $total,
        'visites' => $visites,
        'a_visiter' => $aVisiter,
        'a_relancer' => $aRelancer,
        'a_verifier' => $aVerifier,
        'total_localises' => $totalLocalises,
        'total_non_localises' => $totalNonLocalises,
        'total_corriges' => $totalCorriges,
        'total_visits' => count($allVisits),
        'total_users' => count($allUsers),
        'coverage_pct' => $pctVisites,
        'pct_visites' => $pctVisites,
        'pct_relances' => $pctRelances,
        'pct_a_visiter' => max(0, $pctVisiter),
        'communes' => $communesList,
        'team_performances' => $agentPerf
    ];
}

// --- ROUTER ---

$action = $_GET['action'] ?? 'restaurants';

// CONFIGURATION ENDPOINTS
if ($action === 'get_config') {
    $cfg = getConfig();
    unset($cfg['google_maps_api_key_masked']);
    $cfg['has_key'] = !empty($cfg['google_maps_api_key']) || !empty(getenv('GOOGLE_MAPS_API_KEY'));
    echo json_encode(['success' => true, 'config' => $cfg]);
    exit;
}

if ($action === 'save_config' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $currentUser = getCurrentUser();
    if (!$currentUser || ($currentUser['role'] ?? '') !== 'ADMIN') {
        echo json_encode(['success' => false, 'error' => 'Action réservée aux Administrateurs']);
        exit;
    }
    $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
    $key = trim($input['google_maps_api_key'] ?? '');

    $cfg = getConfig();
    $cfg['google_maps_api_key'] = $key;
    saveConfig($cfg);

    echo json_encode(['success' => true, 'message' => 'Configuration Google Maps enregistrée avec succès !']);
    exit;
}

// GOOGLE PLACES LIVE SYNC
if ($action === 'sync_commune_places' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
    $commune = trim($input['commune'] ?? 'Cocody');

    $syncResult = fetchGooglePlacesForCommune($commune);
    $restaurants = getRestaurants();
    $syncResult['stats'] = calculateStats($restaurants);
    $syncResult['restaurants'] = $restaurants;

    echo json_encode($syncResult);
    exit;
}

// AUTH ACTIONS
if ($action === 'register' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
    
    $name = trim($input['name'] ?? '');
    $email = strtolower(trim($input['email'] ?? ''));
    $phone = trim($input['phone'] ?? '');
    $password = $input['password'] ?? '';
    $role = strtoupper(trim($input['role'] ?? 'AGENT'));

    if (!in_array($role, ['ADMIN', 'AGENT'])) $role = 'AGENT';

    if (!$name || !$email || !$password) {
        echo json_encode(['success' => false, 'error' => 'Veuillez remplir tous les champs obligatoires (Nom, Email, Mot de passe).']);
        exit;
    }

    $users = getUsers();
    foreach ($users as $u) {
        if (strtolower($u['email']) === $email) {
            echo json_encode(['success' => false, 'error' => 'Un compte existe déjà avec cette adresse email.']);
            exit;
        }
    }

    if (empty($users)) {
        $role = 'ADMIN';
    }

    $newUser = [
        'id' => 'USR-' . strtoupper(substr(uniqid(), -6)),
        'name' => $name,
        'email' => $email,
        'phone' => $phone,
        'role' => $role,
        'password_hash' => password_hash($password, PASSWORD_DEFAULT),
        'created_at' => date('Y-m-d H:i:s')
    ];

    $users[] = $newUser;
    saveUsers($users);

    $_SESSION['user_id'] = $newUser['id'];

    unset($newUser['password_hash']);
    echo json_encode(['success' => true, 'message' => 'Compte créé avec succès !', 'user' => $newUser]);
    exit;
}

if ($action === 'login' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;

    $email = strtolower(trim($input['email'] ?? ''));
    $password = $input['password'] ?? '';

    if (!$email || !$password) {
        echo json_encode(['success' => false, 'error' => 'Email et mot de passe requis.']);
        exit;
    }

    $users = getUsers();
    foreach ($users as $u) {
        if (strtolower($u['email']) === $email && password_verify($password, $u['password_hash'])) {
        $_SESSION['user_id'] = $u['id'];
            $_SESSION['logged_out'] = false; // Annuler tout flag de déconnexion précédent
            unset($u['password_hash']);
            echo json_encode(['success' => true, 'message' => 'Connexion réussie', 'user' => $u]);
            exit;
        }
    }

    echo json_encode(['success' => false, 'error' => 'Email ou mot de passe incorrect.']);
    exit;
}

if ($action === 'logout') {
    // Détruire la session actuelle proprement
    session_unset();
    session_destroy();
    // Démarrer une nouvelle session vierge et poser le flag de déconnexion
    session_start();
    $_SESSION['logged_out'] = true;
    $_SESSION['user_id'] = null;
    echo json_encode(['success' => true, 'message' => 'Déconnexion effectuée']);
    exit;
}

if ($action === 'me') {
    $currentUser = getCurrentUser();
    echo json_encode(['success' => true, 'user' => $currentUser]);
    exit;
}

if ($action === 'users') {
    $currentUser = getCurrentUser();
    $users = getUsers();
    $sanitizedUsers = array_map(function($u) {
        unset($u['password_hash']);
        return $u;
    }, $users);

    echo json_encode([
        'success' => true,
        'users' => $sanitizedUsers,
        'is_admin' => ($currentUser && ($currentUser['role'] ?? '') === 'ADMIN')
    ]);
    exit;
}

if ($action === 'stats') {
    $restaurants = getRestaurants();
    echo json_encode(['success' => true, 'stats' => calculateStats($restaurants), 'user' => getCurrentUser()]);
    exit;
}

if ($action === 'restaurant') {
    $id = $_GET['id'] ?? '';
    $restaurants = getRestaurants();
    foreach ($restaurants as $r) {
        if ($r['id'] === $id || ($r['google_place_id'] ?? '') === $id) {
            echo json_encode(['success' => true, 'restaurant' => $r]);
            exit;
        }
    }
    echo json_encode(['success' => false, 'error' => 'Restaurant non trouvé']);
    exit;
}

if ($action === 'restaurants') {
    $restaurants = getRestaurants();
    $currentUser = getCurrentUser();

    // RLS / Contrôle d'accès par rôle :
    // Un agent ne voit sur la carte que les restaurants de ses communes (s'il en a d'assignées). L'admin voit tout.
    if ($currentUser && ($currentUser['role'] ?? '') === 'AGENT') {
        $assignedCommunes = $currentUser['assigned_communes'] ?? [];
        if (!empty($assignedCommunes)) {
            $restaurants = array_values(array_filter($restaurants, function($r) use ($assignedCommunes) {
                return in_array(strtolower($r['commune']), array_map('strtolower', $assignedCommunes));
            }));
        }
    }

    $commune = trim($_GET['commune'] ?? '');
    $quartier = trim($_GET['quartier'] ?? '');
    $status = trim($_GET['status'] ?? '');
    $geocodeStatus = trim($_GET['geocode_status'] ?? '');
    $assignedAgent = trim($_GET['agent'] ?? '');
    $q = trim($_GET['q'] ?? '');

    $filtered = array_filter($restaurants, function($r) use ($commune, $quartier, $status, $geocodeStatus, $assignedAgent, $q) {
        if ($commune !== '' && strtolower($r['commune']) !== strtolower($commune)) {
            return false;
        }
        if ($quartier !== '' && strtolower($r['zone'] ?? '') !== strtolower($quartier) && strtolower($r['quartier'] ?? '') !== strtolower($quartier)) {
            return false;
        }
        if ($status !== '' && $status !== 'all' && $status !== 'tous' && $r['status'] !== $status) {
            return false;
        }
        if ($geocodeStatus !== '' && $geocodeStatus !== 'all') {
            $rGeo = $r['geocode_status'] ?? 'non_localise';
            $hasCoords = !empty($r['latitude']) && !empty($r['longitude']);
            if ($geocodeStatus === 'localise' && (!$hasCoords || ($rGeo !== 'localise' && $rGeo !== 'corrige_manuellement'))) {
                return false;
            } elseif ($geocodeStatus === 'non_localise' && ($hasCoords && $rGeo !== 'non_localise')) {
                return false;
            } elseif ($geocodeStatus === 'corrige_manuellement' && $rGeo !== 'corrige_manuellement') {
                return false;
            }
        }
        if ($assignedAgent !== '' && $assignedAgent !== 'all') {
            if (strtolower($r['assigned_to'] ?? '') !== strtolower($assignedAgent)) {
                return false;
            }
        }
        if ($q !== '') {
            $haystack = strtolower(($r['name'] ?? '') . ' ' . ($r['commune'] ?? '') . ' ' . ($r['zone'] ?? '') . ' ' . ($r['quartier'] ?? '') . ' ' . ($r['address'] ?? '') . ' ' . ($r['cuisine'] ?? ''));
            if (strpos($haystack, strtolower($q)) === false) {
                return false;
            }
        }
        return true;
    });

    echo json_encode([
        'success' => true,
        'count' => count($filtered),
        'restaurants' => array_values($filtered),
        'stats' => calculateStats($restaurants),
        'user' => $currentUser
    ]);
    exit;
}

if ($action === 'visits') {
    $visits = getVisits();
    usort($visits, function($a, $b) {
        return strcmp($b['date'] ?? '', $a['date'] ?? '');
    });
    echo json_encode(['success' => true, 'visits' => $visits]);
    exit;
}

if ($action === 'record_visit' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $currentUser = getCurrentUser();
    $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;

    $restaurantId = $input['restaurant_id'] ?? '';
    $resultKey = $input['result'] ?? 'interesse';
    $contactName = trim($input['contact_name'] ?? '');
    $contactRole = trim($input['contact_role'] ?? '');
    $contactPhone = trim($input['contact_phone'] ?? '');
    $notes = trim($input['notes'] ?? '');
    $tags = is_array($input['tags'] ?? null) ? $input['tags'] : [];
    $nextAction = $input['next_action'] ?? 'none';
    $followUpDate = trim($input['follow_up_date'] ?? '');
    
    $agentName = $currentUser ? $currentUser['name'] : (trim($input['agent'] ?? '') ?: 'Agent Commercial');
    $userId = $currentUser ? $currentUser['id'] : null;

    $resultLabels = [
        'tres_interesse' => 'Contact établi - Très intéressé',
        'interesse' => 'Contact établi - Intéressé',
        'relancer' => 'Responsable absent / À relancer',
        'refus' => 'Pas intéressé / Refus',
        'ferme' => 'Établissement fermé / Rideau baissé'
    ];

    $actionLabels = [
        'send_doc' => 'Envoyer présentation / doc',
        'revenir' => 'Revenir sur place',
        'rappeler' => 'Rappeler par téléphone',
        'none' => 'Aucune'
    ];

    if (in_array($resultKey, ['tres_interesse', 'interesse', 'refus'])) {
        $newStatus = 'VISITE';
    } elseif ($resultKey === 'relancer') {
        $newStatus = 'A_RELANCER';
    } elseif ($resultKey === 'ferme') {
        $newStatus = 'A_VERIFIER';
    } else {
        $newStatus = 'VISITE';
    }

    $restaurants = getRestaurants();
    $foundRestaurant = null;
    $updatedIndex = -1;

    foreach ($restaurants as $idx => $r) {
        if ($r['id'] === $restaurantId || ($r['google_place_id'] ?? '') === $restaurantId) {
            $foundRestaurant = $r;
            $updatedIndex = $idx;
            break;
        }
    }

    if ($updatedIndex === -1) {
        echo json_encode(['success' => false, 'error' => 'Restaurant introuvable']);
        exit;
    }

    $now = date('Y-m-d H:i');
    $visitRecord = [
        'id' => 'VIS-' . strtoupper(substr(uniqid(), -6)),
        'restaurant_id' => $foundRestaurant['id'],
        'google_place_id' => $foundRestaurant['google_place_id'] ?? null,
        'restaurant_name' => $foundRestaurant['name'],
        'user_id' => $userId,
        'agent' => $agentName,
        'commune' => $foundRestaurant['commune'],
        'quartier' => ($foundRestaurant['zone'] ?? '') . ' ' . ($foundRestaurant['quartier'] ?? ''),
        'date' => $now,
        'result' => $resultKey,
        'result_label' => $resultLabels[$resultKey] ?? $resultKey,
        'contact_name' => $contactName ?: ($foundRestaurant['decision_maker']['name'] ?? 'Non précisé'),
        'contact_role' => $contactRole ?: ($foundRestaurant['decision_maker']['role'] ?? ''),
        'contact_phone' => $contactPhone ?: ($foundRestaurant['decision_maker']['phone'] ?? ''),
        'notes' => $notes,
        'tags' => $tags,
        'next_action' => $nextAction,
        'next_action_label' => $actionLabels[$nextAction] ?? $nextAction,
        'follow_up_date' => $followUpDate ?: null,
        'created_at' => date('Y-m-d H:i:s')
    ];

    $restaurants[$updatedIndex]['status'] = $newStatus;
    $restaurants[$updatedIndex]['assigned_to'] = $agentName;
    if ($contactName) {
        $restaurants[$updatedIndex]['decision_maker']['name'] = $contactName;
    }
    if ($contactRole) {
        $restaurants[$updatedIndex]['decision_maker']['role'] = $contactRole;
    }
    if ($contactPhone) {
        $restaurants[$updatedIndex]['decision_maker']['phone'] = $contactPhone;
    }
    $restaurants[$updatedIndex]['last_visit'] = [
        'date' => $now,
        'user_id' => $userId,
        'agent' => $agentName,
        'result' => $resultKey,
        'result_label' => $resultLabels[$resultKey] ?? $resultKey,
        'notes' => $notes,
        'contact_met' => $contactName . ($contactRole ? " ($contactRole)" : ''),
        'next_action' => $actionLabels[$nextAction] ?? $nextAction
    ];
    if ($followUpDate) {
        $restaurants[$updatedIndex]['next_follow_up'] = $followUpDate;
    }

    saveRestaurants($restaurants);

    $visits = getVisits();
    array_unshift($visits, $visitRecord);
    saveVisits($visits);

    echo json_encode([
        'success' => true,
        'message' => 'Visite enregistrée avec succès !',
        'new_status' => $newStatus,
        'visit' => $visitRecord,
        'restaurant' => $restaurants[$updatedIndex],
        'stats' => calculateStats($restaurants)
    ]);
    exit;
}

if ($action === 'update_visit' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $currentUser = getCurrentUser();
    if (!$currentUser) {
        echo json_encode(['success' => false, 'error' => 'Veuillez vous connecter.']);
        exit;
    }
    $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
    $visitId = trim($input['visit_id'] ?? '');

    if (!$visitId) {
        echo json_encode(['success' => false, 'error' => 'ID de visite requis']);
        exit;
    }

    $visits = getVisits();
    $visitIndex = -1;
    foreach ($visits as $idx => $v) {
        if ($v['id'] === $visitId) {
            $visitIndex = $idx;
            break;
        }
    }

    if ($visitIndex === -1) {
        echo json_encode(['success' => false, 'error' => 'Visite introuvable']);
        exit;
    }

    $resultLabels = [
        'tres_interesse' => 'Contact établi - Très intéressé',
        'interesse' => 'Contact positif - Intéressé',
        'relancer' => 'À relancer - Décisionnaire absent',
        'refus' => 'Refus temporaire / Pas intéressé',
        'ferme' => 'Établissement fermé / Inexistant'
    ];

    $actionLabels = [
        'send_doc' => 'Envoyer présentation / doc',
        'call_back' => 'Rappeler le gérant',
        'revisit' => 'Re-passer sur place',
        'sign' => 'Rendez-vous de signature',
        'none' => 'Aucune relance'
    ];

    $resultKey = $input['result'] ?? $visits[$visitIndex]['result'];
    $notes = trim($input['notes'] ?? $visits[$visitIndex]['notes']);
    $contactName = trim($input['contact_name'] ?? $visits[$visitIndex]['contact_name']);
    $contactRole = trim($input['contact_role'] ?? $visits[$visitIndex]['contact_role']);
    $contactPhone = trim($input['contact_phone'] ?? $visits[$visitIndex]['contact_phone']);
    $nextAction = $input['next_action'] ?? $visits[$visitIndex]['next_action'];
    $followUpDate = trim($input['follow_up_date'] ?? $visits[$visitIndex]['follow_up_date']);

    $visits[$visitIndex]['result'] = $resultKey;
    $visits[$visitIndex]['result_label'] = $resultLabels[$resultKey] ?? $resultKey;
    $visits[$visitIndex]['notes'] = $notes;
    $visits[$visitIndex]['contact_name'] = $contactName;
    $visits[$visitIndex]['contact_role'] = $contactRole;
    $visits[$visitIndex]['contact_phone'] = $contactPhone;
    $visits[$visitIndex]['next_action'] = $nextAction;
    $visits[$visitIndex]['next_action_label'] = $actionLabels[$nextAction] ?? $nextAction;
    $visits[$visitIndex]['follow_up_date'] = $followUpDate ?: null;
    $visits[$visitIndex]['updated_at'] = date('Y-m-d H:i:s');

    saveVisits($visits);

    $restaurants = getRestaurants();
    foreach ($restaurants as &$r) {
        if ($r['id'] === $visits[$visitIndex]['restaurant_id']) {
            if ($contactName) $r['decision_maker']['name'] = $contactName;
            if ($contactRole) $r['decision_maker']['role'] = $contactRole;
            if ($contactPhone) $r['decision_maker']['phone'] = $contactPhone;
            if (!empty($r['last_visit']) && ($r['last_visit']['date'] ?? '') === $visits[$visitIndex]['date']) {
                $r['last_visit']['notes'] = $notes;
                $r['last_visit']['result'] = $resultKey;
                $r['last_visit']['result_label'] = $resultLabels[$resultKey] ?? $resultKey;
                $r['last_visit']['next_action'] = $actionLabels[$nextAction] ?? $nextAction;
            }
            if ($followUpDate) $r['next_follow_up'] = $followUpDate;
            break;
        }
    }
    saveRestaurants($restaurants);

    logActivity('visit_updated', "Visite $visitId modifiée par " . ($currentUser['name'] ?? 'Admin'));

    echo json_encode([
        'success' => true,
        'message' => 'Rapport de visite mis à jour avec succès !',
        'visit' => $visits[$visitIndex]
    ]);
    exit;
}

if ($action === 'delete_visit' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $currentUser = getCurrentUser();
    if (!$currentUser) {
        echo json_encode(['success' => false, 'error' => 'Veuillez vous connecter.']);
        exit;
    }
    $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
    $visitId = trim($input['visit_id'] ?? '');

    if (!$visitId) {
        echo json_encode(['success' => false, 'error' => 'ID de visite requis']);
        exit;
    }

    $visits = getVisits();
    $targetVisit = null;
    foreach ($visits as $v) {
        if ($v['id'] === $visitId) {
            $targetVisit = $v;
            break;
        }
    }

    if (!$targetVisit) {
        echo json_encode(['success' => false, 'error' => 'Visite introuvable']);
        exit;
    }

    $newVisits = array_values(array_filter($visits, fn($v) => $v['id'] !== $visitId));
    saveVisits($newVisits);

    // Mettre à jour la fiche du restaurant correspondant
    $restaurants = getRestaurants();
    foreach ($restaurants as &$r) {
        if ($r['id'] === $targetVisit['restaurant_id']) {
            if (!empty($r['last_visit']) && ($r['last_visit']['date'] ?? '') === $targetVisit['date']) {
                $otherVisits = array_values(array_filter($newVisits, fn($v) => $v['restaurant_id'] === $r['id']));
                if (!empty($otherVisits)) {
                    $prev = $otherVisits[0];
                    $r['last_visit'] = [
                        'date' => $prev['date'],
                        'user_id' => $prev['user_id'] ?? null,
                        'agent' => $prev['agent'],
                        'result' => $prev['result'],
                        'result_label' => $prev['result_label'],
                        'notes' => $prev['notes'],
                        'contact_met' => $prev['contact_name'],
                        'next_action' => $prev['next_action_label']
                    ];
                } else {
                    $r['last_visit'] = null;
                    $r['status'] = 'A_VISITER';
                }
            }
            break;
        }
    }
    saveRestaurants($restaurants);

    logActivity('visit_deleted', "Visite $visitId supprimée par " . ($currentUser['name'] ?? 'Admin'));

    echo json_encode(['success' => true, 'message' => 'Visite supprimée avec succès !']);
    exit;
}

if ($action === 'reset_system' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $currentUser = getCurrentUser();
    if (!$currentUser || ($currentUser['role'] ?? '') !== 'ADMIN') {
        echo json_encode(['success' => false, 'error' => 'Action réservée aux Administrateurs']);
        exit;
    }

    $restaurants = getRestaurants();
    foreach ($restaurants as &$r) {
        $r['status'] = 'A_VISITER';
        $r['last_visit'] = null;
        $r['next_follow_up'] = null;
        $r['assigned_to'] = null;
    }
    saveRestaurants($restaurants);
    saveVisits([]);

    echo json_encode(['success' => true, 'message' => 'Base réinitialisée avec succès !']);
    exit;
}

// MIGRATION DU SCHÉMA GÉOGRAPHIQUE
if ($action === 'migrate_geocode_schema') {
    global $restaurantsFile;
    $restaurants = getRestaurants();
    $bakFile = __DIR__ . '/data/restaurants.json.bak';
    copy($restaurantsFile, $bakFile);

    $migrated = 0;
    foreach ($restaurants as &$r) {
        if (!isset($r['latitude'])) $r['latitude'] = null;
        if (!isset($r['longitude'])) $r['longitude'] = null;
        $hasCoords = !empty($r['latitude']) && !empty($r['longitude']) && is_numeric($r['latitude']) && is_numeric($r['longitude']);
        if (!isset($r['geocode_status']) || empty($r['geocode_status'])) {
            $r['geocode_status'] = $hasCoords ? 'localise' : 'non_localise';
        }
        if (!isset($r['coordinates_source'])) {
            $r['coordinates_source'] = $hasCoords ? 'initial' : null;
        }
        $migrated++;
    }
    saveRestaurants($restaurants);
    logActivity('migration', "Migration du schéma geocode_status sur $migrated restaurants", ['backup' => basename($bakFile)]);

    echo json_encode([
        'success' => true,
        'message' => "Schéma migré avec succès sur $migrated restaurants",
        'stats' => calculateStats($restaurants)
    ]);
    exit;
}

// MISE À JOUR MANUELLE DES COORDONNÉES (MARQUEUR DÉPLAÇABLE / DRAGGABLE)
if ($action === 'update_coordinates' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
    $id = trim($input['id'] ?? '');
    $lat = isset($input['latitude']) ? floatval($input['latitude']) : null;
    $lng = isset($input['longitude']) ? floatval($input['longitude']) : null;

    if (!$id || $lat === null || $lng === null) {
        echo json_encode(['success' => false, 'error' => 'Identifiant et coordonnées (latitude, longitude) requis.']);
        exit;
    }

    if ($lat < -90 || $lat > 90 || $lng < -180 || $lng > 180) {
        echo json_encode(['success' => false, 'error' => 'Coordonnées GPS invalides.']);
        exit;
    }

    $restaurants = getRestaurants();
    $targetIndex = -1;
    foreach ($restaurants as $idx => $r) {
        if ($r['id'] === $id || ($r['google_place_id'] ?? '') === $id) {
            $targetIndex = $idx;
            break;
        }
    }

    if ($targetIndex === -1) {
        echo json_encode(['success' => false, 'error' => 'Restaurant introuvable.']);
        exit;
    }

    $oldLat = $restaurants[$targetIndex]['latitude'] ?? null;
    $oldLng = $restaurants[$targetIndex]['longitude'] ?? null;

    $restaurants[$targetIndex]['latitude'] = $lat;
    $restaurants[$targetIndex]['longitude'] = $lng;
    $restaurants[$targetIndex]['geocode_status'] = 'corrige_manuellement';
    $restaurants[$targetIndex]['coordinates_source'] = 'manual_drag';
    $restaurants[$targetIndex]['updated_at'] = date('Y-m-d H:i:s');

    saveRestaurants($restaurants);

    logActivity('coord_manual_drag', "Position corrigée manuellement pour {$restaurants[$targetIndex]['name']}", [
        'id' => $id,
        'old_coords' => [$oldLat, $oldLng],
        'new_coords' => [$lat, $lng]
    ]);

    echo json_encode([
        'success' => true,
        'message' => 'Position enregistrée et marquée comme corrigée manuellement.',
        'restaurant' => $restaurants[$targetIndex],
        'stats' => calculateStats($restaurants)
    ]);
    exit;
}

// GÉOCODAGE UNITAIRE SERVEUR VIA NOMINATIM (OPENSTREETMAP)
if ($action === 'geocode_restaurant' && ($_SERVER['REQUEST_METHOD'] === 'POST' || $_SERVER['REQUEST_METHOD'] === 'GET')) {
    $input = json_decode(file_get_contents('php://input'), true) ?: $_REQUEST;
    $id = trim($input['id'] ?? '');
    $force = !empty($input['force']);

    if (!$id) {
        echo json_encode(['success' => false, 'error' => 'Identifiant du restaurant requis.']);
        exit;
    }

    $restaurants = getRestaurants();
    $targetIndex = -1;
    foreach ($restaurants as $idx => $r) {
        if ($r['id'] === $id || ($r['google_place_id'] ?? '') === $id) {
            $targetIndex = $idx;
            break;
        }
    }

    if ($targetIndex === -1) {
        echo json_encode(['success' => false, 'error' => 'Restaurant introuvable.']);
        exit;
    }

    $restaurant = $restaurants[$targetIndex];

    // Ne jamais géocoder deux fois si déjà localisé sauf si force demandé
    if (!$force && in_array($restaurant['geocode_status'] ?? '', ['localise', 'corrige_manuellement']) && !empty($restaurant['latitude'])) {
        echo json_encode([
            'success' => true,
            'message' => 'Restaurant déjà localisé (mise en cache serveur).',
            'cached' => true,
            'restaurant' => $restaurant
        ]);
        exit;
    }

    $geoRes = geocodeWithNominatim($restaurant);

    if ($geoRes['success']) {
        $restaurants[$targetIndex]['latitude'] = $geoRes['latitude'];
        $restaurants[$targetIndex]['longitude'] = $geoRes['longitude'];
        $restaurants[$targetIndex]['geocode_status'] = 'localise';
        $restaurants[$targetIndex]['coordinates_source'] = $geoRes['source'];
        $restaurants[$targetIndex]['updated_at'] = date('Y-m-d H:i:s');
        saveRestaurants($restaurants);

        logActivity('geocode_auto', "Localisation automatique de {$restaurant['name']}", [
            'id' => $id,
            'source' => $geoRes['source'],
            'coords' => [$geoRes['latitude'], $geoRes['longitude']]
        ]);

        echo json_encode([
            'success' => true,
            'message' => 'Restaurant géolocalisé avec succès via OpenStreetMap Nominatim !',
            'restaurant' => $restaurants[$targetIndex],
            'details' => $geoRes
        ]);
    } else {
        $restaurants[$targetIndex]['geocode_status'] = 'non_localise';
        $restaurants[$targetIndex]['updated_at'] = date('Y-m-d H:i:s');
        saveRestaurants($restaurants);

        logActivity('geocode_fail', "Échec de localisation de {$restaurant['name']}", [
            'id' => $id,
            'queries' => $geoRes['queries_tried'] ?? []
        ]);

        echo json_encode([
            'success' => false,
            'error' => 'Aucune correspondance trouvée sur OpenStreetMap pour cette adresse.',
            'restaurant' => $restaurants[$targetIndex],
            'queries' => $geoRes['queries_tried'] ?? []
        ]);
    }
    exit;
}

// GÉOCODAGE PAR LOT DE 20 (BATCH NOMINATIM)
if ($action === 'geocode_batch' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
    $limit = isset($input['limit']) ? min(20, max(1, intval($input['limit']))) : 20;

    $restaurants = getRestaurants();
    $candidates = [];

    foreach ($restaurants as $idx => $r) {
        $hasCoords = !empty($r['latitude']) && !empty($r['longitude']) && is_numeric($r['latitude']) && is_numeric($r['longitude']);
        $isNonLocalise = ($r['geocode_status'] ?? '') === 'non_localise' || !$hasCoords;
        if ($isNonLocalise) {
            $candidates[] = $idx;
            if (count($candidates) >= $limit) break;
        }
    }

    if (empty($candidates)) {
        echo json_encode([
            'success' => true,
            'message' => 'Tous les établissements sont déjà localisés !',
            'processed' => 0,
            'localized' => 0,
            'failed' => 0,
            'remaining' => 0,
            'stats' => calculateStats($restaurants)
        ]);
        exit;
    }

    $localizedCount = 0;
    $failedCount = 0;
    $batchDetails = [];

    foreach ($candidates as $idx) {
        $r = $restaurants[$idx];
        $res = geocodeWithNominatim($r);

        if ($res['success']) {
            $restaurants[$idx]['latitude'] = $res['latitude'];
            $restaurants[$idx]['longitude'] = $res['longitude'];
            $restaurants[$idx]['geocode_status'] = 'localise';
            $restaurants[$idx]['coordinates_source'] = $res['source'];
            $localizedCount++;
            $batchDetails[] = ['id' => $r['id'], 'name' => $r['name'], 'status' => 'localise', 'lat' => $res['latitude'], 'lng' => $res['longitude']];
        } else {
            $restaurants[$idx]['geocode_status'] = 'non_localise';
            $failedCount++;
            $batchDetails[] = ['id' => $r['id'], 'name' => $r['name'], 'status' => 'non_localise'];
        }
    }

    saveRestaurants($restaurants);

    // Calcul du reste
    $remainingCount = 0;
    foreach ($restaurants as $r) {
        $hasCoords = !empty($r['latitude']) && !empty($r['longitude']) && is_numeric($r['latitude']) && is_numeric($r['longitude']);
        if (($r['geocode_status'] ?? '') === 'non_localise' || !$hasCoords) {
            $remainingCount++;
        }
    }

    logActivity('geocode_batch', "Géocodage par lot de " . count($candidates) . " établissements", [
        'localized' => $localizedCount,
        'failed' => $failedCount,
        'remaining' => $remainingCount
    ]);

    echo json_encode([
        'success' => true,
        'processed' => count($candidates),
        'localized' => $localizedCount,
        'failed' => $failedCount,
        'remaining' => $remainingCount,
        'batch_details' => $batchDetails,
        'stats' => calculateStats($restaurants)
    ]);
    exit;
}

// JOURNAL D'ACTIVITÉ
if ($action === 'activity_logs') {
    $logs = getActivityLogs();
    echo json_encode(['success' => true, 'logs' => $logs]);
    exit;
}

// AJOUT D'UN RESTAURANT
if ($action === 'add_restaurant' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
    $name = trim($input['name'] ?? '');
    $commune = trim($input['commune'] ?? 'Cocody');
    $quartier = trim($input['quartier'] ?? $commune);
    $address = trim($input['address'] ?? ($commune . ', Abidjan'));
    $phone = trim($input['phone'] ?? '');
    $cuisine = trim($input['cuisine'] ?? 'Restaurant / Maquis');
    $lat = isset($input['latitude']) && $input['latitude'] !== '' ? floatval($input['latitude']) : null;
    $lng = isset($input['longitude']) && $input['longitude'] !== '' ? floatval($input['longitude']) : null;

    if (!$name) {
        echo json_encode(['success' => false, 'error' => 'Nom du restaurant requis.']);
        exit;
    }

    $newId = 'RES-' . strtoupper(substr(uniqid(), -6));
    $geoStatus = 'non_localise';
    $geoSource = null;

    if ($lat !== null && $lng !== null) {
        $geoStatus = 'localise';
        $geoSource = 'manual_input';
    }

    $record = [
        'id' => $newId,
        'google_place_id' => null,
        'name' => $name,
        'commune' => $commune,
        'zone' => $quartier,
        'quartier' => $quartier,
        'address' => $address,
        'latitude' => $lat,
        'longitude' => $lng,
        'geocode_status' => $geoStatus,
        'coordinates_source' => $geoSource,
        'phone' => $phone ?: null,
        'website' => null,
        'opening_hours' => null,
        'cuisine' => $cuisine,
        'status' => 'A_VISITER',
        'decision_maker' => ['name' => null, 'role' => 'Gérant', 'phone' => $phone ?: null],
        'photo' => null,
        'last_visit' => null,
        'next_follow_up' => null,
        'assigned_to' => null,
        'source' => 'manual_entry',
        'created_at' => date('Y-m-d H:i:s')
    ];

    // Géocodage automatique si coordonnées non fournies
    if ($lat === null || $lng === null) {
        $geoRes = geocodeWithNominatim($record);
        if ($geoRes['success']) {
            $record['latitude'] = $geoRes['latitude'];
            $record['longitude'] = $geoRes['longitude'];
            $record['geocode_status'] = 'localise';
            $record['coordinates_source'] = $geoRes['source'];
        }
    }

    $restaurants = getRestaurants();
    array_unshift($restaurants, $record);
    saveRestaurants($restaurants);

    logActivity('restaurant_created', "Création du restaurant $name ($commune)", [
        'id' => $newId,
        'geocode_status' => $record['geocode_status']
    ]);

    echo json_encode([
        'success' => true,
        'message' => 'Restaurant créé avec succès !',
        'restaurant' => $record,
        'stats' => calculateStats($restaurants)
    ]);
    exit;
}

// TOGGLE USER COMMUNE ASSIGNMENT
if ($action === 'toggle_user_commune' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $currentUser = getCurrentUser();
    if (!$currentUser || ($currentUser['role'] ?? '') !== 'ADMIN') {
        echo json_encode(['success' => false, 'error' => 'Action réservée aux Administrateurs']);
        exit;
    }
    $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
    $userId = trim($input['user_id'] ?? '');
    $commune = trim($input['commune'] ?? '');

    if (!$userId || !$commune) {
        echo json_encode(['success' => false, 'error' => 'Paramètres manquants']);
        exit;
    }

    $users = getUsers();
    $targetIndex = -1;
    foreach ($users as $idx => $u) {
        if ($u['id'] === $userId) { $targetIndex = $idx; break; }
    }
    if ($targetIndex === -1) {
        echo json_encode(['success' => false, 'error' => 'Utilisateur introuvable']);
        exit;
    }

    $assignedCommunes = $users[$targetIndex]['assigned_communes'] ?? [];
    $isAssigned = in_array($commune, $assignedCommunes);
    if ($isAssigned) {
        $assignedCommunes = array_values(array_filter($assignedCommunes, fn($c) => $c !== $commune));
    } else {
        $assignedCommunes[] = $commune;
    }
    $users[$targetIndex]['assigned_communes'] = array_values($assignedCommunes);
    saveUsers($users);

    echo json_encode(['success' => true, 'assigned' => !$isAssigned, 'assigned_communes' => $assignedCommunes]);
    exit;
}

// UPDATE USER ROLE
if ($action === 'update_user_role' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $currentUser = getCurrentUser();
    if (!$currentUser || ($currentUser['role'] ?? '') !== 'ADMIN') {
        echo json_encode(['success' => false, 'error' => 'Action réservée aux Administrateurs']);
        exit;
    }
    $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
    $userId = trim($input['user_id'] ?? '');
    $newRole = strtoupper(trim($input['role'] ?? ''));

    if (!in_array($newRole, ['ADMIN', 'AGENT'])) {
        echo json_encode(['success' => false, 'error' => 'Rôle invalide']);
        exit;
    }

    $users = getUsers();
    $found = false;
    foreach ($users as &$u) {
        if ($u['id'] === $userId) {
            $u['role'] = $newRole;
            $found = true;
            break;
        }
    }
    if (!$found) {
        echo json_encode(['success' => false, 'error' => 'Utilisateur introuvable']);
        exit;
    }
    saveUsers($users);
    logActivity('role_change', "Rôle de l'utilisateur $userId changé en $newRole", ['user_id' => $userId, 'new_role' => $newRole]);
    echo json_encode(['success' => true, 'message' => "Rôle mis à jour : $newRole"]);
    exit;
}

// DELETE USER
if ($action === 'delete_user' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $currentUser = getCurrentUser();
    if (!$currentUser || ($currentUser['role'] ?? '') !== 'ADMIN') {
        echo json_encode(['success' => false, 'error' => 'Action réservée aux Administrateurs']);
        exit;
    }
    $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
    $userId = trim($input['user_id'] ?? '');

    if (!$userId) {
        echo json_encode(['success' => false, 'error' => 'Identifiant requis']);
        exit;
    }
    // Prevent self-deletion
    if ($userId === $currentUser['id']) {
        echo json_encode(['success' => false, 'error' => 'Vous ne pouvez pas supprimer votre propre compte']);
        exit;
    }

    $users = getUsers();
    $newUsers = array_values(array_filter($users, fn($u) => $u['id'] !== $userId));
    if (count($newUsers) === count($users)) {
        echo json_encode(['success' => false, 'error' => 'Utilisateur introuvable']);
        exit;
    }
    saveUsers($newUsers);
    logActivity('user_deleted', "Utilisateur $userId supprimé", ['user_id' => $userId]);
    echo json_encode(['success' => true, 'message' => 'Utilisateur supprimé']);
    exit;
}

// CREATE USER (ADMIN ONLY)
if ($action === 'create_user' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $currentUser = getCurrentUser();
    if (!$currentUser || ($currentUser['role'] ?? '') !== 'ADMIN') {
        echo json_encode(['success' => false, 'error' => 'Action réservée aux Administrateurs']);
        exit;
    }
    $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
    $name = trim($input['name'] ?? '');
    $email = strtolower(trim($input['email'] ?? ''));
    $phone = trim($input['phone'] ?? '');
    $role = strtoupper(trim($input['role'] ?? 'AGENT'));
    $assignedCommunes = $input['assigned_communes'] ?? [];
    if (!is_array($assignedCommunes)) $assignedCommunes = [];

    if (!$name || !$email) {
        echo json_encode(['success' => false, 'error' => 'Nom et Email sont obligatoires']);
        exit;
    }

    $users = getUsers();
    foreach ($users as $u) {
        if (strtolower($u['email']) === $email) {
            echo json_encode(['success' => false, 'error' => 'Un compte existe déjà avec cette adresse email']);
            exit;
        }
    }

    $rawPassword = !empty($input['password']) ? trim($input['password']) : 'MS-' . substr(md5(uniqid()), 0, 6);

    $newUser = [
        'id' => 'USR-' . strtoupper(substr(uniqid(), -6)),
        'name' => $name,
        'email' => $email,
        'phone' => $phone,
        'role' => in_array($role, ['ADMIN', 'AGENT']) ? $role : 'AGENT',
        'assigned_communes' => array_values($assignedCommunes),
        'password_hash' => password_hash($rawPassword, PASSWORD_DEFAULT),
        'created_at' => date('Y-m-d H:i:s')
    ];

    $users[] = $newUser;
    saveUsers($users);
    logActivity('user_created', "Création du compte $email par l'administrateur", ['user_id' => $newUser['id'], 'email' => $email]);

    unset($newUser['password_hash']);
    echo json_encode([
        'success' => true,
        'message' => 'Compte créé avec succès !',
        'user' => $newUser,
        'generated_password' => $rawPassword
    ]);
    exit;
}

// RESET USER PASSWORD (ADMIN ONLY)
if ($action === 'reset_user_password' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $currentUser = getCurrentUser();
    if (!$currentUser || ($currentUser['role'] ?? '') !== 'ADMIN') {
        echo json_encode(['success' => false, 'error' => 'Action réservée aux Administrateurs']);
        exit;
    }
    $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
    $userId = trim($input['user_id'] ?? '');

    if (!$userId) {
        echo json_encode(['success' => false, 'error' => 'Identifiant utilisateur requis']);
        exit;
    }

    $users = getUsers();
    $found = false;
    $newPassword = 'MS-' . substr(md5(uniqid()), 0, 6);
    foreach ($users as &$u) {
        if ($u['id'] === $userId) {
            $u['password_hash'] = password_hash($newPassword, PASSWORD_DEFAULT);
            $found = true;
            break;
        }
    }
    if (!$found) {
        echo json_encode(['success' => false, 'error' => 'Utilisateur introuvable']);
        exit;
    }

    saveUsers($users);
    logActivity('password_reset', "Mot de passe réinitialisé pour l'utilisateur $userId", ['user_id' => $userId]);
    echo json_encode(['success' => true, 'message' => 'Mot de passe réinitialisé !', 'new_password' => $newPassword]);
    exit;
}

echo json_encode(['success' => false, 'error' => 'Action non valide']);
