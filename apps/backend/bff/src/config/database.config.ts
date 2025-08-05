import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';

@Injectable()
export class DatabaseConfigService implements TypeOrmOptionsFactory {
  private readonly logger = new Logger(DatabaseConfigService.name);

  constructor(private configService: ConfigService) {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
    const host = this.configService.get<string>('NEON_DB_HOST');
    const username = this.configService.get<string>('NEON_DB_USERNAME');
    const password = this.configService.get<string>('NEON_DB_PASSWORD');
    const database = this.configService.get<string>('NEON_DB_NAME');

    // Require all database credentials - no fallback allowed
    if (!host || !username || !password || !database) {
      this.logger.error(
        'Database configuration is required. Please set NEON_DB_HOST, NEON_DB_USERNAME, NEON_DB_PASSWORD, and NEON_DB_NAME environment variables.',
      );
      throw new Error('Database configuration missing');
    }

    this.logger.log(
      `Connecting to Neon PostgreSQL: ${username}@${host}/${database}`,
    );

    return {
      type: 'postgres',
      host,
      port: this.configService.get<number>('NEON_DB_PORT', 5432),
      username,
      password,
      database,
      ssl: {
        rejectUnauthorized: false, // Neon requires SSL but with relaxed certificate validation
      },
      entities: [User],
      synchronize: this.configService.get<string>('NODE_ENV') !== 'production',
      logging: this.configService.get<string>('NODE_ENV') === 'development',
      migrations: ['dist/migrations/*.js'],
      migrationsTableName: 'migrations',
      retryAttempts: 5,
      retryDelay: 3000,
      autoLoadEntities: true,
      // Additional Neon-specific optimizations
      extra: {
        connectionTimeoutMillis: 10000,
        idleTimeoutMillis: 30000,
      },
    };
  }
}
