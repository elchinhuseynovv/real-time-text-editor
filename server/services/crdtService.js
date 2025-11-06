/**
 * CRDT (Conflict-free Replicated Data Type) Service
 * Implements a simple CRDT-based text synchronization algorithm
 * Uses a character-based approach with unique identifiers for each character
 */

class CRDTService {
  constructor() {
    // Store document states per document ID
    this.documentStates = new Map();
  }

  /**
   * Initialize document state for CRDT
   * @param {string} documentId - Document ID
   * @param {string} initialContent - Initial document content
   */
  initializeDocument(documentId, initialContent = '') {
    if (!this.documentStates.has(documentId)) {
      this.documentStates.set(documentId, {
        characters: this._stringToCRDT(initialContent),
        version: 0,
      });
    }
  }

  /**
   * Convert string to CRDT representation (array of character objects)
   * @param {string} text - Text to convert
   * @returns {Array} Array of character objects with position IDs
   */
  _stringToCRDT(text) {
    return text.split('').map((char, index) => ({
      id: this._generateCharId(index),
      char: char,
      position: index,
    }));
  }

  /**
   * Convert CRDT representation back to string
   * @param {Array} crdtChars - Array of CRDT character objects
   * @returns {string} Reconstructed string
   */
  _crdtToString(crdtChars) {
    return crdtChars
      .sort((a, b) => a.position - b.position)
      .map((c) => c.char)
      .join('');
  }

  /**
   * Generate unique character ID
   * @param {number} position - Position in document
   * @param {string} clientId - Client ID (optional)
   * @returns {string} Unique character ID
   */
  _generateCharId(position, clientId = '') {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `${timestamp}-${clientId}-${position}-${random}`;
  }

  /**
   * Apply text operation to CRDT
   * @param {string} documentId - Document ID
   * @param {string} operation - Operation type ('insert' or 'delete')
   * @param {number} position - Position in document
   * @param {string} text - Text to insert/delete
   * @param {string} clientId - Client ID
   * @returns {Object} Operation result with new content
   */
  applyOperation(documentId, operation, position, text, clientId) {
    if (!this.documentStates.has(documentId)) {
      this.initializeDocument(documentId);
    }

    const state = this.documentStates.get(documentId);
    let characters = [...state.characters];

    if (operation === 'insert') {
      // Insert characters at position
      const newChars = text.split('').map((char, index) => ({
        id: this._generateCharId(position + index, clientId),
        char: char,
        position: position + index,
      }));

      // Adjust positions of existing characters after insertion point
      characters = characters.map((c) => ({
        ...c,
        position: c.position >= position ? c.position + text.length : c.position,
      }));

      // Insert new characters
      characters.push(...newChars);
    } else if (operation === 'delete') {
      // Delete characters at position
      characters = characters.filter(
        (c) => c.position < position || c.position >= position + text.length
      );

      // Adjust positions of remaining characters
      characters = characters.map((c) => ({
        ...c,
        position: c.position >= position ? c.position - text.length : c.position,
      }));
    }

    // Sort by position and update state
    characters.sort((a, b) => a.position - b.position);
    state.characters = characters;
    state.version += 1;

    const newContent = this._crdtToString(characters);
    return {
      content: newContent,
      version: state.version,
    };
  }

  /**
   * Merge operations from multiple clients (CRDT merge)
   * This is a simplified merge - in a production system, you'd use more sophisticated algorithms
   * @param {string} documentId - Document ID
   * @param {Array} operations - Array of operations to merge
   * @returns {string} Merged content
   */
  mergeOperations(documentId, operations) {
    if (!this.documentStates.has(documentId)) {
      this.initializeDocument(documentId);
    }

    // Sort operations by timestamp/client ID for deterministic merging
    operations.sort((a, b) => {
      if (a.timestamp !== b.timestamp) {
        return a.timestamp - b.timestamp;
      }
      return a.clientId.localeCompare(b.clientId);
    });

    // Apply operations in order
    operations.forEach((op) => {
      this.applyOperation(documentId, op.operation, op.position, op.text, op.clientId);
    });

    const state_after = this.documentStates.get(documentId);
    return this._crdtToString(state_after.characters);
  }

  /**
   * Get current document content
   * @param {string} documentId - Document ID
   * @returns {string} Current document content
   */
  getContent(documentId) {
    if (!this.documentStates.has(documentId)) {
      return '';
    }
    const state = this.documentStates.get(documentId);
    return this._crdtToString(state.characters);
  }

  /**
   * Update document content (for initial load or external updates)
   * @param {string} documentId - Document ID
   * @param {string} content - New content
   */
  setContent(documentId, content) {
    // Always update/reinitialize the document state
    this.documentStates.set(documentId, {
      characters: this._stringToCRDT(content || ''),
      version: (this.documentStates.get(documentId)?.version || 0) + 1,
    });
  }

  /**
   * Clear document state (cleanup)
   * @param {string} documentId - Document ID
   */
  clearDocument(documentId) {
    this.documentStates.delete(documentId);
  }
}

module.exports = new CRDTService();
