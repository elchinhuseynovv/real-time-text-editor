const socketIOService = require('../../services/socketIOService');
const documentService = require('../../services/documentService');
const crdtService = require('../../services/crdtService');
const permissionService = require('../../services/permissionService');
const mongoose = require('mongoose');

// Mock dependencies
jest.mock('../../services/documentService');
jest.mock('../../services/crdtService');
jest.mock('../../services/permissionService');

beforeAll(async () => {
  const MONGODB_URI =
    process.env.MONGODB_URI || 'mongodb://localhost:27017/collaborative-editor-test';
  await mongoose.connect(MONGODB_URI);
});

afterAll(async () => {
  await mongoose.connection.close();
});

beforeEach(() => {
  // Clear all clients and document clients
  socketIOService.clients.clear();
  socketIOService.documentClients.clear();
  socketIOService.io = null;

  // Reset mocks
  jest.clearAllMocks();

  // Setup default mock implementations
  crdtService.documentStates = new Map();
  crdtService.setContent = jest.fn();
  crdtService.getContent = jest.fn(() => '');
  crdtService.applyOperation = jest.fn(() => ({ content: 'test', version: 1 }));
  crdtService.clearDocument = jest.fn();

  permissionService.checkPermission = jest.fn(() => Promise.resolve(true));

  documentService.getDocumentById = jest.fn(() => Promise.resolve(null));
  documentService.createDocument = jest.fn(() =>
    Promise.resolve({ _id: { toString: () => 'doc123' }, title: 'Test Doc', content: '' })
  );
  documentService.updateDocumentContent = jest.fn(() =>
    Promise.resolve({ _id: { toString: () => 'doc123' } })
  );
  documentService.updateDocumentTitle = jest.fn(() =>
    Promise.resolve({ _id: { toString: () => 'doc123' }, title: 'New Title' })
  );
  documentService.loadDocumentIntoCRDT = jest.fn(() => Promise.resolve());
});

describe('SocketIOService', () => {
  describe('initialize', () => {
    test('should initialize with Socket.IO server', () => {
      const mockIO = {
        on: jest.fn(),
      };

      socketIOService.initialize(mockIO);

      expect(socketIOService.io).toBe(mockIO);
      expect(mockIO.on).toHaveBeenCalledWith('connection', expect.any(Function));
    });
  });

  describe('handleConnection', () => {
    test('should create client and register event handlers', () => {
      const mockSocket = createMockSocket('socket1');

      socketIOService.handleConnection(mockSocket);

      expect(socketIOService.clients.size).toBe(1);
      expect(mockSocket.on).toHaveBeenCalledWith('user_join', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('set_document_id', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('document_change', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('document_operation', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('title_change', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('chat_message', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('save_document', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    test('should assign clientId to socket', () => {
      const mockSocket = createMockSocket('socket1');

      socketIOService.handleConnection(mockSocket);

      const clientId = Array.from(socketIOService.clients.keys())[0];
      expect(mockSocket.clientId).toBe(clientId);
    });
  });

  describe('handleUserJoin', () => {
    test('should set username and broadcast user list', async () => {
      const mockSocket = createMockSocket('socket1');
      socketIOService.handleConnection(mockSocket);
      const clientId = mockSocket.clientId;

      const mockIO = createMockIO();
      socketIOService.io = mockIO;

      await socketIOService.handleUserJoin(clientId, 'testuser');

      const client = socketIOService.clients.get(clientId);
      expect(client.username).toBe('testuser');
      expect(mockIO.emit).toHaveBeenCalled();
    });

    test('should handle non-existent client gracefully', async () => {
      await socketIOService.handleUserJoin('nonexistent', 'testuser');
      // Should not throw error
    });
  });

  describe('handleSetDocumentId', () => {
    test('should set document ID and send init message', async () => {
      const mockSocket = createMockSocket('socket1');
      socketIOService.handleConnection(mockSocket);
      const clientId = mockSocket.clientId;

      const mockDoc = {
        _id: { toString: () => 'doc123' },
        title: 'Test Doc',
        content: 'Test Content',
      };

      documentService.getDocumentById.mockResolvedValue(mockDoc);
      crdtService.getContent.mockReturnValue('Test Content');

      await socketIOService.handleSetDocumentId(clientId, 'doc123');

      const client = socketIOService.clients.get(clientId);
      expect(client.documentId).toBe('doc123');
      expect(mockSocket.join).toHaveBeenCalledWith('document:doc123');
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'init',
        expect.objectContaining({
          document: expect.objectContaining({
            title: 'Test Doc',
            content: 'Test Content',
          }),
        })
      );
    });

    test('should handle empty documentId', async () => {
      const mockSocket = createMockSocket('socket1');
      socketIOService.handleConnection(mockSocket);
      const clientId = mockSocket.clientId;

      await socketIOService.handleSetDocumentId(clientId, '');

      // Should not throw error
      expect(mockSocket.emit).not.toHaveBeenCalled();
    });

    test('should handle document not found', async () => {
      const mockSocket = createMockSocket('socket1');
      socketIOService.handleConnection(mockSocket);
      const clientId = mockSocket.clientId;

      documentService.getDocumentById.mockResolvedValue(null);

      await socketIOService.handleSetDocumentId(clientId, 'doc123');

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({
          message: expect.stringContaining('not found'),
        })
      );
    });

    test('should switch documents when changing documentId', async () => {
      const mockSocket = createMockSocket('socket1');
      socketIOService.handleConnection(mockSocket);
      const clientId = mockSocket.clientId;

      const mockDoc1 = { _id: { toString: () => 'doc1' }, title: 'Doc1', content: 'Content1' };
      const mockDoc2 = { _id: { toString: () => 'doc2' }, title: 'Doc2', content: 'Content2' };

      documentService.getDocumentById
        .mockResolvedValueOnce(mockDoc1)
        .mockResolvedValueOnce(mockDoc2);
      crdtService.getContent.mockReturnValue('content');

      await socketIOService.handleSetDocumentId(clientId, 'doc1');
      await socketIOService.handleSetDocumentId(clientId, 'doc2');

      expect(mockSocket.leave).toHaveBeenCalledWith('document:doc1');
      expect(mockSocket.join).toHaveBeenCalledWith('document:doc2');
    });
  });

  describe('handleDocumentChange', () => {
    test('should update CRDT and broadcast to other clients', async () => {
      const mockSocket1 = createMockSocket('socket1');
      const mockSocket2 = createMockSocket('socket2');

      socketIOService.handleConnection(mockSocket1);
      socketIOService.handleConnection(mockSocket2);

      const clientId1 = mockSocket1.clientId;
      const clientId2 = mockSocket2.clientId;

      // Set usernames
      await socketIOService.handleUserJoin(clientId1, 'user1');
      await socketIOService.handleUserJoin(clientId2, 'user2');

      // Set document IDs
      const mockDoc = { _id: { toString: () => 'doc123' }, title: 'Test', content: '' };
      documentService.getDocumentById.mockResolvedValue(mockDoc);
      crdtService.getContent.mockReturnValue('');

      await socketIOService.handleSetDocumentId(clientId1, 'doc123');
      await socketIOService.handleSetDocumentId(clientId2, 'doc123');

      const mockIO = createMockIO();
      socketIOService.io = mockIO;

      await socketIOService.handleDocumentChange(clientId1, 'New Content');

      expect(crdtService.setContent).toHaveBeenCalledWith('doc123', 'New Content');
      // broadcastToDocument excludes the sender, so it uses socket1.to() to exclude itself
      expect(mockSocket1.to).toHaveBeenCalledWith('document:doc123');
      expect(mockSocket1._mockEmit).toHaveBeenCalledWith(
        'document_update',
        expect.objectContaining({
          content: 'New Content',
          user: 'user1',
        })
      );
    });

    test('should check permissions before updating', async () => {
      const mockSocket = createMockSocket('socket1');
      socketIOService.handleConnection(mockSocket);
      const clientId = mockSocket.clientId;

      await socketIOService.handleUserJoin(clientId, 'user1');

      const mockDoc = { _id: { toString: () => 'doc123' }, title: 'Test', content: '' };
      documentService.getDocumentById.mockResolvedValue(mockDoc);
      crdtService.getContent.mockReturnValue('');

      await socketIOService.handleSetDocumentId(clientId, 'doc123');

      permissionService.checkPermission.mockResolvedValue(false);

      await socketIOService.handleDocumentChange(clientId, 'New Content');

      expect(crdtService.setContent).not.toHaveBeenCalled();
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({
          message: expect.stringContaining('permissions'),
        })
      );
    });
  });

  describe('handleTitleChange', () => {
    test('should update title and broadcast', async () => {
      const mockSocket = createMockSocket('socket1');
      socketIOService.handleConnection(mockSocket);
      const clientId = mockSocket.clientId;

      await socketIOService.handleUserJoin(clientId, 'user1');

      const mockDoc = { _id: { toString: () => 'doc123' }, title: 'Test', content: '' };
      documentService.getDocumentById.mockResolvedValue(mockDoc);
      crdtService.getContent.mockReturnValue('');

      await socketIOService.handleSetDocumentId(clientId, 'doc123');

      const mockIO = createMockIO();
      socketIOService.io = mockIO;

      await socketIOService.handleTitleChange(clientId, 'New Title');

      expect(documentService.updateDocumentTitle).toHaveBeenCalledWith('doc123', 'New Title');
      // broadcastToDocument excludes the sender, so it uses socket.to() to exclude itself
      expect(mockSocket.to).toHaveBeenCalledWith('document:doc123');
      expect(mockSocket._mockEmit).toHaveBeenCalledWith('title_update', { title: 'New Title' });
    });
  });

  describe('handleChatMessage', () => {
    test('should broadcast chat message to other clients', () => {
      const mockSocket1 = createMockSocket('socket1');
      const mockSocket2 = createMockSocket('socket2');

      socketIOService.handleConnection(mockSocket1);
      socketIOService.handleConnection(mockSocket2);

      const clientId1 = mockSocket1.clientId;
      const clientId2 = mockSocket2.clientId;

      // Set document IDs
      socketIOService.clients.get(clientId1).documentId = 'doc123';
      socketIOService.clients.get(clientId2).documentId = 'doc123';
      socketIOService.clients.get(clientId1).username = 'user1';
      socketIOService.clients.get(clientId2).username = 'user2';

      socketIOService.documentClients.set('doc123', new Set([clientId1, clientId2]));

      const mockIO = createMockIO();
      socketIOService.io = mockIO;

      socketIOService.handleChatMessage(clientId1, { text: 'Hello', timestamp: '2024-01-01' });

      // broadcastToDocument excludes the sender, so it uses socket1.to() to exclude itself
      expect(mockSocket1.to).toHaveBeenCalledWith('document:doc123');
      expect(mockSocket1._mockEmit).toHaveBeenCalledWith(
        'chat_message',
        expect.objectContaining({
          message: expect.objectContaining({
            text: 'Hello',
            user: 'user1',
          }),
        })
      );
    });
  });

  describe('handleSaveDocument', () => {
    test('should create new document when documentId is null', async () => {
      const mockSocket = createMockSocket('socket1');
      socketIOService.handleConnection(mockSocket);
      const clientId = mockSocket.clientId;

      await socketIOService.handleUserJoin(clientId, 'user1');

      // Use setTimeout mock
      jest.useFakeTimers();

      await socketIOService.handleSaveDocument(clientId, {
        content: 'New Content',
        title: 'New Doc',
      });

      expect(documentService.createDocument).toHaveBeenCalledWith({
        title: 'New Doc',
        content: 'New Content',
        owner: 'user1',
      });

      const client = socketIOService.clients.get(clientId);
      expect(client.documentId).toBe('doc123');
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'save_success',
        expect.objectContaining({
          documentId: 'doc123',
        })
      );

      jest.advanceTimersByTime(100);
      jest.useRealTimers();
    });

    test('should save existing document', async () => {
      const mockSocket = createMockSocket('socket1');
      socketIOService.handleConnection(mockSocket);
      const clientId = mockSocket.clientId;

      await socketIOService.handleUserJoin(clientId, 'user1');

      const mockDoc = { _id: { toString: () => 'doc123' }, title: 'Test', content: '' };
      documentService.getDocumentById.mockResolvedValue(mockDoc);
      crdtService.getContent.mockReturnValue('Updated Content');

      await socketIOService.handleSetDocumentId(clientId, 'doc123');

      await socketIOService.handleSaveDocument(clientId, {});

      expect(documentService.updateDocumentContent).toHaveBeenCalledWith(
        'doc123',
        'Updated Content',
        'user1'
      );
      expect(mockSocket.emit).toHaveBeenCalledWith('save_success', expect.any(Object));
    });

    test('should require username for new document', async () => {
      const mockSocket = createMockSocket('socket1');
      socketIOService.handleConnection(mockSocket);
      const clientId = mockSocket.clientId;

      // Don't set username
      await socketIOService.handleSaveDocument(clientId, { content: 'Content' });

      expect(documentService.createDocument).not.toHaveBeenCalled();
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({
          message: expect.stringContaining('Username required'),
        })
      );
    });
  });

  describe('handleDisconnect', () => {
    test('should remove client and broadcast user list update', () => {
      const mockSocket1 = createMockSocket('socket1');
      const mockSocket2 = createMockSocket('socket2');

      socketIOService.handleConnection(mockSocket1);
      socketIOService.handleConnection(mockSocket2);

      const clientId1 = mockSocket1.clientId;
      const clientId2 = mockSocket2.clientId;

      socketIOService.clients.get(clientId1).documentId = 'doc123';
      socketIOService.clients.get(clientId1).username = 'user1';
      socketIOService.clients.get(clientId2).documentId = 'doc123';
      socketIOService.clients.get(clientId2).username = 'user2';

      socketIOService.documentClients.set('doc123', new Set([clientId1, clientId2]));

      const mockIO = createMockIO();
      socketIOService.io = mockIO;

      socketIOService.handleDisconnect(clientId1);

      expect(socketIOService.clients.has(clientId1)).toBe(false);
      expect(socketIOService.documentClients.get('doc123').has(clientId1)).toBe(false);
      expect(mockSocket1.leave).toHaveBeenCalledWith('document:doc123');
      expect(mockIO.to).toHaveBeenCalledWith('document:doc123');
    });
  });

  describe('sendToClient', () => {
    test('should send message to connected socket', () => {
      const mockSocket = createMockSocket('socket1');
      mockSocket.connected = true;

      socketIOService.sendToClient(mockSocket, 'test_event', { data: 'test' });

      expect(mockSocket.emit).toHaveBeenCalledWith('test_event', { data: 'test' });
    });

    test('should not send to disconnected socket', () => {
      const mockSocket = createMockSocket('socket1');
      mockSocket.connected = false;

      socketIOService.sendToClient(mockSocket, 'test_event', { data: 'test' });

      expect(mockSocket.emit).not.toHaveBeenCalled();
    });
  });

  describe('sendError', () => {
    test('should send error message to client', () => {
      const mockSocket = createMockSocket('socket1');
      mockSocket.connected = true;

      socketIOService.sendError(mockSocket, 'Test error');

      expect(mockSocket.emit).toHaveBeenCalledWith('error', {
        message: 'Test error',
      });
    });
  });

  describe('broadcastToDocument', () => {
    test('should broadcast to all clients in document room', () => {
      const mockIO = createMockIO();
      socketIOService.io = mockIO;
      socketIOService.documentClients.set('doc123', new Set(['client1', 'client2']));

      socketIOService.broadcastToDocument('doc123', 'test_event', { data: 'test' });

      expect(mockIO.to).toHaveBeenCalledWith('document:doc123');
      expect(mockIO._mockEmit).toHaveBeenCalledWith('test_event', { data: 'test' });
    });

    test('should exclude specific client when specified', () => {
      const mockSocket = createMockSocket('socket1');
      mockSocket.connected = true;
      socketIOService.handleConnection(mockSocket);
      const clientId = mockSocket.clientId;

      // Ensure socket is stored correctly
      const client = socketIOService.clients.get(clientId);
      expect(client).toBeDefined();
      expect(client.socket).toBe(mockSocket);

      client.documentId = 'doc123';
      socketIOService.documentClients.set('doc123', new Set([clientId]));

      // Set io to ensure it doesn't fallback
      const mockIO = createMockIO();
      socketIOService.io = mockIO;

      socketIOService.broadcastToDocument('doc123', 'test_event', { data: 'test' }, clientId);

      // Should use socket.to() to exclude the client
      expect(mockSocket.to).toHaveBeenCalledWith('document:doc123');
      expect(mockSocket._mockEmit).toHaveBeenCalledWith('test_event', { data: 'test' });
      // Should NOT use io.to() since we're excluding via socket
      expect(mockIO.to).not.toHaveBeenCalled();
    });

    test('should fallback to io broadcast if exclude socket not found', () => {
      const mockIO = createMockIO();
      socketIOService.io = mockIO;
      socketIOService.documentClients.set('doc123', new Set(['nonexistent-client']));

      socketIOService.broadcastToDocument(
        'doc123',
        'test_event',
        { data: 'test' },
        'nonexistent-client'
      );

      // Should fallback to io.to() since socket not found
      expect(mockIO.to).toHaveBeenCalledWith('document:doc123');
      expect(mockIO._mockEmit).toHaveBeenCalledWith('test_event', { data: 'test' });
    });

    test('should handle non-existent document gracefully', () => {
      const mockIO = createMockIO();
      socketIOService.io = mockIO;

      socketIOService.broadcastToDocument('nonexistent', 'test_event', { data: 'test' });

      expect(mockIO.to).not.toHaveBeenCalled();
    });
  });

  describe('broadcastUserList', () => {
    test('should broadcast user list to all clients', () => {
      const mockSocket1 = createMockSocket('socket1');
      const mockSocket2 = createMockSocket('socket2');

      socketIOService.handleConnection(mockSocket1);
      socketIOService.handleConnection(mockSocket2);

      const clientId1 = mockSocket1.clientId;
      const clientId2 = mockSocket2.clientId;

      socketIOService.clients.get(clientId1).username = 'user1';
      socketIOService.clients.get(clientId2).username = 'user2';

      const mockIO = createMockIO();
      socketIOService.io = mockIO;

      socketIOService.broadcastUserList();

      expect(mockIO.emit).toHaveBeenCalledWith(
        'user_list_update',
        expect.objectContaining({
          users: expect.arrayContaining([
            expect.objectContaining({ name: 'user1' }),
            expect.objectContaining({ name: 'user2' }),
          ]),
        })
      );
    });

    test('should remove duplicate usernames', () => {
      const mockSocket1 = createMockSocket('socket1');
      const mockSocket2 = createMockSocket('socket2');

      socketIOService.handleConnection(mockSocket1);
      socketIOService.handleConnection(mockSocket2);

      const clientId1 = mockSocket1.clientId;
      const clientId2 = mockSocket2.clientId;

      // Same username, different clients
      socketIOService.clients.get(clientId1).username = 'user1';
      socketIOService.clients.get(clientId2).username = 'user1';

      const mockIO = createMockIO();
      socketIOService.io = mockIO;

      socketIOService.broadcastUserList();

      const callArgs = mockIO.emit.mock.calls.find((call) => call[0] === 'user_list_update');
      expect(callArgs[1].users).toHaveLength(1);
    });
  });

  describe('getUsersForDocument', () => {
    test('should return users for a document', () => {
      const mockSocket1 = createMockSocket('socket1');
      const mockSocket2 = createMockSocket('socket2');

      socketIOService.handleConnection(mockSocket1);
      socketIOService.handleConnection(mockSocket2);

      const clientId1 = mockSocket1.clientId;
      const clientId2 = mockSocket2.clientId;

      socketIOService.clients.get(clientId1).username = 'user1';
      socketIOService.clients.get(clientId1).documentId = 'doc123';
      socketIOService.clients.get(clientId2).username = 'user2';
      socketIOService.clients.get(clientId2).documentId = 'doc123';

      socketIOService.documentClients.set('doc123', new Set([clientId1, clientId2]));

      const users = socketIOService.getUsersForDocument('doc123');

      expect(users).toHaveLength(2);
      expect(users).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'user1' }),
          expect.objectContaining({ name: 'user2' }),
        ])
      );
    });

    test('should return empty array for non-existent document', () => {
      const users = socketIOService.getUsersForDocument('nonexistent');
      expect(users).toEqual([]);
    });
  });

  describe('generateClientId', () => {
    test('should generate unique client IDs', () => {
      const id1 = socketIOService.generateClientId();
      const id2 = socketIOService.generateClientId();

      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
    });
  });

  describe('generateRandomColor', () => {
    test('should generate a valid color', () => {
      const color = socketIOService.generateRandomColor();

      expect(color).toBeDefined();
      expect(color).toMatch(/^#[0-9a-f]{6}$/i);
    });
  });

  describe('getStats', () => {
    test('should return connection statistics', () => {
      const mockSocket1 = createMockSocket('socket1');
      const mockSocket2 = createMockSocket('socket2');

      socketIOService.handleConnection(mockSocket1);
      socketIOService.handleConnection(mockSocket2);

      const clientId1 = mockSocket1.clientId;
      const clientId2 = mockSocket2.clientId;

      socketIOService.clients.get(clientId1).documentId = 'doc1';
      socketIOService.clients.get(clientId2).documentId = 'doc2';

      socketIOService.documentClients.set('doc1', new Set([clientId1]));
      socketIOService.documentClients.set('doc2', new Set([clientId2]));

      const stats = socketIOService.getStats();

      expect(stats.totalClients).toBe(2);
      expect(stats.totalDocuments).toBe(2);
      expect(stats.documentClients).toEqual({
        doc1: 1,
        doc2: 1,
      });
    });
  });
});

// Helper functions
function createMockSocket(id) {
  const mockEmit = jest.fn();
  const mockRoomEmitter = {
    emit: mockEmit,
  };
  const mockTo = jest.fn(() => mockRoomEmitter);

  const mockSocket = {
    id: id,
    clientId: null,
    connected: true,
    emit: jest.fn(),
    on: jest.fn(),
    join: jest.fn(),
    leave: jest.fn(),
    to: mockTo,
    _mockEmit: mockEmit, // Expose for testing
  };
  return mockSocket;
}

function createMockIO() {
  const mockEmit = jest.fn();
  const mockRoomEmitter = {
    emit: mockEmit,
  };
  const mockTo = jest.fn(() => mockRoomEmitter);

  return {
    emit: jest.fn(),
    to: mockTo,
    on: jest.fn(),
    _mockEmit: mockEmit, // Expose for testing
  };
}
