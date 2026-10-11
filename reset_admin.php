<?php
// Script de réinitialisation du mot de passe admin - ONE TIME USE
// À supprimer après utilisation !

$secret = $_GET['secret'] ?? '';
if ($secret !== 'reset-falikou-2026') {
    http_response_code(403);
    die('Accès refusé');
}

$usersFile = __DIR__ . '/data/users.json';

if (!file_exists($usersFile)) {
    die('users.json introuvable : ' . $usersFile);
}

$users = json_decode(file_get_contents($usersFile), true);
if (!$users) {
    die('Erreur lecture users.json');
}

$newPassword = 'Admin1234';
$newHash = password_hash($newPassword, PASSWORD_DEFAULT);

$updated = false;
foreach ($users as &$u) {
    if ($u['role'] === 'ADMIN') {
        $u['password_hash'] = $newHash;
        $updated = true;
        echo "✅ Admin mis à jour : " . htmlspecialchars($u['email']) . "<br>";
    }
}

if ($updated) {
    $result = file_put_contents($usersFile, json_encode($users, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    if ($result !== false) {
        echo "<br>✅ users.json sauvegardé avec succès !<br>";
        echo "<br><strong>Nouveau hash :</strong> " . htmlspecialchars($newHash) . "<br>";
        echo "<br><strong>Vérification :</strong> " . (password_verify($newPassword, $newHash) ? '✅ OK' : '❌ ERREUR') . "<br>";
        echo "<br><hr><br>";
        echo "🔑 <strong>Identifiants admin :</strong><br>";
        echo "Email : fofanafalikou068@gmail.com<br>";
        echo "Mot de passe : Admin1234<br>";
        echo "<br><strong style='color:red'>⚠️ Supprimez ce fichier après utilisation !</strong>";
    } else {
        echo "❌ Impossible d'écrire dans users.json - vérifiez les permissions du dossier data/";
        echo "<br>Chemin : " . realpath(__DIR__ . '/data');
    }
} else {
    echo "❌ Aucun admin trouvé dans users.json";
}
