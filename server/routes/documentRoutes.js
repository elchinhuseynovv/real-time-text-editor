const express = require('express');
const documentController = require('../controllers/documentController');

const router = express.Router();

// Document routes - IMPORTANT: share route must come before :id route
router.get('/', documentController.getAllDocuments.bind(documentController));
router.get('/share/:token', documentController.joinByShareToken.bind(documentController));
router.get('/:id', documentController.getDocumentById.bind(documentController));
router.post('/', documentController.createDocument.bind(documentController));
router.put('/:id', documentController.updateDocument.bind(documentController));
router.delete('/:id', documentController.deleteDocument.bind(documentController));

// Permission routes
router.post('/:id/permissions', documentController.addPermission.bind(documentController));
router.delete('/:id/permissions', documentController.removePermission.bind(documentController));

// Share routes
router.post('/:id/share', documentController.generateShareLink.bind(documentController));
router.delete('/:id/share', documentController.revokeShareLink.bind(documentController));

module.exports = router;

