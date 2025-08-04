import { Fixture, MatchEvent } from "./fixture.interface";

export interface LiveMatchUpdate extends Fixture {
  events: MatchEvent[];
  statistics?: MatchStatistics[];
  lineups?: MatchLineup[];
}

export interface MatchStatistics {
  team: {
    id: number;
    name: string;
    logo: string;
  };
  statistics: Array<{
    type: string;
    value: string | number;
  }>;
}

export interface MatchLineup {
  team: {
    id: number;
    name: string;
    logo: string;
    colors: {
      player: {
        primary: string;
        number: string;
        border: string;
      };
      goalkeeper: {
        primary: string;
        number: string;
        border: string;
      };
    };
  };
  coach: {
    id: number;
    name: string;
    photo: string;
  };
  formation: string;
  startXI: Array<{
    player: {
      id: number;
      name: string;
      number: number;
      pos: string;
      grid?: string;
    };
  }>;
  substitutes: Array<{
    player: {
      id: number;
      name: string;
      number: number;
      pos: string;
      grid?: string;
    };
  }>;
}
