import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNotificationPreferences1724050000000
  implements MigrationInterface
{
  name = 'CreateNotificationPreferences1724050000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "notification_preferences" (
        "user_id" uuid PRIMARY KEY,
        "results" boolean NOT NULL DEFAULT true,
        "matches" boolean NOT NULL DEFAULT true,
        "goals" boolean NOT NULL DEFAULT true,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "notification_preferences"');
  }
}
