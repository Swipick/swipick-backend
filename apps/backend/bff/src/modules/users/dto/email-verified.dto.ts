import { IsBoolean } from 'class-validator';

export class EmailVerifiedDto {
  @IsBoolean()
  emailVerified!: boolean;
}
