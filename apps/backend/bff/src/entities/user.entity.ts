import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum AuthProvider {
  EMAIL = 'email',
  GOOGLE = 'google',
}

@Entity('users')
@Index(['firebaseUid'], { unique: true })
@Index(['email'], { unique: true })
@Index(['nickname'], { unique: true, where: 'nickname IS NOT NULL' })
@Index(['authProvider'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true, length: 128, name: 'firebase_uid' })
  firebaseUid!: string;

  @Column({ unique: true, length: 255 })
  email!: string;

  @Column({ length: 100 })
  name!: string;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
    unique: true,
    comment: "Nullable for Google users who haven't completed profile",
  })
  nickname!: string | null;

  @Column({
    type: 'varchar',
    nullable: true,
    length: 255,
    name: 'password_hash',
    comment: 'Null for Google OAuth users',
  })
  passwordHash!: string | null;

  @Column({
    type: 'enum',
    enum: AuthProvider,
    default: AuthProvider.EMAIL,
    name: 'auth_provider',
  })
  authProvider!: AuthProvider;

  @Column({
    nullable: true,
    type: 'text',
    name: 'google_profile_url',
    comment: 'Google profile picture URL',
  })
  googleProfileUrl!: string | null;

  @Column({ default: true, name: 'is_active' })
  isActive!: boolean;

  @Column({ default: false, name: 'email_verified' })
  emailVerified!: boolean;

  @Column({
    default: false,
    name: 'profile_completed',
    comment: 'Track if Google users completed profile setup',
  })
  profileCompleted!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  /**
   * Check if this is a Google OAuth user
   */
  isGoogleUser(): boolean {
    return this.authProvider === AuthProvider.GOOGLE;
  }

  /**
   * Check if this is a traditional email/password user
   */
  isEmailUser(): boolean {
    return this.authProvider === AuthProvider.EMAIL;
  }

  /**
   * Check if the user needs to complete their profile
   */
  needsProfileCompletion(): boolean {
    return this.isGoogleUser() && !this.profileCompleted;
  }

  /**
   * Get user's display name (nickname or name)
   */
  getDisplayName(): string {
    return this.nickname || this.name;
  }
}
