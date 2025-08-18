import { MigrationInterface } from 'typeorm';

// DEPRECATED: SKIP is no longer persisted. This migration intentionally does nothing.
export class AddSkipChoiceToTestSpecs1723718400000
  implements MigrationInterface
{
  name = 'AddSkipChoiceToTestSpecs1723718400000';

  public async up(): Promise<void> {
    // No-op by design
  }

  public async down(): Promise<void> {
    // No-op by design
  }
}
