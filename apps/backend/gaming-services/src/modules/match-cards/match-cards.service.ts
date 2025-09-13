import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Fixture } from '../../entities/fixture.entity';
import { Spec } from '../../entities/spec.entity';
import { MatchCardDto, MatchCardKickoffDto, MatchCardTeamHomeDto, MatchCardTeamAwayDto, ResultCode, Last5ItemDto } from './dto/match-cards.dto';

interface CacheEntry {
  data: MatchCardDto[];
  expiresAt: number;
}

@Injectable()
export class MatchCardsService {
  private readonly logger = new Logger(MatchCardsService.name);
  private readonly matchCardsCache = new Map<string, CacheEntry>();
  private readonly CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

  constructor(
    @InjectRepository(Fixture)
    private readonly fixtureRepository: Repository<Fixture>,
    @InjectRepository(Spec)
    private readonly specRepository: Repository<Spec>,
  ) {}

  /**
   * Get enriched match cards for a specific week with statistics
   */
  async getMatchCardsByWeek(weekNumber: number, userId?: string): Promise<MatchCardDto[]> {
    const cacheKey = `live-match-cards-${weekNumber}-${userId || 'anonymous'}`;
    const cached = this.matchCardsCache.get(cacheKey);
    
    if (cached && cached.expiresAt > Date.now()) {
      this.logger.debug(`Cache hit for match cards week ${weekNumber}`);
      return cached.data;
    }

    // Get fixtures for the requested week
    const fixtures = await this.fixtureRepository.find({
      where: { week: weekNumber },
      order: { match_date: 'ASC' },
    });

    if (fixtures.length === 0) {
      this.logger.warn(`No fixtures found for week ${weekNumber}`);
      return [];
    }

    // For Week 1, stats are null/empty
    const isWeekOne = weekNumber <= 1;

    // Get prior fixtures for statistics calculation
    const priorFixtures = isWeekOne ? [] : await this.fixtureRepository
      .createQueryBuilder('fixture')
      .where('fixture.week < :week', { week: weekNumber })
      .andWhere('fixture.home_score IS NOT NULL AND fixture.away_score IS NOT NULL')
      .orderBy('fixture.match_date', 'ASC')
      .getMany();

    // Calculate standings up to the previous week
    const standings = isWeekOne ? new Map<string, number>() : this.computeStandings(priorFixtures);

    const cards: MatchCardDto[] = [];

    // Get all teams for last 5 calculations
    const teams = new Set<string>(fixtures.flatMap(f => [f.home_team, f.away_team]));
    const last5ByTeam = new Map<string, ResultCode[]>();
    const last5IdsByTeam = new Map<string, string[]>();

    // Calculate last 5 results and fixture IDs for each team
    for (const team of teams) {
      const { results, fixtureIds } = isWeekOne ? { results: [], fixtureIds: [] } : this.computeLast5WithIds(priorFixtures, team);
      last5ByTeam.set(team, results);
      last5IdsByTeam.set(team, fixtureIds);
    }

    // Get user predictions for overlay if userId provided
    let userPredictions = new Map<string, ResultCode>();
    if (userId && !isWeekOne) {
      const allFixtureIds = Array.from(last5IdsByTeam.values()).flat();
      if (allFixtureIds.length > 0) {
        try {
          const predictions = await this.specRepository.find({
            where: { 
              user_id: userId, 
              fixture_id: In(allFixtureIds) 
            },
          });
          predictions.forEach(pred => {
            if (pred.choice !== 'SKIP') {
              userPredictions.set(pred.fixture_id, pred.choice as ResultCode);
            }
          });
        } catch (error) {
          this.logger.warn(`Failed to fetch user predictions for ${userId}:`, error);
        }
      }
    }

    // Generate match cards
    for (const fixture of fixtures) {
      const kickoff: MatchCardKickoffDto = {
        iso: new Date(fixture.match_date).toISOString(),
        display: this.formatDisplayDate(new Date(fixture.match_date)),
      };

      const homeLast5 = last5ByTeam.get(fixture.home_team) || [];
      const awayLast5 = last5ByTeam.get(fixture.away_team) || [];
      const homeFixtureIds = last5IdsByTeam.get(fixture.home_team) || [];
      const awayFixtureIds = last5IdsByTeam.get(fixture.away_team) || [];

      const homeWinRate = isWeekOne ? null : this.computeWinRate(priorFixtures, fixture.home_team, 'home');
      const awayWinRate = isWeekOne ? null : this.computeWinRate(priorFixtures, fixture.away_team, 'away');

      // Create form with user overlay
      const homeForm = this.createFormWithOverlay(homeLast5, homeFixtureIds, userPredictions);
      const awayForm = this.createFormWithOverlay(awayLast5, awayFixtureIds, userPredictions);

      const homeTeam: MatchCardTeamHomeDto = {
        name: fixture.home_team,
        logo: this.getTeamLogo(fixture.home_team),
        winRateHome: homeWinRate,
        last5: homeLast5,
        standingsPosition: standings.get(fixture.home_team) || null,
        form: homeForm.length > 0 ? homeForm : undefined,
      };

      const awayTeam: MatchCardTeamAwayDto = {
        name: fixture.away_team,
        logo: this.getTeamLogo(fixture.away_team),
        winRateAway: awayWinRate,
        last5: awayLast5,
        standingsPosition: standings.get(fixture.away_team) || null,
        form: awayForm.length > 0 ? awayForm : undefined,
      };

      const matchCard: MatchCardDto = {
        week: weekNumber,
        fixtureId: fixture.id,
        kickoff,
        stadium: fixture.stadium,
        home: homeTeam,
        away: awayTeam,
      };

      cards.push(matchCard);
    }

    // Cache the result
    this.matchCardsCache.set(cacheKey, {
      data: cards,
      expiresAt: Date.now() + this.CACHE_TTL_MS,
    });

    this.logger.log(`Generated ${cards.length} match cards for week ${weekNumber}`);
    return cards;
  }

  /**
   * Compute standings based on prior fixtures
   */
  private computeStandings(priorFixtures: Fixture[]): Map<string, number> {
    const teamStats = new Map<string, { points: number; goalsFor: number; goalsAgainst: number }>();

    for (const fixture of priorFixtures) {
      if (fixture.home_score !== null && fixture.away_score !== null) {
        const homeStats = teamStats.get(fixture.home_team) || { points: 0, goalsFor: 0, goalsAgainst: 0 };
        const awayStats = teamStats.get(fixture.away_team) || { points: 0, goalsFor: 0, goalsAgainst: 0 };

        homeStats.goalsFor += fixture.home_score;
        homeStats.goalsAgainst += fixture.away_score;
        awayStats.goalsFor += fixture.away_score;
        awayStats.goalsAgainst += fixture.home_score;

        if (fixture.home_score > fixture.away_score) {
          // Home win
          homeStats.points += 3;
        } else if (fixture.home_score < fixture.away_score) {
          // Away win
          awayStats.points += 3;
        } else {
          // Draw
          homeStats.points += 1;
          awayStats.points += 1;
        }

        teamStats.set(fixture.home_team, homeStats);
        teamStats.set(fixture.away_team, awayStats);
      }
    }

    // Sort teams by points, then goal difference
    const sortedTeams = Array.from(teamStats.entries())
      .sort(([, a], [, b]) => {
        const pointsDiff = b.points - a.points;
        if (pointsDiff !== 0) return pointsDiff;
        return (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst);
      });

    const standings = new Map<string, number>();
    sortedTeams.forEach(([teamName], index) => {
      standings.set(teamName, index + 1);
    });

    return standings;
  }

  /**
   * Compute last 5 results for a team
   */
  private computeLast5Results(priorFixtures: Fixture[], teamName: string): ResultCode[] {
    const teamFixtures = priorFixtures
      .filter(f => f.home_team === teamName || f.away_team === teamName)
      .filter(f => f.home_score !== null && f.away_score !== null)
      .sort((a, b) => new Date(b.match_date).getTime() - new Date(a.match_date).getTime())
      .slice(0, 5);

    return teamFixtures.map(fixture => {
      if (fixture.home_score! > fixture.away_score!) {
        return '1'; // Home team won
      } else if (fixture.home_score! < fixture.away_score!) {
        return '2'; // Away team won
      } else {
        return 'X'; // Draw
      }
    });
  }

  /**
   * Compute win rate for home/away games
   */
  private computeWinRate(priorFixtures: Fixture[], teamName: string, venue: 'home' | 'away'): number | null {
    const relevantFixtures = priorFixtures.filter(f => {
      const isRelevant = venue === 'home' ? f.home_team === teamName : f.away_team === teamName;
      return isRelevant && f.home_score !== null && f.away_score !== null;
    });

    if (relevantFixtures.length === 0) return null;

    const wins = relevantFixtures.filter(fixture => {
      const won = venue === 'home' 
        ? fixture.home_score! > fixture.away_score!
        : fixture.away_score! > fixture.home_score!;
      return won;
    }).length;

    return Math.round((wins / relevantFixtures.length) * 100);
  }

  /**
   * Get team logo URL - maps database team names to actual logo paths
   */
  private getTeamLogo(teamName: string): string | null {
    // Map exact database team names to logo URLs (matching frontend public/teams/ folder)
    const logoMap: Record<string, string> = {
      // Core Serie A teams from fixtures
      'Juventus': '/teams/JuventusFcLogo.png',
      'Inter': '/teams/FcInternazionaleMilano.png', 
      'Milan': '/teams/AcMilanLogo.png',
      'Roma': '/teams/AsRomaLogo.png',
      'Napoli': '/teams/NapolLogo.png',
      'Lazio': '/teams/StemmaLazioCentenarioLogo.png',
      'Atalanta': '/teams/AtalantaBcLogo.png',
      'Fiorentina': '/teams/AcfFiorentinaLogo.png',
      'Bologna': '/teams/LogobolognaLogo.png',
      'Torino': '/teams/TorinoFcLogo.png',
      'Genoa': '/teams/GenoaCfcLogo.png',
      'Lecce': '/teams/LecceLogo.png',
      'Sassuolo': '/teams/SassuoloLogo.png',
      'Cagliari': '/teams/CagliariCalcioLogo.png',
      'Como': '/teams/ComoCalcioLogo.png',
      'Parma': '/teams/ParmaLogo.png',
      'Cremonese': '/teams/UsCremoneselogo.png',
      'Udinese': '/teams/UdineseCalcioLogo.png',
      'Venezia': '/teams/VeneziaFcLogo.png',
      'Monza': '/teams/AcMonzaLogo.png',
      'Empoli': '/teams/EmpoliFcLogo.png',
      'Verona': '/teams/HellasveronaFcLogo.png',
      'Pisa': '/teams/PisaCalcioLogo.png',
      // Add more teams as they appear in fixtures
    };
    
    return logoMap[teamName] || null;
  }

  /**
   * Compute last 5 results with fixture IDs for a team
   */
  private computeLast5WithIds(priorFixtures: Fixture[], teamName: string): { results: ResultCode[]; fixtureIds: string[] } {
    const teamFixtures = priorFixtures
      .filter(f => f.home_team === teamName || f.away_team === teamName)
      .filter(f => f.home_score !== null && f.away_score !== null)
      .sort((a, b) => new Date(b.match_date).getTime() - new Date(a.match_date).getTime())
      .slice(0, 5);

    const results = teamFixtures.map(fixture => {
      if (fixture.home_score! > fixture.away_score!) {
        return '1'; // Home team won
      } else if (fixture.home_score! < fixture.away_score!) {
        return '2'; // Away team won
      } else {
        return 'X'; // Draw
      }
    });

    const fixtureIds = teamFixtures.map(f => f.id);
    
    return { results, fixtureIds };
  }

  /**
   * Create form with user prediction overlay
   */
  private createFormWithOverlay(
    results: ResultCode[],
    fixtureIds: string[],
    userPredictions: Map<string, ResultCode>
  ): Last5ItemDto[] {
    if (!results.length || !fixtureIds.length) return [];

    return results.map((code, index) => {
      const fixtureId = fixtureIds[index]; // Keep as string
      const predicted = userPredictions.get(fixtureIds[index]) || null;
      const correct = predicted ? (predicted === code) : null;

      return {
        fixtureId,
        code,
        predicted,
        correct,
      };
    });
  }

  /**
   * Format date for display in Italian locale
   */
  private formatDisplayDate(date: Date): string {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      // No timeZone conversion - database already stores Italian time
    };
    
    const formatted = date.toLocaleString('it-IT', options);
    return formatted.replace(',', ' –');
  }
}