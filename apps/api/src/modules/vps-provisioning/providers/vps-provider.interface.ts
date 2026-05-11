export interface CreateServerOptions {
  name: string;
  region: string;
  size: string;
  image?: string;
  userData?: string;
  labels?: Record<string, string>;
}

export interface ServerInfo {
  id: string;
  name: string;
  status: string;
  ipAddress: string | null;
  region: string;
  size: string;
  costPerHour: number;
  metadata: Record<string, any>;
}

export interface VpsProviderAdapter {
  createServer(options: CreateServerOptions): Promise<ServerInfo>;
  deleteServer(providerInstanceId: string): Promise<void>;
  getServer(providerInstanceId: string): Promise<ServerInfo>;
  getServerStatus(providerInstanceId: string): Promise<string>;
}
