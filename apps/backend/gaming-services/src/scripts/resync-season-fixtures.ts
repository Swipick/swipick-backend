/**
 * Resync fixtures di una o più giornate da API-FOOTBALL — UPDATE in place.
 *
 * Non cancella nulla: aggiorna date, status, punteggi, result ed
 * external_api_id dei fixture esistenti, preservando le predizioni utente
 * (specs) collegate.
 *
 * Le regole di abbinamento e di confronto vivono in
 * `src/modules/calendar-sync/calendar-sync.ts`, condivise con il job
 * schedulato: questo file e' solo la sua shell da riga di comando, per gli
 * interventi mirati fuori dalla cadenza notturna.
 *
 * Uso:
 *   npx ts-node src/scripts/resync-season-fixtures.ts 35 36 37 38          # dry-run
 *   npx ts-node src/scripts/resync-season-fixtures.ts 35 36 37 38 --apply  # scrive
 *
 * Richiede DATABASE_URL e API_FOOTBALL_KEY nell'ambiente (.env root monorepo).
 */
import { DataSource } from 'typeorm';
import axios from 'axios';
import { config } from 'dotenv';
import { resolve } from 'path';
import {
  ApiCalendarFixture,
  DbCalendarFixture,
  planRoundUpdates,
  roundLabel,
} from '../modules/calendar-sync/calendar-sync';

config({ path: resolve(__dirname, '../../../../../.env') });
config();

const LEAGUE_ID = 135; // Serie A
const SEASON = parseInt(process.env.CURRENT_SEASON ?? '2025', 10);

interface ApiFixtureResponse {
  fixture: {
    id: number;
    date: string;
    venue: { name: string | null };
    status: { short: string };
  };
  teams: {
    home: { id: number; name: string };
    away: { id: number; name: string };
  };
  goals: { home: number | null; away: number | null };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const weeks = args.filter((a) => /^\d+$/.test(a)).map(Number);

  if (weeks.length === 0) {
    console.error(
      'Specificare almeno una giornata, es: resync-season-fixtures.ts 35 36',
    );
    process.exit(1);
  }

  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey || !process.env.DATABASE_URL) {
    console.error("API_FOOTBALL_KEY o DATABASE_URL mancanti nell'ambiente");
    process.exit(1);
  }

  console.log(
    `Modalità: ${apply ? '✍️  APPLY (scrive sul DB)' : '👀 DRY-RUN (nessuna scrittura)'}`,
  );
  console.log(`Stagione: ${SEASON} — Giornate: ${weeks.join(', ')}\n`);

  const dataSource = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: true }, // Verify Neon certificate (public CA)
  });
  await dataSource.initialize();

  let updated = 0;
  let unchanged = 0;
  const unmatched: string[] = [];

  for (const week of weeks) {
    const { data } = await axios.get(
      'https://v3.football.api-sports.io/fixtures',
      {
        headers: {
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': 'v3.football.api-sports.io',
        },
        params: { league: LEAGUE_ID, season: SEASON, round: roundLabel(week) },
      },
    );

    const response: ApiFixtureResponse[] = data.response ?? [];
    console.log(`— Giornata ${week}: ${response.length} partite da API`);
    if (response.length === 0) continue;

    const apiFixtures: ApiCalendarFixture[] = response.map((api) => ({
      apiId: api.fixture.id,
      date: api.fixture.date,
      statusShort: api.fixture.status.short,
      homeTeam: api.teams.home.name,
      awayTeam: api.teams.away.name,
      homeGoals: api.goals.home,
      awayGoals: api.goals.away,
    }));

    // Il filtro per stagione e' obbligatorio: in tabella convivono piu'
    // stagioni con gli stessi numeri di giornata, e il fallback per nome
    // squadra aggancerebbe la riga della stagione sbagliata.
    const dbFixtures: DbCalendarFixture[] = await dataSource.query(
      'SELECT id, home_team, away_team, match_date, status, home_score, away_score, result, external_api_id FROM fixtures WHERE week = $1 AND season = $2',
      [week, SEASON],
    );

    const plan = planRoundUpdates(apiFixtures, dbFixtures);
    unchanged += plan.unchanged;
    unmatched.push(...plan.unmatched.map((label) => `g.${week}: ${label}`));

    for (const update of plan.updates) {
      console.log(`  ${update.label}: ${update.changes.join(', ')}`);
      if (update.imminent) {
        console.log(
          `    ⚠️  calcio d'inizio spostato entro 48h — probabile rinvio`,
        );
      }
      updated++;

      if (apply) {
        await dataSource.query(
          `UPDATE fixtures
           SET match_date = $1, status = $2, home_score = $3, away_score = $4,
               result = $5, external_api_id = $6, updated_at = NOW()
           WHERE id = $7`,
          [
            update.match_date,
            update.status,
            update.home_score,
            update.away_score,
            update.result,
            update.external_api_id,
            update.id,
          ],
        );
      }
    }
  }

  console.log(
    `\n${apply ? 'Aggiornate' : 'Da aggiornare'}: ${updated} — Già corrette: ${unchanged}`,
  );
  if (unmatched.length > 0) {
    console.log(
      `⚠️  Non abbinate (nessuna modifica): \n  ${unmatched.join('\n  ')}`,
    );
  }
  if (!apply && updated > 0) {
    console.log(
      '\nNessuna scrittura effettuata. Rilanciare con --apply per applicare.',
    );
  }

  await dataSource.destroy();
}

main().catch((err) => {
  console.error('Resync failed:', err.message);
  process.exit(1);
});
