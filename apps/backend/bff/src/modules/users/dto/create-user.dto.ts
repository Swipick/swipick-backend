import {
  IsEmail,
  IsString,
  Length,
  Matches,
  IsNotEmpty,
  IsOptional,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateUserDto {
  // Facoltativi entrambi: la registrazione chiede solo email e password, e il
  // nickname arriva al passo successivo. Restano validati quando ci sono.
  @IsOptional()
  @IsString({ message: 'Il nome deve essere una stringa' })
  @Length(2, 100, { message: 'Il nome deve essere tra 2 e 100 caratteri' })
  @Transform(({ value }) => value?.trim())
  @Matches(/^[a-zA-ZÀ-ÿ\s'.-]+$/, {
    message: 'Il nome può contenere solo lettere, spazi, apostrofi e punti',
  })
  name?: string;

  @IsOptional()
  @IsString({ message: 'Il nickname deve essere una stringa' })
  @Length(3, 50, { message: 'Il nickname deve essere tra 3 e 50 caratteri' })
  @Transform(({ value }) => value?.trim().toLowerCase())
  @Matches(/^[a-z0-9_]+$/, {
    message:
      'Il nickname può contenere solo lettere minuscole, numeri e underscore',
  })
  nickname?: string;

  @IsNotEmpty({ message: "L'email è obbligatoria" })
  @IsEmail({}, { message: 'Inserisci un indirizzo email valido' })
  @Transform(({ value }) => value?.trim().toLowerCase())
  email!: string;

  @IsNotEmpty({ message: 'La password è obbligatoria' })
  @IsString({ message: 'La password deve essere una stringa' })
  @Length(8, 128, { message: 'La password deve essere tra 8 e 128 caratteri' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message:
      'La password deve contenere almeno una lettera minuscola, una maiuscola e un numero',
  })
  password!: string;
}
