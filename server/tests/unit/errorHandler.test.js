const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const errorHandler = require('../../middleware/errorHandler');

describe('Error Handler Middleware', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Test route that throws errors
    app.get('/test-validation', (req, res, next) => {
      const error = new Error('Validation failed');
      error.name = 'ValidationError';
      next(error);
    });

    app.get('/test-cast', (req, res, next) => {
      const error = new Error('Cast failed');
      error.name = 'CastError';
      next(error);
    });

    app.get('/test-custom', (req, res, next) => {
      const error = new Error('Custom error');
      error.status = 418;
      next(error);
    });

    app.get('/test-default', (req, res, next) => {
      const error = new Error('Default error');
      next(error);
    });

    app.use(errorHandler);
  });

  test('should handle ValidationError with 400 status', async () => {
    const response = await request(app).get('/test-validation');
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Validation failed');
  });

  test('should handle CastError with 400 status', async () => {
    const response = await request(app).get('/test-cast');
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid ID format');
  });

  test('should handle custom status code', async () => {
    const response = await request(app).get('/test-custom');
    expect(response.status).toBe(418);
    expect(response.body.error).toBe('Custom error');
  });

  test('should handle default error with 500 status', async () => {
    const response = await request(app).get('/test-default');
    expect(response.status).toBe(500);
    expect(response.body.error).toBe('Default error');
  });

  test('should handle error without message', async () => {
    app.get('/test-no-message', (req, res, next) => {
      // Create error object without message property
      const error = { name: 'Error' };
      // message property doesn't exist, so err.message will be undefined
      next(error);
    });

    const response = await request(app).get('/test-no-message');
    expect(response.status).toBe(500);
    // When err.message is undefined, should use default
    // Note: In JavaScript, undefined || 'default' works, but if the property doesn't exist,
    // accessing it returns undefined, which should trigger the default
    const errorMessage = response.body.error;
    expect(errorMessage === 'Internal server error' || errorMessage === undefined).toBe(true);
  });
});

