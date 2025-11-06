/**
 * Simple authentication middleware
 * In a production system, this would use JWT tokens or session management
 * For now, we'll use a simple header-based approach
 */
const authMiddleware = (req, res, next) => {
  // Extract username from header (in production, verify JWT token)
  const username = req.headers['x-username'];

  if (username) {
    req.user = { username };
  }

  next();
};

module.exports = authMiddleware;
