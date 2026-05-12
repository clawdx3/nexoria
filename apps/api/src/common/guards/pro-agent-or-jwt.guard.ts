import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as nacl from 'tweetnacl';
import { verify } from 'jsonwebtoken';
import { Repository } from 'typeorm';
import { RuntimeInstance } from '../../database/entities/runtime-instance.entity';

@Injectable()
export class ProAgentOrJwtGuard implements CanActivate {
  constructor(
    @InjectRepository(RuntimeInstance)
    private readonly instances: Repository<RuntimeInstance>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();

    // 1. Try JWT (standard user auth)
    const authHeader = req.headers['authorization'] ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    if (token) {
      try {
        const decoded = verify(token, process.env.JWT_SECRET!) as any;
        if (decoded?.sub) {
          req.user = decoded;
          return true;
        }
      } catch {
        // fall through
      }
    }

    // 2. Try Pro Agent Ed25519 signature
    const signatureHeader = req.headers['x-pro-agent-signature'];
    const instanceKey = req.headers['x-pro-agent-instance-key'];
    if (signatureHeader && instanceKey) {
      const instance = await this.instances.findOne({ where: { instanceKey } });
      const pubKeyBase64 = instance?.metadata?.ed25519PublicKey;
      if (pubKeyBase64) {
        const pubKey = Buffer.from(pubKeyBase64, 'base64');
        const message = Buffer.from(JSON.stringify(req.body), 'utf8');
        const signature = Buffer.from(
          Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader,
          'base64',
        );
        const ok = nacl.sign.detached.verify(message, signature, pubKey);
        if (ok) {
          req.user = { id: 'pro-agent', role: 'system', instanceKey };
          return true;
        }
      }
    }

    // 3. Legacy bearer token fallback
    const legacyToken = process.env.NEXORIA_PRO_AGENT_TOKEN;
    if (legacyToken && token === legacyToken) {
      req.user = { id: 'pro-agent', role: 'system' };
      return true;
    }

    throw new UnauthorizedException('Invalid or missing credentials');
  }
}
