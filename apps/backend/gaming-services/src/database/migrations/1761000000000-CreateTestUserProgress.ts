import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates `test_user_progress`: a per-user sequential giornata pointer for the
 * isolated TEST mode. One row per user, `currentWeek` defaults to 1 and is
 * advanced explicitly via the "Prossima giornata" action.
 */
export class CreateTestUserProgress1761000000000 implements MigrationInterface {
  name = 'CreateTestUserProgress1761000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "test_user_progress" (
        "userId" varchar(64) NOT NULL,
        "currentWeek" integer NOT NULL DEFAULT 1,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_test_user_progress" PRIMARY KEY ("userId")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "test_user_progress"`);
  }
}
