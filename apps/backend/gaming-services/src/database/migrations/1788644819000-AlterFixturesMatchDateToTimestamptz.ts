import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Converte fixtures.match_date da `timestamp` (senza fuso) a `timestamptz`.
 *
 * Una colonna senza fuso conserva solo un orario da parete: cosa significhi
 * dipende da chi scrive. L'import della stagione 2026 e' stato lanciato da una
 * macchina con TZ=Europe/Rome e vi ha salvato ora locale italiana, mentre il
 * resto dello stack rilegge quel valore come UTC — ogni calcio d'inizio della
 * stagione risultava 1-2 ore in ritardo, con uno scarto pari all'offset di
 * Roma alla data della partita e quindi variabile con l'ora legale.
 *
 * I dati sono gia' stati riportati a UTC; questa migrazione rende il fuso
 * esplicito nello schema, cosi' che nessuno script possa piu' reintrodurre lo
 * scarto in base a dove viene eseguito.
 *
 * La conversione dichiara `AT TIME ZONE 'UTC'` invece di lasciare che Postgres
 * usi il TimeZone della sessione: senza quella clausola il risultato
 * dipenderebbe da dove gira la migrazione, cioe' esattamente il difetto che
 * stiamo chiudendo. `down` e' simmetrica e riporta gli stessi orari UTC.
 */
export class AlterFixturesMatchDateToTimestamptz1788644819000
  implements MigrationInterface
{
  name = 'AlterFixturesMatchDateToTimestamptz1788644819000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "fixtures"
         ALTER COLUMN "match_date" TYPE timestamptz
         USING "match_date" AT TIME ZONE 'UTC'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "fixtures"
         ALTER COLUMN "match_date" TYPE timestamp
         USING "match_date" AT TIME ZONE 'UTC'`,
    );
  }
}
