FROM php:8.2-apache

# Installer les dépendances curl pour la géolocalisation
RUN apt-get update && apt-get install -y \
    libcurl4-openssl-dev \
    && docker-php-ext-install curl \
    && rm -rf /var/lib/apt/lists/*

# Activer le module de réécriture Apache
RUN a2enmod rewrite

# Support du port dynamique $PORT (Railway, Render, etc.) - défaut 80
ENV PORT=80
RUN sed -i 's/Listen 80/Listen ${PORT}/' /etc/apache2/ports.conf \
    && sed -i 's/:80/:${PORT}/' /etc/apache2/sites-available/000-default.conf

# Configurer Apache pour autoriser .htaccess et CORS
RUN printf '<Directory /var/www/html>\n    AllowOverride All\n    Require all granted\n</Directory>\n' > /etc/apache2/conf-available/app.conf && \
    a2enconf app

# Répertoire de travail
WORKDIR /var/www/html

# Copier l'ensemble des fichiers
COPY . /var/www/html/

# Sauvegarder les données initiales pour auto-init
RUN cp -r /var/www/html/data /var/www/html/data_defaults

# Permissions d'écriture pour Apache
RUN chown -R www-data:www-data /var/www/html \
    && chmod -R 777 /var/www/html/data

EXPOSE 80

CMD ["apache2-foreground"]
