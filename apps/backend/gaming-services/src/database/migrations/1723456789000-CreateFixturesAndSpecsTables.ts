import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateFixturesAndSpecsTables1723456789000
  implements MigrationInterface
{
  name = 'CreateFixturesAndSpecsTables1723456789000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create fixtures table
    await queryRunner.createTable(
      new Table({
        name: 'fixtures',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'home_team',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'away_team',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'match_date',
            type: 'timestamp',
            isNullable: false,
          },
          {
            name: 'stadium',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'week',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'result',
            type: 'enum',
            enum: ['1', 'X', '2'],
            isNullable: true,
          },
          {
            name: 'home_score',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'away_score',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['SCHEDULED', 'LIVE', 'FINISHED', 'POSTPONED', 'CANCELLED'],
            default: "'SCHEDULED'",
          },
          {
            name: 'external_api_id',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'home_team_id',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'away_team_id',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Create specs table
    await queryRunner.createTable(
      new Table({
        name: 'specs',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'fixture_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'choice',
            type: 'enum',
            enum: ['1', 'X', '2', 'SKIP'],
            isNullable: false,
          },
          {
            name: 'result',
            type: 'enum',
            enum: ['1', 'X', '2'],
            isNullable: true,
          },
          {
            name: 'correct',
            type: 'boolean',
            isNullable: true,
          },
          {
            name: 'week',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'timestamp',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
        foreignKeys: [
          {
            columnNames: ['fixture_id'],
            referencedTableName: 'fixtures',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
        uniques: [
          {
            columnNames: ['user_id', 'fixture_id'],
          },
        ],
      }),
      true,
    );

    // Create indexes for fixtures table
    await queryRunner.createIndex(
      'fixtures',
      new TableIndex({
        name: 'IDX_fixtures_week',
        columnNames: ['week'],
      }),
    );
    await queryRunner.createIndex(
      'fixtures',
      new TableIndex({
        name: 'IDX_fixtures_match_date',
        columnNames: ['match_date'],
      }),
    );
    await queryRunner.createIndex(
      'fixtures',
      new TableIndex({
        name: 'IDX_fixtures_status',
        columnNames: ['status'],
      }),
    );

    // Create indexes for specs table
    await queryRunner.createIndex(
      'specs',
      new TableIndex({
        name: 'IDX_specs_user_id',
        columnNames: ['user_id'],
      }),
    );
    await queryRunner.createIndex(
      'specs',
      new TableIndex({
        name: 'IDX_specs_week',
        columnNames: ['week'],
      }),
    );
    await queryRunner.createIndex(
      'specs',
      new TableIndex({
        name: 'IDX_specs_user_week',
        columnNames: ['user_id', 'week'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes first
    await queryRunner.dropIndex('specs', 'IDX_specs_user_week');
    await queryRunner.dropIndex('specs', 'IDX_specs_week');
    await queryRunner.dropIndex('specs', 'IDX_specs_user_id');
    await queryRunner.dropIndex('fixtures', 'IDX_fixtures_status');
    await queryRunner.dropIndex('fixtures', 'IDX_fixtures_match_date');
    await queryRunner.dropIndex('fixtures', 'IDX_fixtures_week');

    // Drop tables
    await queryRunner.dropTable('specs');
    await queryRunner.dropTable('fixtures');
  }
}
