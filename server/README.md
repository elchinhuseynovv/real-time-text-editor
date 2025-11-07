# Real-Time Collaborative Text Editor

A real-time collaborative text editor with CRDT-based conflict resolution, role-based permissions, and WebSocket-based synchronization.

## Features

- ✅ **Real-time Collaboration**: Multiple users can edit documents simultaneously
- ✅ **CRDT-based Conflict Resolution**: Prevents data loss and conflicts during concurrent edits
- ✅ **Role-based Permissions**: Owner, Editor, and Viewer roles with granular permissions
- ✅ **Document History**: Version tracking for document changes
- ✅ **Chat**: Real-time chat functionality within documents
- ✅ **Document Management**: Create, read, update, and delete documents
- ✅ **WebSocket Integration**: Real-time synchronization using WebSockets

## Project Structure

```
server/
├── config/
│   └── database.js          # MongoDB connection configuration
├── models/
│   ├── Document.js          # Document model schema
│   └── User.js              # User model schema
├── controllers/
│   └── documentController.js # HTTP request handlers
├── routes/
│   └── documentRoutes.js    # API route definitions
├── services/
│   ├── crdtService.js       # CRDT conflict resolution implementation
│   ├── documentService.js  # Document business logic
│   ├── permissionService.js # Permission management
│   └── websocketService.js  # WebSocket connection handling
├── middleware/
│   ├── auth.js             # Authentication middleware
│   └── errorHandler.js     # Error handling middleware
├── tests/
│   ├── unit/               # Unit tests
│   │   ├── crdtService.test.js
│   │   ├── documentService.test.js
│   │   └── permissionService.test.js
│   └── integration/        # Integration tests
│       └── documentRoutes.test.js
└── server.js               # Main server entry point
```

## Installation

1. Install dependencies:
```bash
cd server
npm install
```

2. Set up MongoDB:
   - Make sure MongoDB is running locally, or
   - Set `MONGODB_URI` environment variable

3. Configure environment variables (optional):
```bash
cp .env.example .env
# Edit .env with your MongoDB URI
```

## Running the Server

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

The server will start on `http://localhost:4000` (or PORT from environment).

## Running Tests

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Watch mode
npm run test:watch
```

## API Endpoints

### Documents

- `GET /api/documents` - Get all documents (supports `?owner=username` filter)
- `GET /api/documents/:id` - Get document by ID
- `POST /api/documents` - Create new document
- `PUT /api/documents/:id` - Update document
- `DELETE /api/documents/:id` - Delete document

### Permissions

- `POST /api/documents/:id/permissions` - Add permission to document
- `DELETE /api/documents/:id/permissions` - Remove permission from document

### Health Check

- `GET /health` - Server health and connection stats

## WebSocket Messages

### Client → Server

- `user_join` - Join with username
- `set_document_id` - Set current document ID
- `document_change` - Simple text replacement (legacy)
- `document_operation` - CRDT-based operation (insert/delete)
- `title_change` - Change document title
- `chat_message` - Send chat message
- `save_document` - Save document to database

### Server → Client

- `init` - Initial document state and user list
- `document_update` - Document content update
- `document_operation` - CRDT operation broadcast
- `title_update` - Title change notification
- `chat_message` - Chat message broadcast
- `user_list_update` - Active users list update
- `save_success` - Document save confirmation
- `save_error` - Document save error
- `error` - General error message

## Role-Based Permissions

### Owner
- Full access to all operations
- Can manage permissions
- Can delete document

### Editor
- Can read and write document
- Cannot manage permissions
- Cannot delete document

### Viewer
- Can only read document
- Cannot edit or delete

## CRDT Implementation

The system uses a simplified CRDT (Conflict-free Replicated Data Type) algorithm for conflict resolution:

- Each character has a unique identifier
- Operations are timestamped and ordered deterministically
- Concurrent edits are merged without conflicts
- Document state is maintained per document (not global)

## Technologies Used

- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **WebSocket (ws)** - Real-time communication
- **MongoDB** - Database
- **Mongoose** - ODM
- **Jest** - Testing framework

## Development Notes

- Document state is managed per document ID (not globally)
- CRDT state is maintained in memory for active documents
- Permissions are stored in the document model
- WebSocket connections are tracked per document for efficient broadcasting

## Future Improvements

- [ ] JWT-based authentication
- [ ] More sophisticated CRDT implementation (e.g., Yjs, Automerge)
- [ ] Operational Transformation (OT) as alternative to CRDT
- [ ] Document templates
- [ ] Rich text editing (WYSIWYG)
- [ ] Export to PDF/Word
- [ ] Comment system
- [ ] Presence indicators (cursor positions)

