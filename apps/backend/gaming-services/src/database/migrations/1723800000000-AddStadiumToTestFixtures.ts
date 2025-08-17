import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddStadiumToTestFixtures1723800000000
  implements MigrationInterface
{
  name = 'AddStadiumToTestFixtures1723800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'test_fixtures',
      new TableColumn({
        name: 'stadium',
        type: 'varchar',
        length: '150',
        isNullable: true,
      }),
    );

    // Optional backfill: set stadium based on homeTeam for existing rows
    const updates: Array<{ team: string; stadium: string }> = [
      { team: 'AC Milan', stadium: 'Giuseppe Meazza (San Siro)' },
      { team: 'Inter', stadium: 'Giuseppe Meazza (San Siro)' },
      { team: 'Torino', stadium: 'Stadio Olimpico Grande Torino' },
      { team: 'Juventus', stadium: 'Allianz Stadium' },
      { team: 'Napoli', stadium: 'Stadio Diego Armando Maradona' },
      { team: 'Lazio', stadium: 'Stadio Olimpico' },
      { team: 'Roma', stadium: 'Stadio Olimpico' },
      { team: 'Bologna', stadium: "Stadio Renato Dall'Ara" },
      { team: 'Udinese', stadium: 'Dacia Arena (Stadio Friuli)' },
      { team: 'Monza', stadium: 'U-Power Stadium' },
      { team: 'Salernitana', stadium: 'Stadio Arechi' },
      { team: 'Cagliari', stadium: 'Unipol Domus' },
      { team: 'Frosinone', stadium: 'Stadio Benito Stirpe' },
      { team: 'Fiorentina', stadium: 'Stadio Artemio Franchi' },
      {
        team: 'Empoli',
        stadium: 'Stadio Carlo Castellani – Computer Gross Arena',
      },
      { team: 'Hellas Verona', stadium: "Stadio Marc'Antonio Bentegodi" },
      { team: 'Atalanta', stadium: 'Gewiss Stadium' },
      { team: 'Lecce', stadium: 'Stadio Via del Mare' },
    ];

    for (const { team, stadium } of updates) {
      await queryRunner.query(
        `UPDATE "test_fixtures" SET "stadium" = $1 WHERE "homeTeam" = $2 AND "stadium" IS NULL`,
        [stadium, team],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('test_fixtures', 'stadium');
  }
}
