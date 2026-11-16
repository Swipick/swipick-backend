import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Fixture } from '../../entities/fixture.entity';
import { Spec } from '../../entities/spec.entity';
import { TestSpec } from '../../entities/test-spec.entity';
import { CreatePredictionDto } from './dto/create-prediction.dto';

@Injectable()
export class PredictionsService {
  private readonly logger = new Logger(PredictionsService.name);

  constructor(
    @InjectRepository(Fixture)
    private readonly fixtureRepository: Repository<Fixture>,
    @InjectRepository(Spec)
    private readonly specRepository: Repository<Spec>,
    @InjectRepository(TestSpec)
    private readonly testSpecRepository: Repository<TestSpec>,
  ) {}

  async create(
    createPredictionDto: CreatePredictionDto,
  ): Promise<Spec | TestSpec> {
    const { userId, fixtureId, choice, mode } = createPredictionDto;

    const fixture = await this.fixtureRepository.findOne({
      where: { id: fixtureId.toString() },
    });

    if (!fixture) {
      this.logger.warn(
        `Attempted to create prediction for non-existent fixture: ${fixtureId}`,
      );
      throw new NotFoundException(`Fixture with ID '${fixtureId}' not found.`);
    }

    // For live mode, prevent predictions on matches that have already started.
    if (mode === 'live') {
      const now = new Date();
      const matchDate = new Date(fixture.match_date);
      if (now >= matchDate) {
        this.logger.warn(
          `Attempted to predict on a live match that has already started: Fixture ${fixtureId}`,
        );
        throw new ForbiddenException(
          'Predictions are locked for matches that have already started.',
        );
      }
    }

    if (mode === 'test') {
      // Create test prediction
      const newTestSpec = this.testSpecRepository.create({
        userId,
        fixtureId: fixtureId,
        choice,
        week: fixture.week || 1, // Assuming fixture has a week property
      });

      try {
        const savedTestSpec = await this.testSpecRepository.save(newTestSpec);
        this.logger.log(
          `Saved test prediction for User ${userId}, Fixture ${fixtureId}, Week ${fixture.week || 1}`,
        );
        return savedTestSpec;
      } catch (error) {
        // Catch potential unique constraint violations
        if (error.code === '23505') {
          this.logger.warn(
            `User ${userId} already has a test prediction for Fixture ${fixtureId}. Attempting to update.`,
          );
          const existingTestSpec = await this.testSpecRepository.findOne({
            where: { userId, fixtureId: fixtureId },
          });
          if (existingTestSpec) {
            existingTestSpec.choice = choice;
            return this.testSpecRepository.save(existingTestSpec);
          }
        }
        this.logger.error('Failed to save test prediction', error.stack);
        throw new BadRequestException('Could not save test prediction.');
      }
    } else {
      // Create live prediction
      const newSpec = this.specRepository.create({
        user_id: userId,
        fixture_id: fixtureId.toString(),
        choice,
        week: fixture.week || 1, // Assuming fixture has a week property
        season: fixture.season, // Denormalized from the fixture (like week)
      });

      try {
        const savedSpec = await this.specRepository.save(newSpec);
        this.logger.log(
          `Saved live prediction for User ${userId}, Fixture ${fixtureId}, Week ${fixture.week || 1}`,
        );
        return savedSpec;
      } catch (error) {
        // Catch potential unique constraint violations
        if (error.code === '23505') {
          this.logger.warn(
            `User ${userId} already has a live prediction for Fixture ${fixtureId}. Attempting to update.`,
          );
          const existingSpec = await this.specRepository.findOne({
            where: { user_id: userId, fixture_id: fixtureId.toString() },
          });
          if (existingSpec) {
            existingSpec.choice = choice;
            return this.specRepository.save(existingSpec);
          }
        }
        this.logger.error('Failed to save live prediction', error.stack);
        throw new BadRequestException('Could not save live prediction.');
      }
    }
  }
}
