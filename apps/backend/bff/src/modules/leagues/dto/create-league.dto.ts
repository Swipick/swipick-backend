import { IsString, IsNotEmpty, Length } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Creazione di una lega.
 *
 * Nessun campionato da scegliere: l'app segue solo la Serie A, e il server
 * mette il 135 da se'. Il giorno in cui ce ne sarà più d'uno questo DTO
 * crescera' di un campo, e le leghe già create avranno comunque il loro.
 */
export class CreateLeagueDto {
  @IsNotEmpty({ message: 'Il nome della lega è obbligatorio' })
  @IsString({ message: 'Il nome deve essere una stringa' })
  @Transform(({ value }) => value?.trim().replace(/\s+/g, ' '))
  @Length(3, 40, { message: 'Il nome deve essere tra 3 e 40 caratteri' })
  name!: string;
}
