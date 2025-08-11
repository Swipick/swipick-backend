import { IsNotEmpty, IsString } from 'class-validator';

export class GoogleSyncUserDto {
  @IsNotEmpty({ message: 'Il token Firebase è obbligatorio' })
  @IsString({ message: 'Il token Firebase deve essere una stringa' })
  firebaseIdToken!: string;
}
