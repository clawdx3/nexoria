import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../database/entities/user.entity';
import { CreateUserDto, UpdateUserDto, UserResponseDto } from './dto/create-user.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly repo: Repository<User>) {}

  async create(dto: CreateUserDto): Promise<UserResponseDto> {
    const hash = await bcrypt.hash(dto.password, 10);
    const user = this.repo.create({
      email: dto.email,
      passwordHash: hash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      avatarUrl: dto.avatarUrl,
      isSuperAdmin: dto.isSuperAdmin ?? false,
    });
    const saved = await this.repo.save(user);
    return this.toDto(saved);
  }

  async findOne(id: string): Promise<UserResponseDto> {
    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return this.toDto(user);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.repo.findOne({ where: { email } });
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserResponseDto> {
    await this.repo.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.repo.update(id, { isActive: false });
  }

  private toDto(user: User): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      isSuperAdmin: user.isSuperAdmin,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }
}
