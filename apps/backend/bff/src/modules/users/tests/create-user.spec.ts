import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException } from '@nestjs/common';
import { UsersService } from '../users.service';
import { User } from '../../../entities/user.entity';
import { NotificationPreferences } from '../../../entities/notification-preferences.entity';
import { UserAvatar } from '../../../entities/user-avatar.entity';
import { FirebaseConfigService } from '../../../config/firebase.config';
import { EmailService } from '../../../services/email.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

describe('UsersService.createUser — atomicità e gestione credenziali', () => {
  let service: UsersService;
  let userRepository: { findOne: jest.Mock };
  let firebaseConfig: {
    createUser: jest.Mock;
    deleteUser: jest.Mock;
    getAuth: jest.Mock;
    generateEmailVerificationLink: jest.Mock;
    verifyIdToken: jest.Mock;
  };
  let queryRunnerManager: { create: jest.Mock; save: jest.Mock };

  const dto = {
    email: 'nuovo@swipick.com',
    password: 'Password123',
    name: 'Nuovo Utente',
    nickname: 'nuovo_nick',
  };

  beforeEach(async () => {
    userRepository = { findOne: jest.fn().mockResolvedValue(null) };
    queryRunnerManager = {
      create: jest.fn((_, data) => data),
      save: jest.fn(async (_, data) => ({ id: 'db-id-1', ...data })),
    };
    firebaseConfig = {
      createUser: jest.fn().mockResolvedValue({ uid: 'fb-uid-creato' }),
      deleteUser: jest.fn().mockResolvedValue(undefined),
      getAuth: jest.fn().mockReturnValue({
        getUserByEmail: jest
          .fn()
          .mockResolvedValue({ uid: 'fb-uid-esistente' }),
      }),
      generateEmailVerificationLink: jest
        .fn()
        .mockResolvedValue('https://link'),
      verifyIdToken: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: userRepository },
        { provide: getRepositoryToken(NotificationPreferences), useValue: {} },
        { provide: getRepositoryToken(UserAvatar), useValue: {} },
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn().mockReturnValue({
              connect: jest.fn(),
              startTransaction: jest.fn(),
              commitTransaction: jest.fn(),
              rollbackTransaction: jest.fn(),
              release: jest.fn(),
              manager: queryRunnerManager,
            }),
          },
        },
        { provide: FirebaseConfigService, useValue: firebaseConfig },
        {
          provide: EmailService,
          useValue: { sendVerificationEmail: jest.fn() },
        },
        { provide: HttpService, useValue: {} },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('') },
        },
      ],
    }).compile();

    service = module.get(UsersService);
  });

  it('does not store a local password hash (Firebase is the sole credential owner)', async () => {
    await service.createUser(dto as any);

    const created = queryRunnerManager.create.mock.calls[0][1];
    expect(created.passwordHash).toBeNull();
  });

  it('rolls back ONLY the Firebase uid created in this flow when the DB save fails', async () => {
    queryRunnerManager.save.mockRejectedValue(new Error('db down'));

    await expect(service.createUser(dto as any)).rejects.toThrow();

    expect(firebaseConfig.deleteUser).toHaveBeenCalledTimes(1);
    expect(firebaseConfig.deleteUser).toHaveBeenCalledWith('fb-uid-creato');
  });

  it('never touches Firebase when the failure happens before the Firebase creation', async () => {
    // nickname già in uso → ConflictException prima di createUser Firebase
    userRepository.findOne
      .mockResolvedValueOnce(null) // email libera
      .mockResolvedValueOnce({ id: 'x' }); // nickname occupato

    await expect(service.createUser(dto as any)).rejects.toThrow(
      ConflictException,
    );

    expect(firebaseConfig.createUser).not.toHaveBeenCalled();
    expect(firebaseConfig.deleteUser).not.toHaveBeenCalled();
  });
});
