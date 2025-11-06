const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../server');
const Document = require('../../models/Document');

beforeAll(async () => {
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/collaborative-editor-test';
  await mongoose.connect(MONGODB_URI);
});

afterAll(async () => {
  await mongoose.connection.close();
});

beforeEach(async () => {
  await Document.deleteMany({});
});

describe('Document API Routes', () => {
  const testUser = 'testuser';

  describe('GET /api/documents', () => {
    test('should get all documents', async () => {
      await Document.create([
        { title: 'Doc1', content: 'Content1', owner: testUser },
        { title: 'Doc2', content: 'Content2', owner: testUser }
      ]);

      const response = await request(app)
        .get('/api/documents')
        .set('x-username', testUser);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(2);
    });

    test('should filter by owner', async () => {
      await Document.create([
        { title: 'Doc1', owner: 'user1' },
        { title: 'Doc2', owner: 'user2' }
      ]);

      const response = await request(app)
        .get('/api/documents?owner=user1')
        .set('x-username', testUser);

      expect(response.status).toBe(200);
      response.body.forEach(doc => {
        expect(doc.owner).toBe('user1');
      });
    });
  });

  describe('GET /api/documents/:id', () => {
    test('should get document by ID', async () => {
      const doc = await Document.create({
        title: 'Test Doc',
        content: 'Test Content',
        owner: testUser
      });

      const response = await request(app)
        .get(`/api/documents/${doc._id}`)
        .set('x-username', testUser);

      expect(response.status).toBe(200);
      expect(response.body.title).toBe('Test Doc');
      expect(response.body.content).toBe('Test Content');
    });

    test('should return 404 for non-existent document', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .get(`/api/documents/${fakeId}`)
        .set('x-username', testUser);

      expect(response.status).toBe(404);
    });

    test('should check read permission', async () => {
      const doc = await Document.create({
        title: 'Private Doc',
        content: 'Private',
        owner: 'owner1',
        permissions: []
      });

      const response = await request(app)
        .get(`/api/documents/${doc._id}`)
        .set('x-username', 'unauthorized');

      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/documents', () => {
    test('should create new document', async () => {
      const response = await request(app)
        .post('/api/documents')
        .set('x-username', testUser)
        .send({
          title: 'New Document',
          content: 'New Content'
        });

      expect(response.status).toBe(201);
      expect(response.body.title).toBe('New Document');
      expect(response.body.content).toBe('New Content');
      expect(response.body.owner).toBe(testUser);
    });

    test('should require username', async () => {
      const response = await request(app)
        .post('/api/documents')
        .send({
          title: 'New Document'
        });

      expect(response.status).toBe(400);
    });
  });

  describe('PUT /api/documents/:id', () => {
    test('should update document content', async () => {
      const doc = await Document.create({
        title: 'Test',
        content: 'Old',
        owner: testUser
      });

      const response = await request(app)
        .put(`/api/documents/${doc._id}`)
        .set('x-username', testUser)
        .send({
          content: 'New Content'
        });

      expect(response.status).toBe(200);
      expect(response.body.content).toBe('New Content');
    });

    test('should update document title', async () => {
      const doc = await Document.create({
        title: 'Old Title',
        owner: testUser
      });

      const response = await request(app)
        .put(`/api/documents/${doc._id}`)
        .set('x-username', testUser)
        .send({
          title: 'New Title'
        });

      expect(response.status).toBe(200);
      expect(response.body.title).toBe('New Title');
    });

    test('should check write permission', async () => {
      const doc = await Document.create({
        title: 'Protected',
        content: 'Content',
        owner: 'owner1',
        permissions: [{ username: 'viewer1', role: 'viewer' }]
      });

      const response = await request(app)
        .put(`/api/documents/${doc._id}`)
        .set('x-username', 'viewer1')
        .send({
          content: 'Changed'
        });

      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /api/documents/:id', () => {
    test('should delete document', async () => {
      const doc = await Document.create({
        title: 'To Delete',
        owner: testUser
      });

      const response = await request(app)
        .delete(`/api/documents/${doc._id}`)
        .set('x-username', testUser);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('deleted');

      const deleted = await Document.findById(doc._id);
      expect(deleted).toBeNull();
    });

    test('should check delete permission', async () => {
      const doc = await Document.create({
        title: 'Protected',
        owner: 'owner1',
        permissions: [{ username: 'editor1', role: 'editor' }]
      });

      const response = await request(app)
        .delete(`/api/documents/${doc._id}`)
        .set('x-username', 'editor1');

      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/documents/:id/permissions', () => {
    test('should add permission', async () => {
      const doc = await Document.create({
        title: 'Test',
        owner: testUser
      });

      const response = await request(app)
        .post(`/api/documents/${doc._id}/permissions`)
        .set('x-username', testUser)
        .send({
          username: 'newuser',
          role: 'editor'
        });

      expect(response.status).toBe(200);

      const updated = await Document.findById(doc._id);
      const permission = updated.permissions.find(p => p.username === 'newuser');
      expect(permission).toBeDefined();
      expect(permission.role).toBe('editor');
    });

    test('should require manage permission', async () => {
      const doc = await Document.create({
        title: 'Test',
        owner: 'owner1',
        permissions: [{ username: 'editor1', role: 'editor' }]
      });

      const response = await request(app)
        .post(`/api/documents/${doc._id}/permissions`)
        .set('x-username', 'editor1')
        .send({
          username: 'newuser',
          role: 'editor'
        });

      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /api/documents/:id/permissions', () => {
    test('should remove permission', async () => {
      const doc = await Document.create({
        title: 'Test',
        owner: testUser,
        permissions: [{ username: 'editor1', role: 'editor' }]
      });

      const response = await request(app)
        .delete(`/api/documents/${doc._id}/permissions`)
        .set('x-username', testUser)
        .send({
          username: 'editor1'
        });

      expect(response.status).toBe(200);

      const updated = await Document.findById(doc._id);
      const permission = updated.permissions.find(p => p.username === 'editor1');
      expect(permission).toBeUndefined();
    });
  });
});

