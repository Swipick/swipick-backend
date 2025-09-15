/**
 * Fixture-related types for the Gioca page
 * Extracted from the main component for better organization
 */

export interface Team {
  id: number;
  name: string;
  logo: string;
  winner?: boolean;
}

export interface Fixture {
  id: number;
  date: string;
  timestamp: number;
  venue: {
    id: number;
    name: string;
    city: string;
  };
  status: {
    long: string;
    short: string;
    elapsed?: number;
  };
  league: {
    id: number;
    name: string;
    country: string;
    logo?: string;
    season: number;
    round: string;
  };
  teams: {
    home: Team;
    away: Team;
  };
  goals: {
    home?: number;
    away?: number;
  };
  score: {
    halftime: {
      home?: number;
      away?: number;
    };
    fulltime: {
      home?: number;
      away?: number;
    };
  };
}

// Shape returned by Test Mode API (backend)
export interface TestFixtureAPI {
  id?: number;
  week?: number;
  date: string | number | Date;
  homeTeam: string;
  awayTeam: string;
  homeScore?: number;
  awayScore?: number;
  status?: string;
  stadium?: string | null;
}

// Raw API fixture data structure (from external APIs like API-Football)
export interface RawFixtureData {
  id?: number;
  date?: string | number | Date;
  timestamp?: number;
  venue?: {
    id?: number;
    name?: string;
    city?: string;
  };
  status?: {
    long?: string;
    short?: string;
    elapsed?: number;
  };
  league?: {
    id?: number;
    name?: string;
    country?: string;
    logo?: string;
    season?: number;
    round?: string;
  };
  teams?: {
    home?: {
      id?: number;
      name?: string;
      logo?: string;
    };
    away?: {
      id?: number;
      name?: string;
      logo?: string;
    };
  };
  goals?: {
    home?: number;
    away?: number;
  };
  score?: {
    halftime?: {
      home?: number;
      away?: number;
    };
    fulltime?: {
      home?: number;
      away?: number;
    };
  };
}

// Database fixture data structure (from database/BFF)
export interface DatabaseFixture {
  id: number;
  match_date: string;
  home_team: string;
  away_team: string;
  week?: number;
  stadium?: string;
  status?: string;
  home_score?: number;
  away_score?: number;
}

// Type guards for runtime type checking
export function isTestFixture(obj: unknown): obj is TestFixtureAPI {
  if (typeof obj !== 'object' || obj === null) return false;
  const o = obj as Record<string, unknown>;
  return (
    typeof o.homeTeam === 'string' &&
    typeof o.awayTeam === 'string' &&
    ('date' in o)
  );
}

export function isTestFixtureArray(arr: unknown): arr is TestFixtureAPI[] {
  return Array.isArray(arr) && arr.every(isTestFixture);
}