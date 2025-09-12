import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Fixture } from '../../entities/fixture.entity';
import { MatchCardDto, MatchCardKickoffDto, MatchCardTeamHomeDto, MatchCardTeamAwayDto, ResultCode } from './dto/match-cards.dto';

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

    // Calculate last 5 results for each team
    for (const team of teams) {
      const last5 = isWeekOne ? [] : this.computeLast5Results(priorFixtures, team);
      last5ByTeam.set(team, last5);
    }

    // Generate match cards
    for (const fixture of fixtures) {
      const kickoff: MatchCardKickoffDto = {
        iso: new Date(fixture.match_date).toISOString(),
        display: this.formatDisplayDate(new Date(fixture.match_date)),
      };

      const homeLast5 = last5ByTeam.get(fixture.home_team) || [];
      const awayLast5 = last5ByTeam.get(fixture.away_team) || [];

      const homeWinRate = isWeekOne ? null : this.computeWinRate(priorFixtures, fixture.home_team, 'home');
      const awayWinRate = isWeekOne ? null : this.computeWinRate(priorFixtures, fixture.away_team, 'away');

      const homeTeam: MatchCardTeamHomeDto = {
        name: fixture.home_team,
        logo: this.getTeamLogo(fixture.home_team),
        winRateHome: homeWinRate,
        last5: homeLast5,
        standingsPosition: standings.get(fixture.home_team) || null,
      };

      const awayTeam: MatchCardTeamAwayDto = {
        name: fixture.away_team,
        logo: this.getTeamLogo(fixture.away_team),
        winRateAway: awayWinRate,
        last5: awayLast5,
        standingsPosition: standings.get(fixture.away_team) || null,
      };

      const matchCard: MatchCardDto = {
        week: weekNumber,
        fixtureId: Number(fixture.id),
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
        return fixture.home_team === teamName ? '1' : '2';
      } else if (fixture.home_score! < fixture.away_score!) {
        return fixture.home_team === teamName ? '2' : '1';
      } else {
        return 'X';
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
   * Get team logo URL (placeholder - you can implement proper logo mapping)
   */
  private getTeamLogo(teamName: string): string | null {
    // Map team names to logo URLs
    const logoMap: Record<string, string> = {
      'Juventus': '/teams/JuventusFcLogo.png',
      'Inter': '/teams/FcInternazionaleMilano.png',
      'Milan': '/teams/AcMilanLogo.png',
      'Roma': '/teams/AsRomaLogo.png',
      'Napoli': '/teams/NapolLogo.png',
      'Lazio': '/teams/StemmaLazioCentenarioLogo.png',
      'Atalanta': '/teams/AtalantaBcLogo.png',
      'Fiorentina': '/teams/AcfFiorentinaLogo.png',
      // Add more teams as needed
    };
    
    return logoMap[teamName] || null;
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
      timeZone: 'Europe/Rome',
    };
    
    const formatted = date.toLocaleString('it-IT', options);
    return formatted.replace(',', ' –');
  }
}