import { IsString, IsIn, IsUUID, IsNotEmpty } from 'class-validator';

export const GAME_MODES = ['live', 'test'] as const;
export type GameMode = typeof GAME_MODES[number];

export const PREDICTION_CHOICES = ['1', 'X', '2'] as const;
export type PredictionChoice = typeof PREDICTION_CHOICES[number];

export class CreatePredictionDto {
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  fixtureId: string;

  @IsIn(PREDICTION_CHOICES)
  @IsNotEmpty()
  choice: PredictionChoice;

  @IsIn(GAME_MODES)
  @IsNotEmpty()
  mode: GameMode;
}
