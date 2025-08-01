export interface IPrediction {
  id: string;
  userId: string;
  matchId: string;
  homeScore: number;
  awayScore: number;
  points?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPredictionService {
  findById(id: string): Promise<IPrediction | null>;
  findByUser(userId: string): Promise<IPrediction[]>;
  findByMatch(matchId: string): Promise<IPrediction[]>;
  create(predictionData: Partial<IPrediction>): Promise<IPrediction>;
  update(
    id: string,
    predictionData: Partial<IPrediction>
  ): Promise<IPrediction>;
  calculatePoints(
    prediction: IPrediction,
    actualResult: { homeScore: number; awayScore: number }
  ): number;
}
