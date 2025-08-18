import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UsePipes,
  ValidationPipe,
  ParseUUIDPipe,
  Logger,
} from '@nestjs/common';
import { UsersService } from './users.service';
import {
  CreateUserDto,
  GoogleSyncUserDto,
  CompleteProfileDto,
  UserResponseDto,
  EmailVerifiedDto,
} from './dto';

@Controller('api/users')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private readonly usersService: UsersService) {}

  /**
   * Traditional email/password registration
   * POST /api/users/register
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async register(@Body() createUserDto: CreateUserDto): Promise<{
    success: boolean;
    data: UserResponseDto;
    message: string;
  }> {
    this.logger.log(
      `Traditional registration attempt for email: ${createUserDto.email}`,
    );

    const user = await this.usersService.createUser(createUserDto);

    return {
      success: true,
      data: user,
      message: 'Utente registrato con successo',
    };
  }

  /**
   * Google OAuth user synchronization
   * POST /api/users/sync-google
   */
  @Post('sync-google')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async syncGoogle(@Body() googleSyncDto: GoogleSyncUserDto): Promise<{
    success: boolean;
    data: UserResponseDto;
    message: string;
  }> {
    this.logger.log('Google OAuth sync attempt');

    const user = await this.usersService.syncGoogleUser(googleSyncDto);

    return {
      success: true,
      data: user,
      message: user.needsProfileCompletion
        ? 'Utente sincronizzato. Completa il profilo per continuare.'
        : 'Accesso effettuato con successo',
    };
  }

  /**
   * Complete profile for Google users
   * POST /api/users/complete-profile/:id
   */
  @Post('complete-profile/:id')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async completeProfile(
    @Param('id', ParseUUIDPipe) userId: string,
    @Body() completeProfileDto: CompleteProfileDto,
  ): Promise<{
    success: boolean;
    data: UserResponseDto;
    message: string;
  }> {
    this.logger.log(`Profile completion attempt for user: ${userId}`);

    const user = await this.usersService.completeProfile(
      userId,
      completeProfileDto,
    );

    return {
      success: true,
      data: user,
      message: 'Profilo completato con successo',
    };
  }

  /**
   * Get user profile by ID
   * GET /api/users/profile/:id
   */
  @Get('profile/:id')
  @HttpCode(HttpStatus.OK)
  async getUserProfile(@Param('id', ParseUUIDPipe) userId: string): Promise<{
    success: boolean;
    data: UserResponseDto;
  }> {
    this.logger.log(`Get profile request for user: ${userId}`);

    const user = await this.usersService.getUserById(userId);

    return {
      success: true,
      data: user,
    };
  }

  /**
   * Get user profile by Firebase UID
   * GET /api/users/profile/firebase/:uid
   */
  @Get('profile/firebase/:uid')
  @HttpCode(HttpStatus.OK)
  async getUserProfileByFirebaseUid(
    @Param('uid') firebaseUid: string,
  ): Promise<{
    success: boolean;
    data: UserResponseDto;
  }> {
    this.logger.log(`Get profile request for Firebase UID: ${firebaseUid}`);

    const user = await this.usersService.getUserByFirebaseUid(firebaseUid);

    return {
      success: true,
      data: user,
    };
  }

  /**
   * Update user's email verification flag
   * PATCH /api/users/:id/email-verified
   */
  @Patch(':id/email-verified')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async updateEmailVerified(
    @Param('id', ParseUUIDPipe) userId: string,
    @Body() body: EmailVerifiedDto,
  ): Promise<{
    success: boolean;
    data: UserResponseDto;
    message: string;
  }> {
    this.logger.log(
      `Updating email verification for user: ${userId} -> ${body.emailVerified}`,
    );

    const user = await this.usersService.updateEmailVerified(
      userId,
      body.emailVerified,
    );

    return {
      success: true,
      data: user,
      message: 'Stato email verificata aggiornato',
    };
  }

  /**
   * Send password reset email
   * POST /api/users/send-password-reset
   */
  @Post('send-password-reset')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async sendPasswordReset(@Body() body: { email: string }): Promise<{
    success: boolean;
    message: string;
  }> {
    this.logger.log(`Password reset request for email: ${body.email}`);

    await this.usersService.sendPasswordReset(body.email);

    return {
      success: true,
      message: "Email di reset password inviata se l'indirizzo esiste",
    };
  }

  /**
   * Sync password reset with database after Firebase reset
   * POST /api/users/sync-password-reset
   */
  @Post('sync-password-reset')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async syncPasswordReset(
    @Body() body: { firebaseUid: string; email: string },
  ): Promise<{
    success: boolean;
    message: string;
  }> {
    this.logger.log(
      `Syncing password reset for Firebase UID: ${body.firebaseUid}`,
    );

    await this.usersService.syncPasswordReset(body.firebaseUid);

    return {
      success: true,
      message: 'Password reset sincronizzato con successo',
    };
  }

  /**
   * Test email sending (development only)
   * POST /api/users/test-email
   */
  @Post('test-email')
  @HttpCode(HttpStatus.OK)
  async testEmail(@Body() body: { email: string; name: string }): Promise<{
    success: boolean;
    message: string;
  }> {
    this.logger.log(`Testing email sending to: ${body.email}`);

    try {
      await this.usersService.testEmailSending(body.email, body.name);
      return {
        success: true,
        message: 'Test email sent successfully',
      };
    } catch (error) {
      this.logger.error('Test email failed:', error);
      return {
        success: false,
        message: `Test email failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Health check endpoint for users module
   * GET /api/users/health
   */
  @Get('health')
  @HttpCode(HttpStatus.OK)
  async health(): Promise<{
    status: string;
    timestamp: string;
    service: string;
  }> {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'users-service',
    };
  }
}
