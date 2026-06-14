import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Single source of truth for the current Serie A season.
 *
 * The same value drives both API-FOOTBALL requests and DB season filters,
 * so live/test data and stats never mix across seasons. Set via the
 * CURRENT_SEASON env var (default 2025); flip to 2026 to switch the app to
 * the 2026-2027 season once its calendar is imported.
 */
@Injectable()
export class SeasonConfigService {
  constructor(private readonly configService: ConfigService) {}

  getCurrentSeason(): number {
    return this.configService.get<number>('season.current', 2025);
  }
}
