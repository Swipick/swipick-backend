import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChangeTestSpecsUserIdToVarchar361723980000000
  implements MigrationInterface
{
  name = 'ChangeTestSpecsUserIdToVarchar361723980000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop dependent index if exists (will be recreated)
    await queryRunner.query('DROP INDEX IF EXISTS idx_test_specs_user_week');

    // Alter column type from int to varchar(36)
    await queryRunner.query(
      'ALTER TABLE test_specs ALTER COLUMN "userId" TYPE varchar(36) USING "userId"::varchar',
    );

    // Recreate index
    await queryRunner.query(
      'CREATE INDEX idx_test_specs_user_week ON test_specs ("userId", week)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop index before altering type back
    await queryRunner.query('DROP INDEX IF EXISTS idx_test_specs_user_week');

    // Revert column type to int (note: will fail if non-numeric values exist)
    await queryRunner.query(
      'ALTER TABLE test_specs ALTER COLUMN "userId" TYPE int USING "userId"::int',
    );

    // Recreate index
    await queryRunner.query(
      'CREATE INDEX idx_test_specs_user_week ON test_specs ("userId", week)',
    );
  }
}
