const crdtService = require('../../services/crdtService');

describe('CRDTService', () => {
  beforeEach(() => {
    // Clear all document states before each test
    crdtService.documentStates.clear();
  });

  describe('initializeDocument', () => {
    test('should initialize document with empty content', () => {
      crdtService.initializeDocument('doc1');
      expect(crdtService.documentStates.has('doc1')).toBe(true);
      expect(crdtService.getContent('doc1')).toBe('');
    });

    test('should initialize document with initial content', () => {
      crdtService.initializeDocument('doc1', 'Hello World');
      expect(crdtService.getContent('doc1')).toBe('Hello World');
    });
  });

  describe('applyOperation', () => {
    test('should insert text at position', () => {
      crdtService.initializeDocument('doc1', 'Hello');
      const result = crdtService.applyOperation('doc1', 'insert', 5, ' World', 'client1');

      expect(result.content).toBe('Hello World');
      expect(result.version).toBe(1);
    });

    test('should insert text at beginning', () => {
      crdtService.initializeDocument('doc1', 'World');
      const result = crdtService.applyOperation('doc1', 'insert', 0, 'Hello ', 'client1');

      expect(result.content).toBe('Hello World');
    });

    test('should insert text in middle', () => {
      crdtService.initializeDocument('doc1', 'Helo World');
      const result = crdtService.applyOperation('doc1', 'insert', 3, 'l', 'client1');

      expect(result.content).toBe('Hello World');
    });

    test('should delete text', () => {
      crdtService.initializeDocument('doc1', 'Hello World');
      const result = crdtService.applyOperation('doc1', 'delete', 5, ' World', 'client1');

      expect(result.content).toBe('Hello');
    });

    test('should handle multiple operations', () => {
      crdtService.initializeDocument('doc1', 'Hello');
      crdtService.applyOperation('doc1', 'insert', 5, ' World', 'client1');
      const result = crdtService.applyOperation('doc1', 'insert', 11, '!', 'client1');

      expect(result.content).toBe('Hello World!');
    });
  });

  describe('setContent and getContent', () => {
    test('should set and get content', () => {
      crdtService.setContent('doc1', 'Test Content');
      expect(crdtService.getContent('doc1')).toBe('Test Content');
    });

    test('should update existing content', () => {
      crdtService.setContent('doc1', 'Initial');
      crdtService.setContent('doc1', 'Updated');
      expect(crdtService.getContent('doc1')).toBe('Updated');
    });
  });

  describe('mergeOperations', () => {
    test('should merge multiple insert operations', () => {
      crdtService.initializeDocument('doc1', 'Hello');

      const operations = [
        {
          operation: 'insert',
          position: 5,
          text: ' World',
          clientId: 'client1',
          timestamp: Date.now(),
        },
        {
          operation: 'insert',
          position: 11,
          text: '!',
          clientId: 'client2',
          timestamp: Date.now() + 1,
        },
      ];

      const result = crdtService.mergeOperations('doc1', operations);
      expect(result).toBe('Hello World!');
    });

    test('should handle concurrent edits correctly', () => {
      crdtService.initializeDocument('doc1', 'Hello');

      // Simulate two clients inserting at same position
      const operations = [
        { operation: 'insert', position: 5, text: ' A', clientId: 'client1', timestamp: 1000 },
        { operation: 'insert', position: 5, text: ' B', clientId: 'client2', timestamp: 1001 },
      ];

      const result = crdtService.mergeOperations('doc1', operations);
      // Both should be inserted, ordered by timestamp
      expect(result).toContain('Hello');
      expect(result).toContain('A');
      expect(result).toContain('B');
    });
  });

  describe('clearDocument', () => {
    test('should clear document state', () => {
      crdtService.setContent('doc1', 'Test');
      crdtService.clearDocument('doc1');
      expect(crdtService.documentStates.has('doc1')).toBe(false);
    });
  });

  describe('History management', () => {
    test('should initialize history on first operation', () => {
      crdtService.initializeDocument('doc1', 'Hello');
      crdtService.applyOperation('doc1', 'insert', 5, ' World', 'client1');
      
      const state = crdtService.documentStates.get('doc1');
      expect(state.history).toBeDefined();
      expect(state.history.length).toBeGreaterThan(0);
      expect(state.historyIndex).toBeDefined();
    });

    test('should add to history when content changes', () => {
      crdtService.setContent('doc1', 'Hello');
      const state1 = crdtService.documentStates.get('doc1');
      const initialHistoryLength = state1.history.length;
      
      crdtService.setContent('doc1', 'Hello World');
      const state2 = crdtService.documentStates.get('doc1');
      
      expect(state2.history.length).toBe(initialHistoryLength + 1);
    });

    test('should not add to history when content does not change', () => {
      crdtService.setContent('doc1', 'Hello');
      const state1 = crdtService.documentStates.get('doc1');
      const initialHistoryLength = state1.history.length;
      
      crdtService.setContent('doc1', 'Hello');
      const state2 = crdtService.documentStates.get('doc1');
      
      expect(state2.history.length).toBe(initialHistoryLength);
    });

    test('should limit history size to 50', () => {
      crdtService.setContent('doc1', 'Initial');
      
      // Add 55 operations
      for (let i = 0; i < 55; i++) {
        crdtService.setContent('doc1', `Content ${i}`);
      }
      
      const state = crdtService.documentStates.get('doc1');
      expect(state.history.length).toBeLessThanOrEqual(50);
    });

    test('should remove history after current index when making new changes after undo', () => {
      crdtService.setContent('doc1', 'A');
      crdtService.setContent('doc1', 'AB');
      crdtService.setContent('doc1', 'ABC');
      
      const state1 = crdtService.documentStates.get('doc1');
      const historyLengthBeforeUndo = state1.history.length;
      
      crdtService.undo('doc1'); // Go back to 'AB'
      
      crdtService.setContent('doc1', 'ABX'); // New change after undo
      
      const state2 = crdtService.documentStates.get('doc1');
      // History should be trimmed - 'ABC' should be removed
      expect(state2.history[state2.historyIndex]).toBe('ABX');
    });
  });

  describe('setContent with addToHistory flag', () => {
    test('should add to history when addToHistory is true', () => {
      crdtService.setContent('doc1', 'Hello');
      const state1 = crdtService.documentStates.get('doc1');
      const initialHistoryLength = state1.history.length;
      
      crdtService.setContent('doc1', 'Hello World', true);
      const state2 = crdtService.documentStates.get('doc1');
      
      expect(state2.history.length).toBeGreaterThan(initialHistoryLength);
    });

    test('should not add to history when addToHistory is false', () => {
      crdtService.setContent('doc1', 'Hello');
      const state1 = crdtService.documentStates.get('doc1');
      const initialHistoryLength = state1.history.length;
      
      crdtService.setContent('doc1', 'Hello World', false);
      const state2 = crdtService.documentStates.get('doc1');
      
      expect(state2.history.length).toBe(initialHistoryLength);
    });

    test('should initialize document if it does not exist', () => {
      crdtService.setContent('newdoc', 'New Content');
      expect(crdtService.getContent('newdoc')).toBe('New Content');
    });
  });

  describe('undo', () => {
    test('should undo to previous state', () => {
      crdtService.setContent('doc1', 'A');
      crdtService.setContent('doc1', 'AB');
      crdtService.setContent('doc1', 'ABC');
      
      const result = crdtService.undo('doc1');
      
      expect(result).toBeDefined();
      expect(result.content).toBe('AB');
      expect(crdtService.getContent('doc1')).toBe('AB');
    });

    test('should return null if no undo available', () => {
      crdtService.setContent('doc1', 'Hello');
      
      const result = crdtService.undo('doc1');
      
      expect(result).toBeNull();
    });

    test('should return null for non-existent document', () => {
      const result = crdtService.undo('nonexistent');
      expect(result).toBeNull();
    });

    test('should update version on undo', () => {
      crdtService.setContent('doc1', 'A');
      crdtService.setContent('doc1', 'AB');
      
      const state1 = crdtService.documentStates.get('doc1');
      const versionBeforeUndo = state1.version;
      
      crdtService.undo('doc1');
      
      const state2 = crdtService.documentStates.get('doc1');
      expect(state2.version).toBeGreaterThan(versionBeforeUndo);
    });

    test('should include history in undo result', () => {
      crdtService.setContent('doc1', 'A');
      crdtService.setContent('doc1', 'AB');
      
      const result = crdtService.undo('doc1');
      
      expect(result.history).toBeDefined();
      expect(result.history.canUndo).toBe(false);
      expect(result.history.canRedo).toBe(true);
    });
  });

  describe('redo', () => {
    test('should redo to next state', () => {
      crdtService.setContent('doc1', 'A');
      crdtService.setContent('doc1', 'AB');
      crdtService.setContent('doc1', 'ABC');
      
      crdtService.undo('doc1'); // Go back to 'AB'
      const result = crdtService.redo('doc1');
      
      expect(result).toBeDefined();
      expect(result.content).toBe('ABC');
      expect(crdtService.getContent('doc1')).toBe('ABC');
    });

    test('should return null if no redo available', () => {
      crdtService.setContent('doc1', 'Hello');
      
      const result = crdtService.redo('doc1');
      
      expect(result).toBeNull();
    });

    test('should return null for non-existent document', () => {
      const result = crdtService.redo('nonexistent');
      expect(result).toBeNull();
    });

    test('should update version on redo', () => {
      crdtService.setContent('doc1', 'A');
      crdtService.setContent('doc1', 'AB');
      crdtService.undo('doc1');
      
      const state1 = crdtService.documentStates.get('doc1');
      const versionBeforeRedo = state1.version;
      
      crdtService.redo('doc1');
      
      const state2 = crdtService.documentStates.get('doc1');
      expect(state2.version).toBeGreaterThan(versionBeforeRedo);
    });

    test('should include history in redo result', () => {
      crdtService.setContent('doc1', 'A');
      crdtService.setContent('doc1', 'AB');
      crdtService.undo('doc1');
      
      const result = crdtService.redo('doc1');
      
      expect(result.history).toBeDefined();
      expect(result.history.canUndo).toBe(true);
      expect(result.history.canRedo).toBe(false);
    });
  });

  describe('getHistory', () => {
    test('should return empty history for non-existent document', () => {
      const history = crdtService.getHistory('nonexistent');
      
      expect(history.undoStack).toEqual([]);
      expect(history.redoStack).toEqual([]);
      expect(history.canUndo).toBe(false);
      expect(history.canRedo).toBe(false);
    });

    test('should return correct history state', () => {
      crdtService.setContent('doc1', 'A');
      crdtService.setContent('doc1', 'AB');
      crdtService.setContent('doc1', 'ABC');
      
      const history = crdtService.getHistory('doc1');
      
      expect(history.canUndo).toBe(true);
      expect(history.canRedo).toBe(false);
      expect(history.undoStack.length).toBeGreaterThan(0);
    });

    test('should update canRedo after undo', () => {
      crdtService.setContent('doc1', 'A');
      crdtService.setContent('doc1', 'AB');
      
      crdtService.undo('doc1');
      
      const history = crdtService.getHistory('doc1');
      expect(history.canRedo).toBe(true);
    });
  });

  describe('applyOperation edge cases', () => {
    test('should initialize document if it does not exist', () => {
      const result = crdtService.applyOperation('newdoc', 'insert', 0, 'Hello', 'client1');
      
      expect(result.content).toBe('Hello');
      expect(crdtService.documentStates.has('newdoc')).toBe(true);
    });

    test('should handle empty text insert', () => {
      crdtService.initializeDocument('doc1', 'Hello');
      const result = crdtService.applyOperation('doc1', 'insert', 5, '', 'client1');
      
      expect(result.content).toBe('Hello');
    });

    test('should handle delete at end of document', () => {
      crdtService.initializeDocument('doc1', 'Hello');
      const result = crdtService.applyOperation('doc1', 'delete', 3, 'lo', 'client1');
      
      expect(result.content).toBe('Hel');
    });

    test('should handle delete beyond document length', () => {
      crdtService.initializeDocument('doc1', 'Hello');
      const result = crdtService.applyOperation('doc1', 'delete', 3, 'lo World', 'client1');
      
      expect(result.content).toBe('Hel');
    });
  });
});
