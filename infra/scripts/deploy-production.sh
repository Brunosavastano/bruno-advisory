#!/usr/bin/env bash
set -euo pipefail

# Savastano Advisory — deploy to Contabo VPS
#
# Usage (from repo root):
#   bash infra/scripts/deploy-production.sh
#
# Prerequisites:
#   - SSH access to the VPS (will prompt for password)
#   - DNS for savastanoadvisory.com.br pointing to VPS IP
#   - COCKPIT_SECRET set in the environment or passed inline

VPS_HOST="${VPS_HOST:-212.90.121.236}"
VPS_USER="${VPS_USER:-root}"
REMOTE_DIR="/home/savastano-advisory"
COCKPIT_SECRET="${COCKPIT_SECRET:-}"

if [ -z "$COCKPIT_SECRET" ]; then
  echo ""
  echo "  COCKPIT_SECRET is not set."
  echo "  Generate one with: openssl rand -hex 32"
  echo "  Then run: COCKPIT_SECRET=<value> bash infra/scripts/deploy-production.sh"
  echo ""
  exit 1
fi

echo "=== Savastano Advisory — Deploy to $VPS_HOST ==="
echo ""

# 1. Create a temp directory with only what the server needs
BUNDLE_DIR=$(mktemp -d)
trap 'rm -rf "$BUNDLE_DIR"' EXIT

echo "[1/5] Packaging deploy bundle..."
# Copy deployment files
cp Dockerfile "$BUNDLE_DIR/"
cp docker-compose.production.yml "$BUNDLE_DIR/"
cp Caddyfile "$BUNDLE_DIR/"
cp package.json package-lock.json "$BUNDLE_DIR/"
cp tsconfig.base.json "$BUNDLE_DIR/"
cp project.yaml "$BUNDLE_DIR/"
cp -r apps "$BUNDLE_DIR/"
cp -r packages "$BUNDLE_DIR/"

# Create .env for docker compose
cat > "$BUNDLE_DIR/.env" << ENV
COCKPIT_SECRET=$COCKPIT_SECRET
ENV

# Remove node_modules and .next from the bundle
find "$BUNDLE_DIR" -name node_modules -type d -exec rm -rf {} + 2>/dev/null || true
find "$BUNDLE_DIR" -name .next -type d -exec rm -rf {} + 2>/dev/null || true

# Create tarball
TARBALL=$(mktemp --suffix=.tar.gz)
tar -czf "$TARBALL" -C "$BUNDLE_DIR" .

echo "[2/5] Uploading to $VPS_HOST:$REMOTE_DIR..."
ssh "$VPS_USER@$VPS_HOST" "mkdir -p $REMOTE_DIR"
scp "$TARBALL" "$VPS_USER@$VPS_HOST:$REMOTE_DIR/deploy-bundle.tar.gz"
rm -f "$TARBALL"

echo "[3/5] Extracting and building on server..."
ssh "$VPS_USER@$VPS_HOST" << REMOTE
  set -euo pipefail
  cd $REMOTE_DIR
  tar -xzf deploy-bundle.tar.gz
  rm deploy-bundle.tar.gz
  echo "[4/5] Building Docker image..."
  docker compose -f docker-compose.production.yml build --no-cache
  echo "[5/5] Starting containers..."
  docker compose -f docker-compose.production.yml up -d
  echo ""
  echo "=== Deploy complete ==="
  docker compose -f docker-compose.production.yml ps
REMOTE

echo ""
echo "Done. Next steps:"
echo "  1. Ensure DNS for savastanoadvisory.com.br points to $VPS_HOST"
echo "  2. Wait 1-2 min for Caddy to provision HTTPS certificate"
echo "  3. Visit https://savastanoadvisory.com.br"
echo "  4. Bootstrap admin: ssh $VPS_USER@$VPS_HOST then:"
echo "     docker exec -it savastano-advisory-app node --experimental-strip-types scripts/bootstrap-admin.ts --email YOUR_EMAIL --name 'Bruno Savastano' --password YOUR_PASSWORD"
