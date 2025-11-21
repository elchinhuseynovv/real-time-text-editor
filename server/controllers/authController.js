const User = require('../models/User');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Generate JWT token
 * @param {string} userId - User ID
 * @param {string} email - User email
 * @returns {string} JWT token
 */
const generateToken = (userId, email) => {
  return jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

/**
 * Register a new user
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    console.log(`📝 Registration attempt for email: ${email}`);

    // Validation
    if (!name || !email || !password) {
      console.log(`⚠️ Registration failed: Missing required fields for ${email}`);
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    if (password.length < 6) {
      console.log(`⚠️ Registration failed: Password too short for ${email}`);
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log(`⚠️ Registration failed: User already exists with email ${email}`);
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    // Create new user
    const user = new User({ name, email, password });
    await user.save();
    console.log(`✅ User registered successfully: ${email} (ID: ${user._id})`);

    // Generate token
    const token = generateToken(user._id.toString(), user.email);
    console.log(`🔑 JWT token generated for user: ${email}`);

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error(`❌ Registration error for ${req.body.email}:`, error.message);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    if (error.code === 11000) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }
    next(error);
  }
};

/**
 * Login user
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    console.log(`🔐 Login attempt for email: ${email}`);

    // Validation
    if (!email || !password) {
      console.log(`⚠️ Login failed: Missing credentials for ${email}`);
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      console.log(`⚠️ Login failed: User not found for email ${email}`);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Compare password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      console.log(`⚠️ Login failed: Invalid password for email ${email}`);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate token
    const token = generateToken(user._id.toString(), user.email);
    console.log(`✅ Login successful for user: ${email} (ID: ${user._id})`);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error(`❌ Login error for ${req.body.email}:`, error.message);
    next(error);
  }
};

/**
 * Logout user (client-side token removal, but we can invalidate if needed)
 */
const logout = async (req, res) => {
  // In a stateless JWT system, logout is handled client-side by removing the token
  // If you need server-side logout, implement token blacklisting
  const userEmail = req.user?.email || 'unknown';
  console.log(`👋 User logged out: ${userEmail}`);
  res.json({ message: 'Logout successful' });
};

/**
 * Get current user profile
 */
const getProfile = async (req, res, next) => {
  try {
    console.log(`👤 Profile request for user ID: ${req.user.userId}`);
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      console.log(`⚠️ Profile not found for user ID: ${req.user.userId}`);
      return res.status(404).json({ error: 'User not found' });
    }
    console.log(`✅ Profile retrieved for user: ${user.email}`);
    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    });
  } catch (error) {
    console.error(`❌ Profile retrieval error for user ID ${req.user?.userId}:`, error.message);
    next(error);
  }
};

module.exports = {
  register,
  login,
  logout,
  getProfile,
  generateToken,
  JWT_SECRET,
};
