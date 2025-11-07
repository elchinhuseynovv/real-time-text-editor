const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../controllers/authController');

/**
 * JWT Authentication Middleware
 * Validates JWT bearer token from Authorization header
 */
const authMiddleware = (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // Fallback to x-username header for backward compatibility during migration
      const username = req.headers['x-username'];
      if (username) {
        req.user = { username, email: username }; // Temporary compatibility
        return next();
      }
      return res
        .status(401)
        .json({ error: 'Authentication required. Please provide a valid token.' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!token) {
      return res
        .status(401)
        .json({ error: 'Authentication required. Please provide a valid token.' });
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Attach user info to request
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      username: decoded.email, // Use email as username for compatibility
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    next(error);
  }
};

module.exports = authMiddleware;
