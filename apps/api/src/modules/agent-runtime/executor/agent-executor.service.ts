import { Injectable } from '@nestjs/common';
import { AgentContext, AgentExecutorResult, AgentStep, AgentTool } from '../../../shared/interfaces/agent.interfaces';
import { LlmProviderFactory } from '../llm-provider/llm-provider.factory';
import { ToolRegistryService } from '../tool-registry/tool-registry.service';
import { MemoryContextBuilder } from '../memory-context/memory-context.builder';
import { ReflectionService } from '../reflection/reflection.service';

@Injectable()
export class AgentExecutorService {
  private readonly MAX_STEPS = 10;

  constructor(
    private readonly llmFactory: LlmProviderFactory,
    private readonly toolRegistry: ToolRegistryService,
    private readonly memoryBuilder: MemoryContextBuilder,
    private readonly reflection: ReflectionService,
  ) {}

  async run(ctx: AgentContext, userMessage: string): Promise<AgentExecutorResult> {
    const start = Date.now();
    const steps: AgentStep[] = [];
    const availableTools = this.toolRegistry.listForContext(ctx);

    // Load 4-tier memory context
    const memory = await this.memoryBuilder.build(ctx);
    const memoryText = this.memoryBuilder.formatForPrompt(memory);

    const system = this.buildSystemPrompt(ctx, availableTools, memoryText);
    const messages: { role: string; content: string }[] = [{ role: 'user', content: userMessage }];

    try {
      for (let step = 1; step <= this.MAX_STEPS; step++) {
        const { text, tokens } = await this.llmFactory.generate(ctx, system, messages);

        // Parse tool call from LLM output (expect JSON block or plain tool name)
        const toolCall = this.parseToolCall(text);

        if (!toolCall) {
          // No tool call -> final answer
          const result: AgentExecutorResult = {
            success: true,
            steps,
            finalOutput: text,
            tokensUsed: tokens,
            durationMs: Date.now() - start,
          };
          await this.reflection.reflect(ctx, result);
          return result;
        }

        const tool = this.toolRegistry.get(toolCall.name);
        if (!tool) {
          steps.push({ step, thought: text, timestamp: new Date() });
          messages.push({ role: 'assistant', content: text });
          messages.push({ role: 'user', content: `Tool "${toolCall.name}" not found. Please use available tools.` });
          continue;
        }

        // Validate input with Zod schema
        const parseResult = tool.schema.safeParse(toolCall.arguments);
        if (!parseResult.success) {
          steps.push({ step, thought: text, toolName: tool.name, toolInput: toolCall.arguments, timestamp: new Date() });
          messages.push({ role: 'assistant', content: text });
          messages.push({ role: 'user', content: `Invalid arguments: ${parseResult.error.message}` });
          continue;
        }

        const toolCtx = { ...ctx };
        const toolOutput = await tool.execute(parseResult.data, toolCtx);

        steps.push({
          step,
          thought: text,
          toolName: tool.name,
          toolInput: toolCall.arguments,
          toolOutput,
          timestamp: new Date(),
        });

        messages.push({ role: 'assistant', content: text });
        messages.push({ role: 'user', content: `Tool result:\n${JSON.stringify(toolOutput, null, 2)}` });
      }

      const result: AgentExecutorResult = {
        success: false,
        steps,
        finalOutput: null,
        error: 'Max steps reached without completion',
        tokensUsed: 0,
        durationMs: Date.now() - start,
      };
      await this.reflection.reflect(ctx, result);
      return result;
    } catch (err: any) {
      const result: AgentExecutorResult = {
        success: false,
        steps,
        finalOutput: null,
        error: err.message || 'Unknown error',
        tokensUsed: 0,
        durationMs: Date.now() - start,
      };
      await this.reflection.reflect(ctx, result);
      return result;
    }
  }

  private buildSystemPrompt(ctx: AgentContext, tools: AgentTool[], memoryText: string): string {
    const toolDescriptions = tools
      .map((t) => `- ${t.name}: ${t.description} (risk=${t.riskLevel})`)
      .join('\n');

    return `You are ${ctx.agentProfile.name}. ${ctx.agentProfile.systemPrompt}

Available tools:
${toolDescriptions}

To call a tool, respond with JSON inside triple backticks like:
\`\`\`json
{"tool": "tool_name", "arguments": { ... }}
\`\`\`
If no tool is needed, provide a direct answer.

${memoryText}
`;
  }

  private parseToolCall(text: string): { name: string; arguments: any } | null {
    const jsonMatch = text.match(/\`\`\`json\s*([\s\S]*?)\s*\`\`\`/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        if (parsed.tool) return { name: parsed.tool, arguments: parsed.arguments ?? {} };
      } catch {}
    }
    // Fallback: try to find any JSON block with "tool" key
    const looseMatch = text.match(/\{[^}]*"tool"[^}]*\}/);
    if (looseMatch) {
      try {
        const parsed = JSON.parse(looseMatch[0]);
        return { name: parsed.tool, arguments: parsed.arguments ?? {} };
      } catch {}
    }
    return null;
  }
}
