import { Controller, Get, Headers, Post, Query, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { McpService } from './mcp.service';

@ApiTags('MCP')
@Controller({ path: 'mcp', version: '1' })
export class McpController {
  constructor(private readonly mcp: McpService) {}

  @Get()
  async sse(@Headers('authorization') auth: string | undefined, @Res() res: Response): Promise<void> {
    this.mcp.authenticate(auth);
    await this.mcp.openSseTransport(res);
  }

  @Post('messages')
  async messages(
    @Headers('authorization') auth: string | undefined,
    @Query('sessionId') sessionId: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    this.mcp.authenticate(auth);
    await this.mcp.handlePostedMessage(sessionId, req, res);
  }
}
