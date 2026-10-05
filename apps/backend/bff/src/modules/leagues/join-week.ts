/**
 * Da quale giornata comincia a contare chi entra adesso.
 *
 * La regola: se la giornata in corso ha già visto un fischio d'inizio, si
 * entra dalla successiva. Senza, chi entra a giornata finita si porterebbe in
 * dote dei punti fatti quando i risultati erano già noti — e il primo a
 * farlo rovinerebbe la classifica per tutti gli altri.
 */

/** Le forme in cui l'orario di una partita può arrivare da gaming-services. */
export interface FixtureLike {
  match_date?: string | Date | null;
  matchDate?: string | Date | null;
  kickoff?: { iso?: string | null } | null;
}

export function kickoffOf(fixture: FixtureLike): Date | null {
  const raw =
    fixture?.match_date ?? fixture?.matchDate ?? fixture?.kickoff?.iso;
  if (!raw) return null;
  const date = raw instanceof Date ? raw : new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function resolveJoinFromWeek(
  currentWeek: number,
  fixturesOfCurrentWeek: FixtureLike[],
  now: Date = new Date(),
): number {
  const started = (fixturesOfCurrentWeek ?? []).some((fixture) => {
    const kickoff = kickoffOf(fixture);
    return kickoff !== null && kickoff.getTime() <= now.getTime();
  });

  return started ? currentWeek + 1 : currentWeek;
}
