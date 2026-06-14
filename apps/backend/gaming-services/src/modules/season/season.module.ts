import { Global, Module } from '@nestjs/common';
import { SeasonConfigService } from './season-config.service';

/**
 * Global so any service can inject SeasonConfigService without importing
 * this module everywhere (pattern consistent with CacheServiceModule).
 */
@Global()
@Module({
  providers: [SeasonConfigService],
  exports: [SeasonConfigService],
})
export class SeasonModule {}
