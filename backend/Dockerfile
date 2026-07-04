# =============================================================================
# FleetVision AI — Backend (Laravel + PHP-FPM + Nginx)
# =============================================================================

FROM php:8.2-fpm-alpine

ARG WWWUSER=1000
ARG WWWGROUP=1000

# System dependencies
RUN apk add --no-cache \
    nginx \
    supervisor \
    curl \
    zip \
    unzip \
    git \
    bash \
    mysql-client \
    && docker-php-ext-install -j$(nproc) \
        pdo_mysql \
        mysqli \
        sockets \
        bcmath \
        pcntl

# Redis extension
RUN pecl install redis && docker-php-ext-enable redis

# Opcache
RUN docker-php-ext-install opcache

# Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Create user
RUN addgroup -g ${WWWGROUP} www && \
    adduser -D -u ${WWWUSER} -G www www

WORKDIR /var/www

# Copy app
COPY --chown=www:www . /var/www

# Install dependencies
RUN composer install --no-interaction --no-ansi --prefer-dist

# Configs
COPY docker/php.ini $PHP_INI_DIR/conf.d/99-fleetvision.ini
COPY docker/www.conf /usr/local/etc/php-fpm.d/www.conf
COPY docker/nginx.conf /etc/nginx/http.d/default.conf
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

RUN mkdir -p /var/run/php /var/log/supervisor

EXPOSE 80

COPY docker/start.sh /usr/local/bin/start.sh
RUN chmod +x /usr/local/bin/start.sh

CMD ["/usr/local/bin/start.sh"]
