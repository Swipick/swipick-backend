import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    verifyToken: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('verifyToken', () => {
    it('should return success with user data for valid token', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        firebaseUid: 'user-123',
      };

      mockAuthService.verifyToken.mockResolvedValue(mockUser);

      const result = await controller.verifyToken({ token: 'valid-token' });

      expect(result).toEqual({
        success: true,
        user: mockUser,
      });
      expect(mockAuthService.verifyToken).toHaveBeenCalledWith('valid-token');
    });

    it('should throw UnauthorizedException for invalid token', async () => {
      mockAuthService.verifyToken.mockRejectedValue(new Error('Invalid token'));

      await expect(
        controller.verifyToken({ token: 'invalid-token' }),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockAuthService.verifyToken).toHaveBeenCalledWith('invalid-token');
    });
  });

  describe('verifyFromHeader', () => {
    it('should return success with user data for valid authorization header', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        firebaseUid: 'user-123',
      };

      mockAuthService.verifyToken.mockResolvedValue(mockUser);

      const result = await controller.verifyFromHeader('Bearer valid-token');

      expect(result).toEqual({
        success: true,
        user: mockUser,
      });
      expect(mockAuthService.verifyToken).toHaveBeenCalledWith('valid-token');
    });

    it('should throw UnauthorizedException when authorization header is missing', async () => {
      await expect(controller.verifyFromHeader('')).rejects.toThrow(
        'Authorization header required',
      );
    });

    it('should throw UnauthorizedException when authorization header is undefined', async () => {
      await expect(
        controller.verifyFromHeader(undefined as any),
      ).rejects.toThrow('Authorization header required');
    });

    it('should throw UnauthorizedException for invalid token in header', async () => {
      mockAuthService.verifyToken.mockRejectedValue(new Error('Invalid token'));

      await expect(
        controller.verifyFromHeader('Bearer invalid-token'),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockAuthService.verifyToken).toHaveBeenCalledWith('invalid-token');
    });

    it('should handle authorization header without Bearer prefix', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        firebaseUid: 'user-123',
      };

      mockAuthService.verifyToken.mockResolvedValue(mockUser);

      const result = await controller.verifyFromHeader('valid-token');

      expect(result).toEqual({
        success: true,
        user: mockUser,
      });
      expect(mockAuthService.verifyToken).toHaveBeenCalledWith('valid-token');
    });
  });
});
