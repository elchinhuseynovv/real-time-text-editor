const mongoose = require('mongoose');
const permissionService = require('../../services/permissionService');
const Document = require('../../models/Document');

// Connect to test database
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
});

describe('PermissionService', () => {
  let documentId;

  beforeEach(async () => {
    const doc = new Document({
      title: 'Test Document',
      content: 'Test content',
      owner: 'owner1',
      permissions: [
        { username: 'editor1', role: 'editor' },
        { username: 'viewer1', role: 'viewer' },
      ],
    });
    const saved = await doc.save();
    documentId = saved._id.toString();
  });

  describe('checkPermission', () => {
    test('owner should have all permissions', async () => {
      expect(await permissionService.checkPermission(documentId, 'owner1', 'read')).toBe(true);
      expect(await permissionService.checkPermission(documentId, 'owner1', 'write')).toBe(true);
      expect(await permissionService.checkPermission(documentId, 'owner1', 'delete')).toBe(true);
      expect(await permissionService.checkPermission(documentId, 'owner1', 'manage')).toBe(true);
    });

    test('editor should have read and write permissions', async () => {
      expect(await permissionService.checkPermission(documentId, 'editor1', 'read')).toBe(true);
      expect(await permissionService.checkPermission(documentId, 'editor1', 'write')).toBe(true);
      expect(await permissionService.checkPermission(documentId, 'editor1', 'delete')).toBe(false);
      expect(await permissionService.checkPermission(documentId, 'editor1', 'manage')).toBe(false);
    });

    test('viewer should only have read permission', async () => {
      expect(await permissionService.checkPermission(documentId, 'viewer1', 'read')).toBe(true);
      expect(await permissionService.checkPermission(documentId, 'viewer1', 'write')).toBe(false);
      expect(await permissionService.checkPermission(documentId, 'viewer1', 'delete')).toBe(false);
      expect(await permissionService.checkPermission(documentId, 'viewer1', 'manage')).toBe(false);
    });

    test('user without permission should not have access', async () => {
      expect(await permissionService.checkPermission(documentId, 'unauthorized', 'read')).toBe(
        false
      );
      expect(await permissionService.checkPermission(documentId, 'unauthorized', 'write')).toBe(
        false
      );
    });

    test('should return false for non-existent document', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      expect(await permissionService.checkPermission(fakeId.toString(), 'owner1', 'read')).toBe(
        false
      );
    });
  });

  describe('getUserRole', () => {
    test('should return owner role for owner', async () => {
      const role = await permissionService.getUserRole(documentId, 'owner1');
      expect(role).toBe('owner');
    });

    test('should return editor role for editor', async () => {
      const role = await permissionService.getUserRole(documentId, 'editor1');
      expect(role).toBe('editor');
    });

    test('should return viewer role for viewer', async () => {
      const role = await permissionService.getUserRole(documentId, 'viewer1');
      expect(role).toBe('viewer');
    });

    test('should return null for user without permission', async () => {
      const role = await permissionService.getUserRole(documentId, 'unauthorized');
      expect(role).toBeNull();
    });
  });

  describe('addPermission', () => {
    test('owner should be able to add permission', async () => {
      await permissionService.addPermission(documentId, 'newuser', 'editor', 'owner1');

      const doc = await Document.findById(documentId);
      const permission = doc.permissions.find((p) => p.username === 'newuser');
      expect(permission).toBeDefined();
      expect(permission.role).toBe('editor');
    });

    test('non-owner should not be able to add permission', async () => {
      await expect(
        permissionService.addPermission(documentId, 'newuser', 'editor', 'editor1')
      ).rejects.toThrow('Insufficient permissions');
    });

    test('should replace existing permission', async () => {
      await permissionService.addPermission(documentId, 'viewer1', 'editor', 'owner1');

      const doc = await Document.findById(documentId);
      const permissions = doc.permissions.filter((p) => p.username === 'viewer1');
      expect(permissions.length).toBe(1);
      expect(permissions[0].role).toBe('editor');
    });
  });

  describe('removePermission', () => {
    test('owner should be able to remove permission', async () => {
      await permissionService.removePermission(documentId, 'viewer1', 'owner1');

      const doc = await Document.findById(documentId);
      const permission = doc.permissions.find((p) => p.username === 'viewer1');
      expect(permission).toBeUndefined();
    });

    test('non-owner should not be able to remove permission', async () => {
      await expect(
        permissionService.removePermission(documentId, 'viewer1', 'editor1')
      ).rejects.toThrow('Insufficient permissions');
    });

    test('should not allow removing owner permission', async () => {
      await expect(
        permissionService.removePermission(documentId, 'owner1', 'owner1')
      ).rejects.toThrow('Cannot remove owner permission');
    });
  });
});
