export interface IMatch {
  id: string;
  homeTeam: string;
  awayTeam: string;
  kickoffTime: Date;
  competition: string;
  status: "scheduled" | "live" | "finished";
  homeScore?: number;
  awayScore?: number;
  apiFootballId?: string;
}

export interface IMatchService {
  findById(id: string): Promise<IMatch | null>;
  findUpcoming(): Promise<IMatch[]>;
  findByCompetition(competition: string): Promise<IMatch[]>;
  create(matchData: Partial<IMatch>): Promise<IMatch>;
  update(id: string, matchData: Partial<IMatch>): Promise<IMatch>;
}
