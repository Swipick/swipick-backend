import { Exclude, Expose, Transform } from 'class-transformer';
import { AuthProvider } from '../../../entities/user.entity';

export class UserResponseDto {
  @Expose()
  id!: string;

  @Expose()
  @Transform(({ obj }) => obj.firebaseUid)
  firebaseUid!: string;

  @Expose()
  email!: string;

  @Expose()
  name!: string;

  @Expose()
  nickname!: string | null;

  @Expose()
  @Transform(({ obj }) => obj.authProvider)
  authProvider!: AuthProvider;

  @Expose()
  @Transform(({ obj }) => obj.googleProfileUrl)
  googleProfileUrl?: string | null;

  @Expose()
  @Transform(({ obj }) => obj.isActive)
  isActive!: boolean;

  @Expose()
  @Transform(({ obj }) => obj.emailVerified)
  emailVerified!: boolean;

  @Expose()
  @Transform(({ obj }) => obj.profileCompleted)
  profileCompleted!: boolean;

  @Expose()
  @Transform(({ obj }) => obj.createdAt)
  createdAt!: Date;

  @Expose()
  @Transform(({ obj }) => obj.updatedAt)
  updatedAt!: Date;

  /**
   * Only set on registration: whether the verification email was actually sent.
   * false means the account exists but the email failed (e.g. Firebase throttle)
   * and the user should be prompted to resend.
   */
  @Expose()
  verificationEmailSent?: boolean;

  // Exclude sensitive data
  @Exclude()
  passwordHash?: string | null;

  /**
   * Computed property for display name
   */
  @Expose()
  get displayName(): string {
    return this.nickname || this.name;
  }

  /**
   * Check if user needs profile completion (Google and Apple OAuth users)
   */
  @Expose()
  get needsProfileCompletion(): boolean {
    return (
      (this.authProvider === AuthProvider.GOOGLE ||
        this.authProvider === AuthProvider.APPLE) &&
      !this.profileCompleted
    );
  }
}
