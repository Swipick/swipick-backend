import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  Max,
} from 'class-validator';

export class CreateFinalWeekScoreDto {
  @IsString({ message: 'userId must be a string' })
  userId: string;

  @IsNumber({}, { message: 'week must be a number' })
  @Min(1, { message: 'week must be at least 1' })
  @Max(38, { message: 'week must be at most 38' })
  week: number;

  // Optional: defaults to the current season (live) on the server.
  @IsOptional()
  @IsNumber({}, { message: 'season must be a number' })
  season?: number;

  @IsEnum(['live', 'test'], {
    message: 'mode must be either live or test',
  })
  mode: 'live' | 'test';

  @IsNumber({}, { message: 'revealed must be a number' })
  @Min(0, { message: 'revealed must be at least 0' })
  @Max(10, { message: 'revealed must be at most 10' })
  revealed: number;

  @IsNumber({}, { message: 'correct must be a number' })
  @Min(0, { message: 'correct must be at least 0' })
  @Max(10, { message: 'correct must be at most 10' })
  correct: number;
}

export class FinalWeekScoreResponseDto {
  id: string;
  userId: string;
  week: number;
  mode: 'live' | 'test';
  revealed: number;
  correct: number;
  percent: number;
  createdAt: Date;
  updatedAt: Date;
  isComplete: boolean;
  gradeDisplay: string;
  scoreSummary: string;
}

export class UserFinalScoresResponseDto {
  userId: string;
  scores: FinalWeekScoreResponseDto[];
  totalWeeks: number;
  completedWeeks: number;
  averagePercent: number;
}

/**
 * Richiesta della classifica di un gruppo di utenti.
 *
 * POST e non GET perché la lista di UID arriva dal BFF e può contenere tutti
 * i membri di una lega: in query string diventerebbe un URL fragile.
 */
export class LeaderboardQueryDto {
  @IsArray({ message: 'userIds must be an array' })
  @ArrayNotEmpty({ message: 'userIds must not be empty' })
  @ArrayMaxSize(100, { message: 'userIds must contain at most 100 entries' })
  @IsString({ each: true, message: 'each userId must be a string' })
  userIds: string[];

  @IsOptional()
  @IsNumber({}, { message: 'season must be a number' })
  season?: number;

  @IsOptional()
  @IsEnum(['live', 'test'], { message: 'mode must be live or test' })
  mode?: 'live' | 'test';

  /** Se presente, restituisce solo quella giornata. */
  @IsOptional()
  @IsNumber({}, { message: 'week must be a number' })
  week?: number;
}

/** Una riga: il minimo che serve a comporre una classifica. */
export class LeaderboardRowDto {
  userId: string;
  week: number;
  correct: number;
  revealed: number;
}
