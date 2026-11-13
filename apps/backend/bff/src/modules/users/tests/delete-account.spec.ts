import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { of } from 'rxjs';
import { UsersService } from '../users.service';
import { User } from '../../../entities/user.entity';
import { NotificationPreferences } from '../../../entities/notification-preferences.entity';
import { UserAvatar } from '../../../entities/user-avatar.entity';
import { FirebaseConfigService } from '../../../config/firebase.config';
import { EmailService } from '../../../services/email.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

const UID = 'firebase-uid';
const riga = { id: 'user-uuid', firebaseUid: UID } as unknown as User;

describe('UsersService - deleteAccount', () => {
  let service: UsersService;
  let queryRunner: {
    connect: jest.Mock;
    startTransaction: jest.Mock;
    commitTransaction: jest.Mock;
    rollbackTransaction: jest.Mock;
    release: jest.Mock;
    query: jest.Mock;
    manager: { delete: jest.Mock };
  };
  let firebase: { verifyIdToken: jest.Mock; deleteUser: jest.Mock };

  beforeEach(async () => {
    queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      query: jest.fn(),
      manager: { delete: jest.fn() },
    };
    firebase = {
      verifyIdToken: jest.fn().mockResolvedValue({ uid: UID }),
      deleteUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: { findOne: jest.fn().mockResolvedValue(riga) },
        },
        { provide: getRepositoryToken(NotificationPreferences), useValue: {} },
        { provide: getRepositoryToken(UserAvatar), useValue: {} },
        { provide: FirebaseConfigService, useValue: firebase },
        { provide: EmailService, useValue: {} },
        {
          provide: HttpService,
          useValue: { delete: jest.fn().mockReturnValue(of({})) },
        },
        { provide: ConfigService, useValue: { get: () => '' } },
        {
          provide: DataSource,
          useValue: { createQueryRunner: () => queryRunner },
        },
      ],
    }).compile();

    service = module.get(UsersService);
  });

  it("cancella pronostici e punteggi dell'UID Firebase nella stessa transazione", async () => {
    await service.deleteAccount('user-uuid', 'token');

    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM specs'),
      [UID],
    );
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM final_week_scores'),
      [UID],
    );
    expect(queryRunner.commitTransaction).toHaveBeenCalled();
    expect(firebase.deleteUser).toHaveBeenCalledWith(UID);
  });

  it('se la cancellazione fallisce non tocca né il database né Firebase', async () => {
    queryRunner.query.mockRejectedValueOnce(new Error('db giù'));

    await expect(service.deleteAccount('user-uuid', 'token')).rejects.toThrow();

    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
    expect(firebase.deleteUser).not.toHaveBeenCalled();
  });
});
