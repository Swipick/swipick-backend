import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

/**
 * Per-user sequential progression pointer for TEST mode.
 *
 * Test mode uses a frozen 2023-24 dataset (all fixtures FINISHED), so there is
 * no real-time clock. Instead each user advances giornata-by-giornata via an
 * explicit "Prossima giornata" action. `currentWeek` is the giornata currently
 * playable in Gioca; Risultati can always inspect weeks 1..currentWeek with
 * their (already known) results. Fully isolated from live data.
 */
@Entity('test_user_progress')
export class TestUserProgress {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  userId: string;

  @Column({ type: 'integer', default: 1 })
  currentWeek: number;

  @UpdateDateColumn()
  updatedAt: Date;
}
