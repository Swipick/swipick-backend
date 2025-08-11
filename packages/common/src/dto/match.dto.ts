export class MatchDto {
  id!: string;
  homeTeam!: string;
  awayTeam!: string;
  kickoffTime!: Date;
  competition!: string;
  status!: "scheduled" | "live" | "finished";
  homeScore?: number;
  awayScore?: number;
}

export class CreateMatchDto {
  homeTeam!: string;
  awayTeam!: string;
  kickoffTime!: Date;
  competition!: string;
}

export class UpdateMatchDto {
  status?: "scheduled" | "live" | "finished";
  homeScore?: number;
  awayScore?: number;
}
