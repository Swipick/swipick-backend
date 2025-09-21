import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SpecsController } from './specs.controller';
import { SpecsService } from './specs.service';
import { TestModeModule } from '../test-mode/test-mode.module';
import { Spec } from '../../entities/spec.entity';
import { Fixture } from '../../entities/fixture.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Spec, Fixture]), TestModeModule],
  controllers: [SpecsController],
  providers: [SpecsService],
  exports: [SpecsService],
})
export class SpecsModule {}
