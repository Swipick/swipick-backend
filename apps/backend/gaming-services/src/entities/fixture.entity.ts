import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';

@Entity('fixtures')
@Index(['week'])
@Index(['match_date'])
@Index(['status'])
export class Fixture {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  home_team: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  away_team: string;

  @Column({ type: 'timestamp', nullable: false })
  match_date: Date;

  @Column({ type: 'varchar', length: 100, nullable: true })
  stadium: string;

  @Column({ type: 'integer', nullable: false })
  @Index()
  week: number;

  @Column({
    type: 'enum',
    enum: ['1', 'X', '2'],
    nullable: true,
  })
  result: '1' | 'X' | '2' | null;

  @Column({ type: 'integer', nullable: true })
  home_score: number;

  @Column({ type: 'integer', nullable: true })
  away_score: number;

  @Column({
    type: 'enum',
    enum: ['SCHEDULED', 'LIVE', 'FINISHED', 'POSTPONED', 'CANCELLED'],
    default: 'SCHEDULED',
  })
  status: 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'POSTPONED' | 'CANCELLED';

  @Column({ type: 'varchar', length: 50, nullable: true })
  external_api_id: string; // For integration with football API

  @Column({ type: 'varchar', length: 50, nullable: true })
  home_team_id: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  away_team_id: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relations
  @OneToMany('Spec', 'fixture')
  specs: any[];

  // Computed methods for convenience
  calculateResult(): '1' | 'X' | '2' | null {
    if (this.home_score === null || this.away_score === null) {
      return null;
    }

    if (this.home_score > this.away_score) {
      return '1'; // Home win
    } else if (this.home_score < this.away_score) {
      return '2'; // Away win
    } else {
      return 'X'; // Draw
    }
  }

  // Helper method to check if fixture is completed
  isCompleted(): boolean {
    return this.status === 'FINISHED' && this.result !== null;
  }

  // Helper method to get match display string
  getMatchDisplay(): string {
    return `${this.home_team} vs ${this.away_team}`;
  }

  // Helper method to get result display string
  getResultDisplay(): string {
    if (this.home_score !== null && this.away_score !== null) {
      return `${this.home_team} ${this.home_score} - ${this.away_score} ${this.away_team}`;
    }
    return this.getMatchDisplay();
  }
}
