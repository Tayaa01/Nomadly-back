import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Exclude } from 'class-transformer';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column()
  @Exclude()  // Exclude password from responses
  password: string;

  @Column()
  name: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  lastLoginAt: Date;

  @Column({ nullable: true })
  profilePicture?: string;

  @Column({ type: 'json', nullable: true })
  preferences?: {
    currency?: string;
    language?: string;
    notifications?: boolean;
  };

  constructor(partial: Partial<User>) {
    Object.assign(this, partial);
  }
}
