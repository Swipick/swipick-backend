import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabasePersistenceService } from './database-persistence.service';

@Module({
  imports: [ConfigModule],
  providers: [DatabasePersistenceService],
  exports: [DatabasePersistenceService],
})
export class DatabasePersistenceModule {}
