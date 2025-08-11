import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../entities/user.entity';
import { EmailService } from '../../services/email.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([User])],
  controllers: [UsersController],
  providers: [UsersService, EmailService], // Removed FirebaseConfigService - it's provided globally in AppModule
  exports: [UsersService, EmailService], // Removed FirebaseConfigService from exports
})
export class UsersModule {}
