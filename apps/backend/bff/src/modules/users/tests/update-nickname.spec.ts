import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UsersService } from '../users.service';
import { User } from '../../../entities/user.entity';
import { NotificationPreferences } from '../../../entities/notification-preferences.entity';
import { UserAvatar } from '../../../entities/user-avatar.entity';
import { FirebaseConfigService } from '../../../config/firebase.config';
import { EmailService } from '../../../services/email.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

describe('UsersService.updateNickname — cambio dalle impostazioni', () => {
  let service: UsersService;
  let userRepository: { findOne: jest.Mock; save: jest.Mock };
  let firebaseConfig: { updateUserDisplayName: jest.Mock };

  const utente = (overrides: Partial<User> = {}) =>
    ({
      id: 'u-1',
      firebaseUid: 'fb-1',
      nickname: 'vecchio_nick',
      profileCompleted: true,
      ...overrides,
    }) as User;

  beforeEach(async () => {
    userRepository = {
      findOne: jest.fn(),
      save: jest.fn(async (u) => u),
    };
    firebaseConfig = {
      updateUserDisplayName: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: userRepository },
        { provide: getRepositoryToken(NotificationPreferences), useValue: {} },
        { provide: getRepositoryToken(UserAvatar), useValue: {} },
        { provide: DataSource, useValue: { createQueryRunner: jest.fn() } },
        { provide: FirebaseConfigService, useValue: firebaseConfig },
        { provide: EmailService, useValue: {} },
        { provide: HttpService, useValue: {} },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('') },
        },
      ],
    }).compile();

    service = module.get(UsersService);
  });

  it('salva il nickname nuovo e allinea il nome mostrato su Firebase', async () => {
    userRepository.findOne
      .mockResolvedValueOnce(utente()) // l'utente
      .mockResolvedValueOnce(null); // nickname libero

    const result = await service.updateNickname('u-1', 'nuovo_nick');

    expect(result.nickname).toBe('nuovo_nick');
    expect(firebaseConfig.updateUserDisplayName).toHaveBeenCalledWith(
      'fb-1',
      'nuovo_nick',
    );
  });

  it("rifiuta un nickname gia' preso da qualcun altro", async () => {
    userRepository.findOne
      .mockResolvedValueOnce(utente())
      .mockResolvedValueOnce({ id: 'altro-utente' });

    await expect(service.updateNickname('u-1', 'preso')).rejects.toThrow(
      ConflictException,
    );
    expect(userRepository.save).not.toHaveBeenCalled();
  });

  it('non va in conflitto con se stesso quando il nickname non cambia', async () => {
    userRepository.findOne.mockResolvedValueOnce(utente());

    await expect(
      service.updateNickname('u-1', 'vecchio_nick'),
    ).resolves.toBeDefined();
    // Un solo findOne: il controllo di unicita' non e' stato nemmeno tentato.
    expect(userRepository.findOne).toHaveBeenCalledTimes(1);
  });

  it('completa il profilo di chi un nickname non lo aveva ancora', async () => {
    userRepository.findOne
      .mockResolvedValueOnce(
        utente({ nickname: null, profileCompleted: false }),
      )
      .mockResolvedValueOnce(null);

    const result = await service.updateNickname('u-1', 'primo_nick');

    expect(result.profileCompleted).toBe(true);
  });

  it('non trova l-utente e lo dice', async () => {
    userRepository.findOne.mockResolvedValueOnce(null);

    await expect(service.updateNickname('ignoto', 'x_nick')).rejects.toThrow(
      NotFoundException,
    );
  });
});
