const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  title: { type: String, default: 'Untitled Document' },
  content: { type: String, default: '' },
  owner: { type: String, required: true }, // Username of document owner
  permissions: [{
    username: { type: String, required: true },
    role: { 
      type: String, 
      enum: ['owner', 'editor', 'viewer'], 
      default: 'viewer' 
    }
  }],
  shareToken: { type: String, unique: true, sparse: true }, // Unique token for sharing
  shareAccess: { 
    type: String, 
    enum: ['read', 'edit', null], 
    default: null 
  }, // Access level for share link
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  versions: [{
    content: String,
    timestamp: { type: Date, default: Date.now },
    user: String
  }]
});

// Index for faster queries
documentSchema.index({ owner: 1, updatedAt: -1 });

module.exports = mongoose.model('Document', documentSchema);

