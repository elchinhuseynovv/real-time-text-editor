const mongoose = require('mongoose');
const documentService = require('../../services/documentService');
const Document = require('../../models/Document');
const crdtService = require('../../services/crdtService');

beforeAll(async () => {
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/collaborative-editor-test';
  await mongoose.connect(MONGODB_URI);
});

afterAll(async () => {
  await mongoose.connection.close();
});

beforeEach(async () => {
  await Document.deleteMany({});
  // Clear CRDT state
  crdtService.clearDocument = jest.fn();
});

describe('DocumentService - Share Links', () => {
  const testOwner = 'testowner';

  describe('generateShareLink', () => {
    test('should generate share link with edit access', async () => {
      const doc = await Document.create({
        title: 'Test Doc',
        owner: testOwner
      });

      const token = await documentService.generateShareLink(doc._id.toString(), 'edit', testOwner);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);

      const updated = await Document.findById(doc._id);
      expect(updated.shareToken).toBe(token);
      expect(updated.shareAccess).toBe('edit');
    });

    test('should generate share link with read access', async () => {
      const doc = await Document.create({
        title: 'Test Doc',
        owner: testOwner
      });

      const token = await documentService.generateShareLink(doc._id.toString(), 'read', testOwner);

      const updated = await Document.findById(doc._id);
      expect(updated.shareAccess).toBe('read');
    });

    test('should throw error if document not found', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      
      await expect(
        documentService.generateShareLink(fakeId, 'edit', testOwner)
      ).rejects.toThrow('Document not found');
    });

    test('should throw error if not owner', async () => {
      const doc = await Document.create({
        title: 'Test Doc',
        owner: 'owner1'
      });

      await expect(
        documentService.generateShareLink(doc._id.toString(), 'edit', 'notowner')
      ).rejects.toThrow('Only document owner can generate share links');
    });
  });

  describe('getDocumentByShareToken', () => {
    test('should get document by share token', async () => {
      const doc = await Document.create({
        title: 'Shared Doc',
        owner: testOwner,
        shareToken: 'test-token-123',
        shareAccess: 'edit'
      });

      const found = await documentService.getDocumentByShareToken('test-token-123');

      expect(found).toBeDefined();
      expect(found._id.toString()).toBe(doc._id.toString());
      expect(found.shareToken).toBe('test-token-123');
    });

    test('should return null for invalid token', async () => {
      const found = await documentService.getDocumentByShareToken('invalid-token');
      expect(found).toBeNull();
    });
  });

  describe('joinDocumentByShareToken', () => {
    test('should join document with edit access and add editor permission', async () => {
      const doc = await Document.create({
        title: 'Shared Doc',
        owner: 'owner1',
        shareToken: 'test-token-edit',
        shareAccess: 'edit'
      });

      const result = await documentService.joinDocumentByShareToken('test-token-edit', 'newuser');

      expect(result.document).toBeDefined();
      expect(result.access).toBe('edit');

      const updated = await Document.findById(doc._id);
      const permission = updated.permissions.find(p => p.username === 'newuser');
      expect(permission).toBeDefined();
      expect(permission.role).toBe('editor');
    });

    test('should join document with read access and add viewer permission', async () => {
      const doc = await Document.create({
        title: 'Shared Doc',
        owner: 'owner1',
        shareToken: 'test-token-read',
        shareAccess: 'read'
      });

      const result = await documentService.joinDocumentByShareToken('test-token-read', 'newuser');

      expect(result.access).toBe('read');

      const updated = await Document.findById(doc._id);
      const permission = updated.permissions.find(p => p.username === 'newuser');
      expect(permission).toBeDefined();
      expect(permission.role).toBe('viewer');
    });

    test('should not duplicate permission if user already has access', async () => {
      const doc = await Document.create({
        title: 'Shared Doc',
        owner: 'owner1',
        shareToken: 'test-token-edit',
        shareAccess: 'edit',
        permissions: [{ username: 'existinguser', role: 'editor' }]
      });

      await documentService.joinDocumentByShareToken('test-token-edit', 'existinguser');

      const updated = await Document.findById(doc._id);
      const permissions = updated.permissions.filter(p => p.username === 'existinguser');
      expect(permissions.length).toBe(1);
    });

    test('should throw error for invalid token', async () => {
      await expect(
        documentService.joinDocumentByShareToken('invalid-token', 'newuser')
      ).rejects.toThrow('Invalid share token');
    });
  });

  describe('revokeShareLink', () => {
    test('should revoke share link', async () => {
      const doc = await Document.create({
        title: 'Test Doc',
        owner: testOwner,
        shareToken: 'test-token',
        shareAccess: 'edit'
      });

      const result = await documentService.revokeShareLink(doc._id.toString(), testOwner);

      expect(result).toBe(true);

      const updated = await Document.findById(doc._id);
      expect(updated.shareToken).toBeNull();
      expect(updated.shareAccess).toBeNull();
    });

    test('should throw error if document not found', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      
      await expect(
        documentService.revokeShareLink(fakeId, testOwner)
      ).rejects.toThrow('Document not found');
    });

    test('should throw error if not owner', async () => {
      const doc = await Document.create({
        title: 'Test Doc',
        owner: 'owner1',
        shareToken: 'test-token',
        shareAccess: 'edit'
      });

      await expect(
        documentService.revokeShareLink(doc._id.toString(), 'notowner')
      ).rejects.toThrow('Only document owner can revoke share links');
    });
  });

  describe('loadDocumentIntoCRDT', () => {
    test('should load document content into CRDT', async () => {
      const doc = await Document.create({
        title: 'Test Doc',
        content: 'Test Content',
        owner: testOwner
      });

      await documentService.loadDocumentIntoCRDT(doc._id.toString());

      // CRDT should have the content
      const crdtContent = crdtService.getContent(doc._id.toString());
      expect(crdtContent).toBe('Test Content');
    });

    test('should handle non-existent document gracefully', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      
      // Should not throw error
      await expect(
        documentService.loadDocumentIntoCRDT(fakeId)
      ).resolves.not.toThrow();
    });
  });
});

