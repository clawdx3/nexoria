import { Injectable } from '@nestjs/common';
import { MemoryAdapter, MemoryContextRequest, MemoryContextResult, MemoryStoreRequest, MemorySearchRequest, MemorySearchResult, MemoryManageParams } from './memory-adapter.interface';
import { LocalMemoryFilesService } from './local-memory-files.service';

@Injectable()
export class LocalMemoryAdapter implements MemoryAdapter {
  constructor(private readonly files: LocalMemoryFilesService) {}

  async loadContext(ctx: MemoryContextRequest): Promise<MemoryContextResult> {
    const state = await this.files.read(ctx.workspaceId, ctx.agentProfileId);
    return {
      text: [
        '# Working Memory',
        state.memory,
        '',
        '# User Profile',
        state.user,
      ].join('\n'),
      entries: [],
    };
  }

  async store(entry: MemoryStoreRequest): Promise<void> {
    const section = entry.tier === 'profile' || entry.tier === 'user' ? 'user' : 'memory';
    await this.files.add(entry.workspaceId, entry.agentProfileId ?? 'default', section, entry.content);
  }

  async search(query: MemorySearchRequest): Promise<MemorySearchResult[]> {
    const state = await this.files.read(query.workspaceId, query.agentProfileId ?? 'default');
    const haystack = `${state.memory}\n${state.user}`;
    const q = query.query.toLowerCase();
    const lines = haystack.split('\n').filter((line) => line.toLowerCase().includes(q));
    return lines.map((content) => ({ content }));
  }

  async manage(action: 'add' | 'replace' | 'remove', params: MemoryManageParams): Promise<void> {
    const { section = 'memory', workspaceId = '', agentProfileId = 'default' } = params as any;
    if (action === 'add') {
      if (!params.content) throw new Error('content is required for add');
      await this.files.add(workspaceId, agentProfileId, section, params.content);
    } else if (action === 'replace') {
      if (!params.search || params.replacement === undefined) throw new Error('search and replacement are required for replace');
      await this.files.replace(workspaceId, agentProfileId, section, params.search, params.replacement);
    } else if (action === 'remove') {
      if (!params.search) throw new Error('search is required for remove');
      await this.files.remove(workspaceId, agentProfileId, section, params.search);
    }
  }

  async initialize(workspaceId: string, agentProfileId: string): Promise<void> {
    await this.files.initialize(workspaceId, agentProfileId);
  }
}
