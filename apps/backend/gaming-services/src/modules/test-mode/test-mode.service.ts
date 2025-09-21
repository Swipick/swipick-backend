import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TestFixture } from '../../entities/test-fixture.entity';
import { TestSpec } from '../../entities/test-spec.entity';
import { ApiFootballService } from '../api-football/api-football.service';
import { WeeklyStats, UserSummary } from './dto/test-mode.dto';
import {
  MatchCardDto,
  OneXTwo,
  ResultCode,
  Last5ItemDto,
} from './dto/match-cards.dto';
import { In } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';

// Re-export for external use
export { WeeklyStats, UserSummary } from './dto/test-mode.dto';

@Injectable()
export class TestModeService {
  private readonly logger = new Logger(TestModeService.name);
  // In-memory cache for match-cards keyed by (week|userId)
  private readonly matchCardsCache = new Map<
    string,
    { data: MatchCardDto[]; expiresAt: number }
  >();
  private readonly MATCH_CARDS_TTL_MS = 10 * 60 * 1000; // 10 minutes

  constructor(
    @InjectRepository(TestFixture)
    private testFixtureRepository: Repository<TestFixture>,
    @InjectRepository(TestSpec)
    private testSpecRepository: Repository<TestSpec>,
    private readonly apiFootballService: ApiFootballService,
  ) {}

  // --- Match Cards Aggregation ---
  async getMatchCardsByWeek(
    week: number,
    userId?: string,
  ): Promise<MatchCardDto[]> {
    // Cache hit
    const cacheKey = this.getCacheKey(week, userId);
    const cached = this.matchCardsCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      this.logger.debug(`Cache hit match-cards: ${cacheKey}`);
      return cached.data;
    }
    // Retrieve fixtures for the requested week
    const fixtures = await this.testFixtureRepository.find({
      where: { week },
      order: { date: 'ASC' },
    });

    // For Week 1, stats must be empty/null
    const isWeekOne = week <= 1;

    const cards: MatchCardDto[] = [];

    // Auto-complete past fixtures based on virtual time before computing stats
    await this.autoCompleteVirtualFixtures();

    // Preload prior fixtures up to week-1 to compute stats in-memory
    const priorFixtures = isWeekOne
      ? []
      : await this.testFixtureRepository
          .createQueryBuilder('fixture')
          .where('fixture.week < :week', { week })
          .andWhere(
            'fixture.homeScore IS NOT NULL AND fixture.awayScore IS NOT NULL',
          )
          .orderBy('fixture.date', 'ASC')
          .getMany();

    // Compute standings up to week-1
    let standings = isWeekOne
      ? new Map<string, number>()
      : await this.computeStandingsUpToWeek(week);

    // Optional: CSV fallback/verification (data/classifica/serie_a_giornata_<week-1>_classifica.csv)
    if (!isWeekOne && standings.size === 0) {
      const csvPos = this.tryLoadStandingsCsv(week - 1);
      if (csvPos) standings = csvPos;
    }

    // Preload last5 fixture ids per team to join predictions
    const teams = new Set<string>(
      fixtures.flatMap((f) => [f.homeTeam, f.awayTeam]),
    );
    const last5IdsByTeam = new Map<string, number[]>();
    const last5CodesByTeam = new Map<string, ResultCode[]>();
    const resultCodeById = new Map<number, ResultCode>();
    // Build resultCodeById from prior fixtures
    for (const f of priorFixtures) {
      const r = f.calculateResult();
      if (r) resultCodeById.set(f.id, r as ResultCode);
    }
    for (const team of teams) {
      const last5Context = this.computeLast5Fixtures(priorFixtures, team);
      last5IdsByTeam.set(team, last5Context.ids);
      last5CodesByTeam.set(team, last5Context.codes);
    }

    // Lookup user predictions for overlay
    let userPreds = new Map<number, ResultCode>();
    if (userId) {
      const allIds = Array.from(last5IdsByTeam.values()).flat();
      if (allIds.length > 0) {
        try {
          const preds = await this.testSpecRepository.find({
            where: { userId, fixtureId: In(allIds) },
          });
          userPreds = new Map(
            preds.map((p) => [p.fixtureId, p.choice as ResultCode]),
          );
        } catch (e) {
          // Most common production cause: column type mismatch (int vs varchar) before migration.
          this.logger.error(
            `Failed to load user predictions overlay for match cards (userId=${userId}): ${String(
              (e as any).message || e,
            )}`,
          );
        }
      }
    }

    for (const f of fixtures) {
      const kickoffIso = f.date.toISOString();
      const kickoffDisplay = this.formatEuropeRomeDisplay(f.date);

      const homeLast5 = isWeekOne ? [] : last5CodesByTeam.get(f.homeTeam) || [];
      const awayLast5 = isWeekOne ? [] : last5CodesByTeam.get(f.awayTeam) || [];

      const homeWinRate = isWeekOne
        ? null
        : this.computeWinRate(priorFixtures, f.homeTeam, 'home');
      const awayWinRate = isWeekOne
        ? null
        : this.computeWinRate(priorFixtures, f.awayTeam, 'away');

      const homeForm = isWeekOne
        ? []
        : this.toForm(
            last5IdsByTeam.get(f.homeTeam) || [],
            userPreds,
            resultCodeById,
            f.homeTeam,
            priorFixtures,
          );
      const awayForm = isWeekOne
        ? []
        : this.toForm(
            last5IdsByTeam.get(f.awayTeam) || [],
            userPreds,
            resultCodeById,
            f.awayTeam,
            priorFixtures,
          );

      cards.push({
        week: f.week,
        fixtureId: f.id,
        kickoff: { iso: kickoffIso, display: kickoffDisplay },
        stadium: f.stadium || null,
        home: {
          name: f.homeTeam,
          logo: this.resolveTeamLogo(f.homeTeam),
          winRateHome: homeWinRate,
          last5: homeLast5,
          standingsPosition: standings.get(f.homeTeam) ?? null,
          form: homeForm,
        },
        away: {
          name: f.awayTeam,
          logo: this.resolveTeamLogo(f.awayTeam),
          winRateAway: awayWinRate,
          last5: awayLast5,
          standingsPosition: standings.get(f.awayTeam) ?? null,
          form: awayForm,
        },
      });
    }

    this.logger.log(`Match cards built for week ${week}: ${cards.length}`);

    // Store in cache
    this.matchCardsCache.set(cacheKey, {
      data: cards,
      expiresAt: Date.now() + this.MATCH_CARDS_TTL_MS,
    });

    return cards;
  }

  private computeLast5Fixtures(priorFixtures: TestFixture[], teamName: string) {
    // Filter team fixtures and ensure completed; sort by date ASC
    const teamPlayed = priorFixtures
      .filter(
        (f) =>
          (f.homeTeam === teamName || f.awayTeam === teamName) &&
          f.homeScore != null &&
          f.awayScore != null,
      )
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    const last = teamPlayed.slice(-5);
    const ids = last.map((f) => f.id);
    const codes = last
      .map((f) => f.calculateResult())
      .filter(Boolean) as ResultCode[];
    return { ids, codes };
  }

  private computeLast5(
    priorFixtures: TestFixture[],
    teamName: string,
    context: 'home' | 'away',
  ): OneXTwo[] {
    const results: OneXTwo[] = [];
    for (const f of priorFixtures) {
      if (results.length >= 5) break;
      if (context === 'home' && f.homeTeam === teamName) {
        const r = f.calculateResult();
        if (r) results.push(r as OneXTwo);
      } else if (context === 'away' && f.awayTeam === teamName) {
        const r = f.calculateResult();
        if (r) results.push(r as OneXTwo);
      }
    }
    return results;
  }

  private computeWinRate(
    priorFixtures: TestFixture[],
    teamName: string,
    context: 'home' | 'away',
  ): number | null {
    let played = 0;
    let wins = 0;
    for (const f of priorFixtures) {
      if (context === 'home' && f.homeTeam === teamName) {
        const r = f.calculateResult();
        if (!r) continue;
        played++;
        if (r === '1') wins++;
      } else if (context === 'away' && f.awayTeam === teamName) {
        const r = f.calculateResult();
        if (!r) continue;
        played++;
        if (r === '2') wins++;
      }
    }
    if (played === 0) return null;
    return Math.round((wins / played) * 100);
  }

  private resolveTeamLogo(name: string): string | null {
    // Minimal placeholder mapping; to be replaced with team-assets.json in a follow-up
    const map: Record<string, string> = {
      'AC Milan': 'https://media.api-sports.io/football/teams/489.png',
      Inter: 'https://media.api-sports.io/football/teams/505.png',
      Juventus: 'https://media.api-sports.io/football/teams/496.png',
      Napoli: 'https://media.api-sports.io/football/teams/492.png',
      Lazio: 'https://media.api-sports.io/football/teams/487.png',
      'AS Roma': 'https://media.api-sports.io/football/teams/497.png',
      Atalanta: 'https://media.api-sports.io/football/teams/499.png',
      Fiorentina: 'https://media.api-sports.io/football/teams/502.png',
      Bologna: 'https://media.api-sports.io/football/teams/500.png',
      Torino: 'https://media.api-sports.io/football/teams/503.png',
      Udinese: 'https://media.api-sports.io/football/teams/494.png',
      Genoa: 'https://media.api-sports.io/football/teams/495.png',
      Sassuolo: 'https://media.api-sports.io/football/teams/488.png',
      Empoli: 'https://media.api-sports.io/football/teams/511.png',
      Monza: 'https://media.api-sports.io/football/teams/1579.png',
      Verona: 'https://media.api-sports.io/football/teams/504.png',
      Lecce: 'https://media.api-sports.io/football/teams/867.png',
      Cagliari: 'https://media.api-sports.io/football/teams/490.png',
      Frosinone: 'https://media.api-sports.io/football/teams/4945.png',
      Salernitana: 'https://media.api-sports.io/football/teams/514.png',
    };
    return map[name] || null;
  }

  private formatEuropeRomeDisplay(date: Date): string {
    try {
      const formatter = new Intl.DateTimeFormat('it-IT', {
        timeZone: 'Europe/Rome',
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
      const parts = formatter
        .formatToParts(date)
        .reduce((acc, p) => ({ ...acc, [p.type]: p.value }), {} as any);
      const wd = (parts.weekday || '').replace('.', '');
      return `${wd} ${parts.day}/${parts.month} – ${parts.hour}:${parts.minute}`;
    } catch {
      return date.toISOString();
    }
  }

  private async computeStandingsUpToWeek(
    week: number,
  ): Promise<Map<string, number>> {
    const rows = await this.testFixtureRepository
      .createQueryBuilder('f')
      .where('f.week < :week', { week })
      .andWhere('f.homeScore IS NOT NULL AND f.awayScore IS NOT NULL')
      .getMany();

    type Row = { pts: number; gd: number; gf: number };
    const table = new Map<string, Row>();
    const ensure = (t: string) => {
      if (!table.has(t)) table.set(t, { pts: 0, gd: 0, gf: 0 });
      return table.get(t)!;
    };

    for (const f of rows) {
      const h = ensure(f.homeTeam);
      const a = ensure(f.awayTeam);
      h.gf += f.homeScore!;
      a.gf += f.awayScore!;
      h.gd += f.homeScore! - f.awayScore!;
      a.gd += f.awayScore! - f.homeScore!;
      if (f.homeScore! > f.awayScore!) h.pts += 3;
      else if (f.homeScore! < f.awayScore!) a.pts += 3;
      else {
        h.pts += 1;
        a.pts += 1;
      }
    }

    const sorted = Array.from(table.entries()).sort(
      ([, x], [, y]) => y.pts - x.pts || y.gd - x.gd || y.gf - x.gf,
    );
    const pos = new Map<string, number>();
    sorted.forEach(([team], idx) => pos.set(team, idx + 1));
    return pos;
  }

  private toForm(
    ids: number[],
    userPreds: Map<number, ResultCode>,
    codeById: Map<number, ResultCode>,
    teamName: string,
    priorFixtures: TestFixture[],
  ): Last5ItemDto[] {
    if (!ids || ids.length === 0) return [];
    return ids.map((id) => {
      const code = codeById.get(id)!;
      const predicted = userPreds.get(id) ?? null;
      const correct = predicted == null ? null : predicted === code;

      // Find the actual fixture to determine if this team was home or away
      const fixture = priorFixtures.find((f) => f.id === id);
      const wasHome = fixture ? fixture.homeTeam === teamName : false;

      return { fixtureId: id, code, predicted, correct, wasHome };
    });
  }

  private tryLoadStandingsCsv(week: number): Map<string, number> | null {
    try {
      const rel = `data/classifica/serie_a_giornata_${week}_classifica.csv`;
      const filePath = path.resolve(process.cwd(), rel);
      if (!fs.existsSync(filePath)) return null;
      const content = fs.readFileSync(filePath, 'utf8');
      // Expect CSV with headers including Team and Position (posizione)
      const lines = content.split(/\r?\n/).filter((l) => l.trim().length);
      if (lines.length <= 1) return null;
      const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
      const teamIdx = header.findIndex((h) => /team|squadra/.test(h));
      const posIdx = header.findIndex((h) => /pos|position|classifica/.test(h));
      if (teamIdx === -1 || posIdx === -1) return null;
      const map = new Map<string, number>();
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',');
        const team = (parts[teamIdx] || '').trim();
        const pos = Number((parts[posIdx] || '').trim());
        if (team && Number.isFinite(pos)) map.set(team, pos);
      }
      return map.size ? map : null;
    } catch (e) {
      this.logger.warn(
        `Failed to read standings CSV for week ${week}: ${String(e)}`,
      );
      return null;
    }
  }

  // --- Cache helpers ---
  private getCacheKey(week: number, userId?: string | number): string {
    const uid = userId == null ? 'anon' : String(userId);
    return `${week}|${uid}`;
  }

  private invalidateCacheForUserWeek(
    userId: string | number,
    week: number,
  ): void {
    const key = this.getCacheKey(week, userId);
    if (this.matchCardsCache.delete(key)) {
      this.logger.debug(`Cache invalidated for key ${key}`);
    }
  }

  private invalidateCacheForUser(userId: string | number): void {
    const suffix = `|${String(userId)}`;
    for (const key of Array.from(this.matchCardsCache.keys())) {
      if (key.endsWith(suffix)) {
        this.matchCardsCache.delete(key);
        this.logger.debug(`Cache invalidated for key ${key}`);
      }
    }
  }

  async createTestPrediction(
    userId: string,
    fixtureId: number,
    choice: '1' | 'X' | '2' | 'SKIP',
  ): Promise<TestSpec> {
    // New rule: SKIP is client-only and must not be persisted
    if (choice === 'SKIP') {
      this.logger.warn(
        `Rejecting SKIP for user ${userId}, fixture ${fixtureId} — skip is client-only (no persistence)`,
      );
      throw new BadRequestException(
        'Skip is client-only and is not stored as a prediction',
      );
    }
    // Check if fixture exists
    const fixture = await this.testFixtureRepository.findOne({
      where: { id: fixtureId },
    });

    if (!fixture) {
      throw new NotFoundException(
        `Test fixture with ID ${fixtureId} not found`,
      );
    }

    // Check for duplicate prediction
    const existingSpec = await this.testSpecRepository.findOne({
      where: { userId, fixtureId },
    });

    if (existingSpec) {
      this.logger.warn(
        `Duplicate test prediction attempt (idempotent success): user ${userId}, fixture ${fixtureId}`,
      );
      return existingSpec; // Idempotent behavior
    }

    // Create new test prediction
    const testSpec = this.testSpecRepository.create({
      userId,
      fixtureId,
      week: fixture.week,
      choice,
      isCorrect: false,
      countsTowardPercentage: true,
    });

    if (fixture.isCompleted()) {
      const actualResult = fixture.calculateResult();
      testSpec.isCorrect = choice === actualResult;
    }

    const savedSpec = await this.testSpecRepository.save(testSpec);

    // Invalidate cache for this user's week to refresh last-5 overlay
    this.invalidateCacheForUserWeek(userId, fixture.week);

    this.logger.log(
      `Test prediction created: User ${userId}, Fixture ${fixtureId}, Choice: ${choice}`,
    );

    return savedSpec;
  }

  async getTestWeeklyStats(userId: string, week: number): Promise<WeeklyStats> {
    const specs = await this.testSpecRepository.find({
      where: { userId, week },
      relations: ['fixture'],
    });

    if (specs.length === 0) {
      throw new NotFoundException(
        `No test predictions found for user ${userId} in week ${week}`,
      );
    }

    const nonSkipSpecs = specs.filter((s) => s.choice !== 'SKIP');
    const totalPredictions = nonSkipSpecs.length;
    const correctPredictions = nonSkipSpecs.filter(
      (spec) => spec.isCorrect,
    ).length;
    const skippedCount = specs.length - nonSkipSpecs.length;
    const totalTurns = specs.length; // predictions + skips
    const weeklyPercentage =
      totalPredictions > 0
        ? Math.round((correctPredictions / totalPredictions) * 100)
        : 0;

    const predictions = specs.map((spec) => ({
      fixtureId: spec.fixtureId,
      homeTeam: spec.fixture.homeTeam,
      awayTeam: spec.fixture.awayTeam,
      userChoice: spec.choice,
      actualResult: spec.fixture.calculateResult() || 'TBD',
      isCorrect: spec.isCorrect,
      homeScore: spec.fixture.homeScore,
      awayScore: spec.fixture.awayScore,
    }));

    this.logger.log(
      `Test weekly stats calculated: User ${userId}, Week ${week}, ${correctPredictions}/${totalPredictions} (${weeklyPercentage}%)`,
    );

    return {
      week,
      totalPredictions,
      correctPredictions,
      weeklyPercentage,
      totalTurns,
      skippedCount,
      predictions,
    };
  }

  async getTestUserSummary(userId: string): Promise<UserSummary> {
    const specs = await this.testSpecRepository.find({
      where: { userId },
      relations: ['fixture'],
    });

    if (specs.length === 0) {
      throw new NotFoundException(
        `No test predictions found for user ${userId}`,
      );
    }

    const nonSkipSpecs = specs.filter((s) => s.choice !== 'SKIP');
    const totalPredictions = nonSkipSpecs.length;
    const totalCorrect = nonSkipSpecs.filter((spec) => spec.isCorrect).length;
    const skippedCount = specs.length - nonSkipSpecs.length;
    const totalTurns = specs.length;
    const overallPercentage =
      totalPredictions > 0
        ? Math.round((totalCorrect / totalPredictions) * 100)
        : 0;

    // Group by week for breakdown
    const weeklyGroups = specs.reduce(
      (groups, spec) => {
        const week = spec.week;
        if (!groups[week]) {
          groups[week] = [];
        }
        groups[week].push(spec);
        return groups;
      },
      {} as { [week: number]: TestSpec[] },
    );

    const weeklyBreakdown = Object.entries(weeklyGroups).map(
      ([week, weekSpecs]) => {
        const nonSkipWeek = weekSpecs.filter((s) => s.choice !== 'SKIP');
        const totalCount = nonSkipWeek.length;
        const correctCount = nonSkipWeek.filter(
          (spec) => spec.isCorrect,
        ).length;
        const skipped = weekSpecs.length - nonSkipWeek.length;
        const totalTurnsWeek = weekSpecs.length;
        const percentage =
          totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
        return {
          week: parseInt(week),
          percentage,
          correctCount,
          totalCount,
          totalTurns: totalTurnsWeek,
          skippedCount: skipped,
        };
      },
    );

    // Find best and worst weeks
    const bestWeek = weeklyBreakdown.reduce((best, current) =>
      current.percentage > best.percentage ? current : best,
    );

    const worstWeek = weeklyBreakdown.reduce((worst, current) =>
      current.percentage < worst.percentage ? current : worst,
    );

    this.logger.log(
      `Test user summary calculated: User ${userId}, ${totalCorrect}/${totalPredictions} (${overallPercentage}%), ${Object.keys(weeklyGroups).length} weeks`,
    );

    return {
      userId,
      totalWeeks: Object.keys(weeklyGroups).length,
      totalPredictions,
      totalCorrect,
      overallPercentage,
      totalTurns,
      skippedCount,
      weeklyBreakdown,
      bestWeek: {
        week: bestWeek.week,
        percentage: bestWeek.percentage,
      },
      worstWeek: {
        week: worstWeek.week,
        percentage: worstWeek.percentage,
      },
    };
  }

  async getTestFixturesByWeek(week: number): Promise<TestFixture[]> {
    const fixtures = await this.testFixtureRepository.find({
      where: { week },
      order: { date: 'ASC' },
    });

    this.logger.log(
      `Retrieved ${fixtures.length} test fixtures for week ${week}`,
    );
    return fixtures;
  }

  async getAllTestWeeks(): Promise<number[]> {
    const result = await this.testFixtureRepository
      .createQueryBuilder('fixture')
      .select('DISTINCT fixture.week', 'week')
      .orderBy('fixture.week', 'ASC')
      .getRawMany();

    const weeks = result.map((row) => row.week);
    this.logger.log(`Retrieved test weeks: ${weeks.join(', ')}`);
    return weeks;
  }

  async seedTestData(forceReplace = false): Promise<void> {
    this.logger.log('Starting test data seeding...');

    // Check if data already exists
    const existingFixtures = await this.testFixtureRepository.count();
    if (existingFixtures > 0) {
      if (forceReplace) {
        this.logger.warn(
          `Test data already exists (${existingFixtures} fixtures). Force replace enabled — clearing and reseeding.`,
        );
        await this.testFixtureRepository.clear();
      } else {
        this.logger.warn(
          `Test data already exists (${existingFixtures} fixtures). Skipping seed.`,
        );
        return;
      }
    }

    // The historical Serie A fixtures for test mode (Weeks 1–4) based on provided CSV
    const testFixtures = [
      // Week 1 (19–21 Aug 2023)
      {
        week: 1,
        date: '2023-08-19 20:45:00',
        homeTeam: 'Genoa',
        stadium: 'Stadio Luigi Ferraris',
        awayTeam: 'Fiorentina',
        homeScore: 1,
        awayScore: 4,
      },
      {
        week: 1,
        date: '2023-08-19 20:45:00',
        homeTeam: 'Inter',
        stadium: 'San Siro (Giuseppe Meazza)',
        awayTeam: 'Monza',
        homeScore: 2,
        awayScore: 0,
      },
      {
        week: 1,
        date: '2023-08-19 18:30:00',
        homeTeam: 'Empoli',
        stadium: 'Stadio Carlo Castellani – Computer Gross Arena',
        awayTeam: 'Verona',
        homeScore: 0,
        awayScore: 1,
      },
      {
        week: 1,
        date: '2023-08-19 18:30:00',
        homeTeam: 'Frosinone',
        stadium: 'Stadio Benito Stirpe',
        awayTeam: 'Napoli',
        homeScore: 1,
        awayScore: 3,
      },
      {
        week: 1,
        date: '2023-08-20 20:45:00',
        homeTeam: 'Lecce',
        stadium: 'Stadio Via del Mare',
        awayTeam: 'Lazio',
        homeScore: 2,
        awayScore: 1,
      },
      {
        week: 1,
        date: '2023-08-20 20:45:00',
        homeTeam: 'Udinese',
        stadium: 'Stadio Friuli',
        awayTeam: 'Juventus',
        homeScore: 0,
        awayScore: 3,
      },
      {
        week: 1,
        date: '2023-08-20 18:30:00',
        homeTeam: 'AS Roma',
        stadium: 'Stadio Olimpico (Rome)',
        awayTeam: 'Salernitana',
        homeScore: 2,
        awayScore: 2,
      },
      {
        week: 1,
        date: '2023-08-20 18:30:00',
        homeTeam: 'Sassuolo',
        stadium: 'Mapei Stadium – Città del Tricolore',
        awayTeam: 'Atalanta',
        homeScore: 0,
        awayScore: 2,
      },
      {
        week: 1,
        date: '2023-08-21 20:45:00',
        homeTeam: 'Bologna',
        stadium: "Stadio Renato Dall'Ara",
        awayTeam: 'AC Milan',
        homeScore: 0,
        awayScore: 2,
      },
      {
        week: 1,
        date: '2023-08-21 18:30:00',
        homeTeam: 'Torino',
        stadium: 'Stadio Olimpico Grande Torino',
        awayTeam: 'Cagliari',
        homeScore: 0,
        awayScore: 0,
      },

      // Week 2 (26–28 Aug 2023)
      {
        week: 2,
        date: '2023-08-26 18:30:00',
        homeTeam: 'Frosinone',
        stadium: 'Stadio Benito Stirpe',
        awayTeam: 'Atalanta',
        homeScore: 2,
        awayScore: 1,
      },
      {
        week: 2,
        date: '2023-08-26 20:45:00',
        homeTeam: 'Verona',
        stadium: 'Stadio Marcantonio Bentegodi',
        awayTeam: 'AS Roma',
        homeScore: 2,
        awayScore: 1,
      },
      {
        week: 2,
        date: '2023-08-26 20:45:00',
        homeTeam: 'AC Milan',
        stadium: 'San Siro (Giuseppe Meazza)',
        awayTeam: 'Torino',
        homeScore: 4,
        awayScore: 1,
      },
      {
        week: 2,
        date: '2023-08-26 18:30:00',
        homeTeam: 'Monza',
        stadium: 'Stadio Brianteo',
        awayTeam: 'Empoli',
        homeScore: 2,
        awayScore: 0,
      },
      {
        week: 2,
        date: '2023-08-27 18:30:00',
        homeTeam: 'Fiorentina',
        stadium: 'Stadio Artemio Franchi',
        awayTeam: 'Lecce',
        homeScore: 2,
        awayScore: 2,
      },
      {
        week: 2,
        date: '2023-08-27 18:30:00',
        homeTeam: 'Juventus',
        stadium: 'Allianz Stadium (Juventus Stadium)',
        awayTeam: 'Bologna',
        homeScore: 1,
        awayScore: 1,
      },
      {
        week: 2,
        date: '2023-08-27 20:45:00',
        homeTeam: 'Lazio',
        stadium: 'Stadio Olimpico (Rome)',
        awayTeam: 'Genoa',
        homeScore: 0,
        awayScore: 1,
      },
      {
        week: 2,
        date: '2023-08-27 20:45:00',
        homeTeam: 'Napoli',
        stadium: 'Stadio Diego Armando Maradona',
        awayTeam: 'Sassuolo',
        homeScore: 2,
        awayScore: 0,
      },
      {
        week: 2,
        date: '2023-08-28 18:30:00',
        homeTeam: 'Salernitana',
        stadium: 'Stadio Arechi',
        awayTeam: 'Udinese',
        homeScore: 1,
        awayScore: 1,
      },
      {
        week: 2,
        date: '2023-08-28 20:45:00',
        homeTeam: 'Cagliari',
        stadium: 'Unipol Domus',
        awayTeam: 'Inter',
        homeScore: 0,
        awayScore: 2,
      },

      // Week 3 (1–3 Sep 2023)
      {
        week: 3,
        date: '2023-09-01 18:30:00',
        homeTeam: 'Sassuolo',
        stadium: 'Mapei Stadium – Città del Tricolore',
        awayTeam: 'Verona',
        homeScore: 3,
        awayScore: 1,
      },
      {
        week: 3,
        date: '2023-09-01 20:45:00',
        homeTeam: 'AS Roma',
        stadium: 'Stadio Olimpico (Rome)',
        awayTeam: 'AC Milan',
        homeScore: 1,
        awayScore: 2,
      },
      {
        week: 3,
        date: '2023-09-02 18:30:00',
        homeTeam: 'Udinese',
        stadium: 'Stadio Friuli',
        awayTeam: 'Frosinone',
        homeScore: 0,
        awayScore: 0,
      },
      {
        week: 3,
        date: '2023-09-02 20:45:00',
        homeTeam: 'Napoli',
        stadium: 'Stadio Diego Armando Maradona',
        awayTeam: 'Lazio',
        homeScore: 1,
        awayScore: 2,
      },
      {
        week: 3,
        date: '2023-09-02 18:30:00',
        homeTeam: 'Bologna',
        stadium: "Stadio Renato Dall'Ara",
        awayTeam: 'Cagliari',
        homeScore: 2,
        awayScore: 1,
      },
      {
        week: 3,
        date: '2023-09-02 20:45:00',
        homeTeam: 'Atalanta',
        stadium: 'Gewiss Stadium',
        awayTeam: 'Monza',
        homeScore: 3,
        awayScore: 0,
      },
      {
        week: 3,
        date: '2023-09-03 18:30:00',
        homeTeam: 'Torino',
        stadium: 'Stadio Olimpico Grande Torino',
        awayTeam: 'Genoa',
        homeScore: 1,
        awayScore: 0,
      },
      {
        week: 3,
        date: '2023-09-03 18:30:00',
        homeTeam: 'Inter',
        stadium: 'San Siro (Giuseppe Meazza)',
        awayTeam: 'Fiorentina',
        homeScore: 4,
        awayScore: 0,
      },
      {
        week: 3,
        date: '2023-09-03 20:45:00',
        homeTeam: 'Lecce',
        stadium: 'Stadio Via del Mare',
        awayTeam: 'Salernitana',
        homeScore: 2,
        awayScore: 0,
      },
      {
        week: 3,
        date: '2023-09-03 20:45:00',
        homeTeam: 'Empoli',
        stadium: 'Stadio Carlo Castellani – Computer Gross Arena',
        awayTeam: 'Juventus',
        homeScore: 0,
        awayScore: 2,
      },

      // Week 4 (16–18 Sep 2023)
      {
        week: 4,
        date: '2023-09-16 18:00:00',
        homeTeam: 'Inter',
        stadium: 'San Siro (Giuseppe Meazza)',
        awayTeam: 'AC Milan',
        homeScore: 5,
        awayScore: 1,
      },
      {
        week: 4,
        date: '2023-09-16 20:45:00',
        homeTeam: 'Genoa',
        stadium: 'Stadio Luigi Ferraris',
        awayTeam: 'Napoli',
        homeScore: 2,
        awayScore: 2,
      },
      {
        week: 4,
        date: '2023-09-16 15:00:00',
        homeTeam: 'Juventus',
        stadium: 'Allianz Stadium (Juventus Stadium)',
        awayTeam: 'Lazio',
        homeScore: 3,
        awayScore: 1,
      },
      {
        week: 4,
        date: '2023-09-17 20:45:00',
        homeTeam: 'AS Roma',
        stadium: 'Stadio Olimpico (Rome)',
        awayTeam: 'Empoli',
        homeScore: 7,
        awayScore: 0,
      },
      {
        week: 4,
        date: '2023-09-17 18:00:00',
        homeTeam: 'Fiorentina',
        stadium: 'Stadio Artemio Franchi',
        awayTeam: 'Atalanta',
        homeScore: 3,
        awayScore: 2,
      },
      {
        week: 4,
        date: '2023-09-17 15:00:00',
        homeTeam: 'Frosinone',
        stadium: 'Stadio Benito Stirpe',
        awayTeam: 'Sassuolo',
        homeScore: 4,
        awayScore: 2,
      },
      {
        week: 4,
        date: '2023-09-17 15:00:00',
        homeTeam: 'Monza',
        stadium: 'Stadio Brianteo',
        awayTeam: 'Lecce',
        homeScore: 1,
        awayScore: 1,
      },
      {
        week: 4,
        date: '2023-09-17 12:30:00',
        homeTeam: 'Cagliari',
        stadium: 'Unipol Domus',
        awayTeam: 'Udinese',
        homeScore: 0,
        awayScore: 0,
      },
      {
        week: 4,
        date: '2023-09-18 20:45:00',
        homeTeam: 'Verona',
        stadium: 'Stadio Marcantonio Bentegodi',
        awayTeam: 'Bologna',
        homeScore: 0,
        awayScore: 0,
      },
      {
        week: 4,
        date: '2023-09-18 18:30:00',
        homeTeam: 'Salernitana',
        stadium: 'Stadio Arechi',
        awayTeam: 'Torino',
        homeScore: 0,
        awayScore: 3,
      },
    ];

    // Map stadiums by home team for quick backfill
    const STADIUM_BY_TEAM: Record<string, string> = {
      'AC Milan': 'Giuseppe Meazza (San Siro)',
      Inter: 'Giuseppe Meazza (San Siro)',
      Torino: 'Stadio Olimpico Grande Torino',
      Juventus: 'Allianz Stadium',
      Napoli: 'Stadio Diego Armando Maradona',
      Lazio: 'Stadio Olimpico',
      Roma: 'Stadio Olimpico',
      Bologna: "Stadio Renato Dall'Ara",
      Udinese: 'Dacia Arena (Stadio Friuli)',
      Monza: 'U-Power Stadium',
      Salernitana: 'Stadio Arechi',
      Cagliari: 'Unipol Domus',
      Frosinone: 'Stadio Benito Stirpe',
      Fiorentina: 'Stadio Artemio Franchi',
      Empoli: 'Stadio Carlo Castellani – Computer Gross Arena',
      'Hellas Verona': "Stadio Marc'Antonio Bentegodi",
      Atalanta: 'Gewiss Stadium',
      Lecce: 'Stadio Via del Mare',
      TorinoFC: 'Stadio Olimpico Grande Torino',
    };

    for (const fixtureData of testFixtures) {
      const fixture = this.testFixtureRepository.create({
        week: fixtureData.week,
        homeTeam: fixtureData.homeTeam,
        awayTeam: fixtureData.awayTeam,
        date: new Date(fixtureData.date),
        stadium:
          fixtureData.stadium ||
          STADIUM_BY_TEAM[String(fixtureData.homeTeam)] ||
          null,
        status: 'FT' as any, // Cast to MatchStatus enum
        homeScore: fixtureData.homeScore,
        awayScore: fixtureData.awayScore,
        result: this.calculateResultFromScores(
          fixtureData.homeScore,
          fixtureData.awayScore,
        ),
      });

      await this.testFixtureRepository.save(fixture);
    }

    this.logger.log(
      `✅ Test data seeded successfully: ${testFixtures.length} fixtures`,
    );
  }

  /**
   * Seed complete 2023/2024 Serie A season data from API-Football
   * Truncates existing data and fetches all 38 weeks from API
   */
  async seedFullSeasonFromApi(forceReplace = true): Promise<void> {
    this.logger.log(
      'Starting full 2023/2024 Serie A season data seeding from API...',
    );

    if (forceReplace) {
      this.logger.warn(
        'Force replace enabled — truncating test_fixtures table with CASCADE',
      );
      // Truncate with CASCADE to handle FK constraints
      await this.testFixtureRepository.query(
        'TRUNCATE TABLE test_fixtures RESTART IDENTITY CASCADE',
      );
      await this.testSpecRepository.query(
        'TRUNCATE TABLE test_specs RESTART IDENTITY CASCADE',
      );
    } else {
      const existingFixtures = await this.testFixtureRepository.count();
      if (existingFixtures > 0) {
        this.logger.warn(
          `Test data already exists (${existingFixtures} fixtures). Skipping full season seed.`,
        );
        return;
      }
    }

    const SERIE_A_LEAGUE_ID = 135;
    const SEASON_2023_2024 = 2023;
    const allFixtures = [];

    try {
      this.logger.log(
        'Fetching all Serie A 2023/2024 fixtures from API-Football...',
      );

      // Fetch all fixtures for the season
      const apiFixtures = await this.apiFootballService.getFixtures({
        league: SERIE_A_LEAGUE_ID,
        season: SEASON_2023_2024,
      });

      this.logger.log(
        `Fetched ${apiFixtures.length} fixtures from API-Football`,
      );

      // Process and map fixtures to our schema
      let weekCounter = 1;

      // Group fixtures by date to determine weeks
      // Note: API response has nested structure different from Fixture interface
      const sortedFixtures = (apiFixtures as any[])
        .filter((f) => f.fixture?.status?.short === 'FT') // Only finished matches
        .sort(
          (a, b) =>
            new Date(a.fixture.date).getTime() -
            new Date(b.fixture.date).getTime(),
        );

      this.logger.log(`Processing ${sortedFixtures.length} finished fixtures`);

      // Assign week numbers based on Serie A format (10 matches per week)
      for (let i = 0; i < sortedFixtures.length; i += 10) {
        const weekFixtures = sortedFixtures.slice(i, i + 10);
        weekFixtures.forEach((fixture: any) => {
          const testFixture = {
            week: weekCounter,
            date: new Date(fixture.fixture.date),
            homeTeam: fixture.teams?.home?.name || 'Unknown',
            awayTeam: fixture.teams?.away?.name || 'Unknown',
            stadium: fixture.fixture.venue?.name || 'Unknown Stadium',
            homeScore: fixture.goals?.home || 0,
            awayScore: fixture.goals?.away || 0,
            status: 'FT',
            externalApiId: fixture.fixture.id,
          };
          allFixtures.push(testFixture);
        });
        weekCounter++;
      }

      // Insert in batches to avoid memory issues
      const BATCH_SIZE = 50;
      for (let i = 0; i < allFixtures.length; i += BATCH_SIZE) {
        const batch = allFixtures.slice(i, i + BATCH_SIZE);

        const entities = batch.map((fixture) => {
          // Calculate result based on scores
          const result =
            fixture.homeScore > fixture.awayScore
              ? '1'
              : fixture.homeScore < fixture.awayScore
                ? '2'
                : 'X';

          // Return the fixture with updated result property
          return {
            ...fixture,
            result,
          };
        });

        await this.testFixtureRepository.save(entities);
        this.logger.debug(
          `Saved batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(allFixtures.length / BATCH_SIZE)}`,
        );
      }

      this.logger.log(
        `✅ Full season data seeded successfully: ${allFixtures.length} fixtures across ${weekCounter - 1} weeks`,
      );
    } catch (error) {
      this.logger.error('Failed to seed full season data from API', error);
      throw new BadRequestException(
        `Failed to seed season data: ${error.message}`,
      );
    }
  }

  async debugApiCall(): Promise<any[]> {
    this.logger.log(
      '🔍 DEBUG: Testing direct API-Football call for 2023 Serie A season',
    );

    try {
      const SERIE_A_LEAGUE_ID = 135;
      const SEASON_2023_2024 = 2023;

      this.logger.log(
        `🔍 DEBUG: Calling getFixtures with league=${SERIE_A_LEAGUE_ID}, season=${SEASON_2023_2024}`,
      );

      const fixtures = await this.apiFootballService.getFixtures({
        league: SERIE_A_LEAGUE_ID,
        season: SEASON_2023_2024,
      });

      this.logger.log(
        `🔍 DEBUG: Received ${fixtures.length} fixtures from API`,
      );

      if (fixtures.length > 0) {
        this.logger.log(
          `🔍 DEBUG: First fixture sample: ${JSON.stringify(fixtures[0])}`,
        );
      }

      return fixtures;
    } catch (error) {
      this.logger.error('🔍 DEBUG: API call failed', error);
      throw error;
    }
  }

  async resetUserTestData(userId: string): Promise<void> {
    this.logger.log(`Resetting test data for user ${userId}...`);

    // Delete all test predictions for this user
    const deleteResult = await this.testSpecRepository.delete({ userId });

    this.logger.log(
      `✅ Test data reset completed for user ${userId}: ${deleteResult.affected || 0} predictions deleted`,
    );

    // Invalidate all cache entries for this user across weeks
    this.invalidateCacheForUser(userId);
  }

  private calculateResultFromScores(
    homeScore: number,
    awayScore: number,
  ): string {
    if (homeScore > awayScore) {
      return '1'; // Home win
    } else if (homeScore < awayScore) {
      return '2'; // Away win
    } else {
      return 'X'; // Draw
    }
  }

  /**
   * Auto-complete fixtures that have passed in virtual time with their predefined scores
   * This enables historical last5 calculations for test mode
   */
  private async autoCompleteVirtualFixtures(): Promise<void> {
    // Get current virtual time (September 9, 2023 13:35 + elapsed time)
    const virtualStartDate = new Date('2023-09-09T13:35:00.000Z');
    const realElapsed = Date.now() - virtualStartDate.getTime();

    // For demo purposes, simulate that time passes quickly in virtual mode
    const virtualNow = new Date(virtualStartDate.getTime() + realElapsed);

    this.logger.log(`[AutoComplete] Virtual time: ${virtualNow.toISOString()}`);

    // Find fixtures that should be completed (date has passed) but don't have scores yet
    const fixturesToComplete = await this.testFixtureRepository
      .createQueryBuilder('fixture')
      .where('fixture.date < :virtualNow', { virtualNow })
      .andWhere('fixture.homeScore IS NULL OR fixture.awayScore IS NULL')
      .getMany();

    if (fixturesToComplete.length === 0) {
      return; // Nothing to complete
    }

    this.logger.log(
      `[AutoComplete] Found ${fixturesToComplete.length} fixtures to complete`,
    );

    // Complete each fixture with its predefined scores from the seed data
    for (const fixture of fixturesToComplete) {
      // Set scores from the original seed data structure
      const completed = this.getCompletedFixtureScores(fixture);
      if (completed) {
        await this.testFixtureRepository.update(
          { id: fixture.id },
          { homeScore: completed.homeScore, awayScore: completed.awayScore },
        );
        this.logger.log(
          `[AutoComplete] Completed fixture ${fixture.id}: ${fixture.homeTeam} ${completed.homeScore}-${completed.awayScore} ${fixture.awayTeam}`,
        );
      }
    }
  }

  /**
   * Get the predefined scores for a fixture based on the original seed data
   */
  private getCompletedFixtureScores(
    fixture: TestFixture,
  ): { homeScore: number; awayScore: number } | null {
    // This maps to the predefined results from the seed data
    const results: Record<string, { homeScore: number; awayScore: number }> = {
      // Week 1 results
      'Genoa-Fiorentina': { homeScore: 1, awayScore: 4 },
      'Inter-Monza': { homeScore: 2, awayScore: 0 },
      'Empoli-Verona': { homeScore: 0, awayScore: 1 },
      'Frosinone-Napoli': { homeScore: 1, awayScore: 3 },
      'Lecce-Lazio': { homeScore: 2, awayScore: 1 },
      'Udinese-Juventus': { homeScore: 0, awayScore: 3 },
      'AS Roma-Salernitana': { homeScore: 2, awayScore: 1 },
      'Sassuolo-Cagliari': { homeScore: 2, awayScore: 1 },
      'Bologna-AC Milan': { homeScore: 0, awayScore: 2 },
      'Torino-Atalanta': { homeScore: 1, awayScore: 2 },
    };

    const key = `${fixture.homeTeam}-${fixture.awayTeam}`;
    return results[key] || null;
  }
}
