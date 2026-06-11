/**
 * Diagnostic: fixtures integrity per giornata (read-only).
 *
 * Trova la root cause dei risultati mancanti nella pagina Risultati:
 *   - giornate con meno di 10 partite
 *   - partite passate senza risultato finale (backfill mancato)
 *   - calendari degeneri a giorno singolo (date segnaposto mai risincronizzate)
 *
 * Uso:  npx ts-node src/scripts/check-fixtures-integrity.ts
 * Richiede DATABASE_URL nell'ambiente (.env della root del monorepo).
 */
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { resolve } from 'path';
import {
  analyzeSeasonIntegrity,
  FixtureSnapshot,
} from '../modules/fixtures/fixture-integrity';

config({ path: resolve(__dirname, '../../../../../.env') });
config(); // fallback: .env locale

async function main(): Promise<void> {
  const dataSource = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: true }, // Verify Neon certificate (public CA)
  });
  await dataSource.initialize();

  const rows: Array<{
    week: number;
    match_date: Date;
    status: FixtureSnapshot['status'];
    result: FixtureSnapshot['result'];
    home_score: number | null;
    away_score: number | null;
  }> = await dataSource.query(
    'SELECT week, match_date, status, result, home_score, away_score FROM fixtures ORDER BY week, match_date',
  );

  const reports = analyzeSeasonIntegrity(
    rows.map((r) => ({ ...r, match_date: new Date(r.match_date) })),
  );

  console.log('week | partite | mancanti | senza_risultato | giorni | range');
  console.log('-----|---------|----------|-----------------|--------|------------------');
  for (const r of reports) {
    const range =
      r.firstMatch && r.lastMatch
        ? `${r.firstMatch.toISOString().slice(0, 10)} → ${r.lastMatch.toISOString().slice(0, 10)}`
        : '—';
    const flag = r.issues.length > 0 ? '  ⚠️  ' + r.issues.join(',') : '';
    console.log(
      `${String(r.week).padStart(4)} | ${String(r.fixtureCount).padStart(7)} | ${String(r.missingFixtures).padStart(8)} | ${String(r.unresolvedResults).padStart(15)} | ${String(r.distinctMatchDays).padStart(6)} | ${range}${flag}`,
    );
  }

  const broken = reports.filter((r) => r.issues.length > 0);
  console.log(
    broken.length === 0
      ? '\n✅ Nessun problema di integrità rilevato.'
      : `\n⚠️  ${broken.length} giornate con problemi: ${broken.map((r) => r.week).join(', ')}`,
  );

  await dataSource.destroy();
}

main().catch((err) => {
  console.error('Integrity check failed:', err);
  process.exit(1);
});
