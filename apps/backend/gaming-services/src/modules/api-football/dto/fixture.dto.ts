import { IsDateString, IsNumber, IsOptional, IsString } from "class-validator";

export class GetFixturesDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsNumber()
  league?: number;

  @IsOptional()
  @IsNumber()
  season?: number;

  @IsOptional()
  @IsNumber()
  team?: number;

  @IsOptional()
  @IsString()
  h2h?: string;

  @IsOptional()
  @IsString()
  live?: string;

  @IsOptional()
  @IsNumber()
  fixture?: number;
}

export class FixtureResponseDto {
  @IsNumber()
  id: number;

  @IsString()
  referee?: string;

  @IsString()
  timezone: string;

  @IsDateString()
  date: string;

  @IsNumber()
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
  };
}
