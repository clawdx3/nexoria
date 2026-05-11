import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('skills')
@Index(['category'])
@Index(['tags'])
export class Skill {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column()
  version: string;

  @Column()
  category: string;

  @Column({ type: 'simple-array', default: '' })
  tags: string[];

  @Column()
  author: string;

  @Column({ type: 'simple-json', nullable: true })
  configSchema: Record<string, any> | null;

  @Column({ type: 'simple-array', default: '' })
  tools: string[];

  @Column({ type: 'simple-json', nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
