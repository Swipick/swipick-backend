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

/** Vero appena una partita della giornata ha visto il fischio d'inizio. */
export function weekHasStarted(
  fixtures: FixtureLike[],
  now: Date = new Date(),
): boolean {
  return (fixtures ?? []).some((fixture) => {
    const kickoff = kickoffOf(fixture);
    return kickoff !== null && kickoff.getTime() <= now.getTime();
  });
}

export function resolveJoinFromWeek(
  currentWeek: number,
  fixturesOfCurrentWeek: FixtureLike[],
  now: Date = new Date(),
): number {
  return weekHasStarted(fixturesOfCurrentWeek, now)
    ? currentWeek + 1
    : currentWeek;
}

/**
 * Quale giornata mostra la classifica di giornata di una lega.
 *
 * La giornata "in corso" di gaming-services è la prossima da giocare: fra un
 * turno e l'altro non ha ancora nessun risultato, e una classifica su di lei
 * mette tutti a zero. Finché non comincia si mostra quindi l'ultima conclusa,
 * con la stessa regola della schermata Risultati nell'app; dal primo fischio
 * d'inizio si passa a quella nuova, e i punti salgono partita per partita.
 */
export function resolveStandingsWeek(
  currentWeek: number,
  fixturesOfCurrentWeek: FixtureLike[],
  now: Date = new Date(),
): number {
  if (weekHasStarted(fixturesOfCurrentWeek, now)) return currentWeek;
  return Math.max(currentWeek - 1, 1);
}
