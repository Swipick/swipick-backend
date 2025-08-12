import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';

@Entity('specs')
@Unique(['user_id', 'fixture_id']) // Ensures one prediction per fixture per user
@Index(['user_id'])
@Index(['week'])
@Index(['user_id', 'week'])
export class Spec {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  @Index()
  user_id: string;

  @Column({ type: 'uuid', nullable: false })
  fixture_id: string;

  @Column({
    type: 'enum',
    enum: ['1', 'X', '2', 'SKIP'],
    nullable: false,
  })
  choice: '1' | 'X' | '2' | 'SKIP';

  @Column({
    type: 'enum',
    enum: ['1', 'X', '2'],
    nullable: true,
  })
  result: '1' | 'X' | '2' | null;

  @Column({ type: 'boolean', nullable: true })
  correct: boolean | null;

  @Column({ type: 'integer', nullable: false })
  @Index()
  week: number;

  @CreateDateColumn()
  timestamp: Date;

  // Relations
  @ManyToOne('Fixture', 'specs', {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'fixture_id' })
  fixture: any;

  // Helper methods for business logic
  calculateCorrectness(): boolean | null {
    // Skip predictions don't count as correct or incorrect
    if (this.choice === 'SKIP') {
      return null;
    }

    // Can't calculate if we don't have the actual result yet
    if (!this.result) {
      return null;
    }

    // Return true if prediction matches result
    return this.choice === this.result;
  }

  // Update the correct field based on current choice and result
  updateCorrectness(): void {
    this.correct = this.calculateCorrectness();
  }

  // Check if this prediction counts towards percentage calculation
  countsTowardPercentage(): boolean {
    return this.choice !== 'SKIP' && this.correct !== null;
  }

  // Get display string for the prediction
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

  // Get display string for the result
  getResultDisplay(): string {
    switch (this.result) {
      case '1':
        return 'Home Win';
      case 'X':
        return 'Draw';
      case '2':
        return 'Away Win';
      default:
        return 'Pending';
    }
  }

  // Check if prediction was correct (returns null for skipped or pending)
  isCorrect(): boolean | null {
    return this.correct;
  }

  // Check if this is a skipped prediction
  isSkipped(): boolean {
    return this.choice === 'SKIP';
  }

  // Check if result is available
  hasResult(): boolean {
    return this.result !== null;
  }
}
