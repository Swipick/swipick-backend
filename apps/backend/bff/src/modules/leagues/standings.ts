import { LeagueRole } from '../../entities/league-member.entity';

/**
 * Il calcolo della classifica di una lega.
 *
 * Sta qui, puro e senza database, perché è la parte dove un errore non si
 * vede: una somma sbagliata produce comunque una classifica dall'aria giusta,
 * ordinata e plausibile, e nessuno se ne accorge finché qualcuno non conta i
 * punti a mano. Stessa ragione per cui `weekMeter` sta fuori dalla schermata
 * Risultati nell'app.
 */

/** Un membro, già tradotto: `firebaseUid` serve ad agganciare i punteggi. */
export interface StandingMember {
  userId: string;
  firebaseUid: string;
  nickname: string | null;
  role: LeagueRole;
  joinedFromWeek: number;
}

/** Una riga di `final_week_scores`, come la restituisce gaming-services. */
export interface WeekScore {
  /** Firebase UID: gaming-services non conosce gli uuid del BFF. */
  userId: string;
  week: number;
  correct: number;
  revealed: number;
}

export interface StandingRow {
  userId: string;
  nickname: string | null;
  role: LeagueRole;
  /** null per chi non ha ancora una giornata valida: non è ultimo, è fuori. */
  position: number | null;
  points: number;
  revealed: number;
  percent: number;
  joinedFromWeek: number;
  /** true finché la sua prima giornata non è arrivata. */
  pending: boolean;
}

export interface StandingsOptions {
  /** 'season' somma tutto, 'week' guarda una giornata sola. */
  scope: 'season' | 'week';
  /** Richiesto con scope 'week'. */
  week?: number;
  /** Giornata in corso: serve a sapere chi deve ancora cominciare. */
  currentWeek: number;
}

function percentOf(correct: number, revealed: number): number {
  if (revealed <= 0) return 0;
  return Math.round((correct / revealed) * 100);
}

/**
 * Le righe ordinate, con le posizioni già assegnate.
 *
 * Due regole che vengono dal disegno, non dal codice:
 * - le giornate precedenti all'ingresso di un membro non contano per lui, mai,
 *   nemmeno se i punteggi esistono (e esistono: giocava già, solo altrove);
 * - chi entra a giornata iniziata compare subito in lista ma senza posizione,
 *   altrimenti sembrerebbe ultimo per demerito invece che per anzianita'.
 */
export function buildStandings(
  members: StandingMember[],
  scores: WeekScore[],
  options: StandingsOptions,
): StandingRow[] {
  const byUid = new Map<string, WeekScore[]>();
  for (const score of scores) {
    const list = byUid.get(score.userId);
    if (list) list.push(score);
    else byUid.set(score.userId, [score]);
  }

  const rows: StandingRow[] = members.map((member) => {
    const mine = byUid.get(member.firebaseUid) ?? [];

    const counted = mine.filter((score) => {
      if (score.week < member.joinedFromWeek) return false;
      if (options.scope === 'week') return score.week === options.week;
      return true;
    });

    const points = counted.reduce((sum, s) => sum + (s.correct ?? 0), 0);
    const revealed = counted.reduce((sum, s) => sum + (s.revealed ?? 0), 0);

    return {
      userId: member.userId,
      nickname: member.nickname,
      role: member.role,
      position: null,
      points,
      revealed,
      percent: percentOf(points, revealed),
      joinedFromWeek: member.joinedFromWeek,
      pending: member.joinedFromWeek > options.currentWeek,
    };
  });

  const byName = (a: StandingRow, b: StandingRow) =>
    (a.nickname ?? '').localeCompare(b.nickname ?? '');

  const inGara = rows
    .filter((row) => !row.pending)
    .sort(
      (a, b) => b.points - a.points || b.percent - a.percent || byName(a, b),
    );

  // Posizionamento standard: a parita' di punti e percentuale si condivide la
  // posizione, e la successiva salta (1, 2, 2, 4).
  let lastPosition = 0;
  inGara.forEach((row, index) => {
    const previous = inGara[index - 1];
    const samePlace =
      previous &&
      previous.points === row.points &&
      previous.percent === row.percent;
    lastPosition = samePlace ? lastPosition : index + 1;
    row.position = lastPosition;
  });

  const inAttesa = rows.filter((row) => row.pending).sort(byName);

  return [...inGara, ...inAttesa];
}
