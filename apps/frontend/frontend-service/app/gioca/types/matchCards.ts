/**
 * Match Card types for the Gioca page
 * Contains types for the enriched match data with statistics
 */

export interface MatchCardKickoff { 
  iso: string; 
  display: string; 
}

export interface Last5Item {
  fixtureId: number | string;
  code: '1' | 'X' | '2';
  // Optional: user prediction metadata (when applicable)
  predicted: '1' | 'X' | '2' | null;
  correct: boolean | null;
  // Optional: backend-provided, team-perspective outcome for this historical item
  // 'W' = team won, 'D' = draw, 'L' = team lost
  outcome?: 'W' | 'D' | 'L' | null;
  // Whether this team was the home side in that specific historical match
  wasHome: boolean;
}

export interface MatchCardTeamHome { 
  name: string; 
  logo: string | null; 
  winRateHome: number | null; 
  last5: Array<'1' | 'X' | '2'>; 
  standingsPosition?: number | null; 
  form?: Last5Item[]; 
}

export interface MatchCardTeamAway { 
  name: string; 
  logo: string | null; 
  winRateAway: number | null; 
  last5: Array<'1' | 'X' | '2'>; 
  standingsPosition?: number | null; 
  form?: Last5Item[]; 
}

export interface MatchCard { 
  week: number; 
  fixtureId: number; 
  kickoff: MatchCardKickoff; 
  stadium: string | null; 
  home: MatchCardTeamHome; 
  away: MatchCardTeamAway; 
}

// Type aliases for common prediction values
export type PredictionChoice = '1' | 'X' | '2';
export type PredictionResult = PredictionChoice | 'SKIP';
export type PredictionRecord = Record<number, PredictionChoice>;