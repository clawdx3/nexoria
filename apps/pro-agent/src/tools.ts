import { z } from 'zod';
import { ProAgentLoop } from './loop';

export function registerDangerousTools(agent: ProAgentLoop): void {
  agent.registerTool({
    name: 'terminal',
    description: 'Execute a shell command in a sandboxed environment.',
    schema: z.object({
      command: z.string().describe('The shell command to execute'),
      cwd: z.string().optional().describe('Working directory'),
    }),
    riskLevel: 3,
    execute: async (_args: any, _ctx: any) => {
      return { success: false, error: 'Sandbox not yet implemented' };
    },
  });

  agent.registerTool({
    name: 'fs',
    description: 'Read or write workspace files.',
    schema: z.object({
      action: z.enum(['read', 'write', 'list', 'delete']),
      path: z.string(),
      content: z.string().optional(),
    }),
    riskLevel: 3,
    execute: async (_args: any, _ctx: any) => {
      return { success: false, error: 'File system not yet implemented' };
    },
  });

  agent.registerTool({
    name: 'execute_code',
    description: 'Execute Python or Node.js code in a sandboxed environment.',
    schema: z.object({
      language: z.enum(['python', 'javascript']),
      code: z.string(),
    }),
    riskLevel: 3,
    execute: async (_args: any, _ctx: any) => {
      return { success: false, error: 'Code execution not yet implemented' };
    },
  });
}
