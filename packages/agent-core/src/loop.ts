import { AgentConfig, AgentExecutorResult, AgentStep } from './types';

export class AgentLoop {
  private readonly DEFAULT_MAX_STEPS = 10;
  private readonly abortControllers = new Map<string, AbortController>();

  async run(
    config: AgentConfig,
    userMessage: string,
    opts?: { signal?: AbortSignal; existingMessages?: { role: string; content: string }[] },
  ): Promise<AgentExecutorResult> {
    const start = Date.now();
    const steps: AgentStep[] = [];
    const maxSteps = config.maxSteps ?? this.DEFAULT_MAX_STEPS;
    const maxTokens = config.maxTokens ?? 4096;

    if (!config.llm) throw new Error('config.llm is required');

    const tools = config.toolRegistry.listForContext(config.context);

    const memory = await config.memoryManager.prefetch(config.context, userMessage);
    const memoryText = config.memoryManager.formatForPrompt(memory);

    const system = this.buildSystemPrompt(config.profile, tools, memoryText);
    const messages = opts?.existingMessages ? [...opts.existingMessages] : [];
    if (!opts?.existingMessages) {
      messages.push({ role: 'system', content: system });
    }
    messages.push({ role: 'user', content: userMessage });

    const runId = `${config.context.workspaceId}:${Date.now()}`;
    const abortCtrl = new AbortController();
    this.abortControllers.set(runId, abortCtrl);

    if (opts?.signal) {
      opts.signal.addEventListener('abort', () => abortCtrl.abort());
    }

    try {
      for (let step = 1; step <= maxSteps; step++) {
        if (abortCtrl.signal.aborted) {
          throw new Error('Agent loop aborted');
        }

        config.emit?.({ type: 'token', content: '' }); // keep-alive

        const { text: rawText, usage } = await config.llm({
          system,
          messages,
          maxTokens: config.maxTokens ?? 2048,
          temperature: config.temperature ?? 0.7,
        });

        const text = rawText ?? '';
        const toolCall = this.parseToolCall(text);

        if (!toolCall) {
          const final: AgentExecutorResult = {
            success: true,
            steps,
            finalOutput: text,
            tokensUsed: usage?.totalTokens ?? 0,
            durationMs: Date.now() - start,
          };
          await config.memoryManager.syncTurn(config.context, userMessage, text);
          return final;
        }

        const tool = config.toolRegistry.get(toolCall.name);
        if (!tool) {
          steps.push({ step, thought: text, timestamp: new Date() });
          messages.push({ role: 'assistant', content: text });
          messages.push({ role: 'user', content: `Tool "${toolCall.name}" not found. Please use available tools.` });
          continue;
        }

        const parseResult = tool.schema.safeParse(toolCall.arguments);
        if (!parseResult.success) {
          steps.push({ step, thought: text, toolName: tool.name, toolInput: toolCall.arguments, timestamp: new Date() });
          messages.push({ role: 'assistant', content: text });
          messages.push({ role: 'user', content: `Invalid arguments: ${parseResult.error.message}` });
          continue;
        }

        // Approval gate
        if (tool.riskLevel >= 3 && config.approvalGate) {
          const approved = await config.approvalGate(tool, parseResult.data);
          if (!approved) {
            steps.push({ step, thought: text, toolName: tool.name, toolInput: toolCall.arguments, timestamp: new Date() });
            messages.push({ role: 'assistant', content: text });
            messages.push({ role: 'user', content: `Tool "${tool.name}" requires approval. Ask the user to confirm.` });
            continue;
          }
        }

        config.emit?.({ type: 'tool_call_start', toolName: tool.name, toolArgs: toolCall.arguments });

        const toolOutput = await tool.execute(parseResult.data, config.context);

        config.emit?.({ type: 'tool_result', toolName: tool.name, result: toolOutput });

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

      const final: AgentExecutorResult = {
        success: false,
        steps,
        finalOutput: null,
        error: 'Max steps reached without completion',
        tokensUsed: 0,
        durationMs: Date.now() - start,
      };
      return final;
    } catch (err: any) {
      const final: AgentExecutorResult = {
        success: false,
        steps,
        finalOutput: null,
        error: err.message || 'Unknown error',
        tokensUsed: 0,
        durationMs: Date.now() - start,
      };
      return final;
    } finally {
      this.abortControllers.delete(runId);
    }
  }

  abort(runId: string): void {
    this.abortControllers.get(runId)?.abort();
  }

  private buildSystemPrompt(profile: any, tools: any[], memoryText: string): string {
    const toolDescriptions = tools
      .map((t) => `- ${t.name}: ${t.description} (risk=${t.riskLevel})`)
      .join('\n');

    return `You are ${profile.name}. ${profile.systemPrompt}

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
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        if (parsed.tool) return { name: parsed.tool, arguments: parsed.arguments ?? {} };
      } catch {}
    }
    const looseMatch = text.match(/\{[^}]*"tool"[^}]*\}/);
    if (looseMatch) {
      try {
        const parsed = JSON.parse(looseMatch[0]);
        if (parsed.tool) return { name: parsed.tool, arguments: parsed.arguments ?? {} };
      } catch {}
    }
    return null;
  }
}
