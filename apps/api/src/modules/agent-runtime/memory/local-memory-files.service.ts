import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { MemoryManageParams } from './memory-adapter.interface';

const DEFAULT_MAX_CHARS = {
  memory: 2200,
  user: 1375,
};

export interface LocalMemoryState {
  memory: string;
  user: string;
}

@Injectable()
export class LocalMemoryFilesService {
  private readonly logger = new Logger(LocalMemoryFilesService.name);
  private readonly baseDir: string;

  constructor() {
    this.baseDir = process.env.AGENT_MEMORY_DIR || 'data/agent-memory';
  }

  private resolveDir(workspaceId: string, agentProfileId: string): string {
    return path.join(this.baseDir, workspaceId, agentProfileId);
  }

  private memoryPath(dir: string): string {
    return path.join(dir, 'MEMORY.md');
  }

  private userPath(dir: string): string {
    return path.join(dir, 'USER.md');
  }

  async initialize(workspaceId: string, agentProfileId: string): Promise<void> {
    const dir = this.resolveDir(workspaceId, agentProfileId);
    await fs.mkdir(dir, { recursive: true });
    const memPath = this.memoryPath(dir);
    const userPath = this.userPath(dir);
    try {
      await fs.access(memPath);
    } catch {
      await fs.writeFile(memPath, '# Working Memory\n\n', 'utf-8');
    }
    try {
      await fs.access(userPath);
    } catch {
      await fs.writeFile(userPath, '# User Profile\n\n', 'utf-8');
    }
  }

  async read(workspaceId: string, agentProfileId: string): Promise<LocalMemoryState> {
    const dir = this.resolveDir(workspaceId, agentProfileId);
    const memPath = this.memoryPath(dir);
    const userPath = this.userPath(dir);
    const [memory, user] = await Promise.all([
      fs.readFile(memPath, 'utf-8').catch(() => '# Working Memory\n\n'),
      fs.readFile(userPath, 'utf-8').catch(() => '# User Profile\n\n'),
    ]);
    return { memory, user };
  }

  async add(
    workspaceId: string,
    agentProfileId: string,
    section: 'memory' | 'user',
    content: string,
    maxChars?: number,
  ): Promise<void> {
    const dir = this.resolveDir(workspaceId, agentProfileId);
    const filePath = section === 'memory' ? this.memoryPath(dir) : this.userPath(dir);
    const current = await fs.readFile(filePath, 'utf-8').catch(() => '');
    const proposed = `${current}\n- ${content}`.trim();
    const limit = maxChars ?? DEFAULT_MAX_CHARS[section];
    if (proposed.length > limit) {
      throw new Error(
        `Local ${section} memory would exceed ${limit} chars (${proposed.length}). Remove or replace existing entries first.`,
      );
    }
    await fs.writeFile(filePath, proposed, 'utf-8');
  }

  async replace(
    workspaceId: string,
    agentProfileId: string,
    section: 'memory' | 'user',
    search: string,
    replacement: string,
  ): Promise<void> {
    const dir = this.resolveDir(workspaceId, agentProfileId);
    const filePath = section === 'memory' ? this.memoryPath(dir) : this.userPath(dir);
    const current = await fs.readFile(filePath, 'utf-8').catch(() => '');
    if (!current.includes(search)) {
      throw new Error(`Search text not found in local ${section} memory.`);
    }
    const updated = current.replace(search, replacement);
    await fs.writeFile(filePath, updated, 'utf-8');
  }

  async remove(
    workspaceId: string,
    agentProfileId: string,
    section: 'memory' | 'user',
    search: string,
  ): Promise<void> {
    const dir = this.resolveDir(workspaceId, agentProfileId);
    const filePath = section === 'memory' ? this.memoryPath(dir) : this.userPath(dir);
    const current = await fs.readFile(filePath, 'utf-8').catch(() => '');
    if (!current.includes(search)) {
      throw new Error(`Search text not found in local ${section} memory.`);
    }
    const updated = current.replace(search, '').replace(/\n{3,}/g, '\n\n').trim();
    await fs.writeFile(filePath, updated, 'utf-8');
  }
}
