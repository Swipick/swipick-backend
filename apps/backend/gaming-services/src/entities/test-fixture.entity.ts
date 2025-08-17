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

  @OneToMany('TestSpec', 'fixture')
  testSpecs: any[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Business logic methods
  calculateResult(): string {
    if (this.homeScore === null || this.awayScore === null) {
      return null;
    }

    if (this.homeScore > this.awayScore) {
      return '1'; // Home win
    } else if (this.homeScore < this.awayScore) {
      return '2'; // Away win
    } else {
      return 'X'; // Draw
    }
  }

  getMatchDisplay(): string {
    return `${this.homeTeam} vs ${this.awayTeam}`;
  }

  isCompleted(): boolean {
    return (
      this.status === 'FT' && this.homeScore !== null && this.awayScore !== null
    );
  }

  getScoreDisplay(): string {
    if (!this.isCompleted()) {
      return 'TBD';
    }
    return `${this.homeScore}-${this.awayScore}`;
  }
}
