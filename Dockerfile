FROM php:8.2-apache

# Installer les dépendances nécessaires (ex: curl pour l'API de géolocalisation)
RUN apt-get update && apt-get install -y \
    libcurl4-openssl-dev \
    && docker-php-ext-install curl \
    && rm -rf /var/lib/apt/lists/*

# Activer le module de réécriture Apache
RUN a2enmod rewrite

# Définir le répertoire de travail
WORKDIR /var/www/html

# Copier l'ensemble du projet
COPY . /var/www/html/

# Donner les permissions d'écriture à Apache pour le dossier data (fichiers JSON)
RUN chown -R www-data:www-data /var/www/html \
    && chmod -R 775 /var/www/html/data

# Port exposé pour Render
EXPOSE 80

CMD ["apache2-foreground"]
