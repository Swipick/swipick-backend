import { Injectable, Logger, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Fixture } from '../../../entities/fixture.entity';
import { Spec } from '../../../entities/spec.entity';
import { CreatePredictionDto } from './dto/create-prediction.dto';

@Injectable()
export class PredictionsService {
  private readonly logger = new Logger(PredictionsService.name);

  constructor(
    @InjectRepository(Fixture)
    private readonly fixtureRepository: Repository<Fixture>,
    @InjectRepository(Spec)
    private readonly specRepository: Repository<Spec>,
  ) {}

  async create(createPredictionDto: CreatePredictionDto): Promise<Spec> {
    const { userId, fixtureId, choice, mode } = createPredictionDto;

    const fixture = await this.fixtureRepository.findOne({ where: { id: fixtureId } });

    if (!fixture) {
      this.logger.warn(`Attempted to create prediction for non-existent fixture: ${fixtureId}`);
      throw new NotFoundException(`Fixture with ID '${fixtureId}' not found.`);
    }

    // For live mode, prevent predictions on matches that have already started.
    if (mode === 'live') {
      const now = new Date();
      const matchDate = new Date(fixture.match_date);
      if (now >= matchDate) {
        this.logger.warn(`Attempted to predict on a live match that has already started: Fixture ${fixtureId}`);
        throw new ForbiddenException('Predictions are locked for matches that have already started.');
      }
    }

    const newSpec = this.specRepository.create({
      user_id: userId,
      fixture_id: fixtureId,
      choice,
      test_mode: mode === 'test',
    });

    try {
      const savedSpec = await this.specRepository.save(newSpec);
      this.logger.log(`Saved prediction for User ${userId}, Fixture ${fixtureId}, Mode '${mode}'`);
      return savedSpec;
    } catch (error) {
      // Catch potential unique constraint violations (e.g., user already predicted for this fixture)
      if (error.code === '23505') { // PostgreSQL unique violation error code
        this.logger.warn(`User ${userId} already has a prediction for Fixture ${fixtureId}. Attempting to update.`);
        // If the user is re-submitting a prediction for the same fixture, update it.
        const existingSpec = await this.specRepository.findOne({ where: { user_id: userId, fixture_id: fixtureId } });
        if (existingSpec) {
          existingSpec.choice = choice;
          return this.specRepository.save(existingSpec);
        }
      }
      this.logger.error('Failed to save prediction', error.stack);
      throw new BadRequestException('Could not save prediction.');
    }
  }
}
