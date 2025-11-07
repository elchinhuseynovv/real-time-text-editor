# MongoDB Docker Setup

## Command to Run Only MongoDB

Run MongoDB using Docker Compose:

```bash
docker-compose up -d mongodb
```

Or to see logs:

```bash
docker-compose up mongodb
```

## Stop MongoDB

```bash
docker-compose stop mongodb
```

## Remove MongoDB Container

```bash
docker-compose down mongodb
```

## Update .env File

Update your `server/.env` file with the following MongoDB URI:

```env
MONGODB_URI=mongodb://localhost:27017/collaborative-editor
```

### Quick Update Command

```bash
echo 'MONGODB_URI=mongodb://localhost:27017/collaborative-editor' > server/.env
```

Or manually edit `server/.env` and set:
```
MONGODB_URI=mongodb://localhost:27017/collaborative-editor
```

## Verify MongoDB is Running

```bash
# Check container status
docker-compose ps mongodb

# Check MongoDB connection
docker exec -it collaborative-editor-mongodb mongosh --eval "db.adminCommand('ping')"

# Or connect to MongoDB shell
docker exec -it collaborative-editor-mongodb mongosh
```

## Notes

- MongoDB will be accessible on `localhost:27017`
- Database name: `collaborative-editor`
- Data is persisted in Docker volume `mongodb_data`
- The container will restart automatically unless stopped manually

