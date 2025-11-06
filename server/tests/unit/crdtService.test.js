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
        { operation: 'insert', position: 5, text: ' World', clientId: 'client1', timestamp: Date.now() },
        { operation: 'insert', position: 11, text: '!', clientId: 'client2', timestamp: Date.now() + 1 }
      ];

      const result = crdtService.mergeOperations('doc1', operations);
      expect(result).toBe('Hello World!');
    });

    test('should handle concurrent edits correctly', () => {
      crdtService.initializeDocument('doc1', 'Hello');
      
      // Simulate two clients inserting at same position
      const operations = [
        { operation: 'insert', position: 5, text: ' A', clientId: 'client1', timestamp: 1000 },
        { operation: 'insert', position: 5, text: ' B', clientId: 'client2', timestamp: 1001 }
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
});

