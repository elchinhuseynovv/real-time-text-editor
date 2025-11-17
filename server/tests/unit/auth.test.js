const jwt = require('jsonwebtoken');
const authMiddleware = require('../../middleware/auth');
const { JWT_SECRET } = require('../../controllers/authController');

describe('Auth Middleware', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    mockReq = {
      headers: {},
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockNext = jest.fn();
  });

  describe('Token validation', () => {
    test('should pass with valid Bearer token', () => {
      const userId = '123456789';
      const email = 'test@example.com';
      const token = jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '7d' });

      mockReq.headers.authorization = `Bearer ${token}`;

      authMiddleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toBeDefined();
      expect(mockReq.user.userId).toBe(userId);
      expect(mockReq.user.email).toBe(email);
      expect(mockReq.user.username).toBe(email);
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    test('should return 401 if Authorization header is missing', () => {
      authMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Authentication required. Please provide a valid token.',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should return 401 if Authorization header does not start with Bearer', () => {
      mockReq.headers.authorization = 'Invalid token';

      authMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Authentication required. Please provide a valid token.',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should return 401 if token is empty', () => {
      mockReq.headers.authorization = 'Bearer ';

      authMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Authentication required. Please provide a valid token.',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should return 401 if token is invalid', () => {
      mockReq.headers.authorization = 'Bearer invalid-token';

      authMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Invalid token',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should return 401 if token is expired', () => {
      const expiredToken = jwt.sign(
        { userId: '123', email: 'test@example.com' },
        JWT_SECRET,
        { expiresIn: '-1h' }
      );

      mockReq.headers.authorization = `Bearer ${expiredToken}`;

      authMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Token expired',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('x-username fallback', () => {
    test('should use x-username header as fallback when no Bearer token', () => {
      mockReq.headers['x-username'] = 'testuser';

      authMiddleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toBeDefined();
      expect(mockReq.user.username).toBe('testuser');
      expect(mockReq.user.email).toBe('testuser');
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    test('should prefer Bearer token over x-username', () => {
      const userId = '123456789';
      const email = 'test@example.com';
      const token = jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '7d' });

      mockReq.headers.authorization = `Bearer ${token}`;
      mockReq.headers['x-username'] = 'fallbackuser';

      authMiddleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user.userId).toBe(userId);
      expect(mockReq.user.email).toBe(email);
      expect(mockReq.user.username).toBe(email);
    });

    test('should return 401 if neither Bearer token nor x-username provided', () => {
      authMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Authentication required. Please provide a valid token.',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    test('should call next for non-JWT errors', () => {
      // Mock jwt.verify to throw a generic error
      const originalVerify = jwt.verify;
      jwt.verify = jest.fn(() => {
        throw new Error('Generic error');
      });

      const token = jwt.sign({ userId: '123', email: 'test@example.com' }, JWT_SECRET);
      mockReq.headers.authorization = `Bearer ${token}`;

      authMiddleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();

      // Restore original
      jwt.verify = originalVerify;
    });
  });
});

