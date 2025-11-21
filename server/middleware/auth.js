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
    console.log(`🔑 [Auth] Authentication attempt - Path: ${req.method} ${req.path}`);

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // Fallback to x-username header for backward compatibility during migration
      const username = req.headers['x-username'];
      if (username) {
        console.log(`⚠️ [Auth] Using fallback x-username header - User: ${username}`);
        req.user = { username, email: username }; // Temporary compatibility
        return next();
      }
      console.log(`❌ [Auth] Authentication failed - No token provided for ${req.method} ${req.path}`);
      return res
        .status(401)
        .json({ error: 'Authentication required. Please provide a valid token.' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!token) {
      console.log(`❌ [Auth] Authentication failed - Empty token for ${req.method} ${req.path}`);
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

    console.log(`✅ [Auth] Authentication successful - User: ${decoded.email}, Path: ${req.method} ${req.path}`);
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      console.log(`❌ [Auth] Invalid token - Path: ${req.method} ${req.path}`);
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      console.log(`❌ [Auth] Token expired - Path: ${req.method} ${req.path}`);
      return res.status(401).json({ error: 'Token expired' });
    }
    console.error(`❌ [Auth] Authentication error - Path: ${req.method} ${req.path}:`, error.message);
    next(error);
  }
};

module.exports = authMiddleware;
