const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Real-Time Collaborative Text Editor API',
      version: '1.0.0',
      description:
        'API documentation for the Real-Time Collaborative Text Editor. This API provides endpoints for document management, sharing, permissions, and real-time collaboration.',
      contact: {
        name: 'API Support',
      },
    },
    servers: [
      {
        url: process.env.API_URL || 'http://localhost:4000',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        UsernameHeader: {
          type: 'apiKey',
          in: 'header',
          name: 'x-username',
          description: 'Username header for authentication (deprecated, use BearerAuth)',
        },
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT Bearer token authentication',
        },
      },
      schemas: {
        Document: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              description: 'Document ID',
              example: '507f1f77bcf86cd799439011',
            },
            title: {
              type: 'string',
              description: 'Document title',
              example: 'My Document',
            },
            content: {
              type: 'string',
              description: 'Document content',
              example: 'This is the document content...',
            },
            owner: {
              type: 'string',
              description: 'Username of the document owner',
              example: 'john_doe',
            },
            permissions: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/Permission',
              },
              description: 'List of users with access to this document',
            },
            shareToken: {
              type: 'string',
              nullable: true,
              description: 'Share token for public access',
              example: 'abc123def456',
            },
            shareAccess: {
              type: 'string',
              enum: ['read', 'edit', null],
              nullable: true,
              description: 'Access level for share link',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Document creation timestamp',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Document last update timestamp',
            },
            versions: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/DocumentVersion',
              },
              description: 'Document version history',
            },
          },
        },
        Permission: {
          type: 'object',
          properties: {
            username: {
              type: 'string',
              description: 'Username',
              example: 'jane_doe',
            },
            role: {
              type: 'string',
              enum: ['owner', 'editor', 'viewer'],
              description: 'User role',
              example: 'editor',
            },
          },
        },
        DocumentVersion: {
          type: 'object',
          properties: {
            content: {
              type: 'string',
              description: 'Version content',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'Version timestamp',
            },
            user: {
              type: 'string',
              description: 'User who created this version',
            },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message',
              example: 'Document not found',
            },
          },
        },
        CreateDocumentRequest: {
          type: 'object',
          required: ['title'],
          properties: {
            title: {
              type: 'string',
              description: 'Document title',
              example: 'My New Document',
            },
            content: {
              type: 'string',
              description: 'Initial document content',
              example: 'Initial content...',
            },
          },
        },
        UpdateDocumentRequest: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'Document title',
              example: 'Updated Title',
            },
            content: {
              type: 'string',
              description: 'Document content',
              example: 'Updated content...',
            },
          },
        },
        AddPermissionRequest: {
          type: 'object',
          required: ['email', 'role'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              description: 'Email address to grant permission to',
              example: 'jane.doe@example.com',
            },
            username: {
              type: 'string',
              description: 'Username (deprecated, use email instead)',
              example: 'jane_doe',
            },
            role: {
              type: 'string',
              enum: ['editor', 'viewer'],
              description: 'Role to assign',
              example: 'editor',
            },
          },
        },
        RemovePermissionRequest: {
          type: 'object',
          required: ['email'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              description: 'Email address to remove permission from',
              example: 'jane.doe@example.com',
            },
            username: {
              type: 'string',
              description: 'Username (deprecated, use email instead)',
              example: 'jane_doe',
            },
          },
        },
        GenerateShareLinkRequest: {
          type: 'object',
          required: ['access'],
          properties: {
            access: {
              type: 'string',
              enum: ['read', 'edit'],
              description: 'Access level for the share link',
              example: 'edit',
            },
          },
        },
        ShareLinkResponse: {
          type: 'object',
          properties: {
            token: {
              type: 'string',
              description: 'Share token',
              example: 'abc123def456',
            },
            shareUrl: {
              type: 'string',
              description: 'Full share URL',
              example: 'http://localhost:5173/share/abc123def456',
            },
            access: {
              type: 'string',
              enum: ['read', 'edit'],
              description: 'Access level',
            },
          },
        },
        JoinShareTokenResponse: {
          type: 'object',
          properties: {
            documentId: {
              type: 'string',
              description: 'Document ID',
            },
            title: {
              type: 'string',
              description: 'Document title',
            },
            access: {
              type: 'string',
              enum: ['read', 'edit'],
              description: 'Access level granted',
            },
          },
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'Success message',
              example: 'Operation completed successfully',
            },
          },
        },
      },
    },
    security: [
      {
        BearerAuth: [],
      },
    ],
  },
  apis: ['./docs/swagger.docs.js'],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;

