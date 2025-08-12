import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { Fixture } from '../entities/fixture.entity';
import { Spec } from '../entities/spec.entity';
import { TestFixture } from '../entities/test-fixture.entity';
import { TestSpec } from '../entities/test-spec.entity';

export const DatabaseConfig = registerAs(
  'database',
  (): TypeOrmModuleOptions => {
    // If DATABASE_URL is provided (for cloud databases), use it directly
    if (process.env.DATABASE_URL) {
      return {
        type: 'postgres',
        url: process.env.DATABASE_URL,
        entities: [Fixture, Spec, TestFixture, TestSpec],
        migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
        synchronize: false, // Disabled for local builds
        logging: process.env.NODE_ENV === 'development',
        ssl: { rejectUnauthorized: false }, // Always use SSL for cloud databases
      };
    }

    // Fallback to individual parameters for local development
    return {
      type: 'postgres',
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT, 10) || 5432,
      username: process.env.DATABASE_USER || 'gaming_user',
      password: process.env.DATABASE_PASSWORD || 'password',
      database: process.env.DATABASE_NAME || 'swipick_gaming',
      entities: [Fixture, Spec, TestFixture, TestSpec],
      migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
      synchronize: false, // Disabled for local builds
      logging: process.env.NODE_ENV === 'development',
      ssl:
        process.env.NODE_ENV === 'production'
          ? { rejectUnauthorized: false }
          : false,
    };
  },
);
