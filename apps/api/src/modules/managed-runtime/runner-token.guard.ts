import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class RunnerTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const runnerToken = (process.env.NEXORIA_RUNNER_TOKEN || 'dev-runner-token-change-me').trim();
    const proAgentToken = (process.env.NEXORIA_PRO_AGENT_TOKEN || 'dev-pro-agent-token-change-me').trim();
    const runnerHeader = req.headers['x-runner-token'];
    const proAgentHeader = req.headers['x-pro-agent-token'];
    const runnerValue = Array.isArray(runnerHeader) ? runnerHeader[0] : runnerHeader;
    const proAgentValue = Array.isArray(proAgentHeader) ? proAgentHeader[0] : proAgentHeader;
    const token = (runnerValue || proAgentValue || '').trim();
    if (!token || (token !== runnerToken && token !== proAgentToken)) {
      throw new UnauthorizedException('Invalid runner or pro-agent token');
    }
    return true;
  }
}
