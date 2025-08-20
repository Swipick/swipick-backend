import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { User } from './entities/user.entity';
import { NotificationPreferences } from './entities/notification-preferences.entity';
import { UserAvatar } from './entities/user-avatar.entity';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required env var: ${name}`);
  }
  return v || '';
}

const host = requireEnv('NEON_DB_HOST');
const username = requireEnv('NEON_DB_USERNAME');
const password = requireEnv('NEON_DB_PASSWORD');
const database = requireEnv('NEON_DB_NAME');

if (!host || !username || !password || !database) {
  console.error('Database configuration missing. Aborting migrations.');
  process.exit(1);
}

const useTs =
  process.env.MIGRATIONS_TS === '1' || process.env.NODE_ENV !== 'production';

const dataSource = new DataSource({
  type: 'postgres',
  host,
  port: Number(process.env.NEON_DB_PORT || 5432),
  username,
  password,
  database,
  ssl: { rejectUnauthorized: false },
  entities: [User, NotificationPreferences, UserAvatar],
  migrations: [useTs ? 'src/migrations/*.ts' : 'dist/migrations/*.js'],
  migrationsTableName: 'migrations',
});

async function run() {
  try {
    console.log('🔌 Connecting to database for migrations...');
    await dataSource.initialize();
    console.log('🚚 Running migrations...');
    const results = await dataSource.runMigrations();
    results.forEach((r) => console.log(`🧱 ${r.name}`));
    console.log('✅ Migrations completed');
  } catch (err) {
    console.error('❌ Migration failed', err);
    process.exit(1);
  } finally {
    await dataSource.destroy().catch(() => {});
  }
}

run();
