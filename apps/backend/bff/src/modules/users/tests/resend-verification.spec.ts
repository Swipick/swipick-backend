import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UsersService } from '../users.service';
import { User, AuthProvider } from '../../../entities/user.entity';
import { NotificationPreferences } from '../../../entities/notification-preferences.entity';
import { UserAvatar } from '../../../entities/user-avatar.entity';
import { FirebaseConfigService } from '../../../config/firebase.config';
import { EmailService } from '../../../services/email.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

const EMAIL = 'persona@gmail.com';

/** La riga di chi è entrato con Google: per `users` è già verificata. */
const rigaGoogle = {
  id: 'user-uuid',
  email: EMAIL,
  name: 'Persona',
  authProvider: AuthProvider.GOOGLE,
  emailVerified: true,
} as unknown as User;

const utenza = (emailVerified: boolean, providers: string[]) => ({
  emailVerified,
  providerData: providers.map((providerId) => ({ providerId })),
});

describe('UsersService - resendVerificationEmail', () => {
  let service: UsersService;
  let userRepository: { findOne: jest.Mock };
  let firebase: {
    utenzaPerEmail: jest.Mock;
    generateEmailVerificationLink: jest.Mock;
  };
  let email: { sendVerificationEmail: jest.Mock };

  beforeEach(async () => {
    userRepository = { findOne: jest.fn().mockResolvedValue(rigaGoogle) };
    firebase = {
      utenzaPerEmail: jest.fn(),
      generateEmailVerificationLink: jest.fn().mockResolvedValue('link'),
    };
    email = { sendVerificationEmail: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: userRepository },
        { provide: getRepositoryToken(NotificationPreferences), useValue: {} },
        { provide: getRepositoryToken(UserAvatar), useValue: {} },
        { provide: FirebaseConfigService, useValue: firebase },
        { provide: EmailService, useValue: email },
        { provide: HttpService, useValue: {} },
        { provide: ConfigService, useValue: { get: () => '' } },
        { provide: DataSource, useValue: {} },
      ],
    }).compile();

    service = module.get(UsersService);
  });

  it('manda la mail a chi ha aggiunto una password a Google e Firebase la vuole verificata', async () => {
    firebase.utenzaPerEmail.mockResolvedValue(
      utenza(false, ['google.com', 'password']),
    );

    await service.resendVerificationEmail(EMAIL);

    expect(email.sendVerificationEmail).toHaveBeenCalledWith(
      EMAIL,
      'Persona',
      'link',
    );
  });

  it('non la manda se per Firebase è già verificata', async () => {
    firebase.utenzaPerEmail.mockResolvedValue(
      utenza(true, ['google.com', 'password']),
    );

    await service.resendVerificationEmail(EMAIL);

    expect(email.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it('non la manda a chi entra solo con Google o Apple', async () => {
    firebase.utenzaPerEmail.mockResolvedValue(utenza(false, ['google.com']));

    await service.resendVerificationEmail(EMAIL);

    expect(email.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it("non la manda se l'utenza Firebase non c'è", async () => {
    firebase.utenzaPerEmail.mockResolvedValue(null);

    await service.resendVerificationEmail(EMAIL);

    expect(email.sendVerificationEmail).not.toHaveBeenCalled();
  });
});
