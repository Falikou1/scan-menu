FROM php:8.2-apache

# Installer les extensions nécessaires
RUN apt-get update && apt-get install -y \
    libcurl4-openssl-dev \
    && docker-php-ext-install curl \
    && rm -rf /var/lib/apt/lists/*

# Activer le module de réécriture Apache
RUN a2enmod rewrite

# Configurer Apache pour autoriser .htaccess et CORS
RUN echo '<Directory /var/www/html>\n\
    AllowOverride All\n\
    Require all granted\n\
</Directory>' > /etc/apache2/conf-available/app.conf && \
    a2enconf app

# Définir le répertoire de travail
WORKDIR /var/www/html

# Copier le projet (sauf le dossier data qui sera sur volume persistant)
COPY . /var/www/html/

# Créer le dossier data s'il n'existe pas (sera écrasé par le volume Railway)
RUN mkdir -p /var/www/html/data

# Sauvegarder une copie des données initiales pour l'initialisation du volume
RUN cp -r /var/www/html/data /var/www/html/data_initial

# Permissions Apache
RUN chown -R www-data:www-data /var/www/html \
    && chmod -R 775 /var/www/html/data

# Script d'initialisation : copier les données initiales si le volume est vide
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Port exposé
EXPOSE 80

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["apache2-foreground"]
