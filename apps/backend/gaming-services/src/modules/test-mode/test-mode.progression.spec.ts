import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TestModeService } from './test-mode.service';
import { TestFixture } from '../../entities/test-fixture.entity';
import { TestSpec } from '../../entities/test-spec.entity';
import { TestUserProgress } from '../../entities/test-user-progress.entity';
import { FinalWeekScore } from '../../entities/final-week-score.entity';
import { ApiFootballService } from '../api-football/api-football.service';

/**
 * Sequential giornata progression for test mode: starts at 1, advances one
 * giornata at a time, and never exceeds the last available test giornata.
 */
describe('TestModeService — progression', () => {
  let service: TestModeService;
  let progressRow: { userId: string; currentWeek: number } | null;

  const maxWeekQB = {
    select: jest.fn().mockReturnThis(),
    getRawOne: jest.fn().mockResolvedValue({ max: '38' }),
  };

  const testFixtureRepository = {
    createQueryBuilder: jest.fn(() => maxWeekQB),
  };

  const testUserProgressRepository = {
    findOne: jest.fn(async () => progressRow),
    create: jest.fn((row) => row),
    save: jest.fn(async (row) => {
      progressRow = row;
      return row;
    }),
    update: jest.fn(async (_where, patch) => {
      if (progressRow) Object.assign(progressRow, patch);
      return { affected: 1 };
    }),
    upsert: jest.fn(),
  };

  beforeEach(async () => {
    progressRow = null;
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TestModeService,
        { provide: getRepositoryToken(TestFixture), useValue: testFixtureRepository },
        { provide: getRepositoryToken(TestSpec), useValue: {} },
        { provide: getRepositoryToken(TestUserProgress), useValue: testUserProgressRepository },
        { provide: getRepositoryToken(FinalWeekScore), useValue: {} },
        { provide: ApiFootballService, useValue: {} },
      ],
    }).compile();

    service = module.get<TestModeService>(TestModeService);
  });

  it('creates progression at giornata 1 on first access', async () => {
    const res = await service.getProgression('user-1');
    expect(res.currentWeek).toBe(1);
    expect(res.maxWeek).toBe(38);
    expect(res.playedWeeks).toEqual([1]);
    expect(testUserProgressRepository.save).toHaveBeenCalled();
  });

  it('advances one giornata at a time, in sequence', async () => {
    await service.getProgression('user-1'); // seeds at 1
    const a = await service.advanceProgression('user-1');
    expect(a.currentWeek).toBe(2);
    expect(a.playedWeeks).toEqual([1, 2]);

    const b = await service.advanceProgression('user-1');
    expect(b.currentWeek).toBe(3);
  });

  it('never advances past the last available giornata (maxWeek)', async () => {
    progressRow = { userId: 'user-1', currentWeek: 38 };
    const res = await service.advanceProgression('user-1');
    expect(res.currentWeek).toBe(38);
    expect(testUserProgressRepository.update).not.toHaveBeenCalled();
  });
});
