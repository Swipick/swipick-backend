/**
 * I punteggi di giornata calcolati dai pronostici, non letti da una tabella.
 *
 * `final_week_scores` esisteva per questo — indice su `['week','season','mode']`
 * e commento «Season-scoped percentile/leaderboard» — ma nessuno l'ha mai
 * riempita: il frontend non ha mai chiamato `POST /api/final-week-scores` in
 * tutta la sua storia, e le poche righe presenti sono prove manuali del 2025.
 * Una classifica costruita su quella tabella mostra zero per tutti.
 *
 * La fonte vera è `specs` unita a `fixtures`: il pronostico è giusto quando
 * `specs.choice` combacia con `fixtures.result`. È la stessa regola che
 * `SpecsService.mapSpecToResponse` applica già per la schermata Risultati, ed
 * è per questo che lì le singole partite sono sempre state giuste mentre i
 * totali erano a zero.
 *
 * Calcolare invece di memorizzare costa una `GROUP BY` in più e in cambio
 * toglie di mezzo una classe intera di guasti: il dato derivato che resta
 * vecchio quando il risultato di una partita viene corretto a posteriori.
 */
import { LeaderboardRowDto } from './dto/final-week-scores.dto';

/** La scelta che non è un pronostico: non entra né al numeratore né al denominatore. */
export const SCELTA_SALTATA = 'SKIP';

/**
 * Una riga così come la restituisce Postgres: i `count(*)` arrivano come
 * stringhe, ed è il punto in cui è facile sbagliare — `'3' + '2'` fa `'32'`.
 */
export interface RigaGrezza {
  userId: string;
  week: number | string;
  correct: number | string;
  revealed: number | string;
}

/**
 * La query che aggrega i pronostici per utente e giornata.
 *
 * `revealed` conta i pronostici su partite con un risultato, cioè quelli che
 * contano davvero; `correct` quelli azzeccati fra questi. Le giornate ancora
 * senza nessun risultato vengono escluse dall'`HAVING`: contribuirebbero zero
 * sia ai punti sia al totale, e restituirle allungherebbe solo la risposta.
 *
 * Parametri: `$1` gli UID, `$2` la stagione, `$3` la modalità, `$4` la
 * giornata quando richiesta.
 */
export function sqlPunteggiDaPronostici(conGiornata: boolean): string {
  return `
    SELECT s.user_id AS "userId",
           s.week,
           count(*) FILTER (WHERE f.result IS NOT NULL
                              AND s.choice::text = f.result::text) AS correct,
           count(*) FILTER (WHERE f.result IS NOT NULL) AS revealed
      FROM specs s
      JOIN fixtures f ON f.id = s.fixture_id
     WHERE s.user_id = ANY($1::text[])
       AND s.season = $2
       AND s.mode = $3
       AND s.choice::text <> '${SCELTA_SALTATA}'
       ${conGiornata ? 'AND s.week = $4' : ''}
     GROUP BY s.user_id, s.week
    HAVING count(*) FILTER (WHERE f.result IS NOT NULL) > 0
     ORDER BY s.week ASC
  `;
}

/**
 * Converte le righe di Postgres nel DTO, forzando i numeri.
 *
 * Le righe senza niente di rivelato vengono scartate anche qui: l'`HAVING`
 * della query le esclude già, ma chi chiama non deve dipendere da quel
 * dettaglio per non dividere per zero.
 */
export function convertiRighe(righe: RigaGrezza[]): LeaderboardRowDto[] {
  return righe
    .map((riga) => ({
      userId: riga.userId,
      week: Number(riga.week),
      correct: Number(riga.correct),
      revealed: Number(riga.revealed),
    }))
    .filter((riga) => riga.revealed > 0);
}
