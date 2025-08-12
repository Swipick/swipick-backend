import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TestFixture } from '../../entities/test-fixture.entity';
import { TestSpec } from '../../entities/test-spec.entity';
import { TestModeService } from './test-mode.service';
import { TestModeController } from './test-mode.controller';

@Module({
  imports: [TypeOrmModule.forFeature([TestFixture, TestSpec])],
  controllers: [TestModeController],
  providers: [TestModeService],
  exports: [TestModeService],
})
export class TestModeModule {}
