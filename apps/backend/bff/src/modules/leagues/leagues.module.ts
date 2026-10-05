import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User } from '../../entities/user.entity';
import { League } from '../../entities/league.entity';
import { LeagueMember } from '../../entities/league-member.entity';
import { LeagueJoinAttempt } from '../../entities/league-join-attempt.entity';
import { LeagueBurnedCode } from '../../entities/league-burned-code.entity';
import { FirebaseAuthGuard } from '../../common/guards/firebase-auth.guard';
import { LeaguesController } from './leagues.controller';
import { InvitesController } from './invites.controller';
import { LeaguesService } from './leagues.service';

@Module({
  imports: [
    ConfigModule,
    HttpModule,
    TypeOrmModule.forFeature([
      User,
      League,
      LeagueMember,
      LeagueJoinAttempt,
      LeagueBurnedCode,
    ]),
  ],
  controllers: [LeaguesController, InvitesController],
  providers: [LeaguesService, FirebaseAuthGuard],
  exports: [LeaguesService],
})
export class LeaguesModule {}
