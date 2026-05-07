import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Workspace } from '../../database/entities/workspace.entity';
import { WorkspaceMember, WorkspaceRole } from '../../database/entities/workspace-member.entity';
import { Invitation } from '../../database/entities/invitation.entity';
import { CreateWorkspaceDto, UpdateWorkspaceDto, WorkspaceResponseDto, WorkspaceMemberResponseDto, AddMemberDto } from './dto/create-workspace.dto';

@Injectable()
export class WorkspacesService {
  constructor(
    @InjectRepository(Workspace) private readonly wsRepo: Repository<Workspace>,
    @InjectRepository(WorkspaceMember) private readonly memRepo: Repository<WorkspaceMember>,
    @InjectRepository(Invitation) private readonly invRepo: Repository<Invitation>,
  ) {}

  async create(userId: string, dto: CreateWorkspaceDto): Promise<WorkspaceResponseDto> {
    const ws = this.wsRepo.create({ ...dto, ownerId: userId });
    const saved = await this.wsRepo.save(ws);
    await this.memRepo.save({
      workspaceId: saved.id,
      userId,
      role: 'owner' as WorkspaceRole,
    });
    return this.toDto(saved);
  }

  async findOne(id: string): Promise<WorkspaceResponseDto> {
    const ws = await this.wsRepo.findOne({ where: { id }, relations: ['members', 'members.user'] });
    if (!ws) throw new NotFoundException('Workspace not found');
    return this.toDto(ws);
  }

  async findByUser(userId: string): Promise<WorkspaceResponseDto[]> {
    const members = await this.memRepo.find({ where: { userId }, relations: ['workspace'] });
    return members.map((m) => this.toDto(m.workspace));
  }

  async update(id: string, dto: UpdateWorkspaceDto): Promise<WorkspaceResponseDto> {
    await this.wsRepo.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.wsRepo.delete(id);
  }

  async addMember(workspaceId: string, dto: AddMemberDto, invitedById: string): Promise<Invitation> {
    const inv = this.invRepo.create({ workspaceId, email: dto.email, role: dto.role, invitedById });
    return this.invRepo.save(inv);
  }

  async listMembers(workspaceId: string): Promise<WorkspaceMemberResponseDto[]> {
    const members = await this.memRepo.find({ where: { workspaceId }, relations: ['user'] });
    return members.map((m) => ({
      id: m.id,
      userId: m.userId,
      email: m.user.email,
      firstName: m.user.firstName,
      lastName: m.user.lastName,
      role: m.role,
      isActive: m.isActive,
      joinedAt: m.joinedAt,
    }));
  }

  async removeMember(workspaceId: string, userId: string): Promise<void> {
    await this.memRepo.delete({ workspaceId, userId });
  }

  private toDto(ws: Workspace): WorkspaceResponseDto {
    return {
      id: ws.id,
      name: ws.name,
      description: ws.description,
      logoUrl: ws.logoUrl,
      ownerId: ws.ownerId,
      createdAt: ws.createdAt,
      updatedAt: ws.updatedAt,
    };
  }
}
