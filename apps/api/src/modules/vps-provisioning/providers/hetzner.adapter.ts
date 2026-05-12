import { Injectable, Logger } from '@nestjs/common';
import {
  VpsProviderAdapter,
  CreateServerOptions,
  ServerInfo,
} from './vps-provider.interface';

@Injectable()
export class HetznerAdapter implements VpsProviderAdapter {
  private readonly logger = new Logger(HetznerAdapter.name);
  private readonly baseUrl = 'https://api.hetzner.cloud/v1';
  private readonly token: string;

  constructor() {
    this.token = process.env.HETZNER_API_TOKEN || '';
    if (!this.token) {
      this.logger.warn('HETZNER_API_TOKEN not set — Hetzner provisioning will fail');
    }
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token}`,
      'Content-Type': 'application/json',
    };
  }

  async createServer(options: CreateServerOptions): Promise<ServerInfo> {
    const body: Record<string, any> = {
      name: options.name,
      server_type: options.size,
      location: options.region,
      image: options.image || 'ubuntu-22.04',
      labels: options.labels || {},
    };

    if (options.userData) {
      body.user_data = options.userData;
    }

    const res = await fetch(`${this.baseUrl}/servers`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      this.logger.error(`Hetzner createServer failed: ${res.status} ${err}`);
      throw new Error(`Hetzner createServer failed: ${res.status}`);
    }

    const data: any = await res.json();
    const server = data.server;

    return {
      id: String(server.id),
      name: server.name,
      status: this.mapStatus(server.status),
      ipAddress: server.public_net?.ipv4?.ip || null,
      region: options.region,
      size: options.size,
      costPerHour: 0,
      metadata: {
        hetznerId: server.id,
        datacenter: server.datacenter?.name,
        created: server.created,
      },
    };
  }

  async deleteServer(providerInstanceId: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/servers/${providerInstanceId}`, {
      method: 'DELETE',
      headers: this.headers(),
    });

    if (!res.ok && res.status !== 404) {
      const err = await res.text();
      this.logger.error(`Hetzner deleteServer failed: ${res.status} ${err}`);
      throw new Error(`Hetzner deleteServer failed: ${res.status}`);
    }
  }

  async getServer(providerInstanceId: string): Promise<ServerInfo> {
    const res = await fetch(`${this.baseUrl}/servers/${providerInstanceId}`, {
      headers: this.headers(),
    });

    if (!res.ok) {
      const err = await res.text();
      this.logger.error(`Hetzner getServer failed: ${res.status} ${err}`);
      throw new Error(`Hetzner getServer failed: ${res.status}`);
    }

    const data: any = await res.json();
    const server = data.server;

    return {
      id: String(server.id),
      name: server.name,
      status: this.mapStatus(server.status),
      ipAddress: server.public_net?.ipv4?.ip || null,
      region: server.datacenter?.location?.name || '',
      size: server.server_type?.name || '',
      costPerHour: parseFloat(server.server_type?.prices?.[0]?.price_monthly?.gross || '0') / 730,
      metadata: {
        hetznerId: server.id,
        datacenter: server.datacenter?.name,
        created: server.created,
      },
    };
  }

  async getServerStatus(providerInstanceId: string): Promise<string> {
    const info = await this.getServer(providerInstanceId);
    return info.status;
  }

  private mapStatus(hetznerStatus: string): string {
    switch (hetznerStatus) {
      case 'initializing':
      case 'starting':
      case 'migrating':
        return 'provisioning';
      case 'running':
        return 'running';
      case 'stopping':
        return 'stopping';
      case 'off':
        return 'stopped';
      case 'deleting':
        return 'destroying';
      case 'error':
      case 'unknown':
        return 'error';
      default:
        return 'provisioning';
    }
  }
}
