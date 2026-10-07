/**
 * Allineamento delle identità fra le tre anagrafiche di Swipick.
 *
 * L'identità di una persona vive in tre posti diversi:
 *   - `users.id` (uuid)       — la chiave che usano leghe, avatar e preferenze
 *   - `users.firebase_uid`    — la chiave che usano specs e final_week_scores
 *   - Firebase Auth           — l'unico posto dove l'utenza può davvero accedere
 *
 * Il Firebase UID è assegnato dal *progetto* Firebase, non dalla persona: se il
 * progetto cambia, tutti gli UID cambiano insieme a lui e il dato di gioco si
 * scollega dall'anagrafica senza che niente dia errore. È quello che è
 * successo a Swipick al passaggio da `swipick-ab224` a `swipick-2026`.
 *
 * Queste funzioni sono pure: ricevono le tre liste e dicono cosa è agganciato,
 * cosa è riagganciabile e cosa è irrecuperabile. Nessuna query, nessuna rete.
 */

/** Una riga di `users`, ridotta a quel che serve per l'allineamento. */
export interface RigaUtente {
  id: string;
  firebaseUid: string;
  nickname: string | null;
  email: string | null;
  creatoIl: Date;
}

/** Un'utenza vista in Firebase Auth. */
export interface UtenzaFirebase {
  uid: string;
  email: string | null;
}

/** Un autore di dati di gioco, identificato dal solo Firebase UID. */
export interface AutoreGioco {
  uid: string;
  righe: number;
}

export type StatoUtente =
  /** l'UID in `users` esiste in Firebase: la persona può accedere */
  | 'agganciato'
  /** l'UID non esiste più, ma la stessa email sì: si può riscrivere l'UID */
  | 'riagganciabile'
  /** né l'UID né l'email esistono in Firebase: nessun modo di risalire */
  | 'perso';

export interface EsitoUtente {
  utente: RigaUtente;
  stato: StatoUtente;
  /** Valorizzato solo per `riagganciabile`: l'UID da scrivere in `users`. */
  uidCorretto: string | null;
}

export type StatoAutore =
  /** l'UID corrisponde a una riga di `users` */
  | 'riconosciuto'
  /** nessuna riga in `users`, ma l'utenza esiste in Firebase: si può ricreare */
  | 'ricostruibile'
  /** l'UID non esiste da nessuna parte: dato di gioco senza proprietario */
  | 'orfano';

export interface EsitoAutore {
  autore: AutoreGioco;
  stato: StatoAutore;
  /** Il nickname, quando l'autore è riconosciuto. */
  nickname: string | null;
  /** L'email con cui ricostruire l'anagrafica, quando è ricostruibile. */
  email: string | null;
}

export interface Rapporto {
  utenti: EsitoUtente[];
  autori: EsitoAutore[];
  /** Utenze che possono accedere ma non hanno riga in `users`. */
  senzaAnagrafica: UtenzaFirebase[];
  conteggi: {
    utentiAgganciati: number;
    utentiRiagganciabili: number;
    utentiPersi: number;
    autoriRiconosciuti: number;
    autoriRicostruibili: number;
    autoriOrfani: number;
    /** Righe di gioco che non risalgono a nessuna persona. */
    righeOrfane: number;
  };
}

function perEmail(utenze: UtenzaFirebase[]): Map<string, UtenzaFirebase> {
  const mappa = new Map<string, UtenzaFirebase>();
  for (const u of utenze) {
    if (u.email) mappa.set(u.email.toLowerCase(), u);
  }
  return mappa;
}

/**
 * Confronta le tre anagrafiche e classifica ogni riga.
 *
 * `autori` è l'elenco degli UID che compaiono nei dati di gioco (`specs`,
 * `final_week_scores`) con il numero di righe di ciascuno, già aggregato.
 */
export function allineaIdentita(
  utenti: RigaUtente[],
  utenzeFirebase: UtenzaFirebase[],
  autori: AutoreGioco[],
): Rapporto {
  const uidFirebase = new Set(utenzeFirebase.map((u) => u.uid));
  const emailFirebase = perEmail(utenzeFirebase);
  const utentiPerUid = new Map(utenti.map((u) => [u.firebaseUid, u]));

  const esitiUtenti: EsitoUtente[] = utenti.map((utente) => {
    if (uidFirebase.has(utente.firebaseUid)) {
      return { utente, stato: 'agganciato', uidCorretto: null };
    }
    const viaEmail = utente.email
      ? emailFirebase.get(utente.email.toLowerCase())
      : undefined;
    if (viaEmail) {
      return { utente, stato: 'riagganciabile', uidCorretto: viaEmail.uid };
    }
    return { utente, stato: 'perso', uidCorretto: null };
  });

  const esitiAutori: EsitoAutore[] = autori.map((autore) => {
    const riga = utentiPerUid.get(autore.uid);
    if (riga) {
      return {
        autore,
        stato: 'riconosciuto',
        nickname: riga.nickname,
        email: riga.email,
      };
    }
    const utenza = utenzeFirebase.find((u) => u.uid === autore.uid);
    if (utenza) {
      return {
        autore,
        stato: 'ricostruibile',
        nickname: null,
        email: utenza.email,
      };
    }
    return { autore, stato: 'orfano', nickname: null, email: null };
  });

  const uidInAnagrafica = new Set(utenti.map((u) => u.firebaseUid));
  const senzaAnagrafica = utenzeFirebase.filter(
    (u) => !uidInAnagrafica.has(u.uid),
  );

  const contaUtenti = (stato: StatoUtente) =>
    esitiUtenti.filter((e) => e.stato === stato).length;
  const contaAutori = (stato: StatoAutore) =>
    esitiAutori.filter((e) => e.stato === stato).length;

  return {
    utenti: esitiUtenti,
    autori: esitiAutori,
    senzaAnagrafica,
    conteggi: {
      utentiAgganciati: contaUtenti('agganciato'),
      utentiRiagganciabili: contaUtenti('riagganciabile'),
      utentiPersi: contaUtenti('perso'),
      autoriRiconosciuti: contaAutori('riconosciuto'),
      autoriRicostruibili: contaAutori('ricostruibile'),
      autoriOrfani: contaAutori('orfano'),
      righeOrfane: esitiAutori
        .filter((e) => e.stato === 'orfano')
        .reduce((somma, e) => somma + e.autore.righe, 0),
    },
  };
}

/**
 * Data di passaggio da `swipick-ab224` a `swipick-2026`: il commit
 * «Change bundle ID to com.zenotomiolo.swipick for client handover».
 * Serve a distinguere le identità perse per il cambio di progetto da
 * eventuali perdite nuove, che sarebbero un problema diverso.
 */
export const CAMBIO_PROGETTO_FIREBASE = new Date('2026-02-24T00:00:00Z');

/**
 * Vero se la riga è anteriore al cambio di progetto, cioè se la sua perdita è
 * spiegata dal passaggio e non da un guasto successivo.
 */
export function spiegataDalCambioProgetto(utente: RigaUtente): boolean {
  return utente.creatoIl < CAMBIO_PROGETTO_FIREBASE;
}
