import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as nacl from 'tweetnacl';
import { Repository } from 'typeorm';
import { RuntimeInstance } from '../../database/entities/runtime-instance.entity';

@Injectable()
export class ProAgentHttpGuard implements CanActivate {
  constructor(
    @InjectRepository(RuntimeInstance)
    private readonly instances: Repository<RuntimeInstance>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const signatureHeader = req.headers['x-pro-agent-signature'];
    const instanceKey = req.body?.instanceKey ?? req.params?.instanceKey;

    if (!signatureHeader || !instanceKey) {
      throw new UnauthorizedException('Missing signature or instanceKey');
    }

    let pubKeyBase64: string | undefined;

    const instance = await this.instances.findOne({ where: { instanceKey } });
    if (instance?.metadata?.ed25519PublicKey) {
      pubKeyBase64 = instance.metadata.ed25519PublicKey;
    } else if (req.body?.metadata?.ed25519PublicKey) {
      pubKeyBase64 = req.body.metadata.ed25519PublicKey;
    }

    if (!pubKeyBase64) {
      throw new UnauthorizedException('No Ed25519 pubkey found');
    }

    const pubKey = Buffer.from(pubKeyBase64, 'base64');
    const message = Buffer.from(JSON.stringify(req.body), 'utf8');
    const signature = Buffer.from(Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader, 'base64');
    const ok = nacl.sign.detached.verify(message, signature, pubKey);
    if (!ok) {
      throw new UnauthorizedException('Invalid Ed25519 signature');
    }

    return true;
  }
}
