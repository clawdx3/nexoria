import { Body, Controller, Delete, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthenticatedRequest } from '../../shared/interfaces/authenticated-request.interface';
import { AttachmentsService } from './attachments.service';
import { AttachmentListQueryDto, CompleteAttachmentUploadDto, CreateAttachmentReferenceDto, CreateAttachmentUploadUrlDto } from './dto/attachment.dto';

@ApiTags('Attachments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('workspaces/:workspaceId/attachments')
export class AttachmentsController {
  constructor(private readonly service: AttachmentsService) {}

  @Post('upload-url')
  @ApiResponse({ status: 201 })
  uploadUrl(@Param('workspaceId') workspaceId: string, @Body() dto: CreateAttachmentUploadUrlDto, @Request() req: AuthenticatedRequest): Promise<any> {
    return this.service.createUploadUrl(workspaceId, req.user.id, dto);
  }

  @Post(':id/complete')
  @ApiResponse({ status: 200 })
  complete(@Param('workspaceId') workspaceId: string, @Param('id') id: string, @Body() dto: CompleteAttachmentUploadDto): Promise<any> {
    return this.service.completeUpload(workspaceId, id, dto.checksumSha256, dto.metadata);
  }

  @Post('references')
  @ApiResponse({ status: 201 })
  reference(@Param('workspaceId') workspaceId: string, @Body() dto: CreateAttachmentReferenceDto): Promise<any> {
    return this.service.reference(workspaceId, dto);
  }

  @Get()
  @ApiResponse({ status: 200 })
  list(@Param('workspaceId') workspaceId: string, @Query() query: AttachmentListQueryDto): Promise<any[]> {
    return this.service.list(workspaceId, query);
  }

  @Get(':id')
  @ApiResponse({ status: 200 })
  get(@Param('workspaceId') workspaceId: string, @Param('id') id: string): Promise<any> {
    return this.service.get(workspaceId, id);
  }

  @Get(':id/download-url')
  @ApiResponse({ status: 200 })
  downloadUrl(@Param('workspaceId') workspaceId: string, @Param('id') id: string): Promise<any> {
    return this.service.getDownloadUrl(workspaceId, id);
  }

  @Delete(':id')
  @ApiResponse({ status: 204 })
  async remove(@Param('workspaceId') workspaceId: string, @Param('id') id: string): Promise<void> {
    await this.service.softDelete(workspaceId, id);
  }
}
