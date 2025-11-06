const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const connectDB = require('./config/database');
const documentRoutes = require('./routes/documentRoutes');
const socketIOService = require('./services/socketIOService');
const errorHandler = require('./middleware/errorHandler');
const authMiddleware = require('./middleware/auth');

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO with CORS
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'], // Support both transports
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Middleware
const corsOptions = {
  origin: process.env.CLIENT_URL || process.env.CORS_ORIGIN || '*',
  credentials: true,
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(authMiddleware);

// Connect to MongoDB
connectDB();

// Initialize Socket.IO service
socketIOService.initialize(io);

// Routes
app.use('/api/documents', documentRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  const stats = socketIOService.getStats();
  res.json({
    status: 'ok',
    ...stats,
    mongodb: require('mongoose').connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

// Error handler (must be last)
app.use(errorHandler);

// Start server (only if not in test environment)
if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 4000;
  server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📡 Socket.IO server running on ws://localhost:${PORT}`);
  });
}

module.exports = app;
