import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import axios from 'axios';
import { HealthService } from './health.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('HealthService', () => {
  let service: HealthService;
  let dataSource: { query: jest.Mock };
  let config: Record<string, string | undefined>;

  const build = async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, def?: unknown) => config[key] ?? def),
          },
        },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();
    service = module.get(HealthService);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    dataSource = { query: jest.fn().mockResolvedValue([{ ok: 1 }]) };
    config = {
      NODE_ENV: 'test',
      API_FOOTBALL_KEY: 'test-key',
      API_FOOTBALL_URL: 'https://v3.football.api-sports.io',
      // REDIS_URL assente di default
    };
    mockedAxios.get.mockResolvedValue({ status: 200, data: { errors: [] } });
  });

  it('reports database healthy when SELECT 1 succeeds', async () => {
    await build();
    const status = await service.getHealthStatus();
    expect(status.services.database).toBe('healthy');
    expect(dataSource.query).toHaveBeenCalledWith('SELECT 1');
  });

  it('reports database unhealthy when the query fails', async () => {
    dataSource.query.mockRejectedValue(new Error('connection refused'));
    await build();
    const status = await service.getHealthStatus();
    expect(status.services.database).toBe('unhealthy');
  });

  it('reports redis not_configured when REDIS_URL is missing', async () => {
    await build();
    const status = await service.getHealthStatus();
    expect(status.services.redis).toBe('not_configured');
  });

  it('reports apiFootball healthy when /status responds', async () => {
    await build();
    const status = await service.getHealthStatus();
    expect(status.services.apiFootball).toBe('healthy');
    expect(mockedAxios.get).toHaveBeenCalledWith(
      'https://v3.football.api-sports.io/status',
      expect.objectContaining({ timeout: expect.any(Number) }),
    );
  });

  it('reports apiFootball unhealthy when /status fails', async () => {
    mockedAxios.get.mockRejectedValue(new Error('timeout'));
    await build();
    const status = await service.getHealthStatus();
    expect(status.services.apiFootball).toBe('unhealthy');
  });

  it('caches the apiFootball check between close calls (no quota burn)', async () => {
    await build();
    await service.getHealthStatus();
    await service.getHealthStatus();
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
  });

  it('overall status is degraded when a service is unhealthy', async () => {
    dataSource.query.mockRejectedValue(new Error('down'));
    await build();
    const status = await service.getHealthStatus();
    expect(status.status).toBe('degraded');
  });

  it('readiness is not_ready when the database is down', async () => {
    dataSource.query.mockRejectedValue(new Error('down'));
    await build();
    const ready = await service.getReadinessStatus();
    expect(ready.status).toBe('not_ready');
    expect(ready.checks.database).toBe('unhealthy');
  });

  it('liveness keeps working without dependencies', async () => {
    await build();
    const live = await service.getLivenessStatus();
    expect(live.status).toBe('alive');
  });
});
