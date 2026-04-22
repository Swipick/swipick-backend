import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { UsersService } from '../users.service';
import { User, AuthProvider } from '../../../entities/user.entity';
import { NotificationPreferences } from '../../../entities/notification-preferences.entity';
import { UserAvatar } from '../../../entities/user-avatar.entity';
import { FirebaseConfigService } from '../../../config/firebase.config';
import { EmailService } from '../../../services/email.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { AppleSyncUserDto } from '../dto/apple-sync-user.dto';

const mockUserRepository = () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
});

const mockPrefsRepository = () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
});

const mockAvatarRepository = () => ({
  findOne: jest.fn(),
});

const mockFirebaseConfigService = () => ({
  verifyIdToken: jest.fn(),
  createUser: jest.fn(),
  deleteUser: jest.fn(),
  getAuth: jest.fn(),
  generateEmailVerificationLink: jest.fn(),
  updateUserDisplayName: jest.fn(),
});

const mockEmailService = () => ({
  sendVerificationEmail: jest.fn(),
});

const mockHttpService = () => ({
  get: jest.fn(),
  delete: jest.fn(),
});

const mockConfigService = () => ({
  get: jest.fn().mockReturnValue(''),
});

const mockDataSource = () => ({
  createQueryRunner: jest.fn().mockReturnValue({
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    },
  }),
});

describe('UsersService - syncAppleUser', () => {
  let service: UsersService;
  let userRepository: ReturnType<typeof mockUserRepository>;
  let firebaseConfigService: ReturnType<typeof mockFirebaseConfigService>;

  const MOCK_FIREBASE_UID = 'apple-firebase-uid-123';
  const MOCK_EMAIL = 'user@privaterelay.appleid.com';
  const MOCK_NAME = 'John Apple';
  const MOCK_TOKEN = 'valid-firebase-id-token';

  const mockDecodedToken = {
    uid: MOCK_FIREBASE_UID,
    email: MOCK_EMAIL,
    name: MOCK_NAME,
    email_verified: true,
    picture: undefined,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useFactory: mockUserRepository },
        { provide: getRepositoryToken(NotificationPreferences), useFactory: mockPrefsRepository },
        { provide: getRepositoryToken(UserAvatar), useFactory: mockAvatarRepository },
        { provide: FirebaseConfigService, useFactory: mockFirebaseConfigService },
        { provide: EmailService, useFactory: mockEmailService },
        { provide: HttpService, useFactory: mockHttpService },
        { provide: ConfigService, useFactory: mockConfigService },
        { provide: DataSource, useFactory: mockDataSource },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    userRepository = module.get(getRepositoryToken(User));
    firebaseConfigService = module.get(FirebaseConfigService);
  });

  describe('new Apple user', () => {
    it('creates a new user with authProvider APPLE and profileCompleted false', async () => {
      firebaseConfigService.verifyIdToken.mockResolvedValue(mockDecodedToken);
      userRepository.findOne.mockResolvedValue(null); // user does not exist

      const newUser: Partial<User> = {
        id: 'new-uuid',
        firebaseUid: MOCK_FIREBASE_UID,
        email: MOCK_EMAIL,
        name: MOCK_NAME,
        nickname: null,
        passwordHash: null,
        authProvider: AuthProvider.APPLE,
        appleSubjectId: MOCK_FIREBASE_UID,
        emailVerified: true,
        profileCompleted: false,
        isActive: true,
        googleProfileUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      userRepository.create.mockReturnValue(newUser);
      userRepository.save.mockResolvedValue(newUser);

      const dto: AppleSyncUserDto = { firebaseIdToken: MOCK_TOKEN };
      const result = await service.syncAppleUser(dto);

      expect(firebaseConfigService.verifyIdToken).toHaveBeenCalledWith(MOCK_TOKEN);
      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          authProvider: AuthProvider.APPLE,
          profileCompleted: false,
          passwordHash: null,
          nickname: null,
        }),
      );
      expect(result.authProvider).toBe(AuthProvider.APPLE);
      expect(result.needsProfileCompletion).toBe(true);
    });
  });

  describe('existing Apple user', () => {
    it('returns existing user without creating a duplicate', async () => {
      firebaseConfigService.verifyIdToken.mockResolvedValue(mockDecodedToken);

      const existingUser: Partial<User> = {
        id: 'existing-uuid',
        firebaseUid: MOCK_FIREBASE_UID,
        email: MOCK_EMAIL,
        name: MOCK_NAME,
        nickname: 'johnny',
        passwordHash: null,
        authProvider: AuthProvider.APPLE,
        appleSubjectId: MOCK_FIREBASE_UID,
        emailVerified: true,
        profileCompleted: true,
        isActive: true,
        googleProfileUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      userRepository.findOne.mockResolvedValue(existingUser);
      userRepository.save.mockResolvedValue(existingUser);

      const dto: AppleSyncUserDto = { firebaseIdToken: MOCK_TOKEN };
      const result = await service.syncAppleUser(dto);

      expect(userRepository.create).not.toHaveBeenCalled();
      expect(result.needsProfileCompletion).toBe(false);
    });
  });

  describe('invalid token', () => {
    it('throws BadRequestException when Firebase token verification fails', async () => {
      firebaseConfigService.verifyIdToken.mockRejectedValue(
        new Error('Firebase ID token has been revoked'),
      );

      const dto: AppleSyncUserDto = { firebaseIdToken: 'invalid-token' };

      await expect(service.syncAppleUser(dto)).rejects.toThrow(BadRequestException);
    });
  });
});
