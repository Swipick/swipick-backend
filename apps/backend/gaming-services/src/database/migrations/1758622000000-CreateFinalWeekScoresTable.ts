import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateFinalWeekScoresTable1758622000000 implements MigrationInterface {
    name = 'CreateFinalWeekScoresTable1758622000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create enum type for mode
        await queryRunner.query(`CREATE TYPE "public"."final_week_scores_mode_enum" AS ENUM('live', 'test')`);

        // Create the final_week_scores table
        await queryRunner.query(`
            CREATE TABLE "final_week_scores" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "userId" character varying(36) NOT NULL,
                "week" integer NOT NULL,
                "mode" "public"."final_week_scores_mode_enum" NOT NULL,
                "revealed" integer NOT NULL,
                "correct" integer NOT NULL,
                "percent" numeric(5,2) NOT NULL,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_31a07784f27dffdb0f921af8fdb" UNIQUE ("userId", "week", "mode"),
                CONSTRAINT "PK_6de4f360045b90b8f8977614a36" PRIMARY KEY ("id")
            )
        `);

        // Create indexes for better query performance
        await queryRunner.query(`CREATE INDEX "IDX_1eb85fefd628d1ef5b37b18784" ON "final_week_scores" ("week", "mode")`);
        await queryRunner.query(`CREATE INDEX "IDX_b23df5cbf40f4403d8f447e1ec" ON "final_week_scores" ("userId", "mode")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop indexes
        await queryRunner.query(`DROP INDEX "public"."IDX_b23df5cbf40f4403d8f447e1ec"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1eb85fefd628d1ef5b37b18784"`);

        // Drop table
        await queryRunner.query(`DROP TABLE "final_week_scores"`);

        // Drop enum type
        await queryRunner.query(`DROP TYPE "public"."final_week_scores_mode_enum"`);
    }
}