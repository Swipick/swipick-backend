export declare class MatchDto {
    id: string;
    homeTeam: string;
    awayTeam: string;
    kickoffTime: Date;
    competition: string;
    status: "scheduled" | "live" | "finished";
    homeScore?: number;
    awayScore?: number;
}
export declare class CreateMatchDto {
    homeTeam: string;
    awayTeam: string;
    kickoffTime: Date;
    competition: string;
}
export declare class UpdateMatchDto {
    status?: "scheduled" | "live" | "finished";
    homeScore?: number;
    awayScore?: number;
}
