const Document = require('../models/Document');
const crdtService = require('./crdtService');

/**
 * Document Service
 * Handles business logic for document operations
 */
class DocumentService {
  /**
   * Create a new document
   * @param {Object} data - Document data
   * @param {string} data.title - Document title
   * @param {string} data.content - Document content
   * @param {string} data.owner - Document owner username
   * @returns {Promise<Object>} Created document
   */
  async createDocument({ title, content = '', owner }) {
    try {
      const document = new Document({
        title: title || 'Untitled Document',
        content,
        owner,
        permissions: [],
        versions: [
          {
            content,
            timestamp: new Date(),
            user: owner,
          },
        ],
      });

      const savedDoc = await document.save();

      // Initialize CRDT state
      crdtService.setContent(savedDoc._id.toString(), content);

      return savedDoc;
    } catch (error) {
      console.error('Error creating document:', error);
      throw error;
    }
  }

  /**
   * Get document by ID
   * @param {string} documentId - Document ID
   * @returns {Promise<Object|null>} Document or null
   */
  async getDocumentById(documentId) {
    try {
      const document = await Document.findById(documentId);
      return document;
    } catch (error) {
      console.error('Error getting document:', error);
      throw error;
    }
  }

  /**
   * Get all documents (with optional filtering)
   * @param {Object} options - Query options
   * @param {string} options.owner - Filter by owner
   * @param {string} options.username - Filter by username (returns documents user owns OR has access to)
   * @param {number} options.limit - Limit results
   * @param {number} options.skip - Skip results
   * @returns {Promise<Array>} Array of documents
   */
  async getDocuments(options = {}) {
    try {
      const { owner, username, limit = 100, skip = 0 } = options;

      let query = {};

      if (username) {
        // Get documents where user is owner OR has permissions
        query = {
          $or: [{ owner: username }, { 'permissions.username': username }],
        };
      } else if (owner) {
        query = { owner };
      }

      const documents = await Document.find(query).sort({ updatedAt: -1 }).limit(limit).skip(skip);

      return documents;
    } catch (error) {
      console.error('Error getting documents:', error);
      throw error;
    }
  }

  /**
   * Update document content
   * @param {string} documentId - Document ID
   * @param {string} content - New content
   * @param {string} username - Username making the update
   * @returns {Promise<Object>} Updated document
   */
  async updateDocumentContent(documentId, content, username) {
    try {
      const document = await Document.findByIdAndUpdate(
        documentId,
        {
          content,
          updatedAt: new Date(),
          $push: {
            versions: {
              content,
              timestamp: new Date(),
              user: username || 'Anonymous',
            },
          },
        },
        { new: true }
      );

      if (!document) {
        throw new Error('Document not found');
      }

      // Update CRDT state
      crdtService.setContent(documentId, content);

      return document;
    } catch (error) {
      console.error('Error updating document:', error);
      throw error;
    }
  }

  /**
   * Update document title
   * @param {string} documentId - Document ID
   * @param {string} title - New title
   * @returns {Promise<Object>} Updated document
   */
  async updateDocumentTitle(documentId, title) {
    try {
      const document = await Document.findByIdAndUpdate(
        documentId,
        { title, updatedAt: new Date() },
        { new: true }
      );

      if (!document) {
        throw new Error('Document not found');
      }

      return document;
    } catch (error) {
      console.error('Error updating document title:', error);
      throw error;
    }
  }

  /**
   * Delete document
   * @param {string} documentId - Document ID
   * @returns {Promise<boolean>} True if deleted
   */
  async deleteDocument(documentId) {
    try {
      const result = await Document.findByIdAndDelete(documentId);

      // Clear CRDT state
      crdtService.clearDocument(documentId);

      return !!result;
    } catch (error) {
      console.error('Error deleting document:', error);
      throw error;
    }
  }

  /**
   * Load document content into CRDT
   * @param {string} documentId - Document ID
   */
  async loadDocumentIntoCRDT(documentId) {
    try {
      const document = await this.getDocumentById(documentId);
      if (document) {
        crdtService.setContent(documentId, document.content || '');
      }
    } catch (error) {
      console.error('Error loading document into CRDT:', error);
    }
  }

  /**
   * Generate share link for document
   * @param {string} documentId - Document ID
   * @param {string} access - Access level ('read' or 'edit')
   * @param {string} requesterUsername - Username requesting the share link
   * @returns {Promise<string>} Share token
   */
  async generateShareLink(documentId, access, requesterUsername) {
    try {
      const document = await Document.findById(documentId);
      if (!document) {
        throw new Error('Document not found');
      }

      // Only owner can generate share links
      if (document.owner !== requesterUsername) {
        throw new Error('Only document owner can generate share links');
      }

      // Generate unique token
      const crypto = require('crypto');
      const token = crypto.randomBytes(32).toString('hex');

      // Update document with share token and access level
      document.shareToken = token;
      document.shareAccess = access;
      await document.save();

      return token;
    } catch (error) {
      console.error('Error generating share link:', error);
      throw error;
    }
  }

  /**
   * Get document by share token
   * @param {string} shareToken - Share token
   * @returns {Promise<Object|null>} Document or null
   */
  async getDocumentByShareToken(shareToken) {
    try {
      const document = await Document.findOne({ shareToken });
      return document;
    } catch (error) {
      console.error('Error getting document by share token:', error);
      throw error;
    }
  }

  /**
   * Join document via share token
   * @param {string} shareToken - Share token
   * @param {string} userEmail - User email joining
   * @returns {Promise<Object>} Document and access level
   */
  async joinDocumentByShareToken(shareToken, userEmail) {
    try {
      const document = await Document.findOne({ shareToken });
      if (!document) {
        throw new Error('Invalid share token');
      }

      const access = document.shareAccess;

      // Normalize email to lowercase for consistency
      const normalizedEmail = userEmail.toLowerCase().trim();

      // Add user permission based on share access
      if (access === 'edit') {
        // Add as editor
        const existingPermission = document.permissions.find((p) => p.username === normalizedEmail);
        if (!existingPermission) {
          document.permissions.push({ username: normalizedEmail, role: 'editor' });
          await document.save();
        }
      } else if (access === 'read') {
        // Add as viewer
        const existingPermission = document.permissions.find((p) => p.username === normalizedEmail);
        if (!existingPermission) {
          document.permissions.push({ username: normalizedEmail, role: 'viewer' });
          await document.save();
        }
      }

      return {
        document,
        access,
      };
    } catch (error) {
      console.error('Error joining document by share token:', error);
      throw error;
    }
  }

  /**
   * Revoke share link
   * @param {string} documentId - Document ID
   * @param {string} requesterUsername - Username requesting revocation
   * @returns {Promise<boolean>} True if successful
   */
  async revokeShareLink(documentId, requesterUsername) {
    try {
      const document = await Document.findById(documentId);
      if (!document) {
        throw new Error('Document not found');
      }

      // Only owner can revoke share links
      if (document.owner !== requesterUsername) {
        throw new Error('Only document owner can revoke share links');
      }

      document.shareToken = null;
      document.shareAccess = null;
      await document.save();

      return true;
    } catch (error) {
      console.error('Error revoking share link:', error);
      throw error;
    }
  }
}

module.exports = new DocumentService();
