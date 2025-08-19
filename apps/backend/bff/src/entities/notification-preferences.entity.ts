import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('notification_preferences')
export class NotificationPreferences {
  @PrimaryColumn('uuid', { name: 'user_id' })
  userId!: string;

  @Column({ type: 'boolean', default: true })
  results!: boolean;

  @Column({ type: 'boolean', default: true })
  matches!: boolean;

  @Column({ type: 'boolean', default: true })
  goals!: boolean;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
