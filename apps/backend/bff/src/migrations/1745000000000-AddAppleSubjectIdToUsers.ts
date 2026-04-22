import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAppleSubjectIdToUsers1745000000000 implements MigrationInterface {
  name = 'AddAppleSubjectIdToUsers1745000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add apple_subject_id column (nullable, unique)
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "apple_subject_id" varchar(128) NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_users_apple_subject_id"
      ON "users" ("apple_subject_id")
      WHERE "apple_subject_id" IS NOT NULL
    `);

    // Update enum to include 'apple' value (TypeORM names it {table}_{column}_enum)
    await queryRunner.query(`
      ALTER TYPE "users_auth_provider_enum" ADD VALUE IF NOT EXISTS 'apple'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "UQ_users_apple_subject_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN IF EXISTS "apple_subject_id"
    `);

    // Note: PostgreSQL does not support removing enum values.
    // The 'apple' value will remain in the enum type after rollback.
  }
}
