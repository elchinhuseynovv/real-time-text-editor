const mongoose = require('mongoose');
const documentService = require('../../services/documentService');
const Document = require('../../models/Document');
const crdtService = require('../../services/crdtService');

beforeAll(async () => {
  const MONGODB_URI =
    process.env.MONGODB_URI || 'mongodb://localhost:27017/collaborative-editor-test';
  await mongoose.connect(MONGODB_URI);
});

afterAll(async () => {
  await mongoose.connection.close();
});

beforeEach(async () => {
  await Document.deleteMany({});
  crdtService.documentStates.clear();
});

describe('DocumentService', () => {
  describe('createDocument', () => {
    test('should create document with title and content', async () => {
      const doc = await documentService.createDocument({
        title: 'Test Document',
        content: 'Test content',
        owner: 'user1',
      });

      expect(doc.title).toBe('Test Document');
      expect(doc.content).toBe('Test content');
      expect(doc.owner).toBe('user1');
      expect(doc._id).toBeDefined();
    });

    test('should create document with default title', async () => {
      const doc = await documentService.createDocument({
        owner: 'user1',
      });

      expect(doc.title).toBe('Untitled Document');
      expect(doc.content).toBe('');
    });

    test('should initialize CRDT state', async () => {
      const doc = await documentService.createDocument({
        title: 'Test',
        content: 'Hello',
        owner: 'user1',
      });

      expect(crdtService.getContent(doc._id.toString())).toBe('Hello');
    });
  });

  describe('getDocumentById', () => {
    test('should retrieve document by ID', async () => {
      const created = await documentService.createDocument({
        title: 'Test',
        content: 'Content',
        owner: 'user1',
      });

      const retrieved = await documentService.getDocumentById(created._id.toString());
      expect(retrieved).toBeDefined();
      expect(retrieved.title).toBe('Test');
      expect(retrieved.content).toBe('Content');
    });

    test('should return null for non-existent document', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const retrieved = await documentService.getDocumentById(fakeId.toString());
      expect(retrieved).toBeNull();
    });
  });

  describe('getDocuments', () => {
    test('should retrieve all documents', async () => {
      await documentService.createDocument({ title: 'Doc1', owner: 'user1' });
      await documentService.createDocument({ title: 'Doc2', owner: 'user1' });
      await documentService.createDocument({ title: 'Doc3', owner: 'user2' });

      const docs = await documentService.getDocuments();
      expect(docs.length).toBeGreaterThanOrEqual(3);
    });

    test('should filter by owner', async () => {
      await documentService.createDocument({ title: 'Doc1', owner: 'user1' });
      await documentService.createDocument({ title: 'Doc2', owner: 'user1' });
      await documentService.createDocument({ title: 'Doc3', owner: 'user2' });

      const docs = await documentService.getDocuments({ owner: 'user1' });
      expect(docs.length).toBe(2);
      docs.forEach((doc) => {
        expect(doc.owner).toBe('user1');
      });
    });

    test('should respect limit', async () => {
      for (let i = 0; i < 5; i++) {
        await documentService.createDocument({ title: `Doc${i}`, owner: 'user1' });
      }

      const docs = await documentService.getDocuments({ limit: 3 });
      expect(docs.length).toBeLessThanOrEqual(3);
    });
  });

  describe('updateDocumentContent', () => {
    test('should update document content', async () => {
      const doc = await documentService.createDocument({
        title: 'Test',
        content: 'Old',
        owner: 'user1',
      });

      const docId = doc._id.toString();
      const updated = await documentService.updateDocumentContent(docId, 'New content', 'user1');

      expect(updated.content).toBe('New content');
      expect(updated.versions.length).toBe(2);
    });

    test('should update CRDT state', async () => {
      const doc = await documentService.createDocument({
        title: 'Test',
        content: 'Old',
        owner: 'user1',
      });

      const docId = doc._id.toString();
      await documentService.updateDocumentContent(docId, 'New content', 'user1');

      expect(crdtService.getContent(docId)).toBe('New content');
    });

    test('should throw error for non-existent document', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      await expect(
        documentService.updateDocumentContent(fakeId.toString(), 'New', 'user1')
      ).rejects.toThrow('Document not found');
    });
  });

  describe('updateDocumentTitle', () => {
    test('should update document title', async () => {
      const doc = await documentService.createDocument({
        title: 'Old Title',
        owner: 'user1',
      });

      const updated = await documentService.updateDocumentTitle(doc._id.toString(), 'New Title');

      expect(updated.title).toBe('New Title');
    });
  });

  describe('deleteDocument', () => {
    test('should delete document', async () => {
      const doc = await documentService.createDocument({
        title: 'Test',
        owner: 'user1',
      });

      const deleted = await documentService.deleteDocument(doc._id.toString());
      expect(deleted).toBe(true);

      const retrieved = await documentService.getDocumentById(doc._id.toString());
      expect(retrieved).toBeNull();
    });

    test('should clear CRDT state when deleting', async () => {
      const doc = await documentService.createDocument({
        title: 'Test',
        content: 'Content',
        owner: 'user1',
      });

      const docId = doc._id.toString();
      await documentService.deleteDocument(docId);

      expect(crdtService.documentStates.has(docId)).toBe(false);
    });
  });

  describe('loadDocumentIntoCRDT', () => {
    test('should load document content into CRDT', async () => {
      const doc = await documentService.createDocument({
        title: 'Test',
        content: 'Hello World',
        owner: 'user1',
      });

      // Clear CRDT state first
      crdtService.clearDocument(doc._id.toString());

      await documentService.loadDocumentIntoCRDT(doc._id.toString());
      expect(crdtService.getContent(doc._id.toString())).toBe('Hello World');
    });
  });
});
