# Docker Setup Guide

This project is fully dockerized and can be run with Docker Compose.

## Prerequisites

- Docker Desktop or Docker Engine installed
- Docker Compose installed

## Quick Start

### Development Mode

```bash
# Build and start all services
docker-compose up --build

# Or run in detached mode
docker-compose up -d --build
```

This will start:
- **MongoDB** on port `27017`
- **Server** on port `4000`
- **Client** on port `5173`

## Environment Variables

### Server (.env.example)
```bash
PORT=4000
MONGODB_URI=mongodb://mongodb:27017/collaborative-editor
CLIENT_URL=http://localhost:5173
CORS_ORIGIN=http://localhost:5173
```

### Client (.env.example)
```bash
VITE_API_URL=http://localhost:4000
VITE_SOCKET_URL=http://localhost:4000
```

## Docker Commands

```bash
# View logs
docker-compose logs -f

# View logs for specific service
docker-compose logs -f server
docker-compose logs -f client
docker-compose logs -f mongodb

# Stop all services
docker-compose down

# Stop and remove volumes (⚠️ deletes database)
docker-compose down -v

# Rebuild specific service
docker-compose build server
docker-compose build client

# Execute command in container
docker-compose exec server sh
docker-compose exec client sh
```

## Individual Container Management

### Build Server Only
```bash
cd server
docker build -t collaborative-editor-server .
docker run -p 4000:4000 --env-file .env collaborative-editor-server
```

### Build Client Only
```bash
cd client
docker build -t collaborative-editor-client --build-arg VITE_API_URL=http://localhost:4000 --build-arg VITE_SOCKET_URL=http://localhost:4000 .
docker run -p 5173:5173 collaborative-editor-client
```

## Health Checks

- Server: `http://localhost:4000/health`
- Client: `http://localhost:5173/health`
- MongoDB: Automatically checked by healthcheck

## Troubleshooting

### MongoDB Connection Issues
If MongoDB fails to start:
```bash
docker-compose down -v
docker-compose up --build
```

### Port Already in Use
If ports are already in use, modify the port mappings in `docker-compose.yml`:
```yaml
ports:
  - "4001:4000"  # Change host port
```

### Client Can't Connect to Server
Ensure environment variables are set correctly:
- `VITE_API_URL` should point to server URL
- `VITE_SOCKET_URL` should point to WebSocket URL
- For Docker, use container names or host IP

### Rebuild After Code Changes
```bash
# Rebuild and restart
docker-compose up --build

# Or rebuild specific service
docker-compose build server && docker-compose up -d server
```

## Production Deployment

For production, update environment variables in `docker-compose.yml`:

1. **Server environment:**
   ```yaml
   server:
     environment:
       - MONGODB_URI=mongodb://mongodb:27017/collaborative-editor
       - CLIENT_URL=https://yourdomain.com
       - CORS_ORIGIN=https://yourdomain.com
       - JWT_SECRET=your-secure-secret-key
       - NODE_ENV=production
   ```

2. **Client build args:**
   ```yaml
   client:
     build:
       args:
         - VITE_API_URL=https://api.yourdomain.com
         - VITE_SOCKET_URL=https://api.yourdomain.com
   ```

## Volumes

- `mongodb_data`: Persistent storage for MongoDB data

Data persists across container restarts unless volumes are explicitly removed.

