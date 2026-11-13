import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException } from '@nestjs/common';
import { UsersService } from '../users.service';
import { User, AuthProvider } from '../../../entities/user.entity';
import { NotificationPreferences } from '../../../entities/notification-preferences.entity';
import { UserAvatar } from '../../../entities/user-avatar.entity';
import { FirebaseConfigService } from '../../../config/firebase.config';
import { EmailService } from '../../../services/email.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

const UID_NUOVO = 'uid-google-swipick-2026';
const UID_VECCHIO = 'uid-email-swipick-ab224';
const EMAIL = 'persona@gmail.com';
const TOKEN = 'token-google';

const tokenGoogle = (emailVerified = true) => ({
  uid: UID_NUOVO,
  email: EMAIL,
  name: 'Persona',
  picture: 'https://lh3.googleusercontent.com/foto',
  email_verified: emailVerified,
});

/** La riga di chi si era iscritto con email prima del cambio di progetto. */
const rigaVecchia = (): User =>
  ({
    id: 'user-uuid',
    firebaseUid: UID_VECCHIO,
    email: EMAIL,
    name: 'Persona',
    nickname: 'stebega',
    passwordHash: null,
    authProvider: AuthProvider.EMAIL,
    googleProfileUrl: null,
    emailVerified: false,
    profileCompleted: true,
    isActive: true,
    createdAt: new Date('2025-10-18'),
    updatedAt: new Date('2025-10-18'),
  }) as unknown as User;

describe('UsersService - syncGoogleUser', () => {
  let service: UsersService;
  let userRepository: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let firebase: { verifyIdToken: jest.Mock; utenzaEsiste: jest.Mock };
  let queryRunner: {
    connect: jest.Mock;
    startTransaction: jest.Mock;
    commitTransaction: jest.Mock;
    rollbackTransaction: jest.Mock;
    release: jest.Mock;
    query: jest.Mock;
    manager: { save: jest.Mock };
  };

  beforeEach(async () => {
    userRepository = { findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
    firebase = { verifyIdToken: jest.fn(), utenzaEsiste: jest.fn() };
    queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      query: jest.fn(),
      manager: { save: jest.fn((u: User) => Promise.resolve(u)) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: userRepository },
        { provide: getRepositoryToken(NotificationPreferences), useValue: {} },
        { provide: getRepositoryToken(UserAvatar), useValue: {} },
        { provide: FirebaseConfigService, useValue: firebase },
        { provide: EmailService, useValue: {} },
        { provide: HttpService, useValue: {} },
        { provide: ConfigService, useValue: { get: () => '' } },
        {
          provide: DataSource,
          useValue: { createQueryRunner: () => queryRunner },
        },
      ],
    }).compile();

    service = module.get(UsersService);
  });

  /** Nessuna riga per il nuovo UID; per email, quella che passa il test. */
  const cercaPer = (perEmail: User | null) =>
    userRepository.findOne.mockImplementation(
      ({ where }: { where: Partial<User> }) =>
        Promise.resolve(where.email ? perEmail : null),
    );

  it('crea un utente nuovo quando nessuno ha quella email', async () => {
    firebase.verifyIdToken.mockResolvedValue(tokenGoogle());
    cercaPer(null);
    userRepository.create.mockImplementation((u: Partial<User>) => u);
    userRepository.save.mockImplementation((u: User) =>
      Promise.resolve({ ...u, id: 'nuovo' }),
    );

    const result = await service.syncGoogleUser({ firebaseIdToken: TOKEN });

    expect(userRepository.create).toHaveBeenCalled();
    expect(queryRunner.query).not.toHaveBeenCalled();
    expect(result.needsProfileCompletion).toBe(true);
  });

  it('riaggancia la riga con la stessa email e si porta dietro i pronostici', async () => {
    firebase.verifyIdToken.mockResolvedValue(tokenGoogle());
    cercaPer(rigaVecchia());
    firebase.utenzaEsiste.mockResolvedValue(false);

    const result = await service.syncGoogleUser({ firebaseIdToken: TOKEN });

    expect(firebase.utenzaEsiste).toHaveBeenCalledWith(UID_VECCHIO);
    expect(userRepository.create).not.toHaveBeenCalled();

    const [specs, punteggi] = queryRunner.query.mock.calls;
    expect(specs[0]).toContain('UPDATE specs');
    expect(specs[1]).toEqual([UID_NUOVO, UID_VECCHIO]);
    expect(punteggi[0]).toContain('UPDATE final_week_scores');
    expect(punteggi[1]).toEqual([UID_NUOVO, UID_VECCHIO]);
    expect(queryRunner.commitTransaction).toHaveBeenCalled();

    expect(result.id).toBe('user-uuid');
    expect(result.firebaseUid).toBe(UID_NUOVO);
    expect(result.nickname).toBe('stebega');
    expect(result.authProvider).toBe(AuthProvider.GOOGLE);
    expect(result.needsProfileCompletion).toBe(false);
  });

  it('non riaggancia se la vecchia utenza è ancora attiva', async () => {
    firebase.verifyIdToken.mockResolvedValue(tokenGoogle());
    cercaPer(rigaVecchia());
    firebase.utenzaEsiste.mockResolvedValue(true);

    await expect(
      service.syncGoogleUser({ firebaseIdToken: TOKEN }),
    ).rejects.toThrow(ConflictException);
    expect(queryRunner.query).not.toHaveBeenCalled();
  });

  it("non cerca per email se Google non l'ha verificata", async () => {
    firebase.verifyIdToken.mockResolvedValue(tokenGoogle(false));
    cercaPer(rigaVecchia());
    userRepository.create.mockImplementation((u: Partial<User>) => u);
    userRepository.save.mockImplementation((u: User) => Promise.resolve(u));

    await service.syncGoogleUser({ firebaseIdToken: TOKEN });

    expect(firebase.utenzaEsiste).not.toHaveBeenCalled();
    expect(queryRunner.query).not.toHaveBeenCalled();
  });

  it('annulla tutto se lo spostamento dei pronostici fallisce', async () => {
    firebase.verifyIdToken.mockResolvedValue(tokenGoogle());
    cercaPer(rigaVecchia());
    firebase.utenzaEsiste.mockResolvedValue(false);
    queryRunner.query.mockRejectedValueOnce(new Error('db giù'));

    await expect(
      service.syncGoogleUser({ firebaseIdToken: TOKEN }),
    ).rejects.toThrow();
    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    expect(queryRunner.manager.save).not.toHaveBeenCalled();
  });
});
