#!/bin/sh
set -eu

if [ -z "${APP_KEY:-}" ]; then
    echo "APP_KEY is required. Set it in Render using the output of php artisan key:generate --show." >&2
    exit 1
fi

# Render terminates HTTPS at its proxy. Generate HTTPS asset URLs from its public URL.
export APP_URL="${APP_URL:-${RENDER_EXTERNAL_URL:-http://localhost:${PORT:-10000}}}"
export ASSET_URL="${ASSET_URL:-$APP_URL}"

printf 'Listen %s\n' "${PORT:-10000}" > /etc/apache2/ports.conf
sed -i "s/<VirtualHost \*:80>/<VirtualHost *:${PORT:-10000}>/" /etc/apache2/sites-available/000-default.conf

# Cache at startup so Render's runtime environment is used, including APP_KEY.
php artisan config:cache
php artisan route:cache
php artisan view:cache
chown -R www-data:www-data storage bootstrap/cache

exec apache2-foreground
