import { IsString, IsNotEmpty, Length } from 'class-validator';
import { Transform } from 'class-transformer';

export class RenameLeagueDto {
  @IsNotEmpty({ message: 'Il nome della lega è obbligatorio' })
  @IsString({ message: 'Il nome deve essere una stringa' })
  @Transform(({ value }) => value?.trim().replace(/\s+/g, ' '))
  @Length(3, 40, { message: 'Il nome deve essere tra 3 e 40 caratteri' })
  name!: string;
}
