import {
  IsString,
  Length,
  Matches,
  IsNotEmpty,
  IsOptional,
  IsObject,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CompleteProfileDto {
  @IsNotEmpty({ message: 'Il nickname è obbligatorio' })
  @IsString({ message: 'Il nickname deve essere una stringa' })
  @Length(3, 50, { message: 'Il nickname deve essere tra 3 e 50 caratteri' })
  @Transform(({ value }) => value?.trim().toLowerCase())
  @Matches(/^[a-z0-9_]+$/, {
    message:
      'Il nickname può contenere solo lettere minuscole, numeri e underscore',
  })
  nickname!: string;

  @IsOptional()
  @IsObject({ message: 'Le preferenze devono essere un oggetto' })
  preferences?: Record<string, any>;
}
