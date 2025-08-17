import { DataSource } from 'typeorm';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Ensure .env is loaded when running TypeORM CLI/migrations
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Use DATABASE_URL if available (cloud database), otherwise use individual parameters
const config = process.env.DATABASE_URL
  ? {
      type: 'postgres' as const,
      url: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    }
  : {
      type: 'postgres' as const,
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT, 10) || 5432,
      username: process.env.DATABASE_USER || 'gaming_user',
      password: process.env.DATABASE_PASSWORD || 'password',
      database: process.env.DATABASE_NAME || 'swipick_gaming',
    };

export default new DataSource({
  ...config,
  entities: ['src/**/*.entity{.ts,.js}'],
  migrations: ['src/database/migrations/*{.ts,.js}'],
  synchronize: false, // Always false for migrations
  logging: true,
});
