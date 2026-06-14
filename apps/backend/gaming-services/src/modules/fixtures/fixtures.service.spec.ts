import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FixturesService } from './fixtures.service';
import { Fixture } from '../../entities/fixture.entity';
import { ApiFootballService } from '../api-football/api-football.service';
import { ApiRateLimitService } from '../api-rate-limit/api-rate-limit.service';
import { DatabasePersistenceService } from '../database-persistence/database-persistence.service';
import { SeasonConfigService } from '../season/season-config.service';

describe('FixturesService — season awareness', () => {
  let service: FixturesService;
  let qb: Record<string, jest.Mock>;
  let fixtureRepository: { find: jest.Mock; createQueryBuilder: jest.Mock };
  let currentSeason: number;

  beforeEach(async () => {
    currentSeason = 2026;
    qb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getRawOne: jest.fn(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    fixtureRepository = {
      find: jest.fn().mockResolvedValue([]),
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FixturesService,
        { provide: getRepositoryToken(Fixture), useValue: fixtureRepository },
        { provide: ApiFootballService, useValue: {} },
        { provide: ApiRateLimitService, useValue: {} },
        { provide: DatabasePersistenceService, useValue: {} },
        {
          provide: SeasonConfigService,
          useValue: { getCurrentSeason: () => currentSeason },
        },
      ],
    }).compile();

    service = module.get(FixturesService);
  });

  describe('getLastPlayedWeek', () => {
    it('returns {season, week} from the most recent FINISHED giornata', async () => {
      qb.getRawOne.mockResolvedValue({ season: '2025', week: '38' });
      expect(await service.getLastPlayedWeek()).toEqual({
        season: 2025,
        week: 38,
      });
    });

    it('returns the new season once it has a played match', async () => {
      qb.getRawOne.mockResolvedValue({ season: '2026', week: '1' });
      expect(await service.getLastPlayedWeek()).toEqual({
        season: 2026,
        week: 1,
      });
    });

    it('returns null when nothing has been played yet', async () => {
      qb.getRawOne.mockResolvedValue(undefined);
      expect(await service.getLastPlayedWeek()).toBeNull();
    });

    it('returns null (not a throw) on query error', async () => {
      qb.getRawOne.mockRejectedValue(new Error('db down'));
      expect(await service.getLastPlayedWeek()).toBeNull();
    });
  });

  describe('getFixturesByWeek', () => {
    it('defaults to the current season', async () => {
      await service.getFixturesByWeek(35);
      expect(fixtureRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { week: 35, season: 2026 } }),
      );
    });

    it('honours an explicit season (history during the gap)', async () => {
      await service.getFixturesByWeek(38, 2025);
      expect(fixtureRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { week: 38, season: 2025 } }),
      );
    });
  });

  describe('getNextRealFixtures (Gioca)', () => {
    it('filters by the current season so it opens on the new-season week', async () => {
      qb.getMany.mockResolvedValue([
        {
          week: 1,
          season: 2026,
          match_date: new Date('2026-08-23T16:30:00Z'),
          status: 'SCHEDULED',
          home_team: 'Udinese',
          away_team: 'Como',
          stadium: null,
          external_api_id: null,
        } as any,
      ]);
      const res: any = await service.getNextRealFixtures(10);
      expect(qb.andWhere).toHaveBeenCalledWith('fx.season = :season', {
        season: 2026,
      });
      expect(res.detectedWeek).toBe(1);
    });
  });
});
