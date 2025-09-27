import {
  Controller,
  Post,
  Body,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { PredictionsService } from './predictions.service';
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
}
