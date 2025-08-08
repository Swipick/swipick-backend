import {
  Injectable,
  Logger,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, AuthProvider } from '../../entities/user.entity';
import { FirebaseConfigService } from '../../config/firebase.config';
import { EmailService } from '../../services/email.service';
import {
  CreateUserDto,
  GoogleSyncUserDto,
  CompleteProfileDto,
  UserResponseDto,
} from './dto';
import { plainToClass } from 'class-transformer';

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
  private readonly saltRounds = 12;

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private dataSource: DataSource,
    private firebaseConfig: FirebaseConfigService,
    private emailService: EmailService,
  ) {
    this.logger.log('🔧 UsersService initialized');
    this.logger.log(`📧 EmailService available: ${!!this.emailService}`);
  }

  /**

  /**
   * Traditional email/password registration
   */
  async createUser(createUserDto: CreateUserDto): Promise<UserResponseDto> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Check if email already exists
      await this.checkEmailUniqueness(createUserDto.email);

      // Check if nickname already exists
      await this.checkNicknameUniqueness(createUserDto.nickname);

      // Hash password
      const passwordHash = await this.hashPassword(createUserDto.password);

      // Create Firebase user first
      const firebaseUser = await this.firebaseConfig.createUser(
        createUserDto.email,
        createUserDto.password,
        createUserDto.name,
      );

      // Create database user
      const user = queryRunner.manager.create(User, {
        firebaseUid: firebaseUser.uid,
        email: createUserDto.email,
        name: createUserDto.name,
        nickname: createUserDto.nickname,
        passwordHash,
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

      // Cleanup Firebase user if database creation failed
      if (createUserDto.email) {
        try {
          const auth = this.firebaseConfig.getAuth();
          if (auth) {
            const firebaseUser = await auth.getUserByEmail(createUserDto.email);
            await this.firebaseConfig.deleteUser(firebaseUser.uid);
          }
        } catch (cleanupError) {
          this.logger.error(
            'Failed to cleanup Firebase user after database error',
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
   * Google OAuth user synchronization
   */
  async syncGoogleUser(
    googleSyncDto: GoogleSyncUserDto,
  ): Promise<UserResponseDto> {
    try {
      // Verify Firebase token and extract user data
      const decodedToken = await this.firebaseConfig.verifyIdToken(
        googleSyncDto.firebaseIdToken,
      );
      const googleUserData = this.extractGoogleUserData(decodedToken);

      // Check if user already exists
      let user = await this.userRepository.findOne({
        where: { firebaseUid: googleUserData.uid },
      });

      if (user) {
        // Update existing user's last login
        user.updatedAt = new Date();
        await this.userRepository.save(user);
        this.logger.log(`Existing Google user login: ${user.id}`);
      } else {
        // Create new Google user
        user = await this.createGoogleUser(googleUserData);
        this.logger.log(`New Google user created: ${user.id}`);
      }

      return this.transformToResponse(user);
    } catch (error) {
      this.logger.error('Failed to sync Google user', error);
      throw new BadRequestException(
        'Errore durante la sincronizzazione con Google',
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

      if (!user.isGoogleUser()) {
        throw new BadRequestException(
          'Solo gli utenti Google possono completare il profilo',
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

  private extractGoogleUserData(decodedToken: any): GoogleUserData {
    return {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name || decodedToken.email.split('@')[0],
      picture: decodedToken.picture,
      emailVerified: decodedToken.email_verified || false,
    };
  }

  private async hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, this.saltRounds);
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

      if (user.authProvider === AuthProvider.GOOGLE) {
        throw new BadRequestException(
          'Gli utenti Google non possono reimpostare la password. Usa "Accedi con Google".',
        );
      }

      // Note: Actual password reset email is sent from client-side Firebase Auth
      // This endpoint just validates the user exists and has email auth
      this.logger.log(`Password reset validation passed for user: ${user.id}`);
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

      if (user.authProvider === AuthProvider.GOOGLE) {
        throw new BadRequestException(
          'Gli utenti Google non possono cambiare password',
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
  async testEmailSending(email: string, name: string): Promise<void> {
    this.logger.log(`🧪 Testing email sending to: ${email}`);

    try {
      // Generate a test verification link
      const testLink = 'https://swipick-production.up.railway.app/verify-test';

      await this.emailService.sendVerificationEmail(email, name, testLink);

      this.logger.log(`✅ Test email sent successfully to: ${email}`);
    } catch (error) {
      this.logger.error(`❌ Test email failed for: ${email}`, error);
      throw error;
    }
  }

  private handleRegistrationError(error: any): never {
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
}
