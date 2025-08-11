module.exports = {
  displayName: 'BFF Service',
  preset: 'ts-jest/presets/default',
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/src'],
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.json',
        isolatedModules: true,
      },
    ],
  },
  transformIgnorePatterns: ['node_modules/(?!(.*\\.mjs$))'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  coverageDirectory: '<rootDir>/coverage',
  collectCoverageFrom: [
    '<rootDir>/src/**/*.ts',
    '!<rootDir>/src/**/*.spec.ts',
    '!<rootDir>/src/main.ts',
  ],
  moduleNameMapper: {
    '^@swipick/common$': '<rootDir>/../../packages/common/src/index.ts',
  },
  setupFiles: ['<rootDir>/test/jest.setup.ts'],
  verbose: true,
};
