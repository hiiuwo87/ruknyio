#!/bin/bash
# ============================================
# Rukny.io - Production Deployment Script
# Run on DigitalOcean VPS
# ============================================

set -e

echo "🚀 Rukny.io Production Deployment"
echo "=================================="

# ─── Check if .env.production exists ───
if [ ! -f .env.production ]; then
    echo "❌ .env.production file not found!"
    echo "   Copy .env.production.example and fill in your values:"
    echo "   cp .env.production.example .env.production"
    exit 1
fi

# ─── Load environment variables ───
export $(grep -v '^#' .env.production | xargs)

# ─── Build and start containers ───
echo "📦 Building Docker images..."
docker compose -f docker-compose.yml build

echo "🔄 Starting services..."
docker compose -f docker-compose.yml up -d

echo "⏳ Waiting for services to be ready..."
sleep 10

# ─── Check status ───
echo ""
echo "📊 Service Status:"
docker compose -f docker-compose.yml ps

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🔗 Services:"
echo "   Web:   https://rukny.io"
echo "   Auth:  https://accounts.rukny.io"
echo "   App:   https://app.rukny.io"
echo "   API:   https://api.rukny.io"
echo "   Admin: https://admin.rukny.io"
