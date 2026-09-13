import { IsString, Length, Matches, IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Cambio del nickname dalle impostazioni.
 * Stesse regole della scelta iniziale: e' lo stesso campo, cambia solo il
 * momento in cui lo si tocca.
 */
export class UpdateNicknameDto {
  @IsNotEmpty({ message: 'Il nickname è obbligatorio' })
  @IsString({ message: 'Il nickname deve essere una stringa' })
  @Length(3, 50, { message: 'Il nickname deve essere tra 3 e 50 caratteri' })
  @Transform(({ value }) => value?.trim().toLowerCase())
  @Matches(/^[a-z0-9_]+$/, {
    message:
      'Il nickname può contenere solo lettere minuscole, numeri e underscore',
  })
  nickname!: string;
}
