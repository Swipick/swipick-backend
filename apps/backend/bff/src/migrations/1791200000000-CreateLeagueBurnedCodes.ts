import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * I codici d'invito dismessi restano fuori circolazione per qualche mese,
 * così non vengono riassegnati a un'altra lega mentre qualcuno ce li ha
 * ancora in mano.
 */
export class CreateLeagueBurnedCodes1791200000000
  implements MigrationInterface
{
  name = 'CreateLeagueBurnedCodes1791200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Il nome della chiave primaria è quello che genera TypeORM: se ne
    // mettessimo uno leggibile, `synchronize` lo sostituirebbe al primo
    // avvio in sviluppo.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "league_burned_codes" (
        "code" char(4) NOT NULL,
        "burned_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_3fae18cb761b07d82068e563ce2" PRIMARY KEY ("code")
      )
    `);

    // Serve alla pulizia periodica, che cancella per data.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_league_burned_codes_burned_at"
        ON "league_burned_codes" ("burned_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS "public"."idx_league_burned_codes_burned_at"',
    );
    await queryRunner.query('DROP TABLE IF EXISTS "league_burned_codes"');
  }
}
