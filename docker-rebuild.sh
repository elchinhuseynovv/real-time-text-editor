#!/bin/bash

# Docker Rebuild Script
# This script stops, removes, and rebuilds all Docker containers

echo "🐳 CollabEdit - Docker Rebuild Script"
echo "======================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored messages
print_info() {
    echo -e "${GREEN}ℹ️  $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker and try again."
    exit 1
fi

print_info "Docker is running"
echo ""

# Step 1: Stop all services
print_info "Step 1: Stopping all services..."
docker-compose down
echo ""

# Step 2: Remove volumes (optional)
read -p "Do you want to remove volumes? This will DELETE ALL DATA! (y/N): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_warning "Removing volumes..."
    docker-compose down -v
    echo ""
fi

# Step 3: Remove old images
print_info "Step 2: Removing old images..."
docker-compose rm -f
echo ""

# Step 4: Prune unused images
print_info "Step 3: Cleaning up unused images..."
docker image prune -f
echo ""

# Step 5: Build images
print_info "Step 4: Building images (this may take a few minutes)..."
docker-compose build --no-cache
if [ $? -ne 0 ]; then
    print_error "Build failed! Please check the error messages above."
    exit 1
fi
echo ""

# Step 6: Start services
print_info "Step 5: Starting services..."
docker-compose up -d
if [ $? -ne 0 ]; then
    print_error "Failed to start services! Please check the error messages above."
    exit 1
fi
echo ""

# Step 7: Wait for services to be ready
print_info "Step 6: Waiting for services to be ready..."
sleep 10

# Check if services are running
print_info "Checking service status..."
docker-compose ps
echo ""

# Test health endpoints
print_info "Testing health endpoints..."

# Test server
if curl -s http://localhost:4000/health > /dev/null 2>&1; then
    print_info "✅ Server is healthy"
else
    print_warning "⚠️  Server health check failed (it might still be starting up)"
fi

# Test client
if curl -s http://localhost:5173/health > /dev/null 2>&1; then
    print_info "✅ Client is healthy"
else
    print_warning "⚠️  Client health check failed"
fi

echo ""
print_info "======================================"
print_info "🎉 Rebuild complete!"
print_info "======================================"
echo ""
print_info "Access the application:"
print_info "  Frontend: http://localhost:5173"
print_info "  Backend:  http://localhost:4000"
print_info "  MongoDB:  mongodb://localhost:27017"
echo ""
print_info "View logs with: docker-compose logs -f"
print_info "Stop services with: docker-compose down"
echo ""

