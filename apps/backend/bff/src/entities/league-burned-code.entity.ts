import { Entity, PrimaryColumn, Column, Index } from 'typeorm';

/**
 * I codici d'invito fuori circolazione.
 *
 * Quando un codice smette di valere — rigenerato, inviti chiusi, lega
 * eliminata — non torna subito disponibile. Lo spazio è di 31^4 = 923.521
 * combinazioni: senza questa tabella, un codice appena liberato può essere
 * riassegnato a un'altra lega mentre qualcuno ce l'ha ancora scritto su un
 * foglietto, e quel qualcuno entrerebbe in casa di estranei.
 *
 * Non è una traccia storica: le righe si cancellano da sole passati i mesi di
 * quarantena, e il codice torna utilizzabile.
 */
@Entity('league_burned_codes')
@Index('idx_league_burned_codes_burned_at', ['burnedAt'])
export class LeagueBurnedCode {
  @PrimaryColumn({ type: 'char', length: 4 })
  code!: string;

  @Column({ type: 'timestamptz', name: 'burned_at', default: () => 'NOW()' })
  burnedAt!: Date;
}
