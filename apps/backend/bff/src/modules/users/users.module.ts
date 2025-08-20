import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../entities/user.entity';
import { NotificationPreferences } from '../../entities/notification-preferences.entity';
import { UserAvatar } from '../../entities/user-avatar.entity';
import { EmailService } from '../../services/email.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [
    ConfigModule,
    HttpModule,
    TypeOrmModule.forFeature([User, NotificationPreferences, UserAvatar]),
  ],
  controllers: [UsersController],
  providers: [UsersService, EmailService], // Removed FirebaseConfigService - it's provided globally in AppModule
  exports: [UsersService, EmailService], // Removed FirebaseConfigService from exports
})
export class UsersModule {}
