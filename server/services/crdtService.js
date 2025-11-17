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
      const content = initialContent || '';
      this.documentStates.set(documentId, {
        characters: this._stringToCRDT(content),
        version: 0,
        history: [content], // Shared history stack for undo/redo
        historyIndex: 0, // Current position in history
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
    
    // Add to history for regular operations
    if (!state.history) {
      state.history = [newContent];
      state.historyIndex = 0;
    } else {
      // Remove any history after current index (when undoing then making new changes)
      state.history = state.history.slice(0, state.historyIndex + 1);
      
      // Only add if content actually changed
      if (state.history[state.historyIndex] !== newContent) {
        state.history.push(newContent);
        state.historyIndex = state.history.length - 1;
        
        // Limit history size to prevent memory issues (keep last 50 states)
        if (state.history.length > 50) {
          state.history = state.history.slice(-50);
          state.historyIndex = state.history.length - 1;
        }
      }
    }
    
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
   * @param {boolean} addToHistory - Whether to add this state to history (default: true)
   */
  setContent(documentId, content, addToHistory = true) {
    if (!this.documentStates.has(documentId)) {
      this.initializeDocument(documentId, content);
      return;
    }

    const state = this.documentStates.get(documentId);
    const newContent = content || '';
    
    // Update CRDT characters
    state.characters = this._stringToCRDT(newContent);
    state.version += 1;

    // Add to history if requested (for regular edits, not undo/redo)
    if (addToHistory) {
      // Remove any history after current index (when undoing then making new changes)
      state.history = state.history.slice(0, state.historyIndex + 1);
      
      // Only add if content actually changed
      if (state.history[state.historyIndex] !== newContent) {
        state.history.push(newContent);
        state.historyIndex = state.history.length - 1;
        
        // Limit history size to prevent memory issues (keep last 50 states)
        if (state.history.length > 50) {
          state.history = state.history.slice(-50);
          state.historyIndex = state.history.length - 1;
        }
      }
    }
  }

  /**
   * Get undo/redo history for a document
   * @param {string} documentId - Document ID
   * @returns {Object} History state with undoStack, redoStack, and canUndo/canRedo flags
   */
  getHistory(documentId) {
    if (!this.documentStates.has(documentId)) {
      return {
        undoStack: [],
        redoStack: [],
        canUndo: false,
        canRedo: false,
      };
    }

    const state = this.documentStates.get(documentId);
    const undoStack = state.history.slice(0, state.historyIndex);
    const redoStack = state.history.slice(state.historyIndex + 1);

    return {
      undoStack: undoStack.reverse(), // Most recent first
      redoStack: redoStack, // Oldest first
      canUndo: state.historyIndex > 0,
      canRedo: state.historyIndex < state.history.length - 1,
    };
  }

  /**
   * Perform undo operation
   * @param {string} documentId - Document ID
   * @returns {Object|null} Previous state content or null if no undo available
   */
  undo(documentId) {
    if (!this.documentStates.has(documentId)) {
      return null;
    }

    const state = this.documentStates.get(documentId);
    
    if (state.historyIndex <= 0) {
      return null; // No undo available
    }

    state.historyIndex -= 1;
    const previousContent = state.history[state.historyIndex];
    
    // Update CRDT state without adding to history
    state.characters = this._stringToCRDT(previousContent);
    state.version += 1;

    return {
      content: previousContent,
      history: this.getHistory(documentId),
    };
  }

  /**
   * Perform redo operation
   * @param {string} documentId - Document ID
   * @returns {Object|null} Next state content or null if no redo available
   */
  redo(documentId) {
    if (!this.documentStates.has(documentId)) {
      return null;
    }

    const state = this.documentStates.get(documentId);
    
    if (state.historyIndex >= state.history.length - 1) {
      return null; // No redo available
    }

    state.historyIndex += 1;
    const nextContent = state.history[state.historyIndex];
    
    // Update CRDT state without adding to history
    state.characters = this._stringToCRDT(nextContent);
    state.version += 1;

    return {
      content: nextContent,
      history: this.getHistory(documentId),
    };
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
