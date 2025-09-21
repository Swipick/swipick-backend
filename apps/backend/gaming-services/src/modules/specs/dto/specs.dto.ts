import { IsEnum, IsUUID, IsNumber, IsString, Min, Max } from 'class-validator';

export class CreateSpecDto {
  @IsUUID(4, { message: 'user_id must be a valid UUID' })
  user_id: string;

  @IsUUID(4, { message: 'fixture_id must be a valid UUID' })
  fixture_id: string;

  @IsEnum(['1', 'X', '2'], {
    message: 'choice must be one of: 1 (Home Win), X (Draw), 2 (Away Win)',
  })
  choice: '1' | 'X' | '2';

  @IsNumber({}, { message: 'week must be a number' })
  @Min(1, { message: 'week must be at least 1' })
  @Max(38, { message: 'week must be at most 38' })
  week: number;
}

export class WeeklyStatsDto {
  @IsNumber({}, { message: 'week must be a number' })
  @Min(1, { message: 'week must be at least 1' })
  @Max(38, { message: 'week must be at most 38' })
  week: number;
}

export class SpecResponseDto {
  id: string;
  user_id: string;
  fixture_id: string;
  choice: '1' | 'X' | '2';
  result?: '1' | 'X' | '2';
  is_correct?: boolean;
  week: number;
  timestamp: Date;
  match_display: string;
  choice_display: string;
}

export class WeeklyStatsResponseDto {
  week: number;
  total_predictions: number;
  correct_predictions: number;
  success_rate: number;
  predictions: SpecResponseDto[];
}

export class UserSummaryResponseDto {
  user_id: string;
  total_predictions: number;
  correct_predictions: number;
  overall_success_rate: number;
  weekly_stats: WeeklyStatsResponseDto[];
}

export class CreateUnifiedPredictionDto {
  @IsString({ message: 'userId must be a string' })
  userId: string;

  @IsNumber({}, { message: 'fixtureId must be a number' })
  fixtureId: number;

  @IsEnum(['1', 'X', '2'], {
    message: 'choice must be one of: 1 (Home Win), X (Draw), 2 (Away Win)',
  })
  choice: '1' | 'X' | '2';

  @IsEnum(['live', 'test'], {
    message: 'mode must be either live or test',
  })
  mode: 'live' | 'test';
}
