export class PredictionDto {
  id!: string;
  userId!: string;
  matchId!: string;
  homeScore!: number;
  awayScore!: number;
  points?: number;
  createdAt!: Date;
}

export class CreatePredictionDto {
  matchId!: string;
  homeScore!: number;
  awayScore!: number;
}

export class UpdatePredictionDto {
  homeScore?: number;
  awayScore?: number;
}
