#!/bin/bash
# =============================================================================
# Optimized Docker Build Script for Low-RAM Servers
# =============================================================================

echo "🔧 Optimized Docker Build for Low-RAM Servers"
echo "=============================================="
echo ""

# Check available memory
MEM_AVAILABLE=$(free -m | awk '/^Mem:/{print $7}')
echo "📊 Available memory: ${MEM_AVAILABLE}MB"

if [ "$MEM_AVAILABLE" -lt 500 ]; then
    echo "⚠️  Warning: Low memory! Consider closing other applications."
fi

# Disable BuildKit if not available (older docker-compose)
export DOCKER_BUILDKIT=0
export COMPOSE_DOCKER_CLI_BUILD=0

echo ""
echo "🧹 Cleaning up old containers and images..."
docker-compose down --remove-orphans 2>/dev/null || true
docker system prune -f 2>/dev/null || true

echo ""
echo "🏗️  Building with BuildKit (memory optimized)..."
echo ""

# Build with memory constraints
docker-compose build --progress=plain 2>&1

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Build successful!"
    echo ""
    echo "🚀 Starting containers..."
    docker-compose up -d
    
    echo ""
    echo "⏳ Waiting for health check..."
    sleep 10
    
    # Check health
    if docker-compose ps | grep -q "healthy"; then
        echo "✅ Application is healthy and running!"
    else
        echo "⚠️  Health check pending, check: docker-compose logs -f"
    fi
else
    echo ""
    echo "❌ Build failed! Check logs above."
    exit 1
fi

echo ""
echo "📊 Current resource usage:"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" 2>/dev/null || echo "No containers running"
