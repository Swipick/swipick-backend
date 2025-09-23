import {
  Injectable,
  NotFoundException,
  ConflictException,
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
}
