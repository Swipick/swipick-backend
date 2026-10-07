import {
  allineaIdentita,
  spiegataDalCambioProgetto,
  RigaUtente,
  UtenzaFirebase,
  AutoreGioco,
} from '../identity-audit';

const utente = (p: Partial<RigaUtente> = {}): RigaUtente => ({
  id: 'uuid-1',
  firebaseUid: 'UID1',
  nickname: 'tizio',
  email: 'tizio@example.com',
  creatoIl: new Date('2026-09-01T00:00:00Z'),
  ...p,
});

describe('allineaIdentita — stato degli utenti', () => {
  it('aggancia chi ha un UID ancora presente in Firebase', () => {
    const r = allineaIdentita(
      [utente()],
      [{ uid: 'UID1', email: 'tizio@example.com' }],
      [],
    );
    expect(r.utenti[0].stato).toBe('agganciato');
    expect(r.utenti[0].uidCorretto).toBeNull();
    expect(r.conteggi.utentiAgganciati).toBe(1);
  });

  it('riaggancia via email chi ha un UID vecchio e propone l`UID nuovo', () => {
    const r = allineaIdentita(
      [utente({ firebaseUid: 'UID_VECCHIO' })],
      [{ uid: 'UID_NUOVO', email: 'Tizio@Example.com' }],
      [],
    );
    expect(r.utenti[0].stato).toBe('riagganciabile');
    expect(r.utenti[0].uidCorretto).toBe('UID_NUOVO');
  });

  it('considera perso chi non ha né UID né email in Firebase', () => {
    const r = allineaIdentita(
      [utente({ firebaseUid: 'UID_VECCHIO' })],
      [{ uid: 'ALTRO', email: 'altro@example.com' }],
      [],
    );
    expect(r.utenti[0].stato).toBe('perso');
    expect(r.conteggi.utentiPersi).toBe(1);
  });

  it('non riaggancia un utente senza email, nemmeno se un UID è libero', () => {
    const r = allineaIdentita(
      [utente({ firebaseUid: 'UID_VECCHIO', email: null })],
      [{ uid: 'UID_NUOVO', email: null }],
      [],
    );
    expect(r.utenti[0].stato).toBe('perso');
  });
});

describe('allineaIdentita — stato degli autori di dati di gioco', () => {
  const autore = (uid: string, righe: number): AutoreGioco => ({ uid, righe });

  it('riconosce l`autore che ha una riga in users e ne riporta il nickname', () => {
    const r = allineaIdentita(
      [utente({ nickname: 'zen' })],
      [{ uid: 'UID1', email: 'tizio@example.com' }],
      [autore('UID1', 103)],
    );
    expect(r.autori[0].stato).toBe('riconosciuto');
    expect(r.autori[0].nickname).toBe('zen');
    expect(r.conteggi.righeOrfane).toBe(0);
  });

  it('dice ricostruibile l`autore che esiste in Firebase ma non in users', () => {
    const r = allineaIdentita(
      [],
      [{ uid: 'UID_SOLO_FIREBASE', email: 'persona@example.com' }],
      [autore('UID_SOLO_FIREBASE', 12)],
    );
    expect(r.autori[0].stato).toBe('ricostruibile');
    expect(r.autori[0].email).toBe('persona@example.com');
    expect(r.conteggi.righeOrfane).toBe(0);
  });

  it('dice orfano l`autore che non esiste da nessuna parte e somma le righe', () => {
    const r = allineaIdentita(
      [],
      [],
      [autore('FANTASMA_A', 157), autore('FANTASMA_B', 57)],
    );
    expect(r.autori.map((a) => a.stato)).toEqual(['orfano', 'orfano']);
    expect(r.conteggi.autoriOrfani).toBe(2);
    expect(r.conteggi.righeOrfane).toBe(214);
  });

  it('un autore riconosciuto resta tale anche se la sua utenza Firebase è sparita', () => {
    // il dato di gioco risale alla persona tramite users, che è quel che serve
    // per mostrare un nickname in classifica, pur non potendo più accedere
    const r = allineaIdentita(
      [utente({ firebaseUid: 'UID_VECCHIO' })],
      [],
      [autore('UID_VECCHIO', 20)],
    );
    expect(r.autori[0].stato).toBe('riconosciuto');
    expect(r.utenti[0].stato).toBe('perso');
  });
});

describe('allineaIdentita — utenze senza anagrafica', () => {
  it('elenca chi può accedere ma non ha riga in users', () => {
    const r = allineaIdentita(
      [utente()],
      [
        { uid: 'UID1', email: 'tizio@example.com' },
        { uid: 'UID_NUDO', email: 'nuovo@example.com' },
      ],
      [],
    );
    expect(r.senzaAnagrafica.map((u) => u.uid)).toEqual(['UID_NUDO']);
  });

  it('non segnala niente quando le due anagrafiche combaciano', () => {
    const r = allineaIdentita(
      [utente()],
      [{ uid: 'UID1', email: 'tizio@example.com' }],
      [],
    );
    expect(r.senzaAnagrafica).toEqual([]);
  });
});

describe('spiegataDalCambioProgetto', () => {
  it('attribuisce al cambio di progetto le righe anteriori al 24 febbraio 2026', () => {
    expect(
      spiegataDalCambioProgetto(
        utente({ creatoIl: new Date('2025-10-18T00:00:00Z') }),
      ),
    ).toBe(true);
  });

  it('non attribuisce al cambio di progetto le righe successive', () => {
    expect(
      spiegataDalCambioProgetto(
        utente({ creatoIl: new Date('2026-03-28T00:00:00Z') }),
      ),
    ).toBe(false);
  });

  it('tratta il giorno del cambio come già dopo', () => {
    expect(
      spiegataDalCambioProgetto(
        utente({ creatoIl: new Date('2026-02-24T00:00:00Z') }),
      ),
    ).toBe(false);
  });
});
