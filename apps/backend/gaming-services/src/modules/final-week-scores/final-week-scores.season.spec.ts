import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FinalWeekScoresService } from './final-week-scores.service';
import { FinalWeekScore } from '../../entities/final-week-score.entity';
import { SeasonConfigService } from '../season/season-config.service';

describe('FinalWeekScoresService — season scoping (live only)', () => {
  let service: FinalWeekScoresService;
  let repo: { query: jest.Mock };

  beforeEach(async () => {
    repo = { query: jest.fn().mockResolvedValue([]) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinalWeekScoresService,
        { provide: getRepositoryToken(FinalWeekScore), useValue: repo },
        {
          provide: SeasonConfigService,
          useValue: { getCurrentSeason: () => 2026 },
        },
      ],
    }).compile();
    service = module.get(FinalWeekScoresService);
  });

  it('percentile (live) filters by current season — 2025 and 2026 never mix', async () => {
    await service.getUserPercentile('u1', 38, 'live');
    const [sql, params] = repo.query.mock.calls[0];
    expect(sql).toContain('final_week_scores');
    expect(sql).toContain('season = $2');
    expect(params).toEqual([38, 2026]);
  });

  it('percentile (test) does NOT add a season filter (separate table)', async () => {
    await service.getUserPercentile('u1', 38, 'test');
    const [sql, params] = repo.query.mock.calls[0];
    expect(sql).toContain('test_final_week_scores');
    expect(sql).not.toContain('season');
    expect(params).toEqual([38]);
  });

  it('statistics (live) filters by current season', async () => {
    await service.getUserStatistics('u1', 'live');
    const [sql, params] = repo.query.mock.calls[0];
    expect(sql).toContain('season = $2');
    expect(params).toEqual(['u1', 2026]);
  });

  it('statistics (test) is not season-scoped', async () => {
    await service.getUserStatistics('u1', 'test');
    const [sql, params] = repo.query.mock.calls[0];
    expect(sql).toContain('test_final_week_scores');
    expect(sql).not.toContain('season');
    expect(params).toEqual(['u1']);
  });
});
