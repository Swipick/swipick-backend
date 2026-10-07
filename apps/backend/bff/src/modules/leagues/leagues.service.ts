import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  HttpException,
  HttpStatus,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, MoreThan, Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

import { User } from '../../entities/user.entity';
import { League } from '../../entities/league.entity';
import {
  LeagueMember,
  LeagueMemberStatus,
  LeagueRole,
} from '../../entities/league-member.entity';
import { LeagueJoinAttempt } from '../../entities/league-join-attempt.entity';
import { LeagueBurnedCode } from '../../entities/league-burned-code.entity';
import {
  INVITE_CODE_BURN_MONTHS,
  generateInviteCode,
  invalidCharactersIn,
  inviteCodeExpiry,
  isInviteCodeExpired,
  normalizeInviteCode,
} from './invite-code';
import { resolveJoinFromWeek, FixtureLike } from './join-week';
import { buildStandings, StandingMember, WeekScore } from './standings';

/** Oggi l'app segue solo la Serie A (id di API-Football). */
const SERIE_A = 135;

/** Le leghe vivono sul gioco vero, non sulla modalita' di prova. */
const LIVE_MODE = 'live';

@Injectable()
export class LeaguesService {
  private readonly logger = new Logger(LeaguesService.name);
  private readonly gamingServicesUrl: string;

  /**
   * I due limiti che rendono accettabile un codice di quattro caratteri.
   * Lo spazio è 31^4: senza questi, indovinare conviene.
   */
  private static readonly MAX_ATTEMPTS_PER_MINUTE = 5;
  private static readonly MAX_ATTEMPTS_PER_HOUR = 20;

  constructor(
    @InjectRepository(League)
    private readonly leagues: Repository<League>,
    @InjectRepository(LeagueMember)
    private readonly members: Repository<LeagueMember>,
    @InjectRepository(LeagueJoinAttempt)
    private readonly attempts: Repository<LeagueJoinAttempt>,
    @InjectRepository(LeagueBurnedCode)
    private readonly burned: Repository<LeagueBurnedCode>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.gamingServicesUrl = (
      this.configService.get<string>('GAMING_SERVICES_URL', '') || ''
    ).replace(/\/+$/, '');
  }

  // ---------------------------------------------------------------- creazione

  async createLeague(owner: User, name: string) {
    const { season, week } = await this.currentSeasonAndWeek();
    const joinedFromWeek = await this.joinWeekFor(season, week);

    const league = this.leagues.create({
      name,
      competitionId: SERIE_A,
      season,
      ownerUserId: owner.id,
      maxMembers: 20,
    });

    const saved = await this.withFreshCode(league);

    await this.members.save(
      this.members.create({
        leagueId: saved.id,
        userId: owner.id,
        role: LeagueRole.OWNER,
        joinedFromWeek,
        status: LeagueMemberStatus.ACTIVE,
      }),
    );

    this.logger.log(`Lega creata: ${saved.id} (${saved.name}) da ${owner.id}`);
    return this.describeLeague(saved, owner.id);
  }

  // ------------------------------------------------------------------ lettura

  async listMyLeagues(user: User) {
    const mine = await this.members.find({
      where: { userId: user.id, status: LeagueMemberStatus.ACTIVE },
    });
    if (mine.length === 0) return [];

    const leagues = await this.leagues.find({
      where: { id: In(mine.map((m) => m.leagueId)) },
    });

    const { week: currentWeek } = await this.currentSeasonAndWeek();

    const out: LeagueSummary[] = [];
    for (const league of leagues) {
      const standings = await this.standingsOf(
        league,
        { scope: 'season' },
        currentWeek,
      );
      const me = standings.find((row) => row.userId === user.id);
      out.push({
        ...this.describeLeague(league, user.id),
        // Tutti gli attivi, compreso chi parte dalla prossima giornata: è
        // dentro la lega anche se non ha ancora punti. Deve dare lo stesso
        // numero del dettaglio e dell'anteprima dell'invito, altrimenti la
        // stessa lega risulta di 7 membri in un posto e di 8 in un altro.
        memberCount: standings.length,
        // I primi della classifica, per mostrarne le facce nell'elenco: tre
        // bastano, il resto diventa un "+N". In ordine di posizione, così si
        // vede subito chi sta davanti.
        memberPreview: standings.slice(0, 3).map((row) => row.nickname),
        myPosition: me?.position ?? null,
        myPoints: me?.points ?? 0,
        myPending: me?.pending ?? false,
      });
    }

    // La lega dove vai meglio per prima: è quella che vuoi aprire.
    return out.sort((a, b) => (a.myPosition ?? 99) - (b.myPosition ?? 99));
  }

  async getLeague(user: User, leagueId: string) {
    const league = await this.requireLeague(leagueId);
    await this.requireActiveMember(user, league);
    const standings = await this.standingsOf(league, { scope: 'season' });

    return {
      ...this.describeLeague(league, user.id),
      memberCount: standings.length,
      standings,
    };
  }

  async getStandings(
    user: User,
    leagueId: string,
    scope: 'season' | 'week',
    week?: number,
  ) {
    const league = await this.requireLeague(leagueId);
    await this.requireActiveMember(user, league);

    if (scope === 'week' && (!week || week < 1)) {
      throw new BadRequestException('Giornata non valida');
    }

    return this.standingsOf(league, { scope, week });
  }

  // ------------------------------------------------------------------ inviti

  async previewInvite(user: User, rawCode: string) {
    const code = this.parseCode(rawCode);
    await this.enforceAttemptLimit(user);

    const league = await this.leagues.findOne({ where: { inviteCode: code } });
    const valid = league && !isInviteCodeExpired(league.inviteCodeExpiresAt);

    await this.recordAttempt(user, code, Boolean(valid));

    if (!league) throw new NotFoundException('Codice non valido');
    if (!valid) throw new GoneException('Questo codice è scaduto');

    const owner = await this.users.findOne({
      where: { id: league.ownerUserId },
    });
    const activeCount = await this.members.count({
      where: { leagueId: league.id, status: LeagueMemberStatus.ACTIVE },
    });

    const { season, week } = await this.currentSeasonAndWeek();

    return {
      leagueId: league.id,
      name: league.name,
      competitionId: league.competitionId,
      memberCount: activeCount,
      ownerNickname: owner?.nickname ?? null,
      joinFromWeek: await this.joinWeekFor(season, week),
      full: activeCount >= league.maxMembers,
      alreadyMember: Boolean(
        await this.members.findOne({
          where: {
            leagueId: league.id,
            userId: user.id,
            status: LeagueMemberStatus.ACTIVE,
          },
        }),
      ),
    };
  }

  async acceptInvite(user: User, rawCode: string) {
    const code = this.parseCode(rawCode);
    await this.enforceAttemptLimit(user);

    const league = await this.leagues.findOne({ where: { inviteCode: code } });
    await this.recordAttempt(user, code, Boolean(league));

    if (!league) throw new NotFoundException('Codice non valido');
    if (isInviteCodeExpired(league.inviteCodeExpiresAt)) {
      throw new GoneException('Questo codice è scaduto');
    }

    const existing = await this.members.findOne({
      where: { leagueId: league.id, userId: user.id },
    });

    if (existing?.status === LeagueMemberStatus.ACTIVE) {
      throw new ConflictException('Sei già in questa lega');
    }

    // Chi è stato rimosso non rientra col codice: altrimenti rimuovere
    // qualcuno non servirebbe a niente finché il codice è vivo. Lo riammette
    // l'owner, dalla gestione della lega.
    if (existing?.status === LeagueMemberStatus.REMOVED) {
      throw new ForbiddenException(
        'Sei stato rimosso da questa lega: può riammetterti solo chi la gestisce',
      );
    }

    const activeCount = await this.members.count({
      where: { leagueId: league.id, status: LeagueMemberStatus.ACTIVE },
    });
    if (activeCount >= league.maxMembers) {
      throw new UnprocessableEntityException('Questa lega è piena');
    }

    const joinedFromWeek = await this.joinWeekFor(
      league.season,
      (await this.currentSeasonAndWeek()).week,
    );

    if (existing) {
      // Era uscito da solo: rientra, ma riparte da adesso.
      existing.status = LeagueMemberStatus.ACTIVE;
      existing.joinedFromWeek = joinedFromWeek;
      existing.joinedAt = new Date();
      await this.members.save(existing);
    } else {
      await this.members.save(
        this.members.create({
          leagueId: league.id,
          userId: user.id,
          role: LeagueRole.MEMBER,
          joinedFromWeek,
          status: LeagueMemberStatus.ACTIVE,
        }),
      );
    }

    this.logger.log(
      `${user.id} entra nella lega ${league.id} dalla giornata ${joinedFromWeek}`,
    );

    return { leagueId: league.id, joinedFromWeek };
  }

  /**
   * Tutti i membri, rimossi compresi: è la lista della schermata di gestione.
   * Le classifiche mostrano solo gli attivi, quindi da li' chi è stato
   * rimosso sparisce — e l'owner non avrebbe più modo di riammetterlo.
   */
  async listMembers(user: User, leagueId: string) {
    const league = await this.requireOwnedLeague(user, leagueId);

    const rows = await this.members.find({ where: { leagueId: league.id } });
    if (rows.length === 0) return [];

    const users = await this.users.find({
      where: { id: In(rows.map((r) => r.userId)) },
    });
    const byId = new Map(users.map((u) => [u.id, u]));

    return rows
      .map((row) => ({
        userId: row.userId,
        nickname: byId.get(row.userId)?.nickname ?? null,
        role: row.role,
        status: row.status,
        joinedFromWeek: row.joinedFromWeek,
        joinedAt: row.joinedAt,
        isMe: row.userId === user.id,
      }))
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
        if (a.role !== b.role) return a.role === 'owner' ? -1 : 1;
        return (a.nickname ?? '').localeCompare(b.nickname ?? '');
      });
  }

  // ------------------------------------------------------------------- owner

  async renameLeague(user: User, leagueId: string, name: string) {
    const league = await this.requireOwnedLeague(user, leagueId);
    league.name = name;
    await this.leagues.save(league);
    return this.describeLeague(league, user.id);
  }

  async rotateInviteCode(user: User, leagueId: string) {
    const league = await this.requireOwnedLeague(user, leagueId);
    const saved = await this.withFreshCode(league);
    return this.describeLeague(saved, user.id);
  }

  async closeInvites(user: User, leagueId: string) {
    const league = await this.requireOwnedLeague(user, leagueId);
    await this.burnCode(league.inviteCode);
    league.inviteCode = null;
    league.inviteCodeExpiresAt = null;
    await this.leagues.save(league);
    return this.describeLeague(league, user.id);
  }

  async removeMember(user: User, leagueId: string, memberId: string) {
    const league = await this.requireOwnedLeague(user, leagueId);

    if (memberId === league.ownerUserId) {
      throw new ConflictException('Non puoi rimuovere chi gestisce la lega');
    }

    const member = await this.members.findOne({
      where: { leagueId: league.id, userId: memberId },
    });
    if (!member || member.status !== LeagueMemberStatus.ACTIVE) {
      throw new NotFoundException('Membro non trovato');
    }

    member.status = LeagueMemberStatus.REMOVED;
    await this.members.save(member);
    return { removed: memberId };
  }

  async reinstateMember(user: User, leagueId: string, memberId: string) {
    const league = await this.requireOwnedLeague(user, leagueId);

    const member = await this.members.findOne({
      where: { leagueId: league.id, userId: memberId },
    });
    if (!member || member.status === LeagueMemberStatus.ACTIVE) {
      throw new NotFoundException('Membro non trovato');
    }

    const activeCount = await this.members.count({
      where: { leagueId: league.id, status: LeagueMemberStatus.ACTIVE },
    });
    if (activeCount >= league.maxMembers) {
      throw new UnprocessableEntityException('Questa lega è piena');
    }

    // Riparte da adesso: il periodo passato fuori non torna indietro, e chi è
    // rimasto non si vede superare da un rientro.
    const { week } = await this.currentSeasonAndWeek();
    member.status = LeagueMemberStatus.ACTIVE;
    member.joinedFromWeek = await this.joinWeekFor(league.season, week);
    member.joinedAt = new Date();
    await this.members.save(member);

    return { reinstated: memberId, joinedFromWeek: member.joinedFromWeek };
  }

  async transferOwner(user: User, leagueId: string, newOwnerId: string) {
    const league = await this.requireOwnedLeague(user, leagueId);

    if (newOwnerId === user.id) {
      throw new ConflictException('Gestisci già tu questa lega');
    }

    const target = await this.members.findOne({
      where: {
        leagueId: league.id,
        userId: newOwnerId,
        status: LeagueMemberStatus.ACTIVE,
      },
    });
    if (!target) {
      throw new NotFoundException('Membro non trovato');
    }

    const current = await this.members.findOne({
      where: { leagueId: league.id, userId: user.id },
    });

    target.role = LeagueRole.OWNER;
    await this.members.save(target);

    if (current) {
      current.role = LeagueRole.MEMBER;
      await this.members.save(current);
    }

    league.ownerUserId = newOwnerId;
    await this.leagues.save(league);

    return this.describeLeague(league, user.id);
  }

  async leaveLeague(user: User, leagueId: string) {
    const league = await this.requireLeague(leagueId);
    const member = await this.requireActiveMember(user, league);

    // Una lega senza chi la gestisce non può più essere amministrata da
    // nessuno: prima passi il ruolo, oppure la chiudi.
    if (league.ownerUserId === user.id) {
      throw new ConflictException(
        'Gestisci questa lega: passa il ruolo a qualcun altro oppure eliminala',
      );
    }

    member.status = LeagueMemberStatus.LEFT;
    await this.members.save(member);
    return { left: league.id };
  }

  async deleteLeague(user: User, leagueId: string) {
    const league = await this.requireOwnedLeague(user, leagueId);
    await this.burnCode(league.inviteCode);
    await this.leagues.remove(league); // i membri cadono in cascata
    return { deleted: leagueId };
  }

  // ----------------------------------------------------------------- privati

  private parseCode(raw: string): string {
    const code = normalizeInviteCode(raw);
    if (code) return code;

    const bad = invalidCharactersIn(raw);
    if (bad.length > 0) {
      throw new BadRequestException(
        `Il codice non contiene ${bad.join(', ')}: controlla, le lettere O e I e i numeri 0 e 1 non si usano`,
      );
    }
    throw new BadRequestException('Il codice è di quattro caratteri');
  }

  private async requireLeague(leagueId: string): Promise<League> {
    const league = await this.leagues.findOne({ where: { id: leagueId } });
    if (!league) throw new NotFoundException('Lega non trovata');
    return league;
  }

  private async requireActiveMember(
    user: User,
    league: League,
  ): Promise<LeagueMember> {
    const member = await this.members.findOne({
      where: {
        leagueId: league.id,
        userId: user.id,
        status: LeagueMemberStatus.ACTIVE,
      },
    });
    // 403 e non 404: la lega esiste, semplicemente non è affare suo.
    if (!member) throw new ForbiddenException('Non sei in questa lega');
    return member;
  }

  private async requireOwnedLeague(
    user: User,
    leagueId: string,
  ): Promise<League> {
    const league = await this.requireLeague(leagueId);
    if (league.ownerUserId !== user.id) {
      throw new ForbiddenException('Solo chi gestisce la lega può farlo');
    }
    return league;
  }

  /**
   * Un codice nuovo: non già in uso e non in quarantena.
   *
   * Il vecchio, se c'era, finisce fuori circolazione: è la ragione per cui
   * rigenerare è sicuro anche quando il codice precedente è in giro.
   */
  private async withFreshCode(league: League): Promise<League> {
    await this.burnCode(league.inviteCode);

    for (let attempt = 0; attempt < 8; attempt++) {
      const candidato = generateInviteCode();
      if (await this.burned.findOne({ where: { code: candidato } })) {
        continue; // in quarantena: ne provo un altro
      }
      league.inviteCode = candidato;
      league.inviteCodeExpiresAt = inviteCodeExpiry();
      try {
        return await this.leagues.save(league);
      } catch (err: unknown) {
        const code = (err as { code?: string })?.code;
        if (code !== '23505') throw err;
        this.logger.warn(
          `Codice già in uso (${league.inviteCode}), ne genero un altro`,
        );
      }
    }
    throw new ServiceUnavailableException(
      'Non riesco a generare un codice libero, riprova',
    );
  }

  /**
   * Mette un codice fuori circolazione per qualche mese.
   *
   * Non basta che scada: scaduto smette di funzionare, ma resta libero e può
   * finire a un'altra lega mentre qualcuno ce l'ha ancora scritto da qualche
   * parte. Finché è qui, la generazione lo salta.
   */
  private async burnCode(code: string | null | undefined): Promise<void> {
    if (!code) return;

    await this.burned
      .upsert({ code, burnedAt: new Date() }, ['code'])
      .catch((err) => {
        // Un codice non messo in quarantena non deve impedire l'operazione
        // che lo ha dismesso: al massimo tornerà disponibile prima.
        this.logger.warn(
          `Codice ${code} non messo in quarantena: ${err instanceof Error ? err.message : err}`,
        );
      });

    // Pulizia opportunistica: le righe scadute non servono più a nessuno.
    const limite = new Date();
    limite.setMonth(limite.getMonth() - INVITE_CODE_BURN_MONTHS);
    await this.burned
      .delete({ burnedAt: LessThan(limite) })
      .catch(() => undefined);
  }

  private async enforceAttemptLimit(user: User): Promise<void> {
    const now = Date.now();
    const lastMinute = await this.attempts.count({
      where: { userId: user.id, createdAt: MoreThan(new Date(now - 60_000)) },
    });
    if (lastMinute >= LeaguesService.MAX_ATTEMPTS_PER_MINUTE) {
      throw new HttpException(
        'Troppi tentativi: aspetta un minuto',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const lastHour = await this.attempts.count({
      where: {
        userId: user.id,
        createdAt: MoreThan(new Date(now - 3_600_000)),
      },
    });
    if (lastHour >= LeaguesService.MAX_ATTEMPTS_PER_HOUR) {
      throw new HttpException(
        "Troppi tentativi: riprova fra un'ora",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async recordAttempt(user: User, code: string, ok: boolean) {
    await this.attempts.save(
      this.attempts.create({ userId: user.id, codeTried: code, succeeded: ok }),
    );

    // Le righe vecchie non servono a nulla: il contatore guarda un'ora.
    await this.attempts
      .delete({
        userId: user.id,
        createdAt: LessThan(new Date(Date.now() - 24 * 3_600_000)),
      })
      .catch(() => undefined);
  }

  private describeLeague(league: League, viewerId: string): LeagueDescription {
    const expired = isInviteCodeExpired(league.inviteCodeExpiresAt);
    const isOwner = league.ownerUserId === viewerId;

    return {
      id: league.id,
      name: league.name,
      competitionId: league.competitionId,
      season: league.season,
      isOwner,
      maxMembers: league.maxMembers,
      // Il codice lo vede solo chi può invitare.
      inviteCode: isOwner && !expired ? league.inviteCode : null,
      inviteCodeExpiresAt:
        isOwner && !expired ? league.inviteCodeExpiresAt : null,
      invitesOpen: Boolean(league.inviteCode) && !expired,
    };
  }

  private async standingsOf(
    league: League,
    options: { scope: 'season' | 'week'; week?: number },
    /** Giornata già nota: evita di richiederla una volta per lega. */
    currentWeekNoto?: number,
  ) {
    const rows = await this.members.find({
      where: { leagueId: league.id, status: LeagueMemberStatus.ACTIVE },
    });
    if (rows.length === 0) return [];

    const users = await this.users.find({
      where: { id: In(rows.map((r) => r.userId)) },
    });
    const byId = new Map(users.map((u) => [u.id, u]));

    const members: StandingMember[] = rows
      .map((row) => {
        const user = byId.get(row.userId);
        if (!user) return null;
        return {
          userId: row.userId,
          firebaseUid: user.firebaseUid,
          nickname: user.nickname ?? null,
          role: row.role,
          joinedFromWeek: row.joinedFromWeek,
        };
      })
      .filter((m): m is StandingMember => m !== null);

    const scores = await this.fetchScores(
      members.map((m) => m.firebaseUid),
      league.season,
    );
    const currentWeek =
      currentWeekNoto ?? (await this.currentSeasonAndWeek()).week;

    return buildStandings(members, scores, { ...options, currentWeek });
  }

  // ------------------------------------------------- chiamate a gaming-services

  private async currentSeasonAndWeek(): Promise<{
    season: number;
    week: number;
  }> {
    try {
      const lastPlayed = await firstValueFrom(
        this.httpService.get(
          `${this.gamingServicesUrl}/api/fixtures/last-played`,
        ),
      );
      const season = Number(lastPlayed.data?.season) || 2025;

      const next = await firstValueFrom(
        this.httpService.get(
          `${this.gamingServicesUrl}/api/fixtures/next?limit=10`,
        ),
      );
      const week =
        Number(next.data?.detectedWeek) || Number(lastPlayed.data?.week) || 1;

      return { season, week };
    } catch (err) {
      this.logger.error(
        `Giornata in corso non leggibile: ${err instanceof Error ? err.message : err}`,
      );
      // Meglio un errore chiaro che una lega nata nella stagione sbagliata.
      throw new ServiceUnavailableException(
        'Non riesco a leggere la giornata in corso, riprova fra poco',
      );
    }
  }

  private async joinWeekFor(season: number, week: number): Promise<number> {
    let fixtures: FixtureLike[] = [];
    try {
      const resp = await firstValueFrom(
        this.httpService.get(
          `${this.gamingServicesUrl}/api/fixtures/week/${week}?season=${season}`,
        ),
      );
      fixtures = Array.isArray(resp.data) ? resp.data : (resp.data?.data ?? []);
    } catch {
      this.logger.warn(
        `Partite della giornata ${week} non leggibili: entro dalla successiva per prudenza`,
      );
      // Nel dubbio si slitta: far entrare per sbaglio a giornata in corso
      // falsa la classifica, far aspettare una giornata no.
      return week + 1;
    }

    return resolveJoinFromWeek(week, fixtures);
  }

  private async fetchScores(
    firebaseUids: string[],
    season: number,
  ): Promise<WeekScore[]> {
    if (firebaseUids.length === 0) return [];

    try {
      const resp = await firstValueFrom(
        this.httpService.post(
          `${this.gamingServicesUrl}/api/final-week-scores/leaderboard`,
          { userIds: firebaseUids, season, mode: LIVE_MODE },
        ),
      );
      const rows = Array.isArray(resp.data)
        ? resp.data
        : (resp.data?.data ?? []);
      return rows as WeekScore[];
    } catch (err) {
      this.logger.error(
        `Punteggi non leggibili: ${err instanceof Error ? err.message : err}`,
      );
      throw new ServiceUnavailableException(
        'Non riesco a leggere i punteggi, riprova fra poco',
      );
    }
  }
}

/** La lega come la vede chi la sta guardando: il codice solo se può invitare. */
export interface LeagueDescription {
  id: string;
  name: string;
  competitionId: number;
  season: number;
  isOwner: boolean;
  maxMembers: number;
  inviteCode: string | null;
  inviteCodeExpiresAt: Date | null;
  invitesOpen: boolean;
}

/** Una riga dell'elenco "le tue leghe". */
export interface LeagueSummary extends LeagueDescription {
  memberCount: number;
  /** Nickname dei primi in classifica, per gli avatar dell'elenco. */
  memberPreview: (string | null)[];
  myPosition: number | null;
  myPoints: number;
  myPending: boolean;
}
