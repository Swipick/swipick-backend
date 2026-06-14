import { registerAs } from '@nestjs/config';

export interface SeasonConfig {
  /** Current Serie A season (start year). 2026 = season 2026-2027. */
  current: number;
}

export const SeasonConfig = registerAs(
  'season',
  (): SeasonConfig => ({
    current: parseInt(process.env.CURRENT_SEASON ?? '2025', 10),
  }),
);
