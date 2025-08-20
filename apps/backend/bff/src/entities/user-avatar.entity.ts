import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('user_avatars')
export class UserAvatar {
  @PrimaryColumn('uuid', { name: 'user_id' })
  userId!: string;

  @Column({ type: 'varchar', length: 100, name: 'mime_type' })
  mimeType!: string;

  @Column({ type: 'int', name: 'size' })
  size!: number;

  @Column({ type: 'varchar', length: 64 })
  etag!: string; // sha256 hex

  @Column({ type: 'bytea' })
  bytes!: Buffer;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
