import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('test_fixtures')
@Index(['week', 'date']) // Optimize for weekly queries
@Index(['homeTeam', 'awayTeam']) // Optimize for team searches
export class TestFixture {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  week: number; // Giornata number (1-38)

  @Column({ type: 'timestamp' })
  date: Date;

  @Column({ length: 150, nullable: true })
  stadium: string;

  @Column({ length: 100 })
  homeTeam: string;

  @Column({ length: 100 })
  awayTeam: string;

  @Column({ nullable: true })
  homeScore: number;

  @Column({ nullable: true })
  awayScore: number;

  @Column({
    type: 'enum',
    enum: ['NS', '1H', 'HT', '2H', 'FT'],
    default: 'FT', // Test fixtures are always completed
  })
  status: string;

  @Column({ nullable: true, length: 10 })
  result: string; // '1', 'X', '2'

  // Some datasets include a raw score string like '1-3'
  @Column({ name: 'result_raw', nullable: true, length: 16 })
  resultRaw?: string;

  @OneToMany('TestSpec', 'fixture')
  testSpecs: any[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Business logic methods
  calculateResult(): string {
    // Prefer computed result when scores available
    if (this.homeScore !== null && this.awayScore !== null) {
      if (this.homeScore > this.awayScore) return '1';
      if (this.homeScore < this.awayScore) return '2';
      return 'X';
    }
    // Try to compute from result_raw like '1-3'
    if (this.resultRaw) {
      const m = this.resultRaw.match(/(\d+)\s*[-–]\s*(\d+)/);
      if (m) {
        const hs = Number(m[1]);
        const as = Number(m[2]);
        if (!Number.isNaN(hs) && !Number.isNaN(as)) {
          if (hs > as) return '1';
          if (hs < as) return '2';
          return 'X';
        }
      }
    }
    // Fallback to stored result (from imported historical data)
    if (this.result && ['1', 'X', '2'].includes(this.result)) {
      return this.result;
    }
    return null;
  }

  getMatchDisplay(): string {
    return `${this.homeTeam} vs ${this.awayTeam}`;
  }

  isCompleted(): boolean {
    // Completed when we have either full-time status with scores
    // or a stored result for historical fixtures
    if (
      this.status === 'FT' &&
      this.homeScore !== null &&
      this.awayScore !== null
    ) {
      return true;
    }
    if (this.result && ['1', 'X', '2'].includes(this.result)) {
      return true;
    }
    return false;
  }

  getScoreDisplay(): string {
    if (!this.isCompleted()) {
      return 'TBD';
    }
    if (this.homeScore != null && this.awayScore != null) {
      return `${this.homeScore}-${this.awayScore}`;
    }
    if (this.resultRaw) return this.resultRaw;
    return 'TBD';
  }
}
