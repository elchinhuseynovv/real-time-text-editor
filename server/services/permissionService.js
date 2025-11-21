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
      console.log(`🔐 [PermissionService] Checking permission - Document: ${documentId}, User: ${username}, Action: ${action}`);
      const document = await Document.findById(documentId);
      if (!document) {
        console.log(`⚠️ [PermissionService] Document not found - ID: ${documentId}`);
        return false;
      }

      // Owner has all permissions
      if (document.owner === username) {
        console.log(`✅ [PermissionService] Access granted - User ${username} is owner of document ${documentId}`);
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
      let hasAccess = false;
      switch (action) {
        case 'read':
          hasAccess = role === 'owner' || role === 'editor' || role === 'viewer';
          break;
        case 'write':
          hasAccess = role === 'owner' || role === 'editor';
          break;
        case 'delete':
        case 'manage':
          hasAccess = role === 'owner';
          break;
        default:
          hasAccess = false;
      }
      
      if (hasAccess) {
        console.log(`✅ [PermissionService] Access granted - User: ${username}, Role: ${role}, Action: ${action}`);
      } else {
        console.log(`❌ [PermissionService] Access denied - User: ${username}, Role: ${role || 'none'}, Action: ${action}`);
      }
      return hasAccess;
    } catch (error) {
      console.error(`❌ [PermissionService] Error checking permission for document ${documentId}:`, error.message);
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
      console.log(`👤 [PermissionService] Getting user role - Document: ${documentId}, User: ${username}`);
      const document = await Document.findById(documentId);
      if (!document) {
        console.log(`⚠️ [PermissionService] Document not found - ID: ${documentId}`);
        return null;
      }

      if (document.owner === username) {
        return 'owner';
      }

      const userPermission = document.permissions.find((p) => p.username === username);
      const role = userPermission ? userPermission.role : null;
      
      console.log(`✅ [PermissionService] User role retrieved - User: ${username}, Role: ${role || 'none'}`);
      return role;
    } catch (error) {
      console.error(`❌ [PermissionService] Error getting user role for document ${documentId}:`, error.message);
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
      console.log(`➕ [PermissionService] Adding permission - Document: ${documentId}, User: ${username}, Role: ${role}, Requester: ${requesterUsername}`);
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

      console.log(`✅ [PermissionService] Permission added successfully - User: ${username}, Role: ${role}`);
      return true;
    } catch (error) {
      console.error(`❌ [PermissionService] Error adding permission to document ${documentId}:`, error.message);
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
      console.log(`➖ [PermissionService] Removing permission - Document: ${documentId}, User: ${username}, Requester: ${requesterUsername}`);
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

      console.log(`✅ [PermissionService] Permission removed successfully - User: ${username}`);
      return true;
    } catch (error) {
      console.error(`❌ [PermissionService] Error removing permission from document ${documentId}:`, error.message);
      throw error;
    }
  }
}

module.exports = new PermissionService();
