import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateTestModeTablesFixturesAndSpecs1723456790000
  implements MigrationInterface
{
  name = 'CreateTestModeTablesFixturesAndSpecs1723456790000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create test_fixtures table
    await queryRunner.createTable(
      new Table({
        name: 'test_fixtures',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'week',
            type: 'int',
            comment: 'Giornata number (1-38)',
          },
          {
            name: 'date',
            type: 'timestamp',
            comment: 'Match date and time',
          },
          {
            name: 'homeTeam',
            type: 'varchar',
            length: '100',
            comment: 'Home team name',
          },
          {
            name: 'awayTeam',
            type: 'varchar',
            length: '100',
            comment: 'Away team name',
          },
          {
            name: 'homeScore',
            type: 'int',
            isNullable: true,
            comment: 'Home team final score',
          },
          {
            name: 'awayScore',
            type: 'int',
            isNullable: true,
            comment: 'Away team final score',
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['NS', '1H', 'HT', '2H', 'FT'],
            default: "'FT'",
            comment: 'Match status - test fixtures are always completed',
          },
          {
            name: 'result',
            type: 'varchar',
            length: '10',
            isNullable: true,
            comment: 'Match result: 1 (home win), X (draw), 2 (away win)',
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Create test_specs table
    await queryRunner.createTable(
      new Table({
        name: 'test_specs',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'userId',
            type: 'int',
            comment: 'Reference to user from BFF service',
          },
          {
            name: 'fixtureId',
            type: 'int',
            comment: 'Reference to test_fixtures.id',
          },
          {
            name: 'week',
            type: 'int',
            comment: 'Denormalized week for faster queries',
          },
          {
            name: 'choice',
            type: 'enum',
            enum: ['1', 'X', '2'],
            comment: 'User prediction: 1 (home win), X (draw), 2 (away win)',
          },
          {
            name: 'isCorrect',
            type: 'boolean',
            default: false,
            comment: 'Whether the prediction was correct',
          },
          {
            name: 'countsTowardPercentage',
            type: 'boolean',
            default: true,
            comment: 'Whether this prediction counts toward user percentage',
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
        foreignKeys: [
          {
            columnNames: ['fixtureId'],
            referencedTableName: 'test_fixtures',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
        uniques: [
          {
            name: 'UQ_test_specs_user_fixture',
            columnNames: ['userId', 'fixtureId'],
          },
        ],
      }),
      true,
    );

    // Create indexes for performance optimization
    await queryRunner.query(`
      CREATE INDEX IDX_test_fixtures_week_date ON test_fixtures (week, date);
      CREATE INDEX IDX_test_fixtures_teams ON test_fixtures ("homeTeam", "awayTeam");
      CREATE INDEX IDX_test_specs_user_week ON test_specs ("userId", week);
    `);

    console.log('✅ Test mode tables created successfully');
    console.log('📋 Tables: test_fixtures, test_specs');
    console.log('🔗 Foreign key: test_specs.fixtureId -> test_fixtures.id');
    console.log(
      '🚫 Unique constraint: userId + fixtureId (prevent duplicate predictions)',
    );
    console.log('📊 Indexes created for performance optimization');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables in reverse order due to foreign key constraints
    await queryRunner.dropTable('test_specs', true);
    await queryRunner.dropTable('test_fixtures', true);

    console.log('✅ Test mode tables dropped successfully');
  }
}
