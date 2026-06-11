/**
 * Resync fixtures di una o più giornate da API-FOOTBALL — UPDATE in place.
 *
 * A differenza dei vecchi script refresh-week-*, NON cancella nulla:
 * aggiorna date, status, punteggi, result ed external_api_id dei fixture
 * esistenti, preservando le predizioni utente (specs) collegate.
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

config({ path: resolve(__dirname, '../../../../../.env') });
config();

const LEAGUE_ID = 135; // Serie A
const SEASON = parseInt(process.env.CURRENT_SEASON ?? '2025', 10);

interface ApiFixture {
  fixture: {
    id: number;
    date: string;
    venue: { name: string | null };
    status: { short: string };
  };
  teams: { home: { id: number; name: string }; away: { id: number; name: string } };
  goals: { home: number | null; away: number | null };
}

interface DbFixture {
  id: string;
  week: number;
  home_team: string;
  away_team: string;
  match_date: Date;
  status: string;
  home_score: number | null;
  away_score: number | null;
  result: string | null;
  external_api_id: string | null;
}

const FINISHED = new Set(['FT', 'AET', 'PEN']);
const LIVE = new Set(['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE']);

const normalize = (name: string): string =>
  name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\b(ac|as|ss|us|fc|calcio|1913|1909|1907)\b/g, '')
    .replace(/[^a-z]/g, '');

const mapStatus = (short: string): string => {
  if (FINISHED.has(short)) return 'FINISHED';
  if (LIVE.has(short)) return 'LIVE';
  if (short === 'PST') return 'POSTPONED';
  if (short === 'CANC') return 'CANCELLED';
  return 'SCHEDULED';
};

const computeResult = (home: number | null, away: number | null): string | null => {
  if (home === null || away === null) return null;
  if (home > away) return '1';
  if (home < away) return '2';
  return 'X';
};

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const weeks = args.filter((a) => /^\d+$/.test(a)).map(Number);

  if (weeks.length === 0) {
    console.error('Specificare almeno una giornata, es: resync-season-fixtures.ts 35 36');
    process.exit(1);
  }

  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey || !process.env.DATABASE_URL) {
    console.error('API_FOOTBALL_KEY o DATABASE_URL mancanti nell\'ambiente');
    process.exit(1);
  }

  console.log(`Modalità: ${apply ? '✍️  APPLY (scrive sul DB)' : '👀 DRY-RUN (nessuna scrittura)'}`);
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
    const round = `Regular Season - ${week}`;
    const { data } = await axios.get('https://v3.football.api-sports.io/fixtures', {
      headers: { 'X-RapidAPI-Key': apiKey, 'X-RapidAPI-Host': 'v3.football.api-sports.io' },
      params: { league: LEAGUE_ID, season: SEASON, round },
    });

    const apiFixtures: ApiFixture[] = data.response ?? [];
    console.log(`— Giornata ${week}: ${apiFixtures.length} partite da API`);
    if (apiFixtures.length === 0) continue;

    const dbFixtures: DbFixture[] = await dataSource.query(
      'SELECT id, week, home_team, away_team, match_date, status, home_score, away_score, result, external_api_id FROM fixtures WHERE week = $1',
      [week],
    );

    for (const api of apiFixtures) {
      const apiId = `api_football_${api.fixture.id}`;
      const db =
        dbFixtures.find((f) => f.external_api_id === apiId) ??
        dbFixtures.find(
          (f) =>
            normalize(f.home_team) === normalize(api.teams.home.name) &&
            normalize(f.away_team) === normalize(api.teams.away.name),
        );

      if (!db) {
        unmatched.push(`g.${week}: ${api.teams.home.name} vs ${api.teams.away.name}`);
        continue;
      }

      const newStatus = mapStatus(api.fixture.status.short);
      const newResult = newStatus === 'FINISHED' ? computeResult(api.goals.home, api.goals.away) : db.result;
      const newDate = new Date(api.fixture.date);

      const changes: string[] = [];
      if (new Date(db.match_date).getTime() !== newDate.getTime())
        changes.push(`date ${new Date(db.match_date).toISOString().slice(0, 16)} → ${newDate.toISOString().slice(0, 16)}`);
      if (db.status !== newStatus) changes.push(`status ${db.status} → ${newStatus}`);
      if (db.home_score !== api.goals.home || db.away_score !== api.goals.away)
        changes.push(`score ${db.home_score ?? '-'}–${db.away_score ?? '-'} → ${api.goals.home ?? '-'}–${api.goals.away ?? '-'}`);
      if (db.result !== newResult) changes.push(`result ${db.result ?? '-'} → ${newResult ?? '-'}`);
      if (db.external_api_id !== apiId) changes.push(`external_api_id → ${apiId}`);

      if (changes.length === 0) {
        unchanged++;
        continue;
      }

      console.log(`  ${db.home_team} vs ${db.away_team}: ${changes.join(', ')}`);
      updated++;

      if (apply) {
        await dataSource.query(
          `UPDATE fixtures
           SET match_date = $1, status = $2, home_score = $3, away_score = $4,
               result = $5, external_api_id = $6, updated_at = NOW()
           WHERE id = $7`,
          [newDate, newStatus, api.goals.home, api.goals.away, newResult, apiId, db.id],
        );
      }
    }
  }

  console.log(`\n${apply ? 'Aggiornate' : 'Da aggiornare'}: ${updated} — Già corrette: ${unchanged}`);
  if (unmatched.length > 0) {
    console.log(`⚠️  Non abbinate (nessuna modifica): \n  ${unmatched.join('\n  ')}`);
  }
  if (!apply && updated > 0) {
    console.log('\nNessuna scrittura effettuata. Rilanciare con --apply per applicare.');
  }

  await dataSource.destroy();
}

main().catch((err) => {
  console.error('Resync failed:', err.message);
  process.exit(1);
});
