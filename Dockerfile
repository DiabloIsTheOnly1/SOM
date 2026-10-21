FROM php:8.3-apache-bookworm

ENV APP_ENV=production \
    APP_DEBUG=false \
    LOG_CHANNEL=stderr \
    SESSION_DRIVER=file \
    CACHE_STORE=file \
    QUEUE_CONNECTION=sync

WORKDIR /var/www/html

RUN apt-get update \
    && apt-get install -y --no-install-recommends unzip \
    && docker-php-ext-install opcache \
    && rm -rf /var/lib/apt/lists/* \
    && cp "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini" \
    && a2enmod rewrite \
    && sed -i 's|/var/www/html|/var/www/html/public|g' /etc/apache2/sites-available/000-default.conf \
    && printf 'ServerName localhost\nServerTokens Prod\nServerSignature Off\n' > /etc/apache2/conf-available/server-name.conf \
    && a2enconf server-name

COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer
COPY . .

# Git does not preserve empty runtime directories; create them in the image.
RUN mkdir -p bootstrap/cache storage/framework/views storage/framework/sessions storage/framework/cache/data storage/logs \
    && composer install --no-dev --no-interaction --prefer-dist --optimize-autoloader \
    && chown -R www-data:www-data storage bootstrap/cache \
    && sed -i 's/\r$//' docker-entrypoint.sh

EXPOSE 10000

CMD ["sh", "docker-entrypoint.sh"]
