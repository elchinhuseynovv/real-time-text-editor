const Document = require('../models/Document');

/**
 * Permission Service
 * Handles role-based access control for documents
 * Roles: owner, editor, viewer
 */
class PermissionService {
  /**
   * Check if user has permission for an action
   * @param {string} documentId - Document ID
   * @param {string} username - Username
   * @param {string} action - Action to check ('read', 'write', 'delete', 'manage')
   * @returns {Promise<boolean>} True if user has permission
   */
  async checkPermission(documentId, username, action) {
    try {
      const document = await Document.findById(documentId);
      if (!document) {
        return false;
      }

      // Owner has all permissions
      if (document.owner === username) {
        return true;
      }

      // Find user's permission entry
      const userPermission = document.permissions.find((p) => p.username === username);

      if (!userPermission) {
        // No explicit permission, check if user is owner
        return document.owner === username;
      }

      const role = userPermission.role;

      // Check permissions based on role and action
      switch (action) {
        case 'read':
          return role === 'owner' || role === 'editor' || role === 'viewer';
        case 'write':
          return role === 'owner' || role === 'editor';
        case 'delete':
        case 'manage':
          return role === 'owner';
        default:
          return false;
      }
    } catch (error) {
      console.error('Error checking permission:', error);
      return false;
    }
  }

  /**
   * Get user's role for a document
   * @param {string} documentId - Document ID
   * @param {string} username - Username
   * @returns {Promise<string|null>} User's role or null
   */
  async getUserRole(documentId, username) {
    try {
      const document = await Document.findById(documentId);
      if (!document) {
        return null;
      }

      if (document.owner === username) {
        return 'owner';
      }

      const userPermission = document.permissions.find((p) => p.username === username);

      return userPermission ? userPermission.role : null;
    } catch (error) {
      console.error('Error getting user role:', error);
      return null;
    }
  }

  /**
   * Add permission for a user
   * @param {string} documentId - Document ID
   * @param {string} username - Username to grant permission to
   * @param {string} role - Role to grant ('editor' or 'viewer')
   * @param {string} requesterUsername - Username requesting the permission change
   * @returns {Promise<boolean>} True if successful
   */
  async addPermission(documentId, username, role, requesterUsername) {
    try {
      // Check if requester has manage permission
      const hasPermission = await this.checkPermission(documentId, requesterUsername, 'manage');

      if (!hasPermission) {
        throw new Error('Insufficient permissions');
      }

      const document = await Document.findById(documentId);
      if (!document) {
        throw new Error('Document not found');
      }

      // Remove existing permission if any
      document.permissions = document.permissions.filter((p) => p.username !== username);

      // Add new permission
      document.permissions.push({ username, role });
      await document.save();

      return true;
    } catch (error) {
      console.error('Error adding permission:', error);
      throw error;
    }
  }

  /**
   * Remove permission for a user
   * @param {string} documentId - Document ID
   * @param {string} username - Username to remove permission from
   * @param {string} requesterUsername - Username requesting the permission change
   * @returns {Promise<boolean>} True if successful
   */
  async removePermission(documentId, username, requesterUsername) {
    try {
      // Check if requester has manage permission
      const hasPermission = await this.checkPermission(documentId, requesterUsername, 'manage');

      if (!hasPermission) {
        throw new Error('Insufficient permissions');
      }

      const document = await Document.findById(documentId);
      if (!document) {
        throw new Error('Document not found');
      }

      // Can't remove owner's permission
      if (document.owner === username) {
        throw new Error('Cannot remove owner permission');
      }

      document.permissions = document.permissions.filter((p) => p.username !== username);
      await document.save();

      return true;
    } catch (error) {
      console.error('Error removing permission:', error);
      throw error;
    }
  }
}

module.exports = new PermissionService();
