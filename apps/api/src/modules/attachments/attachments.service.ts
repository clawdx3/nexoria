import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, IsNull, Repository } from 'typeorm';
import { createHash, randomUUID } from 'crypto';
import * as path from 'path';
import { Attachment, AttachmentScope, AttachmentSource } from '../../database/entities/attachment.entity';
import { CreateAttachmentReferenceDto, CreateAttachmentUploadUrlDto, UploadAttachmentBytesDto, AttachmentListQueryDto } from './dto/attachment.dto';
import { ObjectStorageService } from './object-storage.service';

const USER_UPLOAD_LIMIT = 25 * 1024 * 1024;
const RUNTIME_UPLOAD_LIMIT = 100 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.pdf', '.txt', '.md', '.csv', '.json', '.html', '.docx', '.xlsx']);

@Injectable()
export class AttachmentsService {
  constructor(
    @InjectRepository(Attachment) private readonly repo: Repository<Attachment>,
    private readonly storage: ObjectStorageService,
  ) {}

  async createUploadUrl(workspaceId: string, userId: string, dto: CreateAttachmentUploadUrlDto): Promise<any> {
    this.validateFile(dto.filename, dto.sizeBytes, dto.source ?? 'user_upload');
    const filename = this.safeFilename(dto.filename);
    const scope = dto.scope ?? this.inferScope(dto);
    const storageKey = this.storageKey(workspaceId, scope, dto.scopeId ?? this.inferScopeId(dto), 'user', userId, filename);
    const attachment = await this.repo.save(this.repo.create({
      workspaceId,
      scope,
      scopeId: dto.scopeId ?? this.inferScopeId(dto),
      source: dto.source ?? 'user_upload',
      status: 'pending',
      visibility: dto.visibility ?? 'workspace',
      uploadedByUserId: userId,
      createdByAgentProfileId: null,
      runtimeJobId: dto.runtimeJobId ?? null,
      runtimeChatSessionId: dto.runtimeChatSessionId ?? null,
      runtimeChatMessageId: dto.runtimeChatMessageId ?? null,
      taskId: dto.taskId ?? null,
      approvalId: dto.approvalId ?? null,
      draftId: dto.draftId ?? null,
      storageProvider: 's3',
      bucket: this.storage.bucketName(),
      storageKey,
      filename,
      mimeType: dto.mimeType,
      sizeBytes: dto.sizeBytes,
      checksumSha256: null,
      metadata: dto.metadata ?? {},
    }));
    return {
      attachment: this.toDto(attachment),
      uploadUrl: await this.storage.signedUploadUrl(storageKey, dto.mimeType),
      expiresAt: this.expiresAt(),
    };
  }

  async completeUpload(workspaceId: string, attachmentId: string, checksumSha256?: string, metadata: Record<string, any> = {}): Promise<any> {
    const attachment = await this.require(workspaceId, attachmentId, true);
    await this.repo.update(attachment.id, {
      status: 'active',
      checksumSha256: checksumSha256 ?? attachment.checksumSha256,
      metadata: { ...(attachment.metadata ?? {}), ...metadata },
    });
    return this.toDto(await this.repo.findOneOrFail({ where: { id: attachment.id } }));
  }

  async uploadBytes(workspaceId: string, dto: UploadAttachmentBytesDto, owner: { userId?: string | null; agentProfileId?: string | null } = {}): Promise<any> {
    const bytes = Buffer.from(dto.contentBase64, 'base64');
    this.validateFile(dto.filename, bytes.length, dto.source ?? (owner.agentProfileId ? 'agent_upload' : 'user_upload'));
    const filename = this.safeFilename(dto.filename);
    const scope = dto.scope ?? this.inferScope(dto);
    const ownerType = owner.agentProfileId ? 'agent' : 'user';
    const ownerId = owner.agentProfileId || owner.userId || 'system';
    const storageKey = this.storageKey(workspaceId, scope, dto.scopeId ?? this.inferScopeId(dto), ownerType, ownerId, filename);
    await this.storage.putObject(storageKey, bytes, dto.mimeType);
    const attachment = await this.repo.save(this.repo.create({
      workspaceId,
      scope,
      scopeId: dto.scopeId ?? this.inferScopeId(dto),
      source: dto.source ?? (owner.agentProfileId ? 'agent_upload' : 'user_upload'),
      status: 'active',
      visibility: dto.visibility ?? 'workspace',
      uploadedByUserId: owner.userId ?? null,
      createdByAgentProfileId: dto.createdByAgentProfileId ?? owner.agentProfileId ?? null,
      runtimeJobId: dto.runtimeJobId ?? null,
      runtimeChatSessionId: dto.runtimeChatSessionId ?? null,
      runtimeChatMessageId: dto.runtimeChatMessageId ?? null,
      taskId: dto.taskId ?? null,
      approvalId: dto.approvalId ?? null,
      draftId: dto.draftId ?? null,
      storageProvider: 's3',
      bucket: this.storage.bucketName(),
      storageKey,
      filename,
      mimeType: dto.mimeType,
      sizeBytes: bytes.length,
      checksumSha256: createHash('sha256').update(bytes).digest('hex'),
      metadata: dto.metadata ?? {},
    }));
    return this.withDownloadUrl(attachment);
  }

  async list(workspaceId: string, query: AttachmentListQueryDto = {}): Promise<any[]> {
    const where: FindOptionsWhere<Attachment> = { workspaceId, deletedAt: IsNull(), status: 'active' as any };
    for (const key of ['scope', 'scopeId', 'taskId', 'runtimeChatSessionId', 'runtimeChatMessageId', 'runtimeJobId', 'createdByAgentProfileId', 'uploadedByUserId', 'source'] as const) {
      if ((query as any)[key]) (where as any)[key] = (query as any)[key];
    }
    if (query.mimeType) where.mimeType = query.mimeType;
    if (query.filename) where.filename = ILike(`%${query.filename}%`) as any;
    const take = Math.min(query.limit ?? 100, 200);
    const items = await this.repo.find({ where, order: { createdAt: 'DESC' }, take });
    return items.map((item) => this.toDto(item));
  }

  async get(workspaceId: string, id: string): Promise<any> {
    return this.toDto(await this.require(workspaceId, id));
  }

  async getMany(workspaceId: string, ids: string[]): Promise<Attachment[]> {
    if (ids.length === 0) return [];
    const attachments = await this.repo.find({ where: ids.map((id) => ({ id, workspaceId, status: 'active' as any, deletedAt: IsNull() })) });
    if (attachments.length !== ids.length) throw new BadRequestException('One or more attachments are not available in this workspace.');
    return attachments;
  }

  async getDownloadUrl(workspaceId: string, id: string): Promise<any> {
    const attachment = await this.require(workspaceId, id);
    return {
      attachment: this.toDto(attachment),
      downloadUrl: await this.storage.signedDownloadUrl(attachment.storageKey, attachment.filename),
      expiresAt: this.expiresAt(),
    };
  }

  async getBytes(workspaceId: string, id: string): Promise<{ attachment: Attachment; bytes: Buffer }> {
    const attachment = await this.require(workspaceId, id);
    return { attachment, bytes: await this.storage.getObjectBuffer(attachment.storageKey) };
  }

  async reference(workspaceId: string, dto: CreateAttachmentReferenceDto): Promise<any> {
    const source = await this.require(workspaceId, dto.attachmentId);
    const attachment = await this.repo.save(this.repo.create({
      ...source,
      id: undefined,
      scope: dto.scope ?? source.scope,
      scopeId: dto.scopeId ?? this.inferScopeId(dto) ?? source.scopeId,
      source: 'reference',
      taskId: dto.taskId ?? source.taskId,
      runtimeChatSessionId: dto.runtimeChatSessionId ?? source.runtimeChatSessionId,
      runtimeChatMessageId: dto.runtimeChatMessageId ?? source.runtimeChatMessageId,
      runtimeJobId: dto.runtimeJobId ?? source.runtimeJobId,
      approvalId: dto.approvalId ?? source.approvalId,
      draftId: dto.draftId ?? source.draftId,
      metadata: { ...(source.metadata ?? {}), ...(dto.metadata ?? {}), sourceAttachmentId: source.id },
      createdAt: undefined,
      updatedAt: undefined,
      deletedAt: null,
    }));
    return this.toDto(attachment);
  }

  async linkToChatMessage(workspaceId: string, attachmentIds: string[], runtimeChatMessageId: string, runtimeChatSessionId: string): Promise<any[]> {
    const attachments = await this.getMany(workspaceId, attachmentIds);
    for (const attachment of attachments) {
      await this.repo.update(attachment.id, {
        scope: 'chat',
        scopeId: runtimeChatSessionId,
        runtimeChatMessageId,
        runtimeChatSessionId,
        status: 'active',
      });
    }
    return attachments.map((attachment) => this.toDto({ ...attachment, runtimeChatMessageId, runtimeChatSessionId, scope: 'chat', scopeId: runtimeChatSessionId } as Attachment));
  }

  async softDelete(workspaceId: string, id: string): Promise<void> {
    const attachment = await this.require(workspaceId, id);
    await this.repo.update(attachment.id, { status: 'deleted' });
    await this.repo.softDelete(attachment.id);
  }

  toDto(attachment: Attachment): any {
    return {
      id: attachment.id,
      workspaceId: attachment.workspaceId,
      scope: attachment.scope,
      scopeId: attachment.scopeId,
      source: attachment.source,
      status: attachment.status,
      visibility: attachment.visibility,
      uploadedByUserId: attachment.uploadedByUserId,
      createdByAgentProfileId: attachment.createdByAgentProfileId,
      runtimeJobId: attachment.runtimeJobId,
      runtimeChatSessionId: attachment.runtimeChatSessionId,
      runtimeChatMessageId: attachment.runtimeChatMessageId,
      taskId: attachment.taskId,
      approvalId: attachment.approvalId,
      draftId: attachment.draftId,
      filename: attachment.filename,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
      checksumSha256: attachment.checksumSha256,
      metadata: attachment.metadata ?? {},
      downloadUrl: `/api/v1/workspaces/${attachment.workspaceId}/attachments/${attachment.id}/download-url`,
      createdAt: attachment.createdAt,
      updatedAt: attachment.updatedAt,
    };
  }

  async withDownloadUrl(attachment: Attachment): Promise<any> {
    return {
      ...this.toDto(attachment),
      signedDownloadUrl: await this.storage.signedDownloadUrl(attachment.storageKey, attachment.filename),
      downloadUrlExpiresAt: this.expiresAt(),
    };
  }

  private async require(workspaceId: string, id: string, includePending = false): Promise<Attachment> {
    const statuses = includePending ? ['active', 'pending'] : ['active'];
    const attachment = await this.repo.findOne({ where: statuses.map((status) => ({ id, workspaceId, status: status as any, deletedAt: IsNull() })) });
    if (!attachment) throw new NotFoundException('Attachment not found');
    return attachment;
  }

  private validateFile(filename: string, sizeBytes: number, source: AttachmentSource): void {
    const extension = path.extname(filename).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(extension)) throw new BadRequestException(`File extension ${extension || '(none)'} is not allowed`);
    const limit = source === 'runtime' || source === 'agent_upload' ? RUNTIME_UPLOAD_LIMIT : USER_UPLOAD_LIMIT;
    if (sizeBytes > limit) throw new BadRequestException('Attachment exceeds max size');
  }

  private inferScope(dto: any): AttachmentScope {
    if (dto.taskId) return 'tasks';
    if (dto.runtimeJobId) return 'runtime-jobs';
    if (dto.runtimeChatSessionId || dto.runtimeChatMessageId) return 'chat';
    if (dto.approvalId) return 'approvals';
    if (dto.draftId) return 'drafts';
    return 'general';
  }

  private inferScopeId(dto: any): string | null {
    return dto.scopeId ?? dto.taskId ?? dto.runtimeJobId ?? dto.runtimeChatSessionId ?? dto.runtimeChatMessageId ?? dto.approvalId ?? dto.draftId ?? null;
  }

  private storageKey(workspaceId: string, scope: AttachmentScope, scopeId: string | null, ownerType: string, ownerId: string, filename: string): string {
    const safeScopeId = this.safeSegment(scopeId || 'general');
    return `workspaces/${this.safeSegment(workspaceId)}/${scope}/${safeScopeId}/${this.safeSegment(ownerType)}-${this.safeSegment(ownerId)}/${randomUUID()}-${filename}`;
  }

  private safeFilename(filename: string): string {
    return path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
  }

  private safeSegment(value: string): string {
    return value.replace(/[^a-zA-Z0-9._-]/g, '_');
  }

  private expiresAt(): string {
    return new Date(Date.now() + 10 * 60 * 1000).toISOString();
  }
}
