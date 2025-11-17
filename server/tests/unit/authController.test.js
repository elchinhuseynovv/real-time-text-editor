const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const authController = require('../../controllers/authController');
const User = require('../../models/User');

// Create test app
const app = express();
app.use(express.json());
app.post('/register', authController.register);
app.post('/login', authController.login);
app.post('/logout', authController.logout);
app.get('/profile', authController.getProfile);

beforeAll(async () => {
  const MONGODB_URI =
    process.env.MONGODB_URI || 'mongodb://localhost:27017/collaborative-editor-test';
  await mongoose.connect(MONGODB_URI);
});

afterAll(async () => {
  await mongoose.connection.close();
});

beforeEach(async () => {
  // Clean up users before each test
  await User.deleteMany({});
  jest.clearAllMocks();
});

afterEach(async () => {
  // Clean up users after each test
  await User.deleteMany({});
});

describe('AuthController', () => {
  describe('register', () => {
    test('should register a new user successfully', async () => {
      const response = await request(app)
        .post('/register')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('message', 'User registered successfully');
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user.name).toBe('Test User');
      expect(response.body.user.email).toBe('test@example.com');
      expect(response.body.user).not.toHaveProperty('password');
    });

    test('should return 400 if name is missing', async () => {
      const response = await request(app)
        .post('/register')
        .send({
          email: 'test@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Name, email, and password are required');
    });

    test('should return 400 if email is missing', async () => {
      const response = await request(app)
        .post('/register')
        .send({
          name: 'Test User',
          password: 'password123',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Name, email, and password are required');
    });

    test('should return 400 if password is missing', async () => {
      const response = await request(app)
        .post('/register')
        .send({
          name: 'Test User',
          email: 'test@example.com',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Name, email, and password are required');
    });

    test('should return 400 if password is too short', async () => {
      const response = await request(app)
        .post('/register')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          password: '12345',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Password must be at least 6 characters long');
    });

    test('should return 409 if user already exists', async () => {
      // Create existing user
      await User.create({
        name: 'Existing User',
        email: 'existing@example.com',
        password: 'password123',
      });

      const response = await request(app)
        .post('/register')
        .send({
          name: 'New User',
          email: 'existing@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty('error', 'User with this email already exists');
    });

    test('should handle validation errors', async () => {
      const response = await request(app)
        .post('/register')
        .send({
          name: '',
          email: 'invalid-email',
          password: '123',
        });

      expect(response.status).toBe(400);
    });

    test('should handle duplicate email error code 11000', async () => {
      // Create existing user
      await User.create({
        name: 'Existing User',
        email: 'duplicate@example.com',
        password: 'password123',
      });

      // Try to create another user with same email
      const response = await request(app)
        .post('/register')
        .send({
          name: 'New User',
          email: 'duplicate@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(409);
    });
  });

  describe('login', () => {
    beforeEach(async () => {
      // Create a test user
      await User.create({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      });
    });

    test('should login successfully with valid credentials', async () => {
      const response = await request(app)
        .post('/login')
        .send({
          email: 'test@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Login successful');
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe('test@example.com');
      expect(response.body.user).not.toHaveProperty('password');
    });

    test('should return 400 if email is missing', async () => {
      const response = await request(app)
        .post('/login')
        .send({
          password: 'password123',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Email and password are required');
    });

    test('should return 400 if password is missing', async () => {
      const response = await request(app)
        .post('/login')
        .send({
          email: 'test@example.com',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Email and password are required');
    });

    test('should return 401 if user does not exist', async () => {
      const response = await request(app)
        .post('/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Invalid email or password');
    });

    test('should return 401 if password is incorrect', async () => {
      const response = await request(app)
        .post('/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword',
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Invalid email or password');
    });
  });

  describe('logout', () => {
    test('should logout successfully', async () => {
      const response = await request(app).post('/logout');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Logout successful');
    });
  });

  describe('getProfile', () => {
    let userId;
    let token;

    beforeEach(async () => {
      // Create a test user
      const user = await User.create({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      });
      userId = user._id.toString();
      token = authController.generateToken(userId, user.email);
    });

    test('should get profile successfully with valid user', async () => {
      // Mock req.user
      const mockReq = {
        user: { userId },
      };
      const mockRes = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };
      const mockNext = jest.fn();

      await authController.getProfile(mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalled();
      const callArgs = mockRes.json.mock.calls[0][0];
      expect(callArgs).toHaveProperty('id');
      expect(callArgs).toHaveProperty('name', 'Test User');
      expect(callArgs).toHaveProperty('email', 'test@example.com');
      expect(callArgs).toHaveProperty('createdAt');
      expect(callArgs).not.toHaveProperty('password');
    });

    test('should return 404 if user not found', async () => {
      const mockReq = {
        user: { userId: new mongoose.Types.ObjectId().toString() },
      };
      const mockRes = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };
      const mockNext = jest.fn();

      await authController.getProfile(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'User not found' });
    });

    test('should handle errors', async () => {
      const mockReq = {
        user: { userId: 'invalid-id' },
      };
      const mockRes = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };
      const mockNext = jest.fn();

      await authController.getProfile(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('generateToken', () => {
    test('should generate a valid JWT token', () => {
      const userId = '123456789';
      const email = 'test@example.com';

      const token = authController.generateToken(userId, email);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });

    test('should generate different tokens for different users', () => {
      const token1 = authController.generateToken('user1', 'user1@example.com');
      const token2 = authController.generateToken('user2', 'user2@example.com');

      expect(token1).not.toBe(token2);
    });
  });
});

