import { Test, TestingModule } from '@nestjs/testing';
import { ToolRegistryService } from './tool-registry.service';

describe('ToolRegistryService', () => {
  let service: ToolRegistryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ToolRegistryService,
        {
          provide: require('../../tasks/tasks.service').TasksService,
          useValue: {
            create: jest.fn().mockResolvedValue({ id: 'task-1' }),
            findByWorkspace: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: require('../../browser/browser.service').BrowserService,
          useValue: {},
        },
      ],
    }).compile();
    service = module.get<ToolRegistryService>(ToolRegistryService);
  });

  it('should list built-in tools', () => {
    const ctx: any = { agentProfile: { enabledTools: ['delegate_task', 'create_internal_task'] } };
    const tools = service.listForContext(ctx);
    expect(tools.length).toBe(2);
    expect(tools.map((t) => t.name)).toContain('delegate_task');
    expect(tools.map((t) => t.name)).toContain('create_internal_task');
  });

  it('should return undefined for unknown tool', () => {
    expect(service.get('nonexistent')).toBeUndefined();
  });

  it('should validate delegate_task schema', () => {
    const tool = service.get('delegate_task');
    expect(tool).toBeDefined();
    const valid = tool!.schema.safeParse({ title: 'T' });
    expect(valid.success).toBe(true);
  });
});
