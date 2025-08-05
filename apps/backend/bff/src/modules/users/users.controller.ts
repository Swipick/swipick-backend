import {
  Controller,
  Post,
  Get,
  Put,
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
