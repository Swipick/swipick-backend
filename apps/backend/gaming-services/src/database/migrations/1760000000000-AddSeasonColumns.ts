import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds a `season` column to fixtures, specs and final_week_scores so the app
 * can host multiple Serie A seasons without week (1-38) collisions, while
 * preserving the 2025 history.
 *
 * Pattern per column: ADD with DEFAULT 2025 -> backfill -> SET NOT NULL.
 * The DEFAULT 2025 keeps pre-season-aware code compatible during the rollout
 * window (safe code rollback). final_week_scores' uniqueness is widened to
 * include season so 2025 and 2026 scores for the same week coexist.
 */
export class AddSeasonColumns1760000000000 implements MigrationInterface {
  name = 'AddSeasonColumns1760000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ---- fixtures ----
    await queryRunner.query(
      `ALTER TABLE "fixtures" ADD COLUMN IF NOT EXISTS "season" integer NOT NULL DEFAULT 2025`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_fixtures_season_week" ON "fixtures" ("season", "week")`,
    );

    // ---- specs ---- (backfill from the linked fixture, then enforce NOT NULL)
    await queryRunner.query(
      `ALTER TABLE "specs" ADD COLUMN IF NOT EXISTS "season" integer DEFAULT 2025`,
    );
    await queryRunner.query(
      `UPDATE "specs" s SET "season" = f."season" FROM "fixtures" f WHERE s."fixture_id" = f."id" AND s."season" IS NULL`,
    );
    await queryRunner.query(
      `UPDATE "specs" SET "season" = 2025 WHERE "season" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "specs" ALTER COLUMN "season" SET NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_specs_user_season_week" ON "specs" ("user_id", "season", "week")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_specs_user_season_mode" ON "specs" ("user_id", "season", "mode")`,
    );

    // ---- final_week_scores ---- widen uniqueness to include season
    await queryRunner.query(
      `ALTER TABLE "final_week_scores" ADD COLUMN IF NOT EXISTS "season" integer NOT NULL DEFAULT 2025`,
    );
    // Drop the old [userId, week, mode] unique constraint, whatever its name.
    await queryRunner.query(`
      DO $$
      DECLARE c text;
      BEGIN
        SELECT tc.constraint_name INTO c
        FROM information_schema.table_constraints tc
        WHERE tc.table_name = 'final_week_scores'
          AND tc.constraint_type = 'UNIQUE'
          AND tc.constraint_name NOT LIKE '%season%'
        LIMIT 1;
        IF c IS NOT NULL THEN
          EXECUTE format('ALTER TABLE "final_week_scores" DROP CONSTRAINT %I', c);
        END IF;
      END $$;
    `);
    await queryRunner.query(
      `ALTER TABLE "final_week_scores" ADD CONSTRAINT "UQ_fws_user_week_season_mode" UNIQUE ("userId", "week", "season", "mode")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_fws_week_season_mode" ON "final_week_scores" ("week", "season", "mode")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // NOTE: safe only while no 2026 data exists (restoring the 3-col unique
    // would conflict if 2025 and 2026 rows share [userId, week, mode]).
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_fws_week_season_mode"`);
    await queryRunner.query(
      `ALTER TABLE "final_week_scores" DROP CONSTRAINT IF EXISTS "UQ_fws_user_week_season_mode"`,
    );
    await queryRunner.query(
      `ALTER TABLE "final_week_scores" ADD CONSTRAINT "UQ_fws_user_week_mode" UNIQUE ("userId", "week", "mode")`,
    );
    await queryRunner.query(
      `ALTER TABLE "final_week_scores" DROP COLUMN IF EXISTS "season"`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_specs_user_season_mode"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_specs_user_season_week"`,
    );
    await queryRunner.query(
      `ALTER TABLE "specs" DROP COLUMN IF EXISTS "season"`,
    );

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_fixtures_season_week"`);
    await queryRunner.query(
      `ALTER TABLE "fixtures" DROP COLUMN IF EXISTS "season"`,
    );
  }
}
