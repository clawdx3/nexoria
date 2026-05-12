import { Test, TestingModule } from '@nestjs/testing';
import { AgentExecutorService } from './agent-executor.service';
import { LlmProviderFactory } from '../llm-provider/llm-provider.factory';
import { ToolRegistryService } from '../tool-registry/tool-registry.service';
import { MemoryContextBuilder } from '../memory-context/memory-context.builder';
import { ReflectionService } from '../reflection/reflection.service';

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
      sessionId: 'sess1',
      agentProfile: {
        id: 'p1',
        name: 'Test',
        systemPrompt: 'You are helpful.',
        modelProvider: 'openai',
        modelName: 'gpt-4o',
        enabledTools: [],
        role: 'specialist',
        modelConfig: {},
      },
    };
    const result = await service.run(ctx, 'Hi');
    expect(result.success).toBe(true);
    expect(result.finalOutput).toBe('Hello there');
    expect(result.steps).toHaveLength(0);
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
        modelConfig: {},
      },
    };
    const result = await service.run(ctx, 'Loop');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Max steps reached without completion');
  });
});
