import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FinalWeekScore } from '../../entities/final-week-score.entity';
import {
  CreateFinalWeekScoreDto,
  FinalWeekScoreResponseDto,
  UserFinalScoresResponseDto,
} from './dto/final-week-scores.dto';

@Injectable()
export class FinalWeekScoresService {
  private readonly logger = new Logger(FinalWeekScoresService.name);

  constructor(
    @InjectRepository(FinalWeekScore)
    private readonly finalWeekScoreRepository: Repository<FinalWeekScore>,
  ) {}

  async createOrUpdateFinalWeekScore(
    dto: CreateFinalWeekScoreDto,
  ): Promise<FinalWeekScoreResponseDto> {
    try {
      // Try to find existing score
      const existingScore = await this.finalWeekScoreRepository.findOne({
        where: {
          userId: dto.userId,
          week: dto.week,
          mode: dto.mode,
        },
      });

      let finalWeekScore: FinalWeekScore;

      if (existingScore) {
        // Update existing score
        existingScore.revealed = dto.revealed;
        existingScore.correct = dto.correct;
        existingScore.percent = existingScore.calculatePercent();
        finalWeekScore =
          await this.finalWeekScoreRepository.save(existingScore);
      } else {
        // Create new score
        finalWeekScore = FinalWeekScore.fromCalculation(
          dto.userId,
          dto.week,
          dto.mode,
          dto.revealed,
          dto.correct,
        );
        finalWeekScore =
          await this.finalWeekScoreRepository.save(finalWeekScore);
      }

      return this.mapToResponseDto(finalWeekScore);
    } catch (error) {
      if (error.code === '23505') {
        // PostgreSQL unique constraint violation
        throw new ConflictException(
          'Final week score already exists for this user, week, and mode',
        );
      }
      throw error;
    }
  }

  async getFinalWeekScore(
    userId: string,
    week: number,
    mode: 'live' | 'test',
  ): Promise<FinalWeekScoreResponseDto> {
    const finalWeekScore = await this.finalWeekScoreRepository.findOne({
      where: {
        userId,
        week,
        mode,
      },
    });

    if (!finalWeekScore) {
      throw new NotFoundException(
        `Final week score not found for user ${userId}, week ${week}, mode ${mode}`,
      );
    }

    return this.mapToResponseDto(finalWeekScore);
  }

  async getAllFinalWeekScores(
    userId: string,
    mode?: 'live' | 'test',
  ): Promise<UserFinalScoresResponseDto> {
    const whereClause: any = { userId };
    if (mode) {
      whereClause.mode = mode;
    }

    const scores = await this.finalWeekScoreRepository.find({
      where: whereClause,
      order: {
        week: 'ASC',
        mode: 'ASC',
      },
    });

    const mappedScores = scores.map((score) => this.mapToResponseDto(score));
    const completedWeeks = scores.filter((score) => score.isComplete()).length;
    const averagePercent =
      scores.length > 0
        ? scores.reduce((sum, score) => sum + score.percent, 0) / scores.length
        : 0;

    return {
      userId,
      scores: mappedScores,
      totalWeeks: scores.length,
      completedWeeks,
      averagePercent: Math.round(averagePercent * 100) / 100, // Round to 2 decimal places
    };
  }

  async deleteFinalWeekScore(
    userId: string,
    week: number,
    mode: 'live' | 'test',
  ): Promise<void> {
    const result = await this.finalWeekScoreRepository.delete({
      userId,
      week,
      mode,
    });

    if (result.affected === 0) {
      throw new NotFoundException(
        `Final week score not found for user ${userId}, week ${week}, mode ${mode}`,
      );
    }
  }

  private mapToResponseDto(
    finalWeekScore: FinalWeekScore,
  ): FinalWeekScoreResponseDto {
    return {
      id: finalWeekScore.id,
      userId: finalWeekScore.userId,
      week: finalWeekScore.week,
      mode: finalWeekScore.mode,
      revealed: finalWeekScore.revealed,
      correct: finalWeekScore.correct,
      percent: finalWeekScore.percent,
      createdAt: finalWeekScore.createdAt,
      updatedAt: finalWeekScore.updatedAt,
      isComplete: finalWeekScore.isComplete(),
      gradeDisplay: finalWeekScore.getGradeDisplay(),
      scoreSummary: finalWeekScore.getScoreSummary(),
    };
  }

  async getUserPercentile(
    userId: string,
    week: number,
    mode: 'live' | 'test' = 'live',
  ): Promise<{
    percentile: number;
    totalPlayers: number;
    betterThanPercent: number;
  }> {
    try {
      this.logger.log(
        `📊 [PERCENTILE] Calculating percentile for user ${userId}, week ${week}, mode: ${mode}`,
      );

      // Get all scores for this week
      const tableName =
        mode === 'test' ? 'test_final_week_scores' : 'final_week_scores';

      this.logger.log(`📊 [PERCENTILE] Querying table: ${tableName}`);

      const allScores = await this.finalWeekScoreRepository.query(
        `SELECT user_id, percent FROM ${tableName} WHERE week = $1 AND percent IS NOT NULL ORDER BY percent DESC`,
        [week],
      );

      if (allScores.length === 0) {
        this.logger.log(`📊 [PERCENTILE] No scores found for week ${week}`);
        return {
          percentile: 0,
          totalPlayers: 0,
          betterThanPercent: 0,
        };
      }

      // Find user's position
      const userIndex = allScores.findIndex(
        (score) => score.user_id === userId,
      );

      if (userIndex === -1) {
        this.logger.log(
          `📊 [PERCENTILE] User ${userId} has no score for week ${week}`,
        );
        return {
          percentile: 0,
          totalPlayers: allScores.length,
          betterThanPercent: 0,
        };
      }

      const userScore = allScores[userIndex].percent;
      const totalPlayers = allScores.length;

      // Calculate how many players the user is better than
      const playersBehind = totalPlayers - userIndex - 1;
      const betterThanPercent = Math.round(
        (playersBehind / totalPlayers) * 100,
      );

      // Calculate percentile (which percentile group they're in)
      // Top 10%, 25%, 50%, etc.
      let percentile: number;
      const position = ((userIndex + 1) / totalPlayers) * 100;

      if (position <= 10) {
        percentile = 10;
      } else if (position <= 25) {
        percentile = 25;
      } else if (position <= 50) {
        percentile = 50;
      } else if (position <= 75) {
        percentile = 75;
      } else {
        percentile = 100;
      }

      this.logger.log(
        `📊 [PERCENTILE] User ${userId} - Score: ${userScore}%, Rank: ${userIndex + 1}/${totalPlayers}, ` +
          `Better than ${betterThanPercent}% of players, In top ${percentile}%`,
      );

      return {
        percentile,
        totalPlayers,
        betterThanPercent,
      };
    } catch (error) {
      this.logger.error(
        `❌ [PERCENTILE] Error calculating percentile for user ${userId}, week ${week}`,
        error.stack,
      );
      throw error;
    }
  }

  async getUserStatistics(
    userId: string,
    mode: 'live' | 'test' = 'live',
  ): Promise<{
    averageScore: number;
    bestScore: number;
    weeksPlayed: number;
    bestWeek: number | null;
  }> {
    try {
      this.logger.log(
        `📊 [STATISTICS] Calculating statistics for user ${userId}, mode: ${mode}`,
      );

      const tableName =
        mode === 'test' ? 'test_final_week_scores' : 'final_week_scores';

      this.logger.log(`📊 [STATISTICS] Querying table: ${tableName}`);

      // Get all user's scores
      const userScores = await this.finalWeekScoreRepository.query(
        `SELECT week, percent FROM ${tableName} WHERE user_id = $1 AND percent IS NOT NULL ORDER BY percent DESC`,
        [userId],
      );

      if (userScores.length === 0) {
        this.logger.log(`📊 [STATISTICS] No scores found for user ${userId}`);
        return {
          averageScore: 0,
          bestScore: 0,
          weeksPlayed: 0,
          bestWeek: null,
        };
      }

      // Calculate statistics
      const scores = userScores.map((s) => s.percent);
      const averageScore = Math.round(
        scores.reduce((sum, score) => sum + score, 0) / scores.length,
      );
      const bestScore = scores[0]; // Already sorted DESC
      const bestWeek = userScores[0].week;
      const weeksPlayed = scores.length;

      this.logger.log(
        `📊 [STATISTICS] User ${userId} - Average: ${averageScore}%, Best: ${bestScore}% (Week ${bestWeek}), Played: ${weeksPlayed} weeks`,
      );

      return {
        averageScore,
        bestScore,
        weeksPlayed,
        bestWeek,
      };
    } catch (error) {
      this.logger.error(
        `❌ [STATISTICS] Error calculating statistics for user ${userId}`,
        error.stack,
      );
      throw error;
    }
  }
}
