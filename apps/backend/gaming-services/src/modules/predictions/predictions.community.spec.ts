import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PredictionsService } from './predictions.service';
import { Spec } from '../../entities/spec.entity';
import { TestSpec } from '../../entities/test-spec.entity';
import { Fixture } from '../../entities/fixture.entity';
import { SeasonConfigService } from '../season/season-config.service';

describe('PredictionsService — votiCommunity', () => {
  let service: PredictionsService;
  let qb: Record<string, jest.Mock>;

  beforeEach(async () => {
    qb = {
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      addGroupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PredictionsService,
        {
          provide: getRepositoryToken(Spec),
          useValue: { createQueryBuilder: jest.fn().mockReturnValue(qb) },
        },
        { provide: getRepositoryToken(TestSpec), useValue: {} },
        { provide: getRepositoryToken(Fixture), useValue: {} },
        {
          provide: SeasonConfigService,
          useValue: { getCurrentSeason: () => 2026 },
        },
      ],
    }).compile();

    service = module.get(PredictionsService);
  });

  it('somma i conteggi per partita (COUNT arriva come stringa)', async () => {
    qb.getRawMany.mockResolvedValue([
      { fixture_id: 'a', choice: '1', n: '12' },
      { fixture_id: 'a', choice: 'X', n: '3' },
      { fixture_id: 'b', choice: '2', n: '5' },
    ]);

    expect(await service.votiCommunity(12)).toEqual([
      { fixtureId: 'a', totale: 15, conteggi: { '1': 12, X: 3, '2': 0 } },
      { fixtureId: 'b', totale: 5, conteggi: { '1': 0, X: 0, '2': 5 } },
    ]);
  });

  it('filtra giornata e stagione corrente, solo live e senza skip', async () => {
    await service.votiCommunity(12);

    expect(qb.where).toHaveBeenCalledWith('f.week = :week', { week: 12 });
    expect(qb.andWhere).toHaveBeenCalledWith('f.season = :stagione', {
      stagione: 2026,
    });
    expect(qb.andWhere).toHaveBeenCalledWith("s.mode = 'live'");
    expect(qb.andWhere).toHaveBeenCalledWith("s.choice IN ('1', 'X', '2')");
  });

  it('usa la stagione richiesta quando c’è', async () => {
    await service.votiCommunity(38, 2025);
    expect(qb.andWhere).toHaveBeenCalledWith('f.season = :stagione', {
      stagione: 2025,
    });
  });

  it('nessun pronostico: lista vuota', async () => {
    expect(await service.votiCommunity(12)).toEqual([]);
  });
});
