import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs/promises';

export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, any>; // JSON schema
  execute(args: Record<string, any>): Promise<any>;
  toLLMFormat(): {
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: Record<string, any>;
    };
  };
}

export class ToolRegistry extends EventEmitter {
  private tools = new Map<string, Tool>();

  async load(toolId: string): Promise<void> {
    // Built-in tools
    const builtIn = this.getBuiltInTool(toolId);
    if (builtIn) {
      this.tools.set(toolId, builtIn);
      console.log(`[tools] loaded built-in: ${toolId}`);
      return;
    }

    // Custom tools from filesystem
    const customPath = path.join(process.env.NEXORIA_TOOLS_DIR || './tools', `${toolId}.js`);
    try {
      const module = await import(customPath);
      const tool = new module.default();
      this.tools.set(toolId, tool);
      console.log(`[tools] loaded custom: ${toolId}`);
    } catch (err) {
      console.warn(`[tools] failed to load ${toolId}:`, err);
    }
  }

  private getBuiltInTool(toolId: string): Tool | null {
    const tools: Record<string, Tool> = {
      'shell': createShellTool(),
      'file_read': createFileReadTool(),
      'file_write': createFileWriteTool(),
      'web_search': createWebSearchTool(),
      'nexoria_api': createNexoriaApiTool(),
    };
    return tools[toolId] || null;
  }

  async execute(name: string, args: Record<string, any>): Promise<any> {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Tool not found: ${name}`);
    return tool.execute(args);
  }

  list(): Tool[] {
    return Array.from(this.tools.values());
  }
}

function createShellTool(): Tool {
  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);

  return {
    name: 'shell',
    description: 'Execute shell commands on the local system',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Shell command to execute' },
        timeout: { type: 'number', default: 30, description: 'Timeout in seconds' },
        cwd: { type: 'string', description: 'Working directory' },
      },
      required: ['command'],
    },
    async execute(args: Record<string, any>) {
      const { stdout, stderr } = await execAsync(args.command, {
        timeout: (args.timeout || 30) * 1000,
        cwd: args.cwd || process.cwd(),
      });
      return { stdout, stderr, exitCode: 0 };
    },
    toLLMFormat() {
      return {
        type: 'function' as const,
        function: {
          name: this.name,
          description: this.description,
          parameters: this.parameters,
        },
      };
    },
  };
}

function createFileReadTool(): Tool {
  return {
    name: 'file_read',
    description: 'Read contents of a file',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path' },
      },
      required: ['path'],
    },
    async execute(args: Record<string, any>) {
      const content = await fs.readFile(args.path, 'utf8');
      return { content, path: args.path };
    },
    toLLMFormat() {
      return {
        type: 'function' as const,
        function: {
          name: this.name,
          description: this.description,
          parameters: this.parameters,
        },
      };
    },
  };
}

function createFileWriteTool(): Tool {
  return {
    name: 'file_write',
    description: 'Write content to a file',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path' },
        content: { type: 'string', description: 'Content to write' },
      },
      required: ['path', 'content'],
    },
    async execute(args: Record<string, any>) {
      await fs.mkdir(path.dirname(args.path), { recursive: true });
      await fs.writeFile(args.path, args.content, 'utf8');
      return { path: args.path, bytesWritten: Buffer.byteLength(args.content) };
    },
    toLLMFormat() {
      return {
        type: 'function' as const,
        function: {
          name: this.name,
          description: this.description,
          parameters: this.parameters,
        },
      };
    },
  };
}

function createWebSearchTool(): Tool {
  return {
    name: 'web_search',
    description: 'Search the web for information',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        count: { type: 'number', default: 5 },
      },
      required: ['query'],
    },
    async execute(args: Record<string, any>) {
      // Stub: would integrate with search API
      return { results: [], query: args.query, note: 'Search integration needed' };
    },
    toLLMFormat() {
      return {
        type: 'function' as const,
        function: {
          name: this.name,
          description: this.description,
          parameters: this.parameters,
        },
      };
    },
  };
}

function createNexoriaApiTool(): Tool {
  return {
    name: 'nexoria_api',
    description: 'Call Nexoria API to create tasks, drafts, approvals, etc.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['tasks.create', 'tasks.update', 'drafts.create', 'drafts.update', 'approvals.create'],
          description: 'API action',
        },
        payload: { type: 'object', description: 'Action payload' },
      },
      required: ['action', 'payload'],
    },
    async execute(args: Record<string, any>) {
      const baseUrl = process.env.NEXORIA_API_URL || 'http://api:3000/api/v1';
      const token = process.env.NEXORIA_RUNNER_TOKEN || '';
      
      const response = await fetch(`${baseUrl}/agent/${args.action.replace('.', '/')}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(args.payload),
      });

      if (!response.ok) {
        throw new Error(`Nexoria API error: ${response.status} ${await response.text()}`);
      }

      return await response.json();
    },
    toLLMFormat() {
      return {
        type: 'function' as const,
        function: {
          name: this.name,
          description: this.description,
          parameters: this.parameters,
        },
      };
    },
  };
}
