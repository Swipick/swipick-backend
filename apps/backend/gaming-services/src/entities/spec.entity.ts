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
@Unique(['user_id', 'fixture_id', 'mode']) // Ensures one prediction per fixture per user per mode
@Index(['user_id'])
@Index(['week'])
@Index(['user_id', 'week'])
@Index(['user_id', 'mode'])
@Index(['mode'])
@Index(['user_id', 'season', 'week'])
@Index(['user_id', 'season', 'mode'])
export class Spec {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
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

  // Denormalized from fixture.season (like week) for fast season-scoped stats.
  @Column({ type: 'integer', nullable: false, default: 2025 })
  season: number;

  @Column({
    type: 'enum',
    enum: ['live', 'test'],
    default: 'live',
    nullable: false,
  })
  @Index()
  mode: 'live' | 'test';

  @CreateDateColumn()
  timestamp: Date;

  // Relations
  @ManyToOne('Fixture', 'specs', {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'fixture_id' })
  fixture: any;

  /**
   * L'esito della partita secondo la fonte che viene davvero aggiornata.
   *
   * `specs.result` e `specs.correct` nascono `NULL` e nessuna riga di codice
   * di produzione li scrive mai: la sincronizzazione del calendario aggiorna
   * `fixtures`, non i pronostici. Leggere le colonne memorizzate faceva dire
   * all'aggregato «4 pronostici, 50%» a chi ne aveva fatti trenta, mentre
   * nella stessa risposta le singole partite erano giuste — perché quelle
   * passavano già dalla partita.
   *
   * Quando la relazione `fixture` è caricata è lei la fonte; le colonne
   * restano solo come ripiego per le righe del 2025 che le hanno valorizzate.
   */
  private esitoEffettivo(): '1' | 'X' | '2' | null {
    const daPartita = (this.fixture as { result?: '1' | 'X' | '2' | null })
      ?.result;
    return daPartita ?? this.result ?? null;
  }

  // Helper methods for business logic
  calculateCorrectness(): boolean | null {
    // Skip predictions don't count as correct or incorrect
    if (this.choice === 'SKIP') {
      return null;
    }

    const esito = this.esitoEffettivo();

    // Can't calculate if we don't have the actual result yet
    if (!esito) {
      return null;
    }

    // Return true if prediction matches result
    return this.choice === esito;
  }

  // Update the correct field based on current choice and result
  updateCorrectness(): void {
    this.correct = this.calculateCorrectness();
  }

  // Check if this prediction counts towards percentage calculation
  countsTowardPercentage(): boolean {
    return this.choice !== 'SKIP' && this.esitoEffettivo() !== null;
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
    return this.calculateCorrectness();
  }

  // Check if this is a skipped prediction
  isSkipped(): boolean {
    return this.choice === 'SKIP';
  }

  // Check if result is available
  hasResult(): boolean {
    return this.esitoEffettivo() !== null;
  }
}
