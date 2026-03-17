#!/usr/bin/env bash
set -euo pipefail

# ==========================================
# Initialize SSL certificates with Let's Encrypt
# ==========================================
# Usage: ./scripts/init-ssl.sh your-domain.com your-email@example.com
#
# Run this ONCE before the first production deploy.

DOMAIN="${1:?Usage: $0 <domain> <email>}"
EMAIL="${2:?Usage: $0 <domain> <email>}"

echo "=== SSL Certificate Setup ==="
echo "Domain: $DOMAIN"
echo "Email: $EMAIL"
echo ""

# Create temporary nginx config for HTTP challenge
mkdir -p ./nginx
cat > ./nginx/nginx-init.conf <<NGINX
server {
    listen 80;
    server_name $DOMAIN;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 200 'SSL setup in progress';
        add_header Content-Type text/plain;
    }
}
NGINX

echo "[1/3] Starting temporary nginx for domain verification..."
docker run -d --name nginx-init \
  -p 80:80 \
  -v "$(pwd)/nginx/nginx-init.conf:/etc/nginx/conf.d/default.conf:ro" \
  -v certbot-var:/var/www/certbot \
  nginx:alpine

echo "[2/3] Requesting certificate from Let's Encrypt..."
docker run --rm \
  -v certbot-etc:/etc/letsencrypt \
  -v certbot-var:/var/www/certbot \
  certbot/certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    --cert-name hr-onboarding \
    -d "$DOMAIN"

echo "[3/3] Cleaning up..."
docker stop nginx-init && docker rm nginx-init
rm -f ./nginx/nginx-init.conf

echo ""
echo "=== SSL setup complete ==="
echo "Now run: ./scripts/deploy.sh"
