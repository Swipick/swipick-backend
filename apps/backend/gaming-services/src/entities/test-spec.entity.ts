import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';

@Entity('test_specs')
@Unique(['userId', 'fixtureId']) // Prevent duplicate predictions per user per fixture
@Index(['userId', 'week']) // Optimize for user weekly queries
export class TestSpec {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 36 })
  userId: string; // Backend user id (UUID from BFF service)

  @Column()
  fixtureId: number;

  @Column()
  week: number; // Denormalized for faster queries

  @Column({
    type: 'enum',
    enum: ['1', 'X', '2', 'SKIP'],
  })
  choice: string; // User's prediction

  @Column({ default: false })
  isCorrect: boolean;

  @Column({ default: true })
  countsTowardPercentage: boolean; // Always true for test mode

  @ManyToOne('TestFixture', 'testSpecs', {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'fixtureId' })
  fixture: any;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Business logic methods
  updateCorrectness(): void {
    if (this.fixture && this.fixture.isCompleted()) {
      const actualResult = this.fixture.calculateResult();
      this.isCorrect = this.choice === actualResult;
    }
  }

  getChoiceDisplay(): string {
    switch (this.choice) {
      case '1':
        return 'Home Win';
      case 'X':
        return 'Draw';
      case '2':
        return 'Away Win';
      case 'SKIP':
        return 'Skipped';
      default:
        return 'Unknown';
    }
  }

  getPredictionSummary(): string {
    if (!this.fixture) return 'Unknown fixture';

    const match = this.fixture.getMatchDisplay();
    const choice = this.getChoiceDisplay();
    let status: string;
    if (this.choice === 'SKIP') {
      status = '⏭ Skipped';
    } else {
      status = this.isCorrect ? '✅ Correct' : '❌ Wrong';
    }
    return `${match} - Predicted: ${choice} ${status}`;
  }
}
