# CollabEdit Client

The frontend application for CollabEdit - a real-time collaborative text editor built with React and Vite.

## Features

- ✅ **Real-time Collaboration** - Multiple users can edit documents simultaneously
- ✅ **Live Document Synchronization** - See changes from other users in real-time
- ✅ **Document Management** - Create, view, edit, and delete documents
- ✅ **Real-time Chat** - In-document chat functionality
- ✅ **User Presence** - See who's currently active in the document
- ✅ **Document History** - Track document versions
- ✅ **Modern UI** - Beautiful, responsive dark-themed interface

## Tech Stack

- **React 19** - UI library
- **Vite** - Build tool and dev server
- **Lucide React** - Icon library
- **WebSocket** - Real-time communication
- **Nginx** - Production web server (Docker)

## Prerequisites

- Node.js 18+ 
- npm or yarn

## Installation

```bash
# Install dependencies
npm install

# Or with yarn
yarn install
```

## Configuration

### Environment Variables

Create a `.env` file in the client directory (see `.env.example`):

```bash
# API server URL
VITE_API_URL=http://localhost:4000

# WebSocket server URL
VITE_WS_URL=ws://localhost:4000
```

For production, update these to your domain:
```bash
VITE_API_URL=https://api.yourdomain.com
VITE_WS_URL=wss://api.yourdomain.com
```

## Development

```bash
# Start development server
npm run dev

# The app will be available at http://localhost:5173
```

### Development Server Options

- Hot Module Replacement (HMR) enabled
- Fast refresh for React components
- Source maps for debugging

## Building for Production

```bash
# Build the application
npm run build

# The built files will be in the `dist/` directory
```

### Build Output

The build process:
- Optimizes and minifies code
- Creates production-ready static files
- Splits vendor chunks for better caching
- Generates source maps (disabled by default)

## Preview Production Build

```bash
# Preview the production build locally
npm run preview

# The preview will be available at http://localhost:4173
```

## Linting

```bash
# Run ESLint
npm run lint
```

## Project Structure

```
client/
├── src/
│   ├── App.jsx          # Main application component
│   ├── App.css          # Application styles
│   ├── main.jsx         # Entry point
│   └── index.css        # Global styles
├── public/              # Static assets
├── Dockerfile           # Docker configuration
├── nginx.conf          # Nginx configuration for production
├── vite.config.js      # Vite configuration
└── package.json        # Dependencies and scripts
```

## Docker

### Build Docker Image

```bash
docker build -t collaborative-editor-client \
  --build-arg VITE_API_URL=http://localhost:4000 \
  --build-arg VITE_WS_URL=ws://localhost:4000 \
  .
```

### Run Docker Container

```bash
docker run -p 80:80 collaborative-editor-client
```

### Using Docker Compose

See the root `docker-compose.yml` for full stack setup.

## Architecture

### Components

- **Login Screen** - User authentication entry point
- **Documents List** - Browse and manage documents
- **Editor** - Real-time collaborative text editor
- **Chat Sidebar** - Real-time chat functionality
- **User Presence** - Active users indicator

### State Management

- React hooks (`useState`, `useEffect`, `useRef`, `useCallback`)
- Local component state
- WebSocket for real-time updates

### WebSocket Communication

The client connects to the server via WebSocket for:
- Real-time document updates
- User presence tracking
- Chat messages
- Document synchronization

### API Integration

REST API calls for:
- Document CRUD operations
- Fetching document list
- User authentication

## Environment Variables Reference

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API server URL | `http://localhost:4000` |
| `VITE_WS_URL` | WebSocket server URL | `ws://localhost:4000` |

**Note**: Vite requires the `VITE_` prefix for environment variables to be exposed to the client.

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Performance Optimizations

- Code splitting for vendor libraries
- Lazy loading of components
- Optimized bundle size
- Nginx compression for production
- Browser caching headers

## Troubleshooting

### WebSocket Connection Issues

1. Check that `VITE_WS_URL` is correctly set
2. Verify the server is running
3. Check browser console for connection errors
4. Ensure CORS is configured correctly on the server

### Build Issues

1. Clear `node_modules` and reinstall: `rm -rf node_modules && npm install`
2. Clear Vite cache: `rm -rf node_modules/.vite`
3. Check Node.js version: `node --version` (should be 18+)

### Environment Variables Not Working

1. Ensure variables start with `VITE_` prefix
2. Restart the dev server after changing `.env`
3. Rebuild the application if using Docker

## Contributing

1. Follow the existing code style
2. Use ESLint for code quality
3. Test your changes thoroughly
4. Update documentation if needed

## License

ISC
