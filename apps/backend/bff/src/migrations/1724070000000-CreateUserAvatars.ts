import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserAvatars1724070000000 implements MigrationInterface {
  name = 'CreateUserAvatars1724070000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_avatars" (
        "user_id" uuid PRIMARY KEY,
        "mime_type" varchar(100) NOT NULL,
        "size" int NOT NULL CHECK (size > 0 AND size <= 4194304),
        "etag" varchar(64) NOT NULL,
        "bytes" bytea NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT "fk_user_avatars_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "user_avatars"');
  }
}
