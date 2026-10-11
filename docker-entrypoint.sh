#!/bin/bash
set -e

# ============================================================
# Script d'initialisation du container Menu Scan
# Copie les données JSON initiales si le volume est vide
# ============================================================

DATA_DIR="/var/www/html/data"
INITIAL_DATA_DIR="/var/www/html/data_initial"

echo "==> Vérification du dossier data..."

# Si le dossier data est vide (volume vide au premier démarrage),
# copier les données initiales packagées dans l'image
if [ ! -f "$DATA_DIR/users.json" ]; then
    echo "==> Premier démarrage : initialisation des données..."
    if [ -d "$INITIAL_DATA_DIR" ]; then
        cp -n "$INITIAL_DATA_DIR/"* "$DATA_DIR/" 2>/dev/null || true
        echo "==> Données initiales copiées."
    fi
fi

# S'assurer des permissions correctes
chown -R www-data:www-data "$DATA_DIR"
chmod -R 775 "$DATA_DIR"

# Adapter le port d'Apache si Railway définit la variable PORT
if [ -n "$PORT" ]; then
    echo "==> Configuration du port Apache sur $PORT..."
    sed -i "s/Listen 80/Listen $PORT/" /etc/apache2/ports.conf
    sed -i "s/<VirtualHost \*:80>/<VirtualHost \*:$PORT>/" /etc/apache2/sites-available/*.conf
fi

echo "==> Démarrage d'Apache..."
exec "$@"
