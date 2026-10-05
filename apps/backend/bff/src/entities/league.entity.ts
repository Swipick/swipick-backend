import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

/**
 * Una lega privata: un gruppo di amici che pronostica lo stesso campionato e si
 * confronta in classifica.
 *
 * La classifica non sta qui e non sta in nessuna tabella: è `final_week_scores`
 * (gaming-services) filtrato sui membri. Duplicare i punteggi vorrebbe dire
 * tenerli allineati a ogni rivelazione di risultato, e sarebbe la prima cosa a
 * rompersi.
 */
@Entity('leagues')
// I nomi sono espliciti perché le stesse tabelle le crea anche la migrazione
// (in produzione `synchronize` è spento): senza, TypeORM genererebbe nomi
// propri e in banca dati finirebbero due serie di indici uguali.
@Index('uq_leagues_invite_code', ['inviteCode'], {
  unique: true,
  where: 'invite_code IS NOT NULL',
})
@Index('idx_leagues_owner', ['ownerUserId'])
export class League {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 40 })
  name!: string;

  /**
   * Campionato della lega, con gli id di API-Football (135 = Serie A).
   * Oggi è sempre 135 — l'app segue solo la Serie A — ma la colonna c'è già
   * perché il giorno in cui arrivano gli altri campionati le leghe esistenti
   * devono restare interpretabili senza una migrazione di dati.
   */
  @Column({ type: 'integer', name: 'competition_id', default: 135 })
  competitionId!: number;

  /** Stagione di inizio: 2025 = 2025/26. Una lega vive dentro una stagione. */
  @Column({ type: 'integer' })
  season!: number;

  @Column({ type: 'uuid', name: 'owner_user_id' })
  ownerUserId!: string;

  // La relazione serve a dichiarare la foreign key: il servizio lavora con gli
  // id, ma senza questa `synchronize` non vedrebbe il vincolo e proverebbe a
  // toglierlo a ogni avvio.
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_user_id' })
  owner?: User;

  /**
   * Il codice d'invito in corso. NULL = inviti chiusi: la lega resta viva ma
   * nessuno può entrare.
   */
  @Column({ type: 'char', length: 4, nullable: true, name: 'invite_code' })
  inviteCode!: string | null;

  @Column({
    type: 'timestamptz',
    nullable: true,
    name: 'invite_code_expires_at',
  })
  inviteCodeExpiresAt!: Date | null;

  @Column({ type: 'smallint', name: 'max_members', default: 20 })
  maxMembers!: number;

  // `timestamptz` esplicito: il tipo di default di TypeORM è senza fuso, e la
  // differenza con la migrazione farebbe ricreare la colonna a ogni avvio.
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
