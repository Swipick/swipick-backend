import { IsUUID } from 'class-validator';

export class TransferOwnerDto {
  @IsUUID('4', { message: 'Membro non valido' })
  userId!: string;
}
