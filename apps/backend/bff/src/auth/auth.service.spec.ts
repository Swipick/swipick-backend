import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              switch (key) {
                case 'NODE_ENV':
                  return 'test';
                case 'FIREBASE_PROJECT_ID':
                  return 'test-project';
                default:
                  return null;
              }
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('verifyToken', () => {
    it('should return mock user data in test environment', async () => {
      const token = 'test-token';
      const result = await service.verifyToken(token);

      expect(result).toEqual({
        id: 'mock-user-id',
        email: 'mock-user@example.com',
        displayName: 'Mock User',
        firebaseUid: 'mock-user-id',
      });
    });

    it('should handle empty token', async () => {
      const token = '';
      const result = await service.verifyToken(token);

      expect(result).toEqual({
        id: 'mock-user-id',
        email: 'mock-user@example.com',
        displayName: 'Mock User',
        firebaseUid: 'mock-user-id',
      });
    });
  });

  describe('validateUser', () => {
    it('should return user data from payload', async () => {
      const payload = {
        sub: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
      };

      const result = await service.validateUser(payload);

      expect(result).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        firebaseUid: 'user-123',
      });
    });

    it('should handle payload without email', async () => {
      const payload = {
        sub: 'user-123',
        name: 'Test User',
      };

      const result = await service.validateUser(payload);

      expect(result).toEqual({
        id: 'user-123',
        email: undefined,
        displayName: 'Test User',
        firebaseUid: 'user-123',
      });
    });
  });
});
