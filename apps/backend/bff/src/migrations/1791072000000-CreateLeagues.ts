import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Le tabelle delle leghe private.
 *
 * In sviluppo le crea `synchronize` (database.config.ts), quindi questa
 * migrazione serve a una cosa sola: la produzione su Railway. Va tenuta
 * allineata a mano alle entity — è l'unico punto dove le due descrizioni
 * dello schema possono divergere senza che nessuno se ne accorga.
 */
export class CreateLeagues1791072000000 implements MigrationInterface {
  name = 'CreateLeagues1791072000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."league_members_role_enum" AS ENUM('owner', 'member');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."league_members_status_enum" AS ENUM('active', 'left', 'removed');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "leagues" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" varchar(40) NOT NULL,
        "competition_id" integer NOT NULL DEFAULT 135,
        "season" integer NOT NULL,
        "owner_user_id" uuid NOT NULL,
        "invite_code" char(4),
        "invite_code_expires_at" TIMESTAMP WITH TIME ZONE,
        "max_members" smallint NOT NULL DEFAULT 20,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        CONSTRAINT "pk_leagues" PRIMARY KEY ("id"),
        CONSTRAINT "FK_1205a9294354363e4969c2378a8" FOREIGN KEY ("owner_user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // Parziale: i codici chiusi sono NULL, e di NULL ce ne saranno tanti.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_leagues_invite_code"
        ON "leagues" ("invite_code") WHERE "invite_code" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_leagues_owner" ON "leagues" ("owner_user_id")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "league_members" (
        "league_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "role" "public"."league_members_role_enum" NOT NULL DEFAULT 'member',
        "joined_from_week" integer NOT NULL,
        "status" "public"."league_members_status_enum" NOT NULL DEFAULT 'active',
        "joined_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        CONSTRAINT "pk_league_members" PRIMARY KEY ("league_id", "user_id"),
        CONSTRAINT "FK_c762aefaf8125efd0b3b08fb9d0" FOREIGN KEY ("league_id")
          REFERENCES "leagues"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_b7c5afba2ad8d257e435a1a6574" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // "Le mie leghe" è la query più frequente dell'intera funzione.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_league_members_user_active"
        ON "league_members" ("user_id") WHERE "status" = 'active'
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "league_join_attempts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "code_tried" char(4) NOT NULL,
        "succeeded" boolean NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        CONSTRAINT "pk_league_join_attempts" PRIMARY KEY ("id"),
        CONSTRAINT "FK_cabb8cafb8ac168387469f99c2a" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_league_join_attempts_user_time"
        ON "league_join_attempts" ("user_id", "created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS "public"."idx_league_join_attempts_user_time"',
    );
    await queryRunner.query('DROP TABLE IF EXISTS "league_join_attempts"');

    await queryRunner.query(
      'DROP INDEX IF EXISTS "public"."idx_league_members_user_active"',
    );
    await queryRunner.query('DROP TABLE IF EXISTS "league_members"');

    await queryRunner.query(
      'DROP INDEX IF EXISTS "public"."idx_leagues_owner"',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "public"."uq_leagues_invite_code"',
    );
    await queryRunner.query('DROP TABLE IF EXISTS "leagues"');

    await queryRunner.query(
      'DROP TYPE IF EXISTS "public"."league_members_status_enum"',
    );
    await queryRunner.query(
      'DROP TYPE IF EXISTS "public"."league_members_role_enum"',
    );
  }
}
