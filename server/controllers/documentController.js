const documentService = require('../services/documentService');
const permissionService = require('../services/permissionService');
const socketIOService = require('../services/socketIOService');

/**
 * Document Controller
 * Handles HTTP requests for document operations
 */
class DocumentController {
  /**
   * Get all documents
   */
  async getAllDocuments(req, res) {
    try {
      const { owner, limit = 100, skip = 0 } = req.query;
      const username = req.user?.username || req.headers['x-username'] || null;

      // If username is provided, filter by username (documents user owns OR has access to)
      // Otherwise, if owner is provided, filter by owner
      // If neither, return empty array (don't show all documents)
      const filterOptions = username
        ? { username, limit: parseInt(limit), skip: parseInt(skip) }
        : owner
          ? { owner, limit: parseInt(limit), skip: parseInt(skip) }
          : { limit: parseInt(limit), skip: parseInt(skip) };

      const documents = await documentService.getDocuments(filterOptions);
      res.json(documents);
    } catch (error) {
      console.error('Error fetching documents:', error.message);
      res.status(500).json({ error: 'Failed to fetch documents' });
    }
  }

  /**
   * Get document by ID
   */
  async getDocumentById(req, res) {
    try {
      const { id } = req.params;
      const username = req.user?.username || req.headers['x-username'] || 'anonymous';

      // First check if document exists
      const document = await documentService.getDocumentById(id);
      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }

      // Then check read permission
      const hasPermission = await permissionService.checkPermission(id, username, 'read');
      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      res.json(document);
    } catch (error) {
      console.error('Error fetching document:', error.message);
      res.status(500).json({ error: 'Failed to fetch document' });
    }
  }

  /**
   * Create new document
   */
  async createDocument(req, res) {
    try {
      const { title, content } = req.body;
      const username = req.user?.username || req.headers['x-username'] || 'anonymous';

      if (!username || username === 'anonymous') {
        return res.status(400).json({ error: 'Username is required' });
      }

      const document = await documentService.createDocument({
        title,
        content: content || '',
        owner: username,
      });

      console.log(`Document created: ${document._id} by ${username}`);
      res.status(201).json(document);
    } catch (error) {
      console.error('Error creating document:', error.message);
      res.status(500).json({ error: 'Failed to create document' });
    }
  }

  /**
   * Update document
   */
  async updateDocument(req, res) {
    try {
      const { id } = req.params;
      const { title, content } = req.body;
      const username = req.user?.username || req.headers['x-username'] || 'anonymous';

      // Check write permission
      const hasPermission = await permissionService.checkPermission(id, username, 'write');
      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      let document;
      if (content !== undefined) {
        document = await documentService.updateDocumentContent(id, content, username);
      }
      if (title !== undefined) {
        document = await documentService.updateDocumentTitle(id, title);
      }

      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }

      res.json(document);
    } catch (error) {
      console.error('Error updating document:', error);
      res.status(500).json({ error: 'Failed to update document' });
    }
  }

  /**
   * Delete document
   */
  async deleteDocument(req, res) {
    try {
      const { id } = req.params;
      const username = req.user?.username || req.headers['x-username'] || 'anonymous';

      // Check delete permission
      const hasPermission = await permissionService.checkPermission(id, username, 'delete');
      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const deleted = await documentService.deleteDocument(id);
      if (!deleted) {
        return res.status(404).json({ error: 'Document not found' });
      }

      console.log(`Document deleted: ${id}`);
      res.json({ message: 'Document deleted successfully' });
    } catch (error) {
      console.error('Error deleting document:', error.message);
      res.status(500).json({ error: 'Failed to delete document' });
    }
  }

  /**
   * Add permission to document
   */
  async addPermission(req, res) {
    try {
      const { id } = req.params;
      const { email, username, role } = req.body; // Accept both email and username for backward compatibility
      const requesterEmail =
        req.user?.email || req.user?.username || req.headers['x-username'] || 'anonymous';

      // Use email if provided, otherwise fall back to username for backward compatibility
      const userEmail = email || username;

      if (!userEmail || !role) {
        return res.status(400).json({ error: 'Email and role are required' });
      }

      // Normalize email to lowercase
      const normalizedEmail = userEmail.toLowerCase().trim();

      await permissionService.addPermission(id, normalizedEmail, role, requesterEmail);

      // Notify the affected user via Socket.IO if they're currently viewing the document
      socketIOService.notifyRoleChange(id, normalizedEmail, role);

      res.json({ message: 'Permission added successfully' });
    } catch (error) {
      console.error('Error adding permission:', error.message);
      if (error.message === 'Insufficient permissions') {
        return res.status(403).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to add permission' });
    }
  }

  /**
   * Remove permission from document
   */
  async removePermission(req, res) {
    try {
      const { id } = req.params;
      const { email, username } = req.body; // Accept both email and username for backward compatibility
      const requesterEmail =
        req.user?.email || req.user?.username || req.headers['x-username'] || 'anonymous';

      // Use email if provided, otherwise fall back to username for backward compatibility
      const userEmail = email || username;

      if (!userEmail) {
        return res.status(400).json({ error: 'Email is required' });
      }

      // Normalize email to lowercase
      const normalizedEmail = userEmail.toLowerCase().trim();

      await permissionService.removePermission(id, normalizedEmail, requesterEmail);

      // Notify the affected user via Socket.IO if they're currently viewing the document
      socketIOService.notifyRoleChange(id, normalizedEmail, null); // null means no access

      res.json({ message: 'Permission removed successfully' });
    } catch (error) {
      console.error('Error removing permission:', error);
      if (
        error.message === 'Insufficient permissions' ||
        error.message === 'Cannot remove owner permission'
      ) {
        return res.status(403).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to remove permission' });
    }
  }

  /**
   * Generate share link for document
   */
  async generateShareLink(req, res) {
    try {
      const { id } = req.params;
      const { access } = req.body; // 'read' or 'edit'
      const requesterUsername = req.user?.username || req.headers['x-username'] || 'anonymous';

      if (!access || !['read', 'edit'].includes(access)) {
        return res.status(400).json({ error: 'Access must be "read" or "edit"' });
      }

      const token = await documentService.generateShareLink(id, access, requesterUsername);
      const shareUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/share/${token}`;

      res.json({
        token,
        shareUrl,
        access,
      });
    } catch (error) {
      console.error('Error generating share link:', error);
      if (error.message === 'Document not found') {
        return res.status(404).json({ error: error.message });
      }
      if (error.message === 'Only document owner can generate share links') {
        return res.status(403).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to generate share link' });
    }
  }

  /**
   * Join document via share token
   */
  async joinByShareToken(req, res) {
    try {
      const { token } = req.params;
      const userEmail =
        req.user?.email || req.user?.username || req.headers['x-username'] || 'anonymous';

      if (!userEmail || userEmail === 'anonymous') {
        return res.status(400).json({ error: 'Authentication required' });
      }

      // Normalize email to lowercase
      const normalizedEmail = userEmail.toLowerCase().trim();

      const { document, access } = await documentService.joinDocumentByShareToken(
        token,
        normalizedEmail
      );

      res.json({
        documentId: document._id.toString(),
        title: document.title,
        access,
      });
    } catch (error) {
      console.error('Error joining document by share token:', error);
      if (error.message === 'Invalid share token') {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to join document' });
    }
  }

  /**
   * Revoke share link
   */
  async revokeShareLink(req, res) {
    try {
      const { id } = req.params;
      const requesterUsername = req.user?.username || req.headers['x-username'] || 'anonymous';

      await documentService.revokeShareLink(id, requesterUsername);
      res.json({ message: 'Share link revoked successfully' });
    } catch (error) {
      console.error('Error revoking share link:', error);
      if (error.message === 'Document not found') {
        return res.status(404).json({ error: error.message });
      }
      if (error.message === 'Only document owner can revoke share links') {
        return res.status(403).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to revoke share link' });
    }
  }
}

module.exports = new DocumentController();
