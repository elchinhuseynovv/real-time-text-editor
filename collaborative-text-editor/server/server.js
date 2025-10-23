const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/collaborative-editor';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ Connected to MongoDB'))
.catch((err) => console.error('❌ MongoDB connection error:', err));

// MongoDB Schemas
const documentSchema = new mongoose.Schema({
  title: { type: String, default: 'Untitled Document' },
  content: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  versions: [{
    content: String,
    timestamp: { type: Date, default: Date.now },
    user: String
  }]
});

const Document = mongoose.model('Document', documentSchema);

// Store connected clients
const clients = new Map();
let documentState = {
  content: '',
  title: 'Untitled Document'
};

// WebSocket connection handler
wss.on('connection', (ws) => {
  console.log('👤 New client connected');
  
  const clientId = generateClientId();
  const clientData = {
    id: clientId,
    ws: ws,
    username: null,
    color: generateRandomColor()
  };
  
  clients.set(clientId, clientData);

  // Send current document state to new client
  ws.send(JSON.stringify({
    type: 'init',
    data: {
      document: documentState,
      users: Array.from(clients.values()).map(c => ({
        id: c.id,
        name: c.username,
        color: c.color
      }))
    }
  }));

  // Handle incoming messages
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      
      switch(data.type) {
        case 'user_join':
          handleUserJoin(clientId, data.username);
          break;
          
        case 'document_change':
          handleDocumentChange(clientId, data.content);
          break;
          
        case 'title_change':
          handleTitleChange(clientId, data.title);
          break;
          
        case 'chat_message':
          handleChatMessage(clientId, data.message);
          break;
          
        case 'save_document':
          await handleSaveDocument(clientId);
          break;
          
        default:
          console.log('Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('Error handling message:', error);
    }
  });

  // Handle client disconnect
  ws.on('close', () => {
    console.log('👤 Client disconnected:', clientData.username || clientId);
    clients.delete(clientId);
    broadcastUserList();
  });
});

// Handler functions
function handleUserJoin(clientId, username) {
  const client = clients.get(clientId);
  if (client) {
    client.username = username;
    console.log(`👤 User joined: ${username}`);
    broadcastUserList();
  }
}

function handleDocumentChange(clientId, content) {
  const client = clients.get(clientId);
  documentState.content = content;
  documentState.updatedAt = new Date();
  
  // Broadcast to all other clients
  broadcast({
    type: 'document_update',
    data: {
      content: content,
      user: client?.username
    }
  }, clientId);
}

function handleTitleChange(clientId, title) {
  documentState.title = title;
  
  broadcast({
    type: 'title_update',
    data: { title }
  }, clientId);
}

function handleChatMessage(clientId, message) {
  const client = clients.get(clientId);
  
  broadcast({
    type: 'chat_message',
    data: {
      message: {
        ...message,
        user: client?.username,
        timestamp: new Date().toLocaleTimeString()
      }
    }
  });
}

async function handleSaveDocument(clientId) {
  try {
    const client = clients.get(clientId);
    
    // Save to MongoDB
    const doc = new Document({
      title: documentState.title,
      content: documentState.content,
      updatedAt: new Date(),
      versions: [{
        content: documentState.content,
        timestamp: new Date(),
        user: client?.username || 'Anonymous'
      }]
    });
    
    await doc.save();
    console.log('💾 Document saved to MongoDB');
    
    // Notify the client
    const clientSocket = client?.ws;
    if (clientSocket && clientSocket.readyState === WebSocket.OPEN) {
      clientSocket.send(JSON.stringify({
        type: 'save_success',
        data: { message: 'Document saved successfully!' }
      }));
    }
  } catch (error) {
    console.error('Error saving document:', error);
    
    const client = clients.get(clientId);
    const clientSocket = client?.ws;
    if (clientSocket && clientSocket.readyState === WebSocket.OPEN) {
      clientSocket.send(JSON.stringify({
        type: 'save_error',
        data: { message: 'Failed to save document' }
      }));
    }
  }
}

function broadcastUserList() {
  const userList = Array.from(clients.values())
    .filter(c => c.username)
    .map(c => ({
      id: c.id,
      name: c.username,
      color: c.color
    }));
  
  broadcast({
    type: 'user_list_update',
    data: { users: userList }
  });
}

function broadcast(message, excludeClientId = null) {
  const messageStr = JSON.stringify(message);
  
  clients.forEach((client, clientId) => {
    if (clientId !== excludeClientId && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(messageStr);
    }
  });
}

// Utility functions
function generateClientId() {
  return Math.random().toString(36).substr(2, 9);
}

function generateRandomColor() {
  const colors = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', 
    '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

// REST API Endpoints
app.get('/api/documents', async (req, res) => {
  try {
    const documents = await Document.find().sort({ updatedAt: -1 }).limit(10);
    res.json(documents);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

app.get('/api/documents/:id', async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    res.json(document);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

app.post('/api/documents', async (req, res) => {
  try {
    const document = new Document(req.body);
    await document.save();
    res.status(201).json(document);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create document' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    connectedClients: clients.size,
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket server running on ws://localhost:${PORT}`);
});