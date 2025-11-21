const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/collaborative-editor';

const connectDB = async () => {
  try {
    console.log('🔌 [Database] Attempting to connect to MongoDB...');
    console.log(`📍 [Database] Connection URI: ${MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@')}`);
    
    await mongoose.connect(MONGODB_URI);
    
    console.log('✅ [Database] Connected to MongoDB successfully');
    console.log(`📊 [Database] Database: ${mongoose.connection.name}`);
    console.log(`🖥️  [Database] Host: ${mongoose.connection.host}`);
    
    // Handle connection events
    mongoose.connection.on('disconnected', () => {
      console.log('⚠️ [Database] MongoDB disconnected');
    });
    
    mongoose.connection.on('error', (err) => {
      console.error('❌ [Database] MongoDB error:', err.message);
    });
    
    mongoose.connection.on('reconnected', () => {
      console.log('✅ [Database] MongoDB reconnected');
    });
    
  } catch (err) {
    console.error('❌ [Database] MongoDB connection error:', err.message);
    console.error('💡 [Database] Please ensure MongoDB is running and the connection URI is correct');
    process.exit(1);
  }
};

module.exports = connectDB;
