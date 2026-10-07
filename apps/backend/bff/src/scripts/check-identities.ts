/**
 * Diagnostica: allineamento delle identità (sola lettura).
 *
 * Mette a confronto `users`, Firebase Auth e gli autori dei dati di gioco
 * (`specs`, `final_week_scores`) e dice, riga per riga, chi è agganciato, chi
 * si può riagganciare e chi è irrecuperabile.
 *
 * Serve perché il dato di gioco è indicizzato sul Firebase UID, che appartiene
 * al progetto Firebase e non alla persona: se il progetto cambia, il dato si
 * scollega in silenzio. Senza questo controllo la cosa non dà nessun errore —
 * le classifiche mostrano semplicemente zero.
 *
 * Uso:  npx ts-node src/scripts/check-identities.ts
 * Legge NEON_DB_* e FIREBASE_* dal .env del BFF; se le credenziali Firebase
 * mancano o sono finte, salta il confronto con Firebase e lo dichiara.
 */
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { resolve } from 'path';
import * as admin from 'firebase-admin';
import {
  allineaIdentita,
  spiegataDalCambioProgetto,
  RigaUtente,
  UtenzaFirebase,
  AutoreGioco,
  CAMBIO_PROGETTO_FIREBASE,
} from '../modules/users/identity-audit';

config({ path: resolve(__dirname, '../../.env') });
config({ path: resolve(__dirname, '../../../../../.env') });

function credenzialiFirebaseValide(): boolean {
  const chiave = process.env.FIREBASE_PRIVATE_KEY || '';
  return (
    !!process.env.FIREBASE_PROJECT_ID &&
    !!process.env.FIREBASE_CLIENT_EMAIL &&
    chiave.includes('BEGIN PRIVATE KEY') &&
    !chiave.includes('MOCK')
  );
}

async function elencaFirebase(): Promise<UtenzaFirebase[]> {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(
        /\\n/g,
        '\n',
      ),
    }),
  });
  const utenze: UtenzaFirebase[] = [];
  let pagina = await admin.auth().listUsers(1000);
  for (;;) {
    utenze.push(
      ...pagina.users.map((u) => ({ uid: u.uid, email: u.email ?? null })),
    );
    if (!pagina.pageToken) break;
    pagina = await admin.auth().listUsers(1000, pagina.pageToken);
  }
  return utenze;
}

async function main(): Promise<void> {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.NEON_DB_HOST,
    port: Number(process.env.NEON_DB_PORT || 5432),
    username: process.env.NEON_DB_USERNAME,
    password: process.env.NEON_DB_PASSWORD,
    database: process.env.NEON_DB_NAME,
    ssl: { rejectUnauthorized: true }, // certificato Neon, CA pubblica
  });
  await dataSource.initialize();

  const righe: Array<{
    id: string;
    firebase_uid: string;
    nickname: string | null;
    email: string | null;
    created_at: Date;
  }> = await dataSource.query(
    'SELECT id, firebase_uid, nickname, email, created_at FROM users ORDER BY created_at',
  );
  const utenti: RigaUtente[] = righe.map((r) => ({
    id: r.id,
    firebaseUid: r.firebase_uid,
    nickname: r.nickname,
    email: r.email,
    creatoIl: new Date(r.created_at),
  }));

  // gli autori dei dati di gioco, specs e punteggi messi insieme per UID
  const autoriRighe: Array<{ uid: string; righe: string }> =
    await dataSource.query(`
    SELECT uid, sum(n)::text AS righe FROM (
      SELECT user_id AS uid, count(*) n FROM specs GROUP BY user_id
      UNION ALL
      SELECT "userId" AS uid, count(*) n FROM final_week_scores GROUP BY "userId"
    ) t GROUP BY uid ORDER BY sum(n) DESC
  `);
  const autori: AutoreGioco[] = autoriRighe.map((a) => ({
    uid: a.uid,
    righe: Number(a.righe),
  }));

  await dataSource.destroy();

  if (!credenzialiFirebaseValide()) {
    console.log(
      'Credenziali Firebase assenti o finte: confronto con Firebase saltato.',
    );
    console.log(
      `users: ${utenti.length} righe — autori di dati di gioco: ${autori.length}`,
    );
    const conosciuti = new Set(utenti.map((u) => u.firebaseUid));
    const senzaAnagrafica = autori.filter((a) => !conosciuti.has(a.uid));
    console.log(
      `autori senza riga in users: ${senzaAnagrafica.length} (${senzaAnagrafica.reduce((s, a) => s + a.righe, 0)} righe)`,
    );
    return;
  }

  const utenzeFirebase = await elencaFirebase();
  const r = allineaIdentita(utenti, utenzeFirebase, autori);

  console.log(
    `users: ${utenti.length}   Firebase (${process.env.FIREBASE_PROJECT_ID}): ${utenzeFirebase.length}   autori di dati di gioco: ${autori.length}\n`,
  );

  console.log(
    'stato          nickname             email                                        creato',
  );
  console.log(
    '-------------- -------------------- -------------------------------------------- ----------',
  );
  for (const e of r.utenti) {
    const nota =
      e.stato === 'perso' && spiegataDalCambioProgetto(e.utente)
        ? '  (cambio progetto)'
        : e.stato === 'riagganciabile'
          ? `  → ${e.uidCorretto}`
          : '';
    console.log(
      `${e.stato.padEnd(14)} ${String(e.utente.nickname ?? '—').padEnd(20)} ${String(e.utente.email ?? '—').padEnd(44)} ${e.utente.creatoIl.toISOString().slice(0, 10)}${nota}`,
    );
  }

  console.log('\nautori dei dati di gioco');
  console.log('stato          righe  uid                              chi');
  console.log(
    '-------------- ------ -------------------------------- --------------------',
  );
  for (const a of r.autori) {
    const chi = a.nickname ?? a.email ?? '—';
    console.log(
      `${a.stato.padEnd(14)} ${String(a.autore.righe).padStart(6)} ${a.autore.uid.padEnd(32)} ${chi}`,
    );
  }

  if (r.senzaAnagrafica.length > 0) {
    console.log('\nutenze che possono accedere ma non hanno riga in users');
    for (const u of r.senzaAnagrafica) {
      console.log(`  ${u.uid}  ${u.email ?? '(senza email)'}`);
    }
  }

  const c = r.conteggi;
  console.log('\nriepilogo');
  console.log(`  utenti agganciati .......... ${c.utentiAgganciati}`);
  console.log(`  utenti riagganciabili ...... ${c.utentiRiagganciabili}`);
  console.log(`  utenti persi ............... ${c.utentiPersi}`);
  console.log(`  autori riconosciuti ........ ${c.autoriRiconosciuti}`);
  console.log(`  autori ricostruibili ....... ${c.autoriRicostruibili}`);
  console.log(
    `  autori orfani .............. ${c.autoriOrfani}  (${c.righeOrfane} righe di gioco)`,
  );

  const persiDopoIlCambio = r.utenti.filter(
    (e) => e.stato === 'perso' && !spiegataDalCambioProgetto(e.utente),
  );
  if (persiDopoIlCambio.length > 0) {
    console.log(
      `\n⚠️  ${persiDopoIlCambio.length} identità perse DOPO il ${CAMBIO_PROGETTO_FIREBASE.toISOString().slice(0, 10)}: non è il cambio di progetto, è una perdita nuova.`,
    );
  }
}

main().catch((errore) => {
  console.error('ERRORE:', errore instanceof Error ? errore.message : errore);
  process.exit(1);
});
