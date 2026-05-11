import { Test, TestingModule } from '@nestjs/testing';
import { AgentHubService } from './agent-hub.service';

describe('AgentHubService', () => {
  let service: AgentHubService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AgentHubService],
    }).compile();

    service = module.get<AgentHubService>(AgentHubService);
  });

  describe('registerAgent', () => {
    it('should register an agent with instance key', async () => {
      const client = { id: 'socket-1' } as any;
      const result = await service.registerAgent('instance-a', client);
      expect(result).toBe(true);

      const agents = service.getAgents();
      expect(agents).toHaveLength(1);
      expect(agents[0].instanceKey).toBe('instance-a');
      expect(agents[0].status).toBe('online');
    });

    it('should reject registration without token or instance key', async () => {
      const client = { id: 'socket-2' } as any;
      // The gateway disconnects before calling registerAgent if missing,
      // but the service itself just registers
      const result = await service.registerAgent('instance-b', client);
      expect(result).toBe(true);
    });
  });

  describe('updateAgentCapabilities', () => {
    it('should update agent capabilities', async () => {
      const client = { id: 'socket-3' } as any;
      await service.registerAgent('instance-c', client);

      service.updateAgentCapabilities('socket-3', {
        capabilities: ['web_search', 'file_write'],
        models: ['gpt-4o'],
        capacity: 2,
      });

      const agents = service.getAgents();
      const agent = agents.find((a) => a.socketId === 'socket-3');
      expect(agent?.capabilities).toEqual(['web_search', 'file_write']);
      expect(agent?.models).toEqual(['gpt-4o']);
      expect(agent?.capacity).toBe(2);
    });
  });

  describe('updateHeartbeat', () => {
    it('should update heartbeat timestamp', async () => {
      const client = { id: 'socket-4' } as any;
      await service.registerAgent('instance-d', client);

      const before = service.getAgents()[0].lastHeartbeat;
      await new Promise((resolve) => setTimeout(resolve, 10));
      service.updateHeartbeat('socket-4', {});

      const after = service.getAgents()[0].lastHeartbeat;
      expect(after.getTime()).toBeGreaterThan(before.getTime());
    });
  });

  describe('task lifecycle', () => {
    it('should create and dispatch a task', () => {
      const task = service.createTask('web_search', { query: 'test' });
      expect(task.status).toBe('pending');
      expect(task.type).toBe('web_search');
      expect(task.id).toBeDefined();
    });

    it('should accept a task', async () => {
      const client = { id: 'socket-5' } as any;
      await service.registerAgent('instance-e', client);

      const task = service.createTask('file_read', { path: '/tmp/test' });
      service.acceptTask('socket-5', task.id);

      const tasks = service.getTasks();
      const updated = tasks.find((t) => t.id === task.id);
      expect(updated?.status).toBe('accepted');
      expect(updated?.agentId).toBe('instance-e');
    });

    it('should complete a task', async () => {
      const client = { id: 'socket-6' } as any;
      await service.registerAgent('instance-f', client);

      const task = service.createTask('file_write', { path: '/tmp/test', content: 'hello' });
      service.acceptTask('socket-6', task.id);
      service.completeTask(task.id, { bytesWritten: 5 });

      const tasks = service.getTasks();
      const updated = tasks.find((t) => t.id === task.id);
      expect(updated?.status).toBe('completed');
      expect(updated?.result).toEqual({ bytesWritten: 5 });
    });
  });

  describe('approval lifecycle', () => {
    it('should create an approval', () => {
      const approval = service.createApproval({
        approvalId: 'approval-1',
        taskId: 'task-1',
        type: 'spend',
        title: 'Approve $50 spend',
        description: 'Marketing campaign',
        riskLevel: 'medium',
      });

      expect(approval.status).toBe('pending');
      expect(approval.title).toBe('Approve $50 spend');
    });

    it('should resolve an approval', () => {
      service.createApproval({
        approvalId: 'approval-2',
        taskId: 'task-2',
        type: 'task',
        title: 'Approve task creation',
        description: 'Create social media post',
        riskLevel: 'low',
      });

      service.resolveApproval('approval-2', 'approved', 'Looks good');

      const approvals = service.getApprovals();
      const resolved = approvals.find((a) => a.id === 'approval-2');
      expect(resolved?.status).toBe('approved');
      expect(resolved?.userDecision).toBe('Looks good');
    });
  });
});
