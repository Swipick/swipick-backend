export interface WeeklyStats {
  week: number;
  totalPredictions: number;
  correctPredictions: number;
  weeklyPercentage: number;
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
  totalPredictions: number;
  totalCorrect: number;
  overallPercentage: number;
  weeklyBreakdown: Array<{
    week: number;
    percentage: number;
    correctCount: number;
    totalCount: number;
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

export class CreateTestPredictionDto {
  userId: number;
  fixtureId: number;
  choice: '1' | 'X' | '2';
}
