import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreateSocialPostDraftDto, SocialPostDraftResponseDto, UpdateSocialPostDraftDto } from './dto/social-post-draft.dto';
import { SocialPostDraftsService } from './social-post-drafts.service';

@ApiTags('Social Post Drafts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('workspaces/:workspaceId/social-post-drafts')
export class SocialPostDraftsController {
  constructor(private readonly service: SocialPostDraftsService) {}

  @Get()
  @ApiResponse({ status: 200, type: [SocialPostDraftResponseDto] })
  findByWorkspace(@Param('workspaceId') workspaceId: string): Promise<SocialPostDraftResponseDto[]> {
    return this.service.findByWorkspace(workspaceId);
  }

  @Get(':id')
  @ApiResponse({ status: 200, type: SocialPostDraftResponseDto })
  findOne(@Param('id') id: string): Promise<SocialPostDraftResponseDto> {
    return this.service.findOne(id);
  }

  @Post()
  @ApiResponse({ status: 201, type: SocialPostDraftResponseDto })
  create(@Param('workspaceId') workspaceId: string, @Body() dto: CreateSocialPostDraftDto): Promise<SocialPostDraftResponseDto> {
    return this.service.create(workspaceId, dto);
  }

  @Patch(':id')
  @ApiResponse({ status: 200, type: SocialPostDraftResponseDto })
  update(@Param('id') id: string, @Body() dto: UpdateSocialPostDraftDto): Promise<SocialPostDraftResponseDto> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiResponse({ status: 204 })
  remove(@Param('id') id: string): Promise<void> {
    return this.service.remove(id);
  }
}
