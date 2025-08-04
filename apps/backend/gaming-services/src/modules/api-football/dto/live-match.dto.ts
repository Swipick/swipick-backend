import { IsNumber, IsArray, IsObject } from "class-validator";
import { FixtureResponseDto } from "./fixture.dto";

export class LiveMatchUpdateDto extends FixtureResponseDto {
  @IsArray()
  events: Array<{
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
  }>;

  @IsArray()
  @IsObject({ each: true })
  statistics?: Array<{
    team: {
      id: number;
      name: string;
      logo: string;
    };
    statistics: Array<{
      type: string;
      value: string | number;
    }>;
  }>;
}

export class WebSocketMatchUpdateDto {
  @IsNumber()
  fixtureId: number;

  @IsObject()
  match: LiveMatchUpdateDto;

  @IsNumber()
  timestamp: number;
}
