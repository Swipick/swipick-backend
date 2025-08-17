import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSkipChoiceToTestSpecs1723718400000
  implements MigrationInterface
{
  name = 'AddSkipChoiceToTestSpecs1723718400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Postgres enum alteration requires creating new enum type then altering column
    await queryRunner.query(
      `ALTER TYPE "public"."test_specs_choice_enum" ADD VALUE IF NOT EXISTS 'SKIP'`,
    );
  }

  public async down(): Promise<void> {
    // Irreversible safely (cannot remove enum value easily); document only
  }
}
