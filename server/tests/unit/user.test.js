const mongoose = require('mongoose');
const User = require('../../models/User');
const bcrypt = require('bcryptjs');

beforeAll(async () => {
  const MONGODB_URI =
    process.env.MONGODB_URI || 'mongodb://localhost:27017/collaborative-editor-test';
  await mongoose.connect(MONGODB_URI);
});

afterAll(async () => {
  await mongoose.connection.close();
});

beforeEach(async () => {
  await User.deleteMany({});
});

afterEach(async () => {
  await User.deleteMany({});
});

describe('User Model', () => {
  describe('Password hashing', () => {
    test('should hash password before saving', async () => {
      const plainPassword = 'password123';
      const user = new User({
        name: 'Test User',
        email: 'test@example.com',
        password: plainPassword,
      });

      await user.save();

      expect(user.password).not.toBe(plainPassword);
      expect(user.password.length).toBeGreaterThan(20); // bcrypt hash length
      expect(user.password).toMatch(/^\$2[aby]\$/); // bcrypt hash format
    });

    test('should not rehash password if not modified', async () => {
      const user = new User({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      });

      await user.save();
      const originalPassword = user.password;

      // Update non-password field
      user.name = 'Updated Name';
      await user.save();

      expect(user.password).toBe(originalPassword);
    });

    test('should update updatedAt when password is modified', async () => {
      const user = new User({
        name: 'Test User',
        email: 'test-update@example.com',
        password: 'password123',
      });

      await user.save();
      const savedUser = await User.findById(user._id);
      const originalUpdatedAt = savedUser.updatedAt;

      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      savedUser.password = 'newpassword123';
      await savedUser.save();

      const updatedUser = await User.findById(user._id);
      expect(updatedUser.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });

  describe('comparePassword', () => {
    test('should return true for correct password', async () => {
      const plainPassword = 'password123';
      const user = new User({
        name: 'Test User',
        email: 'test@example.com',
        password: plainPassword,
      });

      await user.save();

      const isValid = await user.comparePassword(plainPassword);
      expect(isValid).toBe(true);
    });

    test('should return false for incorrect password', async () => {
      const user = new User({
        name: 'Test User',
        email: 'test-wrong@example.com',
        password: 'password123',
      });

      await user.save();

      const isValid = await user.comparePassword('wrongpassword');
      expect(isValid).toBe(false);
    });

    test('should handle empty password comparison', async () => {
      const user = new User({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      });

      await user.save();

      const isValid = await user.comparePassword('');
      expect(isValid).toBe(false);
    });
  });

  describe('toJSON', () => {
    test('should remove password from JSON output', async () => {
      const user = new User({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      });

      await user.save();

      const userJSON = user.toJSON();

      expect(userJSON).not.toHaveProperty('password');
      expect(userJSON).toHaveProperty('name', 'Test User');
      expect(userJSON).toHaveProperty('email', 'test@example.com');
      expect(userJSON).toHaveProperty('_id');
    });

    test('should include other fields in JSON output', async () => {
      const user = new User({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      });

      await user.save();

      const userJSON = user.toJSON();

      expect(userJSON).toHaveProperty('name');
      expect(userJSON).toHaveProperty('email');
      expect(userJSON).toHaveProperty('_id');
      expect(userJSON).toHaveProperty('createdAt');
      expect(userJSON).toHaveProperty('updatedAt');
    });
  });

  describe('Schema validation', () => {
    test('should require name field', async () => {
      const user = new User({
        email: 'test@example.com',
        password: 'password123',
      });

      await expect(user.save()).rejects.toThrow();
    });

    test('should require email field', async () => {
      const user = new User({
        name: 'Test User',
        password: 'password123',
      });

      await expect(user.save()).rejects.toThrow();
    });

    test('should require password field', async () => {
      const user = new User({
        name: 'Test User',
        email: 'test@example.com',
      });

      await expect(user.save()).rejects.toThrow();
    });

    test('should enforce unique email', async () => {
      // Create first user
      const user1 = await User.create({
        name: 'User 1',
        email: 'unique-test@example.com',
        password: 'password123',
      });
      
      // Verify first user was created
      expect(user1).toBeDefined();

      // Try to create second user with same email - should fail
      const user2 = new User({
        name: 'User 2',
        email: 'unique-test@example.com',
        password: 'password123',
      });

      await expect(user2.save()).rejects.toThrow();
    });

    test('should trim name and email', async () => {
      const user = new User({
        name: '  Test User  ',
        email: '  test-trim@example.com  ',
        password: 'password123',
      });

      await user.save();

      expect(user.name).toBe('Test User');
      expect(user.email).toBe('test-trim@example.com');
    });

    test('should lowercase email', async () => {
      const user = new User({
        name: 'Test User',
        email: 'TEST@EXAMPLE.COM',
        password: 'password123',
      });

      await user.save();

      expect(user.email).toBe('test@example.com');
    });

    test('should enforce minimum password length', async () => {
      const user = new User({
        name: 'Test User',
        email: 'test@example.com',
        password: '12345', // Less than 6 characters
      });

      await expect(user.save()).rejects.toThrow();
    });

    test('should set createdAt and updatedAt automatically', async () => {
      const user = new User({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      });

      await user.save();

      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.updatedAt).toBeInstanceOf(Date);
    });
  });
});

