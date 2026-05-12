import { AgentTool, ToolContext, ToolRegistry } from '../types';

export class AgentToolRegistry implements ToolRegistry {
  private tools = new Map<string, AgentTool>();

  register(tool: AgentTool): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): AgentTool | undefined {
    return this.tools.get(name);
  }

  listForContext(ctx: ToolContext): AgentTool[] {
    const enabled = ctx.agentProfile.enabledTools;
    if (!enabled || !enabled.length) return Array.from(this.tools.values());
    const whitelist = new Set(enabled);
    return Array.from(this.tools.values()).filter((t) => whitelist.has(t.name));
  }

  listAll(): AgentTool[] {
    return Array.from(this.tools.values());
  }
}
