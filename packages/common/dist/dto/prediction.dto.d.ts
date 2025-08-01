export declare class PredictionDto {
    id: string;
    userId: string;
    matchId: string;
    homeScore: number;
    awayScore: number;
    points?: number;
    createdAt: Date;
}
export declare class CreatePredictionDto {
    matchId: string;
    homeScore: number;
    awayScore: number;
}
export declare class UpdatePredictionDto {
    homeScore?: number;
    awayScore?: number;
}
