export type OneXTwo = '1' | 'X' | '2';
export type ResultCode = OneXTwo;

export interface Last5ItemDto {
  fixtureId: number;
  code: ResultCode;
  predicted: ResultCode | null; // user prediction if exists
  correct: boolean | null; // null when no prediction
}

export interface MatchCardKickoffDto {
  iso: string; // ISO string of kickoff time
  display: string; // preformatted Europe/Rome display, e.g., "sab 19/08 – 20:30"
}

export interface MatchCardTeamHomeDto {
  name: string;
  logo: string | null;
  winRateHome: number | null; // percentage 0-100 or null when no data
  last5: OneXTwo[]; // most recent first, up to 5, values in {'1','X','2'}
  standingsPosition?: number | null; // null for week 1 or no data
  form?: Last5ItemDto[]; // enriched last5 with user overlay
}

export interface MatchCardTeamAwayDto {
  name: string;
  logo: string | null;
  winRateAway: number | null; // percentage 0-100 or null when no data
  last5: OneXTwo[]; // most recent first, up to 5, values in {'1','X','2'}
  standingsPosition?: number | null; // null for week 1 or no data
  form?: Last5ItemDto[]; // enriched last5 with user overlay
}

export interface MatchCardDto {
  week: number;
  fixtureId: number;
  kickoff: MatchCardKickoffDto;
  stadium: string | null;
  home: MatchCardTeamHomeDto;
  away: MatchCardTeamAwayDto;
}
