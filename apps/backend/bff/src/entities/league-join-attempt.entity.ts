import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

/**
 * Un tentativo di entrare con un codice, riuscito o meno.
 *
 * Non è una traccia di controllo: è il contatore del rate limiting, ed è il
 * motivo per cui un codice di quattro caratteri regge. Lo spazio è 31^4 =
 * 923.521: con qualche migliaio di codici vivi, tirare a indovinare funziona.
 * Senza questa tabella la lunghezza del codice sarebbe una scelta sbagliata.
 */
@Entity('league_join_attempts')
@Index('idx_league_join_attempts_user_time', ['userId', 'createdAt'])
export class LeagueJoinAttempt {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ type: 'char', length: 4, name: 'code_tried' })
  codeTried!: string;

  @Column({ type: 'boolean' })
  succeeded!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
