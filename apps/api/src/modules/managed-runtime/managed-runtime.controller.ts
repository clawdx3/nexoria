import { Body, Controller, Get, Header, Param, Post, Request, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthenticatedRequest } from '../../shared/interfaces/authenticated-request.interface';
import { ManagedRuntimeService } from './managed-runtime.service';
import { RunnerTokenGuard } from './runner-token.guard';
import {
  CompleteRuntimeChatCommandDto,
  CompleteRuntimeJobDto,
  CreateRuntimeChatSessionDto,
  CreateRuntimeEventDto,
  CreateRuntimeJobDto,
  HeartbeatRuntimeInstanceDto,
  RegisterRuntimeInstanceDto,
  RuntimeChatRunnerEventDto,
  SendRuntimeChatMessageDto,
  UploadArtifactDto,
} from './dto/managed-runtime.dto';

@ApiTags('Managed Runtime')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('workspaces/:workspaceId/runtime')
export class ManagedRuntimeController {
  constructor(private readonly service: ManagedRuntimeService) {}

  @Get('status')
  @ApiResponse({ status: 200 })
  status(@Param('workspaceId') workspaceId: string): Promise<any> {
    return this.service.workspaceStatus(workspaceId);
  }

  @Get('jobs')
  @ApiResponse({ status: 200 })
  jobs(@Param('workspaceId') workspaceId: string): Promise<any[]> {
    return this.service.listJobs(workspaceId);
  }

  @Get('jobs/:jobId')
  @ApiResponse({ status: 200 })
  job(@Param('workspaceId') workspaceId: string, @Param('jobId') jobId: string): Promise<any> {
    return this.service.getJob(workspaceId, jobId);
  }

  @Post('jobs')
  @ApiResponse({ status: 201 })
  createJob(@Param('workspaceId') workspaceId: string, @Body() dto: CreateRuntimeJobDto, @Request() req: AuthenticatedRequest): Promise<any> {
    return this.service.createJob(workspaceId, req.user.id, dto);
  }

  @Post('chat/sessions')
  @ApiResponse({ status: 201 })
  createChatSession(@Param('workspaceId') workspaceId: string, @Body() dto: CreateRuntimeChatSessionDto, @Request() req: AuthenticatedRequest): Promise<any> {
    return this.service.createChatSession(workspaceId, req.user.id, dto);
  }

  @Get('chat/sessions/:sessionId')
  @ApiResponse({ status: 200 })
  chatSession(@Param('workspaceId') workspaceId: string, @Param('sessionId') sessionId: string): Promise<any> {
    return this.service.getChatSession(workspaceId, sessionId);
  }

  @Get('chat/sessions/:sessionId/messages')
  @ApiResponse({ status: 200 })
  chatMessages(@Param('workspaceId') workspaceId: string, @Param('sessionId') sessionId: string): Promise<any[]> {
    return this.service.listChatMessages(workspaceId, sessionId);
  }

  @Post('chat/sessions/:sessionId/messages')
  @ApiResponse({ status: 201 })
  sendChatMessage(@Param('workspaceId') workspaceId: string, @Param('sessionId') sessionId: string, @Body() dto: SendRuntimeChatMessageDto, @Request() req: AuthenticatedRequest): Promise<any> {
    return this.service.sendChatMessage(workspaceId, req.user.id, sessionId, dto);
  }

  @Get('chat/sessions/:sessionId/events')
  @ApiResponse({ status: 200 })
  async chatEvents(@Param('workspaceId') workspaceId: string, @Param('sessionId') sessionId: string, @Res() res: Response): Promise<void> {
    const stream = await this.service.streamChatEvents(workspaceId, sessionId);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
    res.write(': connected\n\n');
    const subscription = stream.subscribe((event) => {
      res.write(`data: ${JSON.stringify(event.data ?? event)}\n\n`);
    });
    res.on('close', () => subscription.unsubscribe());
  }
}

@ApiTags('Artifacts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('workspaces/:workspaceId/artifacts')
export class ArtifactsController {
  constructor(private readonly service: ManagedRuntimeService) {}

  @Get()
  @ApiResponse({ status: 200 })
  list(@Param('workspaceId') workspaceId: string): Promise<any[]> {
    return this.service.listArtifacts(workspaceId);
  }

  @Get(':artifactId/download')
  @Header('Cache-Control', 'private, max-age=300')
  async download(@Param('workspaceId') workspaceId: string, @Param('artifactId') artifactId: string, @Res() res: Response): Promise<void> {
    const { artifact, bytes } = await this.service.getArtifact(workspaceId, artifactId);
    res.setHeader('Content-Type', artifact.mimeType);
    res.setHeader('Content-Length', String(bytes.length));
    res.setHeader('Content-Disposition', `attachment; filename="${artifact.filename.replace(/"/g, '')}"`);
    res.send(bytes);
  }
}

@ApiTags('Runtime Runner')
@UseGuards(RunnerTokenGuard)
@Controller('runner/runtime')
export class RuntimeRunnerController {
  constructor(private readonly service: ManagedRuntimeService) {}

  @Post('instances')
  @ApiResponse({ status: 201 })
  register(@Body() dto: RegisterRuntimeInstanceDto): Promise<any> {
    return this.service.registerInstance(dto);
  }

  @Post('instances/:instanceKey/heartbeat')
  @ApiResponse({ status: 200 })
  heartbeat(@Param('instanceKey') instanceKey: string, @Body() dto: HeartbeatRuntimeInstanceDto): Promise<any> {
    return this.service.heartbeat(instanceKey, dto);
  }

  @Get('instances/:instanceKey/jobs/next')
  @ApiResponse({ status: 200 })
  nextJob(@Param('instanceKey') instanceKey: string): Promise<any | null> {
    return this.service.claimNextJob(instanceKey);
  }

  @Post('instances/:instanceKey/jobs/:jobId/events')
  @ApiResponse({ status: 201 })
  event(@Param('instanceKey') instanceKey: string, @Param('jobId') jobId: string, @Body() dto: CreateRuntimeEventDto): Promise<any> {
    return this.service.runnerEvent(instanceKey, jobId, dto);
  }

  @Post('instances/:instanceKey/jobs/:jobId/result')
  @ApiResponse({ status: 200 })
  result(@Param('instanceKey') instanceKey: string, @Param('jobId') jobId: string, @Body() dto: CompleteRuntimeJobDto): Promise<any> {
    return this.service.completeJob(instanceKey, jobId, dto);
  }

  @Post('instances/:instanceKey/jobs/:jobId/artifacts')
  @ApiResponse({ status: 201 })
  artifact(@Param('instanceKey') instanceKey: string, @Param('jobId') jobId: string, @Body() dto: UploadArtifactDto): Promise<any> {
    return this.service.uploadArtifact(instanceKey, jobId, dto);
  }

  @Get('instances/:instanceKey/chat/commands/next')
  @ApiResponse({ status: 200 })
  nextChatCommand(@Param('instanceKey') instanceKey: string): Promise<any | null> {
    return this.service.claimNextChatCommand(instanceKey);
  }

  @Post('instances/:instanceKey/chat/commands/:commandId/result')
  @ApiResponse({ status: 200 })
  chatCommandResult(@Param('instanceKey') instanceKey: string, @Param('commandId') commandId: string, @Body() dto: CompleteRuntimeChatCommandDto): Promise<any> {
    return this.service.completeChatCommand(instanceKey, commandId, dto);
  }

  @Post('instances/:instanceKey/chat/sessions/:sessionId/events')
  @ApiResponse({ status: 201 })
  chatEvent(@Param('instanceKey') instanceKey: string, @Param('sessionId') sessionId: string, @Body() dto: RuntimeChatRunnerEventDto): Promise<any> {
    return this.service.runnerChatEvent(instanceKey, sessionId, dto);
  }
}
