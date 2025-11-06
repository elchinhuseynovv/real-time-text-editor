const WebSocket = require('ws');
const documentService = require('./documentService');
const crdtService = require('./crdtService');
const permissionService = require('./permissionService');

/**
 * WebSocket Service
 * Handles all WebSocket connections and real-time collaboration
 */
class WebSocketService {
  constructor() {
    this.clients = new Map(); // clientId -> clientData
    this.documentClients = new Map(); // documentId -> Set of clientIds
  }

  /**
   * Initialize WebSocket server
   * @param {WebSocket.Server} wss - WebSocket server instance
   */
  initialize(wss) {
    wss.on('connection', (ws) => {
      this.handleConnection(ws);
    });
  }

  /**
   * Handle new WebSocket connection
   * @param {WebSocket} ws - WebSocket connection
   */
  handleConnection(ws) {
    const clientId = this.generateClientId();
    const clientData = {
      id: clientId,
      ws: ws,
      username: null,
      color: this.generateRandomColor(),
      documentId: null
    };

    this.clients.set(clientId, clientData);

    console.log('👤 New client connected:', clientId);

    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message);
        await this.handleMessage(clientId, data);
      } catch (error) {
        console.error('Error handling message:', error);
        this.sendError(ws, 'Invalid message format');
      }
    });

    ws.on('close', () => {
      this.handleDisconnect(clientId);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      this.handleDisconnect(clientId);
    });
  }

  /**
   * Handle incoming WebSocket message
   * @param {string} clientId - Client ID
   * @param {Object} data - Message data
   */
  async handleMessage(clientId, data) {
    const client = this.clients.get(clientId);
    if (!client) return;

    switch (data.type) {
      case 'user_join':
        await this.handleUserJoin(clientId, data.username);
        break;

      case 'set_document_id':
        await this.handleSetDocumentId(clientId, data.documentId);
        break;

      case 'document_change':
        await this.handleDocumentChange(clientId, data.content);
        break;

      case 'document_operation':
        await this.handleDocumentOperation(clientId, data.operation);
        break;

      case 'title_change':
        await this.handleTitleChange(clientId, data.title);
        break;

      case 'chat_message':
        this.handleChatMessage(clientId, data.message);
        break;

      case 'save_document':
        await this.handleSaveDocument(clientId, data);
        break;

      default:
        console.log('Unknown message type:', data.type);
    }
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
      }

      // Set new document ID
      client.documentId = documentId;

      // Add to new document's client set
      if (documentId) {
        if (!this.documentClients.has(documentId)) {
          this.documentClients.set(documentId, new Set());
        }
        this.documentClients.get(documentId).add(clientId);

        // Load document into CRDT if not already loaded
        if (!crdtService.documentStates.has(documentId)) {
          await documentService.loadDocumentIntoCRDT(documentId);
        }

        // Send current document state to client
        const document = await documentService.getDocumentById(documentId);
        if (document) {
          this.sendToClient(client.ws, {
            type: 'init',
            data: {
              document: {
                title: document.title,
                content: crdtService.getContent(documentId)
              },
              users: this.getUsersForDocument(documentId)
            }
          });
          
          // Broadcast user list update to all clients viewing this document
          this.broadcastToDocument(documentId, {
            type: 'user_list_update',
            data: {
              users: this.getUsersForDocument(documentId)
            }
          });
        } else {
          console.warn(`⚠️ Document ${documentId} not found`);
          this.sendError(client.ws, `Document ${documentId} not found`);
        }
      }

      console.log(`📄 Client ${client.username} (${clientId}) set document ID:`, documentId);
    } catch (error) {
      console.error(`❌ Error handling set_document_id for client ${clientId}:`, error);
      this.sendError(client.ws, `Failed to set document ID: ${error.message}`);
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
      this.sendError(client.ws, 'Insufficient permissions to edit document');
      return;
    }

    // Update CRDT state
    crdtService.setContent(client.documentId, content);

    // Broadcast to other clients viewing the same document
    this.broadcastToDocument(client.documentId, {
      type: 'document_update',
      data: {
        content: content,
        user: client.username
      }
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
      this.sendError(client.ws, 'Insufficient permissions to edit document');
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
    this.broadcastToDocument(client.documentId, {
      type: 'document_operation',
      data: {
        operation: operation,
        content: result.content,
        user: client.username
      }
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
      this.sendError(client.ws, 'Insufficient permissions to change title');
      return;
    }

    try {
      await documentService.updateDocumentTitle(client.documentId, title);

      // Broadcast to other clients
      this.broadcastToDocument(client.documentId, {
        type: 'title_update',
        data: { title }
      }, clientId);
    } catch (error) {
      console.error('Error updating title:', error);
      this.sendError(client.ws, 'Failed to update title');
    }
  }

  /**
   * Handle chat message
   * @param {string} clientId - Client ID
   * @param {Object} message - Message object
   */
  handleChatMessage(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client || !client.documentId) return;

    const chatMessage = {
      id: message.id || Date.now(),
      text: message.text,
      user: client.username || 'Anonymous',
      timestamp: new Date().toLocaleTimeString()
    };

    console.log('💬 Chat message from', chatMessage.user, ':', chatMessage.text);

    // Broadcast to all clients viewing the same document
    this.broadcastToDocument(client.documentId, {
      type: 'chat_message',
      data: { message: chatMessage }
    }, null);
  }

  /**
   * Handle save document request
   * @param {string} clientId - Client ID
   * @param {Object} data - Save data (may include content and title for new documents)
   */
  async handleSaveDocument(clientId, data = {}) {
    const client = this.clients.get(clientId);
    if (!client) {
      this.sendError(client?.ws, 'Client not found');
      return;
    }

    // If no documentId, create a new document first
    if (!client.documentId) {
      if (!client.username) {
        this.sendError(client.ws, 'Username required to create document');
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

        // Initialize CRDT
        crdtService.setContent(client.documentId, content);

        // Send success with new document ID
        this.sendToClient(client.ws, {
          type: 'save_success',
          data: {
            message: 'Document created and saved successfully!',
            documentId: document._id.toString()
          }
        });

        // Also send init message with document state so client doesn't need to send set_document_id
        // Use setTimeout to ensure save_success is processed first and connection stays open
        setTimeout(() => {
          if (client.ws && client.ws.readyState === WebSocket.OPEN) {
            this.sendToClient(client.ws, {
              type: 'init',
              data: {
                document: {
                  title: document.title,
                  content: content
                },
                users: this.getUsersForDocument(client.documentId)
              }
            });
          }
        }, 100);

        console.log('✅ New document created and saved:', client.documentId);
        return;
      } catch (error) {
        console.error('Error creating new document:', error);
        this.sendError(client.ws, 'Failed to create document: ' + error.message);
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
      this.sendError(client.ws, 'Insufficient permissions to save document');
      return;
    }

    try {
      const content = crdtService.getContent(client.documentId);
      const document = await documentService.updateDocumentContent(
        client.documentId,
        content,
        client.username
      );

      this.sendToClient(client.ws, {
        type: 'save_success',
        data: {
          message: 'Document saved successfully!',
          documentId: document._id.toString()
        }
      });

      // Broadcast save notification to other clients
      this.broadcastToDocument(client.documentId, {
        type: 'document_saved',
        data: {
          message: `${client.username} saved the document`,
          timestamp: new Date().toISOString()
        }
      }, clientId);

      console.log('✅ Document saved:', client.documentId);
    } catch (error) {
      console.error('Error saving document:', error);
      this.sendError(client.ws, 'Failed to save document: ' + error.message);
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
          }
        }
      }

      this.clients.delete(clientId);
      this.broadcastUserList();
    }
  }

  /**
   * Broadcast message to all clients viewing a specific document
   * @param {string} documentId - Document ID
   * @param {Object} message - Message to broadcast
   * @param {string|null} excludeClientId - Client ID to exclude (null = broadcast to all)
   */
  broadcastToDocument(documentId, message, excludeClientId = null) {
    const docClients = this.documentClients.get(documentId);
    if (!docClients) return;

    const messageStr = JSON.stringify(message);

    docClients.forEach(clientId => {
      if (clientId !== excludeClientId) {
        const client = this.clients.get(clientId);
        if (client && client.ws.readyState === WebSocket.OPEN) {
          client.ws.send(messageStr);
        }
      }
    });
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
    this.broadcastToAll(message);
  }

  /**
   * Broadcast message to all connected clients
   * @param {Object} message - Message to broadcast
   */
  broadcastToAll(message) {
    const messageStr = JSON.stringify(message);
    this.clients.forEach((client) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(messageStr);
      }
    });
  }

  /**
   * Send message to specific client
   * @param {WebSocket} ws - WebSocket connection
   * @param {Object} message - Message to send
   */
  sendToClient(ws, message) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Send error message to client
   * @param {WebSocket} ws - WebSocket connection
   * @param {string} errorMessage - Error message
   */
  sendError(ws, errorMessage) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'error',
        data: { message: errorMessage }
      }));
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
   * @returns {string} Color hex code
   */
  generateRandomColor() {
    const colors = [
      '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
      '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  /**
   * Get connection stats
   * @returns {Object} Connection statistics
   */
  getStats() {
    return {
      totalClients: this.clients.size,
      activeDocuments: this.documentClients.size
    };
  }
}

module.exports = new WebSocketService();

