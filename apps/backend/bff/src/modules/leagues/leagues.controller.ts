import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { FirebaseAuthGuard } from '../../common/guards/firebase-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../entities/user.entity';
import { LeaguesService } from './leagues.service';
import { CreateLeagueDto, RenameLeagueDto, TransferOwnerDto } from './dto';

/**
 * Le leghe private.
 *
 * Nessun userId nei path: chi chiama lo dice il token (vedi
 * `FirebaseAuthGuard`). È la differenza con le altre rotte del BFF, ed è
 * voluta: qui si iscrivono persone e si leggono i punteggi di altri.
 */
@Controller('api/leagues')
@UseGuards(FirebaseAuthGuard)
export class LeaguesController {
  private readonly logger = new Logger(LeaguesController.name);

  constructor(private readonly leaguesService: LeaguesService) {}

  @Post()
  async create(@CurrentUser() user: User, @Body() dto: CreateLeagueDto) {
    return this.leaguesService.createLeague(user, dto.name);
  }

  @Get()
  async mine(@CurrentUser() user: User) {
    return this.leaguesService.listMyLeagues(user);
  }

  @Get(':id')
  async detail(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.leaguesService.getLeague(user, id);
  }

  @Get(':id/standings')
  async standings(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('scope') scope: 'season' | 'week' = 'season',
    @Query('week') week?: string,
  ) {
    return this.leaguesService.getStandings(
      user,
      id,
      scope === 'week' ? 'week' : 'season',
      week ? Number(week) : undefined,
    );
  }

  @Get(':id/members')
  async members(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.leaguesService.listMembers(user, id);
  }

  @Patch(':id')
  async rename(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RenameLeagueDto,
  ) {
    return this.leaguesService.renameLeague(user, id, dto.name);
  }

  @Post(':id/invite-code')
  async rotateCode(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.leaguesService.rotateInviteCode(user, id);
  }

  @Delete(':id/invite-code')
  async closeInvites(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.leaguesService.closeInvites(user, id);
  }

  @Delete(':id/members/me')
  async leave(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.leaguesService.leaveLeague(user, id);
  }

  @Delete(':id/members/:userId')
  async removeMember(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) memberId: string,
  ) {
    return this.leaguesService.removeMember(user, id, memberId);
  }

  @Post(':id/members/:userId/reinstate')
  async reinstateMember(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) memberId: string,
  ) {
    return this.leaguesService.reinstateMember(user, id, memberId);
  }

  @Post(':id/owner')
  async transferOwner(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransferOwnerDto,
  ) {
    return this.leaguesService.transferOwner(user, id, dto.userId);
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.leaguesService.deleteLeague(user, id);
  }
}
