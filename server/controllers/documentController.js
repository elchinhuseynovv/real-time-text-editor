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
      console.log(`📋 Fetching documents for user: ${username}`);

      // If username is provided, filter by username (documents user owns OR has access to)
      // Otherwise, if owner is provided, filter by owner
      // If neither, return empty array (don't show all documents)
      const filterOptions = username
        ? { username, limit: parseInt(limit), skip: parseInt(skip) }
        : owner
          ? { owner, limit: parseInt(limit), skip: parseInt(skip) }
          : { limit: parseInt(limit), skip: parseInt(skip) };

      const documents = await documentService.getDocuments(filterOptions);
      console.log(`✅ Retrieved ${documents.length} documents for user: ${username}`);
      res.json(documents);
    } catch (error) {
      console.error('❌ Error fetching documents:', error.message);
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
      console.log(`📄 Document fetch request - ID: ${id}, User: ${username}`);

      // First check if document exists
      const document = await documentService.getDocumentById(id);
      if (!document) {
        console.log(`⚠️ Document not found - ID: ${id}`);
        return res.status(404).json({ error: 'Document not found' });
      }

      // Then check read permission
      const hasPermission = await permissionService.checkPermission(id, username, 'read');
      if (!hasPermission) {
        console.log(`⚠️ Access denied for user ${username} to document ${id}`);
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      console.log(`✅ Document retrieved successfully - ID: ${id}, User: ${username}`);
      res.json(document);
    } catch (error) {
      console.error(`❌ Error fetching document ${req.params.id}:`, error.message);
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
      console.log(`➕ Creating document for user: ${username}, Title: ${title}`);

      if (!username || username === 'anonymous') {
        console.log('⚠️ Document creation failed: No username provided');
        return res.status(400).json({ error: 'Username is required' });
      }

      const document = await documentService.createDocument({
        title,
        content: content || '',
        owner: username,
      });

      console.log(`✅ Document created successfully - ID: ${document._id}, Owner: ${username}`);
      res.status(201).json(document);
    } catch (error) {
      console.error('❌ Error creating document:', error.message);
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
      console.log(`🗑️ Delete request for document ${id} by user ${username}`);

      // Check delete permission
      const hasPermission = await permissionService.checkPermission(id, username, 'delete');
      if (!hasPermission) {
        console.log(`⚠️ Delete permission denied for user ${username} on document ${id}`);
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const deleted = await documentService.deleteDocument(id);
      if (!deleted) {
        console.log(`⚠️ Document not found for deletion - ID: ${id}`);
        return res.status(404).json({ error: 'Document not found' });
      }

      console.log(`✅ Document deleted successfully - ID: ${id}`);
      res.json({ message: 'Document deleted successfully' });
    } catch (error) {
      console.error(`❌ Error deleting document ${req.params.id}:`, error.message);
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
      console.log(`🔓 Adding permission - Document: ${id}, User: ${email || username}, Role: ${role}, Requester: ${requesterEmail}`);

      // Use email if provided, otherwise fall back to username for backward compatibility
      const userEmail = email || username;

      if (!userEmail || !role) {
        console.log('⚠️ Permission add failed: Missing email or role');
        return res.status(400).json({ error: 'Email and role are required' });
      }

      // Normalize email to lowercase
      const normalizedEmail = userEmail.toLowerCase().trim();

      await permissionService.addPermission(id, normalizedEmail, role, requesterEmail);

      // Notify the affected user via Socket.IO if they're currently viewing the document
      socketIOService.notifyRoleChange(id, normalizedEmail, role);

      console.log(`✅ Permission added successfully - Document: ${id}, User: ${normalizedEmail}, Role: ${role}`);
      res.json({ message: 'Permission added successfully' });
    } catch (error) {
      console.error(`❌ Error adding permission to document ${req.params.id}:`, error.message);
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
      console.log(`🔒 Removing permission - Document: ${id}, User: ${email || username}, Requester: ${requesterEmail}`);

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

      console.log(`✅ Permission removed successfully - Document: ${id}, User: ${normalizedEmail}`);
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
      console.log(`🔗 Generating share link - Document: ${id}, Access: ${access}, Requester: ${requesterUsername}`);

      if (!access || !['read', 'edit'].includes(access)) {
        return res.status(400).json({ error: 'Access must be "read" or "edit"' });
      }

      const token = await documentService.generateShareLink(id, access, requesterUsername);
      const shareUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/share/${token}`;

      console.log(`✅ Share link generated - Document: ${id}, Token: ${token.substring(0, 8)}...`);
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
      console.log(`🔑 Join by share token attempt - Token: ${token.substring(0, 8)}..., User: ${userEmail}`);

      if (!userEmail || userEmail === 'anonymous') {
        return res.status(400).json({ error: 'Authentication required' });
      }

      // Normalize email to lowercase
      const normalizedEmail = userEmail.toLowerCase().trim();

      const { document, access } = await documentService.joinDocumentByShareToken(
        token,
        normalizedEmail
      );

      console.log(`✅ User ${normalizedEmail} joined document ${document._id} via share link with ${access} access`);
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
      console.log(`🚫 Revoking share link - Document: ${id}, Requester: ${requesterUsername}`);

      await documentService.revokeShareLink(id, requesterUsername);
      console.log(`✅ Share link revoked successfully - Document: ${id}`);
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
