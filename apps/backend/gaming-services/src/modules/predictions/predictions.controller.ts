import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { PredictionsService, VotiPartita } from './predictions.service';
import { CreatePredictionDto } from './dto/create-prediction.dto';

@Controller('predictions')
export class PredictionsController {
  constructor(private readonly predictionsService: PredictionsService) {}

  @Post()
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  create(@Body() createPredictionDto: CreatePredictionDto) {
    // The `createTestModePrediction` from the old test-mode-only controller has been
    // superseded by this more generic endpoint.
    return this.predictionsService.create(createPredictionDto);
  }

  /**
   * GET /api/predictions/community/week/:week[?season=2026]
   * Conteggi 1/X/2 per partita della giornata, per i post di swipick-social.
   */
  @Get('community/week/:week')
  votiCommunity(
    @Param('week', ParseIntPipe) week: number,
    @Query('season') season?: string,
  ): Promise<VotiPartita[]> {
    // Una stagione non valida si ignora: vale quella corrente.
    const stagione = Number(season);
    return this.predictionsService.votiCommunity(
      week,
      Number.isInteger(stagione) && stagione > 0 ? stagione : undefined,
    );
  }
}
