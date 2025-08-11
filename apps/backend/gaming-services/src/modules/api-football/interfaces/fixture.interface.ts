export interface Fixture {
  id: number;
  referee?: string;
  timezone: string;
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
    home: {
      id: number;
      name: string;
      logo: string;
      winner?: boolean;
    };
    away: {
      id: number;
      name: string;
      logo: string;
      winner?: boolean;
    };
  };
  goals: {
    home: number;
    away: number;
  };
  score: {
    halftime: {
      home: number;
      away: number;
    };
    fulltime: {
      home: number;
      away: number;
    };
    extratime?: {
      home: number;
      away: number;
    };
    penalty?: {
      home: number;
      away: number;
    };
  };
}

export interface LiveMatch extends Fixture {
  events: MatchEvent[];
}

export interface MatchEvent {
  time: {
    elapsed: number;
    extra?: number;
  };
  team: {
    id: number;
    name: string;
    logo: string;
  };
  player: {
    id: number;
    name: string;
  };
  assist?: {
    id: number;
    name: string;
  };
  type: string;
  detail: string;
  comments?: string;
}
