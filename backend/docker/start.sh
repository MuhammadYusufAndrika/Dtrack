#!/bin/sh
set -e

# ── Ensure .env ──
if [ ! -f .env ]; then
    cp .env.example .env
fi

# ── Generate APP_KEY ──
if [ -z "$APP_KEY" ] || [ "$APP_KEY" = "APP_KEY=" ] || [ "$APP_KEY" = "SomeRandomString" ]; then
    php artisan key:generate --force
fi

# ── Storage link ──
php artisan storage:link --force 2>/dev/null || true

# ── Run migrations ──
php artisan migrate --force

# ── Seed database ──
php artisan db:seed --force 2>/dev/null || true

# ── Clear cache (local dev) ──
php artisan config:clear 2>/dev/null || true
php artisan route:clear 2>/dev/null || true

# ── Permissions ──
chmod -R 775 storage bootstrap/cache
chown -R www:www storage bootstrap/cache

# ── Start Supervisor (Nginx + PHP-FPM) ──
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
