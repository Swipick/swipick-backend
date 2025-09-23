import { IsEnum, IsNumber, IsString, Min, Max } from 'class-validator';

export class CreateFinalWeekScoreDto {
  @IsString({ message: 'userId must be a string' })
  userId: string;

  @IsNumber({}, { message: 'week must be a number' })
  @Min(1, { message: 'week must be at least 1' })
  @Max(38, { message: 'week must be at most 38' })
  week: number;

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
