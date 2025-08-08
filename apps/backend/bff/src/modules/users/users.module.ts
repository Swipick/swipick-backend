import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../entities/user.entity';
import { FirebaseConfigService } from '../../config/firebase.config';
import { EmailService } from '../../services/email.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([User])],
  controllers: [UsersController],
  providers: [UsersService, FirebaseConfigService, EmailService],
  exports: [UsersService, FirebaseConfigService, EmailService],
})
export class UsersModule {}
