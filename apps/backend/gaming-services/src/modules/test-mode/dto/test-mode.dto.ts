export interface WeeklyStats {
  week: number;
  totalPredictions: number; // excluding skips
  correctPredictions: number; // excluding skips
  weeklyPercentage: number; // based on non-skip predictions
  totalTurns: number; // predictions + skips
  skippedCount: number;
  predictions: Array<{
    fixtureId: number;
    homeTeam: string;
    awayTeam: string;
    userChoice: string;
    actualResult: string;
    isCorrect: boolean;
    homeScore: number;
    awayScore: number;
  }>;
}

export interface UserSummary {
  userId: number;
  totalWeeks: number;
  totalPredictions: number; // excluding skips
  totalCorrect: number; // excluding skips
  overallPercentage: number; // based on non-skips
  totalTurns: number; // predictions + skips
  skippedCount: number;
  weeklyBreakdown: Array<{
    week: number;
    percentage: number;
    correctCount: number;
    totalCount: number; // excluding skips
    totalTurns: number;
    skippedCount: number;
  }>;
  bestWeek: {
    week: number;
    percentage: number;
  };
  worstWeek: {
    week: number;
    percentage: number;
  };
}

import { IsInt, IsIn, IsPositive } from 'class-validator';

export class CreateTestPredictionDto {
  @IsInt()
  @IsPositive()
  userId: number;

  @IsInt()
  @IsPositive()
  fixtureId: number;

  @IsIn(['1', 'X', '2'])
  choice: '1' | 'X' | '2';
}
