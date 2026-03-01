import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Turn } from './turn.entity';
import { Flow } from './flow.entity';

@Entity('conversations')
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'flow_id' })
  flowId: string;

  @ManyToOne(() => Flow)
  @JoinColumn({ name: 'flow_id' })
  flow: Flow;

  @OneToMany(() => Turn, (turn) => turn.conversation, { cascade: true })
  turns: Turn[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
