/**
 * Import a full Serie A season calendar into the `fixtures` table (INSERT).
 *
 * Unlike resync-season-fixtures.ts (which UPDATEs existing rows in place to
 * refresh results), this inserts a brand-new season with `season = <year>`,
 * preserving any other season already present. Idempotent: refuses to run if
 * the season already has fixtures (unless --force), and inserts inside a
 * transaction.
 *
 * Uso:
 *   npx ts-node src/scripts/import-season-fixtures.ts --season 2026          # dry-run
 *   npx ts-node src/scripts/import-season-fixtures.ts --season 2026 --apply  # scrive
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

interface ApiFixture {
  fixture: {
    id: number;
    date: string;
    venue: { name: string | null };
    status: { short: string };
  };
  league: { round: string };
  teams: {
    home: { id: number; name: string };
    away: { id: number; name: string };
  };
  goals: { home: number | null; away: number | null };
}

const FINISHED = new Set(['FT', 'AET', 'PEN']);
const LIVE = new Set(['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE']);

const mapStatus = (short: string): string => {
  if (FINISHED.has(short)) return 'FINISHED';
  if (LIVE.has(short)) return 'LIVE';
  if (short === 'PST') return 'POSTPONED';
  if (short === 'CANC') return 'CANCELLED';
  return 'SCHEDULED';
};

const computeResult = (
  home: number | null,
  away: number | null,
): string | null => {
  if (home === null || away === null) return null;
  if (home > away) return '1';
  if (home < away) return '2';
  return 'X';
};

const weekFromRound = (round: string): number => {
  const m = round.match(/(\d+)$/);
  return m ? parseInt(m[1], 10) : 1;
};

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const force = args.includes('--force');
  const seasonArg = args[args.indexOf('--season') + 1];
  const season = seasonArg ? parseInt(seasonArg, 10) : NaN;

  if (Number.isNaN(season)) {
    console.error('Specificare --season <anno>, es: --season 2026');
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
  console.log(`Stagione da importare: ${season}\n`);

  const dataSource = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: true }, // Verify Neon certificate (public CA)
  });
  await dataSource.initialize();

  // Idempotency guard: refuse if the season already exists.
  const existing: Array<{ count: string }> = await dataSource.query(
    'SELECT COUNT(*)::text AS count FROM fixtures WHERE season = $1',
    [season],
  );
  const existingCount = parseInt(existing[0]?.count ?? '0', 10);
  if (existingCount > 0 && !force) {
    console.error(
      `⚠️  La stagione ${season} ha già ${existingCount} fixture nel DB. Usa --force per reimportare.`,
    );
    await dataSource.destroy();
    process.exit(1);
  }

  console.log(`📡 Fetching Serie A ${season} fixtures da API-Football...`);
  const { data } = await axios.get(
    'https://v3.football.api-sports.io/fixtures',
    {
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'v3.football.api-sports.io',
      },
      params: { league: LEAGUE_ID, season },
    },
  );
  const apiFixtures: ApiFixture[] = data.response ?? [];
  console.log(`✅ Ricevute ${apiFixtures.length} partite da API\n`);

  if (apiFixtures.length === 0) {
    console.error('Nessuna partita restituita — abort.');
    await dataSource.destroy();
    process.exit(1);
  }

  const rows = apiFixtures.map((api) => ({
    home_team: api.teams.home.name,
    away_team: api.teams.away.name,
    match_date: new Date(api.fixture.date),
    stadium: api.fixture.venue?.name ?? 'TBD',
    week: weekFromRound(api.league.round),
    season,
    status: mapStatus(api.fixture.status.short),
    result:
      mapStatus(api.fixture.status.short) === 'FINISHED'
        ? computeResult(api.goals.home, api.goals.away)
        : null,
    home_score: api.goals.home,
    away_score: api.goals.away,
    external_api_id: `api_football_${api.fixture.id}`,
  }));

  const byWeek = rows.reduce<Record<number, number>>((acc, r) => {
    acc[r.week] = (acc[r.week] ?? 0) + 1;
    return acc;
  }, {});
  console.log(
    `Riepilogo: ${rows.length} partite, ${Object.keys(byWeek).length} giornate distinte.`,
  );

  if (!apply) {
    console.log(
      '\n👀 DRY-RUN: nessuna scrittura. Rilanciare con --apply per importare.',
    );
    await dataSource.destroy();
    return;
  }

  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();
  try {
    for (const r of rows) {
      await queryRunner.query(
        `INSERT INTO fixtures
           (home_team, away_team, match_date, stadium, week, season, status, result, home_score, away_score, external_api_id, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, NOW(), NOW())`,
        [
          r.home_team,
          r.away_team,
          r.match_date,
          r.stadium,
          r.week,
          r.season,
          r.status,
          r.result,
          r.home_score,
          r.away_score,
          r.external_api_id,
        ],
      );
    }
    await queryRunner.commitTransaction();
    console.log(
      `\n✍️  Inserite ${rows.length} fixture per la stagione ${season}.`,
    );
  } catch (err) {
    await queryRunner.rollbackTransaction();
    console.error('Import fallito, rollback eseguito:', (err as Error).message);
    process.exitCode = 1;
  } finally {
    await queryRunner.release();
    await dataSource.destroy();
  }
}

main().catch((err) => {
  console.error('Import failed:', err.message);
  process.exit(1);
});
