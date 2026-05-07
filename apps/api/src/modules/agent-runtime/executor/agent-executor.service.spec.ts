import { Test, TestingModule } from '@nestjs/testing';
import { AgentExecutorService } from './agent-executor.service';
import { LlmProviderFactory } from '../llm-provider/llm-provider.factory';
import { ToolRegistryService } from '../tool-registry/tool-registry.service';
import { MemoryContextBuilder } from '../memory-context/memory-context.builder';
import { ReflectionService } from '../reflection/reflection.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MemoryEntry } from '../../../database/entities/memory-entry.entity';

const mockLlm = {
  generate: jest.fn(),
};

const mockMemoryBuilder = {
  build: jest.fn().mockResolvedValue({ profile: [], session: [], daily: [], longTerm: [] }),
  formatForPrompt: jest.fn().mockReturnValue(''),
};

const mockReflection = {
  reflect: jest.fn(),
};

describe('AgentExecutorService', () => {
  let service: AgentExecutorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentExecutorService,
        ToolRegistryService,
        { provide: LlmProviderFactory, useValue: mockLlm },
        { provide: MemoryContextBuilder, useValue: mockMemoryBuilder },
        { provide: ReflectionService, useValue: mockReflection },
        { provide: getRepositoryToken(MemoryEntry), useValue: {} },
      ],
    }).compile();

    service = module.get<AgentExecutorService>(AgentExecutorService);
    jest.clearAllMocks();
  });

  it('should return final answer when no tool is called', async () => {
    mockLlm.generate.mockResolvedValue({ text: 'Hello there', tokens: 10 });
    const ctx: any = {
      workspaceId: 'ws1',
      triggeredByUserId: 'u1',
      userRole: 'member',
      autonomyLevel: 1,
      agentProfile: {
        id: 'p1',
        name: 'Test',
        systemPrompt: 'You are helpful.',
        modelProvider: 'openai',
        modelName: 'gpt-4o',
        enabledTools: [],
        role: 'specialist',
      },
    };
    const result = await service.run(ctx, 'Hi');
    expect(result.success).toBe(true);
    expect(result.finalOutput).toBe('Hello there');
    expect(result.steps).toHaveLength(0);
  });

  it('should call a tool when instructed', async () => {
    mockLlm.generate
      .mockResolvedValueOnce({ text: '\`\`\`json\n{"tool": "create_internal_task", "arguments": {"title": "Test task"}}\n\`\`\`', tokens: 20 })
      .mockResolvedValueOnce({ text: 'Done', tokens: 5 });

    const ctx: any = {
      workspaceId: 'ws1',
      triggeredByUserId: 'u1',
      userRole: 'member',
      autonomyLevel: 1,
      agentProfile: {
        id: 'p1',
        name: 'Test',
        systemPrompt: 'You are helpful.',
        modelProvider: 'openai',
        modelName: 'gpt-4o',
        enabledTools: ['create_internal_task'],
        role: 'specialist',
      },
    };
    const result = await service.run(ctx, 'Create a task');
    expect(result.success).toBe(true);
    expect(result.steps.length).toBeGreaterThanOrEqual(1);
    expect(result.steps[0].toolName).toBe('create_internal_task');
  });

  it('should return error after max steps', async () => {
    mockLlm.generate.mockResolvedValue({ text: '\`\`\`json\n{"tool": "unknown_tool", "arguments": {}}\n\`\`\`', tokens: 5 });
    const ctx: any = {
      workspaceId: 'ws1',
      triggeredByUserId: 'u1',
      userRole: 'member',
      autonomyLevel: 1,
      agentProfile: {
        id: 'p1',
        name: 'Test',
        systemPrompt: 'You are helpful.',
        modelProvider: 'openai',
        modelName: 'gpt-4o',
        enabledTools: [],
        role: 'specialist',
      },
    };
    const result = await service.run(ctx, 'Loop');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Max steps reached without completion');
  });
});
