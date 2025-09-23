import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';

@Entity('final_week_scores')
@Unique(['userId', 'week', 'mode']) // One score per user per week per mode
@Index(['userId', 'mode']) // Optimize for user mode queries
@Index(['week', 'mode']) // Optimize for week mode queries
export class FinalWeekScore {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36 })
  userId: string; // Firebase UID from frontend

  @Column()
  week: number; // Week number (1-38)

  @Column({
    type: 'enum',
    enum: ['live', 'test'],
  })
  mode: 'live' | 'test'; // Game mode

  @Column()
  revealed: number; // Number of matches revealed (0-10)

  @Column()
  correct: number; // Number of correct predictions (0-revealed)

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  percent: number; // Success percentage (0.00-100.00)

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Business logic methods
  calculatePercent(): number {
    if (this.revealed === 0) return 0;
    return Math.round((this.correct / this.revealed) * 100);
  }

  isComplete(): boolean {
    return this.revealed === 10;
  }

  getScoreSummary(): string {
    const completionStatus = this.isComplete()
      ? 'Complete'
      : `${this.revealed}/10`;
    return `Week ${this.week} (${this.mode}): ${this.correct}/${this.revealed} correct (${this.percent}%) - ${completionStatus}`;
  }

  getGradeDisplay(): string {
    if (this.percent >= 90) return 'A+';
    if (this.percent >= 80) return 'A';
    if (this.percent >= 70) return 'B';
    if (this.percent >= 60) return 'C';
    if (this.percent >= 50) return 'D';
    return 'F';
  }

  static fromCalculation(
    userId: string,
    week: number,
    mode: 'live' | 'test',
    revealed: number,
    correct: number,
  ): FinalWeekScore {
    const score = new FinalWeekScore();
    score.userId = userId;
    score.week = week;
    score.mode = mode;
    score.revealed = revealed;
    score.correct = correct;
    score.percent = score.calculatePercent();
    return score;
  }
}
