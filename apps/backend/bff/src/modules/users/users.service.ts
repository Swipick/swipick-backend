import {
  Injectable,
  Logger,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { User, AuthProvider } from '../../entities/user.entity';
import { FirebaseConfigService } from '../../config/firebase.config';
import { EmailService } from '../../services/email.service';
import { NotificationPreferences } from '../../entities/notification-preferences.entity';
import { UserAvatar } from '../../entities/user-avatar.entity';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import {
  CreateUserDto,
  GoogleSyncUserDto,
  AppleSyncUserDto,
  CompleteProfileDto,
  UserResponseDto,
} from './dto';
import { plainToClass } from 'class-transformer';
import type { auth as adminAuth } from 'firebase-admin';

export interface GoogleUserData {
  uid: string;
  email: string;
  name: string;
  picture?: string;
  emailVerified: boolean;
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  private readonly gamingServicesUrl: string;

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(NotificationPreferences)
    private prefsRepository: Repository<NotificationPreferences>,
    @InjectRepository(UserAvatar)
    private avatarRepository: Repository<UserAvatar>,
    private dataSource: DataSource,
    private firebaseConfig: FirebaseConfigService,
    private emailService: EmailService,
    private httpService: HttpService,
    private configService: ConfigService,
  ) {
    this.logger.log('🔧 UsersService initialized');
    this.logger.log(`📧 EmailService available: ${!!this.emailService}`);
    this.gamingServicesUrl = (
      this.configService.get<string>('GAMING_SERVICES_URL', '') || ''
    ).replace(/\/+$/, '');
  }

  /**

  /**
   * Traditional email/password registration
   */
  async createUser(createUserDto: CreateUserDto): Promise<UserResponseDto> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    // Track del solo uid creato in QUESTO flusso: il rollback non deve mai
    // cancellare un account Firebase pre-esistente con la stessa email.
    let createdFirebaseUid: string | null = null;

    try {
      // Check if email already exists
      await this.checkEmailUniqueness(createUserDto.email);

      // Check if nickname already exists
      await this.checkNicknameUniqueness(createUserDto.nickname);

      // Create Firebase user first
      const firebaseUser = await this.firebaseConfig.createUser(
        createUserDto.email,
        createUserDto.password,
        createUserDto.name,
      );
      createdFirebaseUid = firebaseUser.uid;

      // Create database user.
      // passwordHash: null — Firebase è l'unico proprietario delle credenziali;
      // un hash locale sarebbe un secondo store mai verificato e da proteggere.
      const user = queryRunner.manager.create(User, {
        firebaseUid: firebaseUser.uid,
        email: createUserDto.email,
        name: createUserDto.name,
        nickname: createUserDto.nickname,
        passwordHash: null,
        authProvider: AuthProvider.EMAIL,
        emailVerified: false,
        profileCompleted: true, // Traditional users complete profile during registration
      });

      const savedUser = await queryRunner.manager.save(User, user);
      await queryRunner.commitTransaction();

      // Send custom verification email via Resend
      this.logger.log('🚀 Starting email verification process...');
      try {
        this.logger.log('📧 Generating Firebase verification link...');
        const verificationLink =
          await this.firebaseConfig.generateEmailVerificationLink(
            createUserDto.email,
          );

        this.logger.log(
          `🔗 Firebase verification link generated: ${verificationLink}`,
        );
        this.logger.log('📤 Calling EmailService.sendVerificationEmail...');

        await this.emailService.sendVerificationEmail(
          createUserDto.email,
          createUserDto.name,
          verificationLink,
        );

        this.logger.log(
          `✅ Verification email sent successfully to ${createUserDto.email}`,
        );
      } catch (emailError) {
        this.logger.error(
          `❌ Failed to send verification email to ${createUserDto.email}`,
          emailError,
        );
        this.logger.error(
          '📊 Email error details:',
          JSON.stringify(emailError, null, 2),
        );
        // Don't fail the registration if email fails - user is created successfully
      }

      this.logger.log(`Traditional user created successfully: ${savedUser.id}`);
      return this.transformToResponse(savedUser);
    } catch (error) {
      await queryRunner.rollbackTransaction();

      // Rollback compensativo: SOLO l'utente Firebase creato in questo flusso.
      // Mai cercare per email — cancellerebbe account legittimi pre-esistenti.
      if (createdFirebaseUid) {
        try {
          await this.firebaseConfig.deleteUser(createdFirebaseUid);
        } catch (cleanupError) {
          this.logger.error(
            `Failed to cleanup Firebase user ${createdFirebaseUid} after database error`,
            cleanupError,
          );
        }
      }

      this.handleRegistrationError(error);
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Email user synchronization - syncs emailVerified status from Firebase
   */
  async syncEmailUser(firebaseIdToken: string): Promise<UserResponseDto> {
    try {
      // Verify Firebase token
      const decodedToken =
        await this.firebaseConfig.verifyIdToken(firebaseIdToken);

      // Find user by Firebase UID
      const user = await this.userRepository.findOne({
        where: { firebaseUid: decodedToken.uid },
      });

      if (!user) {
        throw new NotFoundException('Utente non trovato');
      }

      // Update emailVerified from Firebase token
      user.emailVerified = decodedToken.email_verified ?? false;
      user.updatedAt = new Date();

      const savedUser = await this.userRepository.save(user);
      this.logger.log(
        `Email user synced: ${savedUser.id}, emailVerified: ${savedUser.emailVerified}`,
      );

      return this.transformToResponse(savedUser);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error('Failed to sync email user', error);
      throw new BadRequestException(
        'Errore durante la sincronizzazione utente',
      );
    }
  }

  /**
   * Google OAuth user synchronization
   */
  async syncGoogleUser(
    googleSyncDto: GoogleSyncUserDto,
  ): Promise<UserResponseDto> {
    this.logger.log('🟢 [UsersService] syncGoogleUser called');
    try {
      // Verify Firebase token and extract user data
      this.logger.log('🟢 [UsersService] Verifying Firebase ID token...');
      const decodedToken = await this.firebaseConfig.verifyIdToken(
        googleSyncDto.firebaseIdToken,
      );
      this.logger.log(
        `🟢 [UsersService] Token verified - Firebase UID: ${decodedToken.uid}`,
      );

      const googleUserData = this.extractGoogleUserData(decodedToken);
      this.logger.log(
        `🟢 [UsersService] Extracted user data - Email: ${googleUserData.email}, Name: ${googleUserData.name}`,
      );

      // Check if user already exists
      this.logger.log(
        `🟢 [UsersService] Checking if user exists with Firebase UID: ${googleUserData.uid}`,
      );
      let user = await this.userRepository.findOne({
        where: { firebaseUid: googleUserData.uid },
      });

      if (user) {
        // Update existing user's last login
        this.logger.log(
          `🟢 [UsersService] Existing user found - ID: ${user.id}, Email: ${user.email}`,
        );
        user.updatedAt = new Date();
        await this.userRepository.save(user);
        this.logger.log(
          `🟢 [UsersService] Existing Google user login successful: ${user.id}`,
        );
      } else {
        // Create new Google user
        this.logger.log(
          '🟢 [UsersService] User not found, creating new Google user...',
        );
        user = await this.createGoogleUser(googleUserData);
        this.logger.log(
          `🟢 [UsersService] New Google user created: ${user.id}`,
        );
      }

      this.logger.log('🟢 [UsersService] Transforming user to response DTO');
      return this.transformToResponse(user);
    } catch (error) {
      this.logger.error('🔴 [UsersService] Failed to sync Google user', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`🔴 [UsersService] Error details: ${errorMessage}`);
      throw new BadRequestException(
        'Errore durante la sincronizzazione con Google',
      );
    }
  }

  /**
   * Apple Sign-In user synchronization
   */
  async syncAppleUser(
    appleSyncDto: AppleSyncUserDto,
  ): Promise<UserResponseDto> {
    this.logger.log('🍎 [UsersService] syncAppleUser called');
    try {
      const decodedToken = await this.firebaseConfig.verifyIdToken(
        appleSyncDto.firebaseIdToken,
      );
      this.logger.log(
        `🍎 [UsersService] Token verified - Firebase UID: ${decodedToken.uid}`,
      );

      let user = await this.userRepository.findOne({
        where: { firebaseUid: decodedToken.uid },
      });

      if (user) {
        user.updatedAt = new Date();
        await this.userRepository.save(user);
        this.logger.log(
          `🍎 [UsersService] Existing Apple user login: ${user.id}`,
        );
      } else {
        const name =
          decodedToken.name ||
          (decodedToken.email
            ? decodedToken.email.split('@')[0]
            : 'Apple User');

        user = this.userRepository.create({
          firebaseUid: decodedToken.uid,
          email: decodedToken.email,
          name,
          nickname: null,
          passwordHash: null,
          authProvider: AuthProvider.APPLE,
          appleSubjectId: decodedToken.uid,
          googleProfileUrl: null,
          emailVerified: decodedToken.email_verified ?? true,
          profileCompleted: false,
        });
        user = await this.userRepository.save(user);
        this.logger.log(`🍎 [UsersService] New Apple user created: ${user.id}`);
      }

      return this.transformToResponse(user);
    } catch (error) {
      this.logger.error('🔴 [UsersService] Failed to sync Apple user', error);
      throw new BadRequestException(
        'Errore durante la sincronizzazione con Apple',
      );
    }
  }

  /**
   * Complete profile for Google users
   */
  async completeProfile(
    userId: string,
    completeProfileDto: CompleteProfileDto,
  ): Promise<UserResponseDto> {
    try {
      const user = await this.userRepository.findOne({ where: { id: userId } });

      if (!user) {
        throw new NotFoundException('Utente non trovato');
      }

      if (!user.isGoogleUser() && !user.isAppleUser()) {
        throw new BadRequestException(
          'Solo gli utenti social possono completare il profilo',
        );
      }

      if (user.profileCompleted) {
        throw new BadRequestException('Il profilo è già stato completato');
      }

      // Check nickname uniqueness
      await this.checkNicknameUniqueness(completeProfileDto.nickname);

      // Update user profile
      user.nickname = completeProfileDto.nickname;
      user.profileCompleted = true;

      // Update Firebase display name
      const displayName = completeProfileDto.nickname;
      await this.firebaseConfig.updateUserDisplayName(
        user.firebaseUid,
        displayName,
      );

      const savedUser = await this.userRepository.save(user);
      this.logger.log(`Google user profile completed: ${savedUser.id}`);

      return this.transformToResponse(savedUser);
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      this.logger.error('Failed to complete user profile', error);
      throw new BadRequestException(
        'Errore durante il completamento del profilo',
      );
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(id: string): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('Utente non trovato');
    }
    return this.transformToResponse(user);
  }

  /**
   * Get user by Firebase UID
   */
  async getUserByFirebaseUid(firebaseUid: string): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({ where: { firebaseUid } });
    if (!user) {
      throw new NotFoundException('Utente non trovato');
    }
    return this.transformToResponse(user);
  }

  // Private helper methods
  private async createGoogleUser(
    googleUserData: GoogleUserData,
  ): Promise<User> {
    const user = this.userRepository.create({
      firebaseUid: googleUserData.uid,
      email: googleUserData.email,
      name: googleUserData.name,
      nickname: null, // Will be set during profile completion
      passwordHash: null, // Google users don't have passwords
      authProvider: AuthProvider.GOOGLE,
      googleProfileUrl: googleUserData.picture,
      emailVerified: googleUserData.emailVerified,
      profileCompleted: false, // Needs nickname selection
    });

    return await this.userRepository.save(user);
  }

  private extractGoogleUserData(
    decodedToken: adminAuth.DecodedIdToken,
  ): GoogleUserData {
    const email = decodedToken.email ?? '';
    return {
      uid: decodedToken.uid,
      email,
      name: decodedToken.name || email.split('@')[0],
      picture: decodedToken.picture,
      emailVerified: decodedToken.email_verified || false,
    };
  }

  private async checkEmailUniqueness(email: string): Promise<void> {
    const existingUser = await this.userRepository.findOne({
      where: { email },
    });
    if (existingUser) {
      throw new ConflictException('Un utente con questa email esiste già');
    }
  }

  private async checkNicknameUniqueness(nickname: string): Promise<void> {
    const existingUser = await this.userRepository.findOne({
      where: { nickname },
    });
    if (existingUser) {
      throw new ConflictException('Questo nickname è già in uso');
    }
  }

  private transformToResponse(user: User): UserResponseDto {
    return plainToClass(UserResponseDto, user, {
      excludeExtraneousValues: true,
    });
  }

  /**
   * Aggregate profile KPIs server-side using the existing summary endpoint.
   */
  async getProfileKpis(userId: string): Promise<{
    averageAccuracy: number;
    weeksPlayed: number;
    bestWeek: number;
    bestWeekNumber: number;
    worstWeek: number;
    worstWeekNumber: number;
  }> {
    // Fetch live summary from gaming services
    const url = `${this.gamingServicesUrl}/api/predictions/user/${userId}/summary`;
    const resp = await firstValueFrom(this.httpService.get(url));
    const summary = resp.data;

    const weekly: Array<{
      week: number;
      totalPredictions: number;
      correctPredictions: number;
      accuracy: number;
      points?: number;
    }> = Array.isArray(summary?.data?.weeklyStats)
      ? summary.data.weeklyStats
      : Array.isArray(summary?.weeklyStats)
        ? summary.weeklyStats
        : [];

    const played = weekly.filter((w) => Number(w.totalPredictions) > 0);
    const weeksPlayed = played.length;
    const averageAccuracy = Number(
      (summary?.data?.overallAccuracy ?? summary?.overallAccuracy ?? 0) || 0,
    );
    const best = played.reduce((a, b) => (b.accuracy > a.accuracy ? b : a), {
      week: 1,
      totalPredictions: 0,
      correctPredictions: 0,
      accuracy: 0,
    });
    const worst = played.reduce((a, b) => (b.accuracy < a.accuracy ? b : a), {
      week: 1,
      totalPredictions: 0,
      correctPredictions: 0,
      accuracy: 0,
    });

    return {
      averageAccuracy,
      weeksPlayed,
      bestWeek: Number(best.accuracy || 0),
      bestWeekNumber: Number(best.week || 1),
      worstWeek: Number(worst.accuracy || 0),
      worstWeekNumber: Number(worst.week || 1),
    };
  }

  /** Preferences: get or create defaults */
  async getPreferences(userId: string): Promise<NotificationPreferences> {
    let prefs = await this.prefsRepository.findOne({ where: { userId } });
    if (!prefs) {
      prefs = this.prefsRepository.create({
        userId,
        results: true,
        matches: true,
        goals: true,
      });
      prefs = await this.prefsRepository.save(prefs);
    }
    return prefs;
  }

  /** Preferences: update */
  async updatePreferences(
    userId: string,
    patch: Partial<
      Pick<NotificationPreferences, 'results' | 'matches' | 'goals'>
    >,
  ): Promise<NotificationPreferences> {
    const prefs = await this.getPreferences(userId);
    const next = { ...prefs, ...patch };
    return this.prefsRepository.save(next);
  }

  /**
   * Update user's emailVerified flag
   */
  async updateEmailVerified(
    userId: string,
    emailVerified: boolean,
  ): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Utente non trovato');
    }
    user.emailVerified = emailVerified;
    const saved = await this.userRepository.save(user);
    this.logger.log(
      `Email verification updated for user ${userId}: ${emailVerified}`,
    );
    return this.transformToResponse(saved);
  }

  /**
   * Update user's avatar URL (stored in googleProfileUrl for now)
   */
  async updateAvatarUrl(userId: string, url: string): Promise<UserResponseDto> {
    // Basic URL validation and https enforcement
    try {
      const u = new URL(url);
      if (u.protocol !== 'https:') {
        throw new BadRequestException('URL immagine deve usare HTTPS');
      }
    } catch {
      throw new BadRequestException('URL immagine non valido');
    }
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Utente non trovato');
    }
    user.googleProfileUrl = url;
    const saved = await this.userRepository.save(user);
    return this.transformToResponse(saved);
  }

  /** Avatar: upsert processed bytes */
  async setAvatarBytes(
    userId: string,
    mimeType: string,
    buf: Buffer,
  ): Promise<{ etag: string }> {
    if (!/^image\/(webp|png|jpeg)$/.test(mimeType)) {
      throw new BadRequestException('Tipo immagine non supportato');
    }
    if (buf.length <= 0 || buf.length > 4 * 1024 * 1024) {
      throw new BadRequestException('Dimensione immagine non valida (max 4MB)');
    }
    const crypto = await import('node:crypto');
    const etag = crypto.createHash('sha256').update(buf).digest('hex');
    const existing = await this.avatarRepository.findOne({ where: { userId } });
    if (existing) {
      existing.mimeType = mimeType;
      existing.size = buf.length;
      existing.bytes = buf;
      existing.etag = etag;
      await this.avatarRepository.save(existing);
    } else {
      const rec = this.avatarRepository.create({
        userId,
        mimeType,
        size: buf.length,
        bytes: buf,
        etag,
      });
      await this.avatarRepository.save(rec);
    }
    return { etag };
  }

  async getAvatar(userId: string): Promise<UserAvatar | null> {
    return this.avatarRepository.findOne({ where: { userId } });
  }

  /**
   * Presign S3/R2 upload URL (placeholder implementation)
   * Replace with actual S3 client configured with credentials if using R2/S3.
   */
  async presignAvatarUpload(
    userId: string,
  ): Promise<{ url: string; key: string }> {
    // For now, just return a dummy structure to be replaced when integrating S3/R2
    // A real implementation would use @aws-sdk/s3-request-presigner with a PutObjectCommand
    const key = `avatars/${userId}/${Date.now()}.webp`;
    const url = `https://example-upload-endpoint.invalid/${key}`;
    this.logger.warn(
      'presignAvatarUpload called without S3 integration. Returning placeholder URL.',
    );
    return { url, key };
  }

  /**
   * Send password reset email via Firebase (client-side only)
   * This method validates the user exists and provides appropriate response
   */
  async sendPasswordReset(email: string): Promise<void> {
    try {
      // Check if user exists in database
      const user = await this.userRepository.findOne({ where: { email } });

      if (!user) {
        // Don't reveal if email exists for security
        this.logger.warn(
          `Password reset attempted for non-existent email: ${email}`,
        );
        return; // Still return success to not reveal email existence
      }

      if (
        user.authProvider === AuthProvider.GOOGLE ||
        user.authProvider === AuthProvider.APPLE
      ) {
        throw new BadRequestException(
          'Gli utenti social non possono reimpostare la password. Usa il tuo metodo di accesso originale.',
        );
      }

      // Generate the reset link via Admin SDK and send our own branded email
      // (replaces Firebase's default password-reset template).
      try {
        const resetLink =
          await this.firebaseConfig.generatePasswordResetLink(email);
        await this.emailService.sendPasswordResetEmail(
          email,
          user.name,
          resetLink,
        );
        this.logger.log(`Password reset email sent to user: ${user.id}`);
      } catch (emailError) {
        // Don't leak failures to the caller: keep the neutral response so we
        // never reveal account existence. Log for diagnostics.
        this.logger.error(
          `Failed to send password reset email to ${email}`,
          emailError,
        );
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error('Failed to validate password reset request', error);
      throw new BadRequestException(
        'Errore durante la validazione del reset password',
      );
    }
  }

  /**
   * Re-send the email verification message using our own branded EmailService
   * (replaces Firebase's default verification template). Neutral on missing /
   * already-verified / social accounts so it never reveals account state.
   */
  async resendVerificationEmail(email: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { email } });

    if (!user) {
      this.logger.warn(
        `Verification resend attempted for non-existent email: ${email}`,
      );
      return;
    }

    if (user.emailVerified) {
      this.logger.log(`Verification resend skipped (already verified): ${email}`);
      return;
    }

    if (
      user.authProvider === AuthProvider.GOOGLE ||
      user.authProvider === AuthProvider.APPLE
    ) {
      this.logger.log(`Verification resend skipped (social account): ${email}`);
      return;
    }

    try {
      const verificationLink =
        await this.firebaseConfig.generateEmailVerificationLink(email);
      await this.emailService.sendVerificationEmail(
        email,
        user.name,
        verificationLink,
      );
      this.logger.log(`Verification email re-sent to user: ${user.id}`);
    } catch (emailError) {
      this.logger.error(
        `Failed to resend verification email to ${email}`,
        emailError,
      );
    }
  }

  /**
   * Sync password reset with database after Firebase reset
   * This ensures our database stays in sync with Firebase
   */
  async syncPasswordReset(firebaseUid: string): Promise<void> {
    try {
      const user = await this.userRepository.findOne({
        where: { firebaseUid },
      });

      if (!user) {
        throw new NotFoundException('Utente non trovato');
      }

      if (
        user.authProvider === AuthProvider.GOOGLE ||
        user.authProvider === AuthProvider.APPLE
      ) {
        throw new BadRequestException(
          'Gli utenti social non possono cambiare password',
        );
      }

      // Update the user's updated timestamp to reflect the password change
      user.updatedAt = new Date();

      // Clear any stored password hash since Firebase manages the password
      // Our database doesn't store the actual password for Firebase users
      user.passwordHash = null;

      await this.userRepository.save(user);

      this.logger.log(`Password reset synced for user: ${user.id}`);
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      this.logger.error('Failed to sync password reset', error);
      throw new BadRequestException(
        'Errore durante la sincronizzazione del reset password',
      );
    }
  }

  /**
   * Test email sending functionality
   */
  /**
   * TEMP DIAGNOSTIC — pinpoints why generateEmailVerificationLink fails in prod.
   * firebaseConfig.generateEmailVerificationLink swallows the real Firebase error
   * code, so here we call the Admin SDK directly with several continueUrl variants
   * and return the raw error per variant. Remove once the issue is fixed.
   */
  async diagnoseVerificationLink(
    email: string,
  ): Promise<{ email: string; results: unknown[] }> {
    const auth = this.firebaseConfig.getAuth();
    if (!auth) {
      return { email, results: [{ ok: false, message: 'Admin SDK null' }] };
    }
    const candidates: (string | undefined)[] = [
      undefined,
      'https://mindful-sparkle-production.up.railway.app/loginVerified',
      'https://www.swipick.com/loginVerified',
    ];
    const results: unknown[] = [];
    for (const url of candidates) {
      try {
        const acs = url ? { url, handleCodeInApp: false } : undefined;
        await auth.generateEmailVerificationLink(email, acs);
        results.push({ url: url ?? '(default/none)', ok: true });
      } catch (e: unknown) {
        const err = e as { code?: string; message?: string };
        results.push({
          url: url ?? '(default/none)',
          ok: false,
          code: err?.code,
          message: err?.message,
        });
      }
    }
    return { email, results };
  }

  async testEmailSending(email: string, name: string): Promise<void> {
    this.logger.log(`🧪 Testing email sending to: ${email}`);

    try {
      // Generate a test verification link
      const testLink =
        'https://mindful-sparkle-production.up.railway.app/verify-test';

      await this.emailService.sendVerificationEmail(email, name, testLink);

      this.logger.log(`✅ Test email sent successfully to: ${email}`);
    } catch (error) {
      this.logger.error(`❌ Test email failed for: ${email}`, error);
      throw error;
    }
  }

  private handleRegistrationError(error: any): never {
    // Eccezioni HTTP già specifiche (es. ConflictException dei check di
    // unicità): rilanciate intatte, il client deve sapere il motivo reale.
    if (
      error instanceof ConflictException ||
      error instanceof BadRequestException ||
      error instanceof NotFoundException
    ) {
      throw error;
    }

    if (error.code === '23505') {
      // PostgreSQL unique constraint violation
      if (error.constraint?.includes('email')) {
        throw new ConflictException('Un utente con questa email esiste già');
      }
      if (error.constraint?.includes('nickname')) {
        throw new ConflictException('Questo nickname è già in uso');
      }
    }

    this.logger.error('Registration error', error);
    throw new BadRequestException(
      "Errore durante la registrazione dell'utente",
    );
  }

  /**
   * Delete a user account and related data.
   * Steps:
   * 1) Verify Firebase ID token and match with userId
   * 2) Transactionally delete related DB rows (avatars, notification prefs, user)
   * 3) Optionally reset test-mode data in gaming-services
   * 4) Delete Firebase auth user
   */
  async deleteAccount(
    userId: string,
    firebaseIdToken: string,
  ): Promise<{ success: boolean; message: string; warnings?: string[] }> {
    const warnings: string[] = [];

    // 1) Verify token and user match
    const decoded = await this.firebaseConfig.verifyIdToken(firebaseIdToken);
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Utente non trovato');
    }
    if (decoded.uid !== user.firebaseUid) {
      throw new BadRequestException("Token non corrisponde all'utente");
    }

    // 2) DB deletions inside a transaction
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      // Delete avatar (if any)
      await queryRunner.manager.delete(UserAvatar, { userId });
      // Delete notification preferences (if any)
      await queryRunner.manager.delete(NotificationPreferences, { userId });
      // Delete the user
      await queryRunner.manager.delete(User, { id: userId });
      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error('DB deletion failed during account deletion', err);
      throw new BadRequestException('Errore durante la cancellazione dati');
    } finally {
      await queryRunner.release();
    }

    // 3) Best-effort reset of test-mode data in gaming-services
    try {
      if (this.gamingServicesUrl) {
        const resetTest = `${this.gamingServicesUrl}/api/test-mode/reset/${userId}`;
        await firstValueFrom(this.httpService.delete(resetTest));
        const purgeLive = `${this.gamingServicesUrl}/api/predictions/user/${userId}`;
        await firstValueFrom(this.httpService.delete(purgeLive));
      }
    } catch (err) {
      this.logger.warn(
        `Impossibile pulire i dati di gioco per utente ${userId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      warnings.push('Pulizia dati gioco non completa');
    }

    // 4) Delete Firebase auth user
    try {
      await this.firebaseConfig.deleteUser(user.firebaseUid);
    } catch (err) {
      this.logger.error('Firebase auth deletion failed', err);
      warnings.push('Eliminazione utente Firebase non riuscita');
    }

    return {
      success: true,
      message: 'Account eliminato con successo',
      warnings: warnings.length ? warnings : undefined,
    };
  }
}
