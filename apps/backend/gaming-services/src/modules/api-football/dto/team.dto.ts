import { IsNumber, IsOptional, IsString, IsBoolean } from "class-validator";

export class GetTeamsDto {
  @IsOptional()
  @IsNumber()
  id?: number;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  league?: number;

  @IsOptional()
  @IsNumber()
  season?: number;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsNumber()
  venue?: number;

  @IsOptional()
  @IsString()
  search?: string;
}

export class TeamResponseDto {
  @IsNumber()
  id: number;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsString()
  country: string;

  @IsOptional()
  @IsNumber()
  founded?: number;

  @IsBoolean()
  national: boolean;

  @IsString()
  logo: string;

  @IsOptional()
  venue?: {
    id: number;
    name: string;
    address?: string;
    city: string;
    capacity: number;
    surface: string;
    image?: string;
  };
}
