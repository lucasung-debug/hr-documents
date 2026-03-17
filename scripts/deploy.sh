#!/usr/bin/env bash
set -euo pipefail

# ==========================================
# HR Documents - Production Deploy Script
# ==========================================
# Usage: ./scripts/deploy.sh
#
# Prerequisites:
#   - Docker & Docker Compose installed
#   - .env.local file with all required secrets
#   - SSL certificates (run init-ssl.sh first)

COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.local"

echo "=== HR Documents Deploy ==="

# Check prerequisites
if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found. Copy .env.example and fill in values."
  exit 1
fi

# Export env vars for docker compose
set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

echo "[1/3] Pulling latest code..."
git pull origin main

echo "[2/3] Building Docker images..."
docker compose -f "$COMPOSE_FILE" build

echo "[3/3] Starting services..."
docker compose -f "$COMPOSE_FILE" up -d

echo ""
echo "=== Deploy complete ==="
echo "Health check: curl http://localhost:3000/api/health"
docker compose -f "$COMPOSE_FILE" ps
