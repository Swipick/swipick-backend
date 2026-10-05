import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';

import { FirebaseAuthGuard } from '../../common/guards/firebase-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../entities/user.entity';
import { LeaguesService } from './leagues.service';

/**
 * Gli inviti stanno su un controller loro perché il codice non è un id di
 * lega: finché non lo risolvi non sai nemmeno se esiste una lega dietro.
 *
 * Anteprima e accettazione restano due chiamate distinte: chi riceve un codice
 * deve poter vedere dove sta entrando prima di entrarci.
 */
@Controller('api/invites')
@UseGuards(FirebaseAuthGuard)
export class InvitesController {
  constructor(private readonly leaguesService: LeaguesService) {}

  @Get(':code')
  async preview(@CurrentUser() user: User, @Param('code') code: string) {
    return this.leaguesService.previewInvite(user, code);
  }

  @Post(':code/accept')
  async accept(@CurrentUser() user: User, @Param('code') code: string) {
    return this.leaguesService.acceptInvite(user, code);
  }
}
