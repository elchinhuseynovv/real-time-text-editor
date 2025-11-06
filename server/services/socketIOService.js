const documentService = require('./documentService');
const crdtService = require('./crdtService');
const permissionService = require('./permissionService');

/**
 * Socket.IO Service
 * Handles all Socket.IO connections and real-time collaboration
 * More stable than native WebSocket with automatic reconnection
 */
class SocketIOService {
  constructor() {
    this.clients = new Map(); // clientId -> clientData
    this.documentClients = new Map(); // documentId -> Set of clientIds
    this.io = null;
  }

  /**
   * Initialize Socket.IO server
   * @param {SocketIOServer} io - Socket.IO server instance
   */
  initialize(io) {
    this.io = io;
    
    io.on('connection', (socket) => {
      this.handleConnection(socket);
    });
  }

  /**
   * Handle new Socket.IO connection
   * @param {Socket} socket - Socket.IO socket connection
   */
  handleConnection(socket) {
    const clientId = this.generateClientId();
    const clientData = {
      id: clientId,
      socket: socket,
      username: null,
      color: this.generateRandomColor(),
      documentId: null
    };

    this.clients.set(clientId, clientData);
    socket.clientId = clientId; // Store clientId on socket for easy access

    console.log('👤 New client connected:', clientId);

    // Handle user join
    socket.on('user_join', async (data) => {
      await this.handleUserJoin(clientId, data.username);
    });

    // Handle setting document ID
    socket.on('set_document_id', async (data) => {
      await this.handleSetDocumentId(clientId, data.documentId);
    });

    // Handle document content change
    socket.on('document_change', async (data) => {
      await this.handleDocumentChange(clientId, data.content);
    });

    // Handle CRDT operation
    socket.on('document_operation', async (data) => {
      await this.handleDocumentOperation(clientId, data.operation);
    });

    // Handle title change
    socket.on('title_change', async (data) => {
      await this.handleTitleChange(clientId, data.title);
    });

    // Handle chat message
    socket.on('chat_message', (data) => {
      this.handleChatMessage(clientId, data.message);
    });

    // Handle save document
    socket.on('save_document', async (data) => {
      await this.handleSaveDocument(clientId, data);
    });

    // Handle disconnect
    socket.on('disconnect', (reason) => {
      console.log(`👤 Client disconnected: ${clientId}, reason: ${reason}`);
      this.handleDisconnect(clientId);
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error('Socket.IO error:', error);
    });
  }

  /**
   * Handle user join
   * @param {string} clientId - Client ID
   * @param {string} username - Username
   */
  async handleUserJoin(clientId, username) {
    const client = this.clients.get(clientId);
    if (client) {
      client.username = username;
      console.log(`👤 User joined: ${username}`);
      this.broadcastUserList();
    }
  }

  /**
   * Handle setting document ID for a client
   * @param {string} clientId - Client ID
   * @param {string} documentId - Document ID
   */
  async handleSetDocumentId(clientId, documentId) {
    const client = this.clients.get(clientId);
    if (!client) {
      console.warn(`⚠️ Client ${clientId} not found when setting document ID`);
      return;
    }

    if (!documentId) {
      console.warn(`⚠️ Empty documentId provided for client ${clientId}`);
      return;
    }

    try {
      const oldDocumentId = client.documentId;

      // Remove from old document's client set
      if (oldDocumentId && oldDocumentId !== documentId) {
        const oldClients = this.documentClients.get(oldDocumentId);
        if (oldClients) {
          oldClients.delete(clientId);
          if (oldClients.size === 0) {
            this.documentClients.delete(oldDocumentId);
          }
        }
        // Leave old room
        client.socket.leave(`document:${oldDocumentId}`);
      }

      // Set new document ID
      client.documentId = documentId;

      // Add to new document's client set
      if (documentId) {
        if (!this.documentClients.has(documentId)) {
          this.documentClients.set(documentId, new Set());
        }
        this.documentClients.get(documentId).add(clientId);

        // Join document room for efficient broadcasting
        client.socket.join(`document:${documentId}`);

        // Load document into CRDT if not already loaded
        if (!crdtService.documentStates.has(documentId)) {
          await documentService.loadDocumentIntoCRDT(documentId);
        }

        // Send current document state to client
        const document = await documentService.getDocumentById(documentId);
        if (document) {
          this.sendToClient(client.socket, 'init', {
            document: {
              title: document.title,
              content: crdtService.getContent(documentId)
            },
            users: this.getUsersForDocument(documentId)
          });
          
          // Broadcast user list update to all clients viewing this document
          this.broadcastToDocument(documentId, 'user_list_update', {
            users: this.getUsersForDocument(documentId)
          });
        } else {
          console.warn(`⚠️ Document ${documentId} not found`);
          this.sendError(client.socket, `Document ${documentId} not found`);
        }
      }

      console.log(`📄 Client ${client.username} (${clientId}) set document ID:`, documentId);
    } catch (error) {
      console.error(`❌ Error handling set_document_id for client ${clientId}:`, error);
      this.sendError(client.socket, `Failed to set document ID: ${error.message}`);
    }
  }

  /**
   * Handle document content change (simple text replacement)
   * @param {string} clientId - Client ID
   * @param {string} content - New content
   */
  async handleDocumentChange(clientId, content) {
    const client = this.clients.get(clientId);
    if (!client || !client.documentId) return;

    // Check permission
    const hasPermission = await permissionService.checkPermission(
      client.documentId,
      client.username,
      'write'
    );

    if (!hasPermission) {
      this.sendError(client.socket, 'Insufficient permissions to edit document');
      return;
    }

    // Update CRDT state
    crdtService.setContent(client.documentId, content);

    // Broadcast to other clients viewing the same document
    this.broadcastToDocument(client.documentId, 'document_update', {
      content: content,
      user: client.username
    }, clientId);
  }

  /**
   * Handle document operation (CRDT-based)
   * @param {string} clientId - Client ID
   * @param {Object} operation - Operation object
   */
  async handleDocumentOperation(clientId, operation) {
    const client = this.clients.get(clientId);
    if (!client || !client.documentId) return;

    // Check permission
    const hasPermission = await permissionService.checkPermission(
      client.documentId,
      client.username,
      'write'
    );

    if (!hasPermission) {
      this.sendError(client.socket, 'Insufficient permissions to edit document');
      return;
    }

    // Apply CRDT operation
    const result = crdtService.applyOperation(
      client.documentId,
      operation.type,
      operation.position,
      operation.text,
      clientId
    );

    // Broadcast operation to other clients
    this.broadcastToDocument(client.documentId, 'document_operation', {
      operation: operation,
      content: result.content,
      user: client.username
    }, clientId);
  }

  /**
   * Handle title change
   * @param {string} clientId - Client ID
   * @param {string} title - New title
   */
  async handleTitleChange(clientId, title) {
    const client = this.clients.get(clientId);
    if (!client || !client.documentId) return;

    // Check permission (only owner/editor can change title)
    const hasPermission = await permissionService.checkPermission(
      client.documentId,
      client.username,
      'write'
    );

    if (!hasPermission) {
      this.sendError(client.socket, 'Insufficient permissions to change title');
      return;
    }

    try {
      await documentService.updateDocumentTitle(client.documentId, title);

      // Broadcast to other clients
      this.broadcastToDocument(client.documentId, 'title_update', { title }, clientId);
    } catch (error) {
      console.error('Error updating title:', error);
      this.sendError(client.socket, 'Failed to update title');
    }
  }

  /**
   * Handle chat message
   * @param {string} clientId - Client ID
   * @param {Object} message - Chat message object
   */
  handleChatMessage(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client || !client.documentId) return;

    // Add user info to message
    const chatMessage = {
      ...message,
      user: client.username,
      timestamp: message.timestamp || new Date().toISOString()
    };

    // Broadcast to other clients viewing the same document
    this.broadcastToDocument(client.documentId, 'chat_message', {
      message: chatMessage
    }, clientId);
  }

  /**
   * Handle save document
   * @param {string} clientId - Client ID
   * @param {Object} data - Save data (may include content and title for new documents)
   */
  async handleSaveDocument(clientId, data = {}) {
    const client = this.clients.get(clientId);
    if (!client) {
      this.sendError(client?.socket, 'Client not found');
      return;
    }

    // If no documentId, create a new document first
    if (!client.documentId) {
      if (!client.username) {
        this.sendError(client.socket, 'Username required to create document');
        return;
      }

      try {
        // Get content and title from data or use defaults
        const content = data.content || '';
        const title = data.title || 'Untitled Document';

        // Create new document
        const document = await documentService.createDocument({
          title,
          content,
          owner: client.username
        });

        // Set document ID for client
        client.documentId = document._id.toString();
        
        // Add to document clients
        if (!this.documentClients.has(client.documentId)) {
          this.documentClients.set(client.documentId, new Set());
        }
        this.documentClients.get(client.documentId).add(clientId);

        // Join document room
        client.socket.join(`document:${client.documentId}`);

        // Initialize CRDT
        crdtService.setContent(client.documentId, content);

        // Send success with new document ID
        this.sendToClient(client.socket, 'save_success', {
          message: 'Document created and saved successfully!',
          documentId: document._id.toString()
        });

        // Also send init message with document state so client doesn't need to send set_document_id
        // Use setTimeout to ensure save_success is processed first and connection stays open
        setTimeout(() => {
          if (client.socket && client.socket.connected) {
            this.sendToClient(client.socket, 'init', {
              document: {
                title: document.title,
                content: content
              },
              users: this.getUsersForDocument(client.documentId)
            });
          }
        }, 100);

        console.log('✅ New document created and saved:', client.documentId);
        return;
      } catch (error) {
        console.error('Error creating new document:', error);
        this.sendError(client.socket, 'Failed to create document: ' + error.message);
        return;
      }
    }

    // Check permission for existing document
    const hasPermission = await permissionService.checkPermission(
      client.documentId,
      client.username,
      'write'
    );

    if (!hasPermission) {
      this.sendError(client.socket, 'Insufficient permissions to save document');
      return;
    }

    try {
      const content = crdtService.getContent(client.documentId);
      const document = await documentService.updateDocumentContent(
        client.documentId,
        content,
        client.username
      );

      this.sendToClient(client.socket, 'save_success', {
        message: 'Document saved successfully!',
        documentId: document._id.toString()
      });

      // Broadcast save notification to other clients
      this.broadcastToDocument(client.documentId, 'document_saved', {
        message: `${client.username} saved the document`,
        timestamp: new Date().toISOString()
      }, clientId);

      console.log('✅ Document saved:', client.documentId);
    } catch (error) {
      console.error('Error saving document:', error);
      this.sendError(client.socket, 'Failed to save document: ' + error.message);
    }
  }

  /**
   * Handle client disconnect
   * @param {string} clientId - Client ID
   */
  handleDisconnect(clientId) {
    const client = this.clients.get(clientId);
    if (client) {
      console.log('👤 Client disconnected:', client.username || clientId);

      // Remove from document's client set
      if (client.documentId) {
        const docClients = this.documentClients.get(client.documentId);
        if (docClients) {
          docClients.delete(clientId);
          if (docClients.size === 0) {
            this.documentClients.delete(client.documentId);
          } else {
            // Broadcast user list update
            this.broadcastToDocument(client.documentId, 'user_list_update', {
              users: this.getUsersForDocument(client.documentId)
            });
          }
        }
        // Leave document room
        if (client.socket) {
          client.socket.leave(`document:${client.documentId}`);
        }
      }

      this.clients.delete(clientId);
      this.broadcastUserList();
    }
  }

  /**
   * Send message to a specific client
   * @param {Socket} socket - Socket.IO socket
   * @param {string} type - Message type
   * @param {Object} data - Message data
   */
  sendToClient(socket, type, data) {
    if (socket && socket.connected) {
      socket.emit(type, data);
    }
  }

  /**
   * Send error to client
   * @param {Socket} socket - Socket.IO socket
   * @param {string} errorMessage - Error message
   */
  sendError(socket, errorMessage) {
    if (socket && socket.connected) {
      this.sendToClient(socket, 'error', {
        message: errorMessage
      });
    }
  }

  /**
   * Broadcast message to all clients viewing a specific document
   * @param {string} documentId - Document ID
   * @param {string} type - Message type
   * @param {Object} data - Message data
   * @param {string|null} excludeClientId - Client ID to exclude (null = broadcast to all)
   */
  broadcastToDocument(documentId, type, data, excludeClientId = null) {
    const docClients = this.documentClients.get(documentId);
    if (!docClients || !this.io) return;

    // Use Socket.IO rooms for efficient broadcasting
    const room = `document:${documentId}`;
    
    if (excludeClientId) {
      const excludeSocket = this.clients.get(excludeClientId)?.socket;
      if (excludeSocket && excludeSocket.connected) {
        // Send to room excluding the specified socket
        excludeSocket.to(room).emit(type, data);
      } else {
        // If exclude socket not found, broadcast to all in room
        this.io.to(room).emit(type, data);
      }
    } else {
      // Broadcast to all clients in the room
      this.io.to(room).emit(type, data);
    }
  }

  /**
   * Broadcast user list to all clients
   */
  broadcastUserList() {
    const userList = Array.from(this.clients.values())
      .filter(c => c.username)
      .map(c => ({
        id: c.id,
        name: c.username,
        color: c.color
      }));

    // Remove duplicates by username
    const uniqueUsers = [];
    const seenNames = new Set();
    userList.forEach(user => {
      if (!seenNames.has(user.name)) {
        seenNames.add(user.name);
        uniqueUsers.push(user);
      }
    });

    const message = {
      type: 'user_list_update',
      data: { users: uniqueUsers }
    };

    // Broadcast to all connected clients
    if (this.io) {
      this.io.emit('user_list_update', { users: uniqueUsers });
    }
  }

  /**
   * Get users for a specific document
   * @param {string} documentId - Document ID
   * @returns {Array} Array of user objects
   */
  getUsersForDocument(documentId) {
    const docClients = this.documentClients.get(documentId);
    if (!docClients) return [];

    return Array.from(docClients)
      .map(clientId => {
        const client = this.clients.get(clientId);
        return client && client.username ? {
          id: client.id,
          name: client.username,
          color: client.color
        } : null;
      })
      .filter(Boolean);
  }

  /**
   * Generate unique client ID
   * @returns {string} Client ID
   */
  generateClientId() {
    return Math.random().toString(36).substr(2, 9) + '-' + Date.now();
  }

  /**
   * Generate random color for user
   * @returns {string} Hex color
   */
  generateRandomColor() {
    const colors = [
      '#3b82f6', '#ef4444', '#10b981', '#f59e0b',
      '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  /**
   * Get connection statistics
   * @returns {Object} Stats object
   */
  getStats() {
    return {
      totalClients: this.clients.size,
      totalDocuments: this.documentClients.size,
      documentClients: Object.fromEntries(
        Array.from(this.documentClients.entries()).map(([docId, clients]) => [
          docId,
          clients.size
        ])
      )
    };
  }
}

module.exports = new SocketIOService();

