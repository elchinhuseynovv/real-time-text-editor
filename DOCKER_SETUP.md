# Docker Setup Guide

## 🐳 Running with Docker

### Prerequisites
- Docker and Docker Compose installed
- Ports 4000, 5173, and 27017 available on your host machine

### Quick Start

1. **Clean up any existing containers and images:**
   ```bash
   docker-compose down -v
   docker system prune -a
   ```

2. **Build and start all services:**
   ```bash
   docker-compose up --build
   ```

3. **Access the application:**
   - **Frontend:** http://localhost:5173
   - **Backend API:** http://localhost:4000
   - **MongoDB:** mongodb://localhost:27017

### Step-by-Step Instructions

#### 1. Stop and Remove Existing Containers
```bash
# Stop all containers
docker-compose down

# Remove volumes (this will delete all data!)
docker-compose down -v

# Remove all unused images to force rebuild
docker image prune -a -f
```

#### 2. Rebuild the Images
```bash
# Build without cache to ensure fresh build
docker-compose build --no-cache

# Or build and start in one command
docker-compose up --build
```

#### 3. Start the Services
```bash
# Start in foreground (see logs)
docker-compose up

# Or start in background (detached mode)
docker-compose up -d

# View logs
docker-compose logs -f

# View logs for specific service
docker-compose logs -f server
docker-compose logs -f client
```

### Troubleshooting

#### Connection Refused Errors

If you see `ERR_CONNECTION_REFUSED` errors:

1. **Check if all services are running:**
   ```bash
   docker-compose ps
   ```
   All services should show "Up" status.

2. **Check server logs:**
   ```bash
   docker-compose logs server
   ```
   Look for "Server running on port 4000" message.

3. **Verify network connectivity:**
   ```bash
   # Test server from host
   curl http://localhost:4000/health
   
   # Should return: {"status":"ok"}
   ```

4. **Rebuild client with correct environment variables:**
   ```bash
   docker-compose rm -f client
   docker-compose build --no-cache client
   docker-compose up client
   ```

#### MongoDB Connection Issues

If server can't connect to MongoDB:

1. **Check MongoDB health:**
   ```bash
   docker-compose logs mongodb
   ```

2. **Wait for MongoDB to be ready:**
   MongoDB might take 10-20 seconds to initialize on first start.

3. **Verify MongoDB connection from server:**
   ```bash
   docker-compose exec server sh
   # Inside container:
   nc -zv mongodb 27017
   ```

#### Port Already in Use

If you see "port is already allocated" errors:

```bash
# Find what's using the port (example for port 4000)
lsof -i :4000

# Kill the process
kill -9 <PID>

# Or use different ports in docker-compose.yml
```

### Environment Variables

The application uses these environment variables:

**Server:**
- `PORT`: Server port (default: 4000)
- `MONGODB_URI`: MongoDB connection string
- `JWT_SECRET`: Secret key for JWT tokens
- `CLIENT_URL`: Frontend URL for CORS
- `CORS_ORIGIN`: Allowed CORS origins

**Client (build-time):**
- `VITE_API_URL`: Backend API URL (default: http://localhost:4000)
- `VITE_SOCKET_URL`: WebSocket URL (default: http://localhost:4000)

### Development Configuration

**Docker setup uses:**
- API: `http://localhost:4000`
- Frontend: `http://localhost:5173`
- MongoDB: `mongodb://localhost:27017`

**For production deployment:**
Update environment variables in `docker-compose.yml`:
```yaml
client:
  build:
    args:
      - VITE_API_URL=https://api.yourdomain.com
      - VITE_SOCKET_URL=https://api.yourdomain.com

server:
  environment:
    - CLIENT_URL=https://yourdomain.com
    - CORS_ORIGIN=https://yourdomain.com
```

### Useful Commands

```bash
# View running containers
docker-compose ps

# Stop services
docker-compose stop

# Start services
docker-compose start

# Restart a specific service
docker-compose restart server

# View logs for all services
docker-compose logs -f

# Execute command in running container
docker-compose exec server sh
docker-compose exec client sh

# Remove everything and start fresh
docker-compose down -v
docker system prune -a -f
docker-compose up --build
```

### Health Checks

**Server Health Check:**
```bash
curl http://localhost:4000/health
```

**Client Health Check:**
```bash
curl http://localhost:5173/health
```

**MongoDB Health Check:**
```bash
docker-compose exec mongodb mongosh --eval "db.adminCommand('ping')"
```

### Data Persistence

MongoDB data is persisted in a Docker volume named `mongodb_data`. To completely reset the database:

```bash
docker-compose down -v
docker volume rm real-time-text-editor_mongodb_data
docker-compose up
```

### Network Configuration

All services communicate through a Docker bridge network named `app-network`:
- **MongoDB:** `mongodb:27017` (internal)
- **Server:** `server:4000` (internal), `localhost:4000` (external)
- **Client:** `client:80` (internal), `localhost:5173` (external)

### Security Notes

⚠️ **Important for Production:**
1. Change `JWT_SECRET` in docker-compose.yml
2. Use proper SSL/TLS certificates
3. Configure firewalls appropriately
4. Use environment-specific configurations
5. Never commit `.env` files with secrets

### Getting Help

If you encounter issues:
1. Check service logs: `docker-compose logs -f`
2. Verify all services are running: `docker-compose ps`
3. Ensure ports are available: `netstat -an | grep LISTEN`
4. Rebuild from scratch if needed: `docker-compose down -v && docker-compose up --build`

