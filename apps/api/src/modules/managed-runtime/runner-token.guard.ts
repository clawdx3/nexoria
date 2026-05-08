import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class RunnerTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const expected = process.env.NEXORIA_RUNNER_TOKEN || 'dev-runner-token-change-me';
    const header = req.headers['x-runner-token'];
    const token = Array.isArray(header) ? header[0] : header;
    if (!token || token !== expected) {
      throw new UnauthorizedException('Invalid runner token');
    }
    return true;
  }
}
