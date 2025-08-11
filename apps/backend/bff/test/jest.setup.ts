// Jest setup file for BFF service
import 'reflect-metadata';

// Mock console methods if needed
global.console = {
  ...console,
  // Uncomment to ignore console.log in tests
  // log: jest.fn(),
};

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '9000';
