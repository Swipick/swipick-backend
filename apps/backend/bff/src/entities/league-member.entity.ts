import {
  Entity,
  PrimaryColumn,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { League } from './league.entity';

export enum LeagueRole {
  OWNER = 'owner',
  MEMBER = 'member',
}

export enum LeagueMemberStatus {
  ACTIVE = 'active',
  LEFT = 'left',
  REMOVED = 'removed',
}

/**
 * L'iscrizione di un utente a una lega.
 *
 * Le righe non si cancellano mai: uscire o essere rimossi cambia `status`.
 * Serve per distinguere "non è mai stato qui" da "è stato rimosso", che è
 * la differenza fra poter rientrare col codice e non poterlo fare.
 */
@Entity('league_members')
@Index('idx_league_members_user_active', ['userId'], {
  where: "status = 'active'",
})
export class LeagueMember {
  @PrimaryColumn('uuid', { name: 'league_id' })
  leagueId!: string;

  @PrimaryColumn('uuid', { name: 'user_id' })
  userId!: string;

  // Le due relazioni dichiarano le foreign key. Quella sulla lega porta il
  // CASCADE da cui dipende l'eliminazione: cancellata la lega, spariscono le
  // iscrizioni.
  @ManyToOne(() => League, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'league_id' })
  league?: League;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ type: 'enum', enum: LeagueRole, default: LeagueRole.MEMBER })
  role!: LeagueRole;

  /**
   * Prima giornata che conta per questo membro.
   *
   * Si congela all'ingresso: se la giornata corrente ha già un fischio
   * d'inizio alle spalle, si entra dalla successiva. Senza questo campo, chi
   * entra a giornata finita si porterebbe in dote dei punti guadagnati quando
   * i risultati erano già noti.
   */
  @Column({ type: 'integer', name: 'joined_from_week' })
  joinedFromWeek!: number;

  @Column({
    type: 'enum',
    enum: LeagueMemberStatus,
    default: LeagueMemberStatus.ACTIVE,
  })
  status!: LeagueMemberStatus;

  @Column({ type: 'timestamptz', name: 'joined_at', default: () => 'NOW()' })
  joinedAt!: Date;
}
