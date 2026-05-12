import { AgentConfig, AgentExecutorResult, AgentStep, AgentTool, AskUserInterrupt } from './types';
import { tokenEstimate, CompressorMessage } from './compressor';
import { ContextEngine, DefaultCompactionEngine } from './context-engine';

export interface ToolCall {
  name: string;
  arguments: any;
  originalIndex: number;
}

let runCounter = 0;

export class AgentLoop {
  private readonly DEFAULT_MAX_STEPS = 10;
  private readonly abortControllers = new Map<string, AbortController>();

  async run(
    config: AgentConfig,
    userMessage: string,
    opts?: { signal?: AbortSignal; existingMessages?: { role: string; content: string }[]; checkpoint?: { steps?: AgentStep[]; step?: number; messages?: { role: string; content: string }[] } },
  ): Promise<AgentExecutorResult> {
    const start = Date.now();
    const steps: AgentStep[] = opts?.checkpoint?.steps ?? [];
    let step = (opts?.checkpoint?.step ?? 0) + 1;
    const maxSteps = config.maxSteps ?? this.DEFAULT_MAX_STEPS;
    const contextTokenBudget = config.maxTokens ?? 4096;
    let totalTokens = 0;

    if (!config.llm) throw new Error('config.llm is required');

    const tools = config.toolRegistry.listForContext(config.context);

    const memory = await config.memoryManager.prefetch(config.context, userMessage);
    const memoryText = config.memoryManager.formatForPrompt(memory);

    const system = this.buildSystemPrompt(config.profile, tools, memoryText);
    const messages: { role: string; content: string }[] = [];

    if (opts?.checkpoint?.messages) {
      messages.push(...opts.checkpoint.messages);
    } else if (opts?.existingMessages?.length) {
      const hasSystem = opts.existingMessages.length > 0 && opts.existingMessages[0].role === 'system';
      if (hasSystem) {
        messages.push(...opts.existingMessages);
      } else {
        messages.push({ role: 'system', content: system });
        messages.push(...opts.existingMessages);
      }
    } else {
      messages.push({ role: 'system', content: system });
    }

    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.role !== 'user' || lastMsg.content !== userMessage) {
      messages.push({ role: 'user', content: userMessage });
    }

    const runId = `${config.context.workspaceId}:${Date.now()}:${++runCounter}`;
    const abortCtrl = new AbortController();
    this.abortControllers.set(runId, abortCtrl);

    const engine: ContextEngine | null = config.contextEngine ?? (config.enableCompaction ? new DefaultCompactionEngine() : null);
    engine?.onSessionStart(runId);

    if (opts?.signal) {
      opts.signal.addEventListener('abort', () => abortCtrl.abort());
    }

    try {
      for (; step <= maxSteps; step++) {
        if (abortCtrl.signal.aborted) {
          throw new Error('Agent loop aborted');
        }

        config.emit?.({ type: 'token', content: '' }); // keep-alive

        if (engine && engine.shouldCompact(messages as CompressorMessage[], contextTokenBudget)) {
          engine.compact(messages as CompressorMessage[], contextTokenBudget);
        }

        const { text: rawText, usage } = await config.llm({
          system,
          messages,
          maxTokens: config.maxTokens ?? 2048,
          temperature: config.temperature ?? 0.7,
        });

        totalTokens += usage?.totalTokens ?? 0;
        engine?.updateFromResponse(usage ?? {});
        const text = rawText ?? '';
        const toolCalls = this.parseToolCalls(text);

        if (!toolCalls.length) {
          const final: AgentExecutorResult = {
            success: true,
            steps,
            finalOutput: text,
            tokensUsed: totalTokens,
            durationMs: Date.now() - start,
          };
          await config.memoryManager.syncTurn(config.context, userMessage, text);
          return final;
        }

        // Approval gate — track rejected tool indices
        const rejectedIndices = new Set<number>();
        for (const tc of toolCalls) {
          const tool = config.toolRegistry.get(tc.name);
          if (tool && tool.riskLevel >= 3 && config.approvalGate) {
            const approved = await config.approvalGate(tool, tc.arguments);
            if (!approved) {
              rejectedIndices.add(tc.originalIndex);
              steps.push({ step, thought: text, toolName: tool.name, toolInput: tc.arguments, timestamp: new Date() });
            }
          }
        }

        if (rejectedIndices.size > 0) {
          messages.push({ role: 'assistant', content: text });
          messages.push({ role: 'user', content: `Tool(s) require approval. Ask the user to confirm.` });
          continue;
        }

        const approvedCalls = toolCalls.filter(tc => !rejectedIndices.has(tc.originalIndex));

        if (config.enableConcurrency) {
          await this.executeConcurrent(config, approvedCalls, steps, text, step, messages);
        } else {
          for (const tc of approvedCalls) {
            await this.executeSingle(config, tc, steps, text, step, messages);
          }
        }
      }

      const final: AgentExecutorResult = {
        success: false,
        steps,
        finalOutput: null,
        error: 'Max steps reached without completion',
        tokensUsed: totalTokens,
        durationMs: Date.now() - start,
      };
      return final;
    } catch (err: any) {
      if (err instanceof AskUserInterrupt || err?._tag === 'AskUserInterrupt') {
        return {
          success: false,
          steps,
          finalOutput: null,
          error: err.message,
          tokensUsed: totalTokens,
          durationMs: Date.now() - start,
          interruptedByApprovalId: err.approvalId,
        };
      }
      const final: AgentExecutorResult = {
        success: false,
        steps,
        finalOutput: null,
        error: err.message || 'Unknown error',
        tokensUsed: totalTokens,
        durationMs: Date.now() - start,
      };
      return final;
    } finally {
      engine?.onSessionEnd(runId);
      this.abortControllers.delete(runId);
    }
  }

  abort(runId: string): void {
    this.abortControllers.get(runId)?.abort();
  }

  private buildSystemPrompt(profile: any, tools: any[], memoryText: string): string {
    const toolDescriptions = tools
      .map((t) => `- ${t.name}: ${t.description} (risk=${t.riskLevel}${t.exclusive ? ', exclusive' : ''})`)
      .join('\n');

    return `You are ${profile.name}. ${profile.systemPrompt}

Available tools:
${toolDescriptions}

To call one or more tools, respond with JSON inside triple backticks like:
\`\`\`json
{"tool": "tool_name", "arguments": { ... }}
\`\`\`
If multiple tools are needed, output multiple JSON blocks in the same message. They will be executed in parallel when safe.
If no tool is needed, provide a direct answer.

${memoryText}
`;
  }

  private parseToolCalls(text: string): ToolCall[] {
    const calls: ToolCall[] = [];
    const blockRe = /```json\s*([\s\S]*?)\s*```/g;
    let m: RegExpExecArray | null;
    while ((m = blockRe.exec(text)) !== null) {
      try {
        const parsed = JSON.parse(m[1]);
        if (parsed.tool) {
          calls.push({ name: parsed.tool, arguments: parsed.arguments ?? {}, originalIndex: calls.length });
        }
      } catch (err: any) {
        // Try to repair common JSON issues (trailing commas)
        try {
          const repaired = m[1].replace(/,\s*([\]}])/g, '$1');
          const parsed = JSON.parse(repaired);
          if (parsed.tool) {
            calls.push({ name: parsed.tool, arguments: parsed.arguments ?? {}, originalIndex: calls.length });
          }
        } catch {
          // Silent — malformed tool call block is skipped
        }
      }
    }
    if (calls.length === 0) {
      const looseMatch = this.extractJsonObject(text);
      if (looseMatch) {
        try {
          const parsed = JSON.parse(looseMatch);
          if (parsed.tool) {
            calls.push({ name: parsed.tool, arguments: parsed.arguments ?? {}, originalIndex: 0 });
          }
        } catch {}
      }
    }
    return calls;
  }

  private extractJsonObject(text: string): string | null {
    const start = text.indexOf('{');
    if (start === -1) return null;
    let depth = 0;
    for (let i = start; i < text.length; i++) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}') {
        depth--;
        if (depth === 0) {
          const candidate = text.slice(start, i + 1);
          if (candidate.includes('"tool"')) return candidate;
          return null;
        }
      }
    }
    return null;
  }

  private async executeSingle(
    config: AgentConfig,
    tc: ToolCall,
    steps: AgentStep[],
    thought: string,
    stepNum: number,
    messages: Array<{ role: string; content: string }>,
  ): Promise<void> {
    const tool = config.toolRegistry.get(tc.name);
    if (!tool) {
      steps.push({ step: stepNum, thought, timestamp: new Date() });
      messages.push({ role: 'assistant', content: thought });
      messages.push({ role: 'user', content: `Tool "${tc.name}" not found. Please use available tools.` });
      return;
    }

    const parseResult = tool.schema.safeParse(tc.arguments);
    if (!parseResult.success) {
      steps.push({ step: stepNum, thought, toolName: tool.name, toolInput: tc.arguments, timestamp: new Date() });
      messages.push({ role: 'assistant', content: thought });
      messages.push({ role: 'user', content: `Invalid arguments: ${parseResult.error.message}` });
      return;
    }

    config.emit?.({ type: 'tool_call_start', toolName: tool.name, toolArgs: tc.arguments });

    const toolOutput = await tool.execute(parseResult.data, config.context);

    config.emit?.({ type: 'tool_result', toolName: tool.name, result: toolOutput });

    steps.push({
      step: stepNum,
      thought,
      toolName: tool.name,
      toolInput: tc.arguments,
      toolOutput,
      timestamp: new Date(),
    });

    messages.push({ role: 'assistant', content: thought });
    messages.push({ role: 'user', content: `Tool result:\n${JSON.stringify(toolOutput, null, 2)}` });
  }

  private async executeConcurrent(
    config: AgentConfig,
    toolCalls: ToolCall[],
    steps: AgentStep[],
    thought: string,
    stepNum: number,
    messages: Array<{ role: string; content: string }>,
  ): Promise<void> {
    const exclusive = toolCalls.filter((tc) => {
      const t = config.toolRegistry.get(tc.name);
      return t?.exclusive === true;
    });

    const parallel = toolCalls.filter((tc) => !exclusive.includes(tc));

    // Run exclusive tools first, then continue with parallel
    for (const tc of exclusive) {
      await this.executeSingle(config, tc, steps, thought, stepNum, messages);
    }

    if (parallel.length === 0) return;

    const validated = parallel
      .map((tc) => {
        const tool = config.toolRegistry.get(tc.name);
        if (!tool) {
          return { ok: false as const, tc, error: `Tool "${tc.name}" not found.` };
        }
        const parsed = tool.schema.safeParse(tc.arguments);
        if (!parsed.success) {
          return { ok: false as const, tc, error: `Invalid arguments: ${parsed.error.message}` };
        }
        return { ok: true as const, tc, tool, data: parsed.data };
      });

    const failures = validated.filter((v) => !v.ok);
    const successes = validated.filter((v) => v.ok) as any[];

    if (failures.length > 0) {
      for (const f of failures) {
        steps.push({ step: stepNum, thought, timestamp: new Date() });
        messages.push({ role: 'assistant', content: thought });
        messages.push({ role: 'user', content: f.error as string });
      }
      if (successes.length === 0) return;
    }

    config.emit?.({ type: 'tool_call_start', toolName: successes.map((s) => s.tc.name).join(', '), toolArgs: successes.map((s) => s.tc.arguments) });

    const results = await Promise.all(
      successes.map(async (s) => {
        try {
          const out = await s.tool.execute(s.data, config.context);
          return { tc: s.tc, tool: s.tool, output: out, error: null };
        } catch (err: any) {
          return { tc: s.tc, tool: s.tool, output: null, error: err.message };
        }
      }),
    );

    const ordered = results.sort((a, b) => a.tc.originalIndex - b.tc.originalIndex);

    for (const r of ordered) {
      config.emit?.({ type: 'tool_result', toolName: r.tool.name, result: r.output ?? { success: false, error: r.error } });
      steps.push({
        step: stepNum,
        thought,
        toolName: r.tool.name,
        toolInput: r.tc.arguments,
        toolOutput: r.output ?? { success: false, error: r.error },
        timestamp: new Date(),
      });
    }

    messages.push({ role: 'assistant', content: thought });
    messages.push({
      role: 'user',
      content: `Tool results:\n${ordered.map((r) => `${r.tool.name}: ${JSON.stringify(r.output ?? { success: false, error: r.error })}`).join('\n---\n')}`,
    });
  }

  private compactMessages(messages: Array<{ role: string; content: string }>, maxTokens: number): void {
    const est = tokenEstimate(messages);
    if (est <= maxTokens * 0.85) return;

    const system = messages.find((m) => m.role === 'system');
    const nonSystem = messages.filter((m) => m.role !== 'system');

    const recent = nonSystem.slice(-4);
    const older = nonSystem.slice(0, -4);

    const compactedOlder = older.map((m) => {
      if (m.role === 'user' && (m.content.startsWith('Tool result:') || m.content.startsWith('Tool results:'))) {
        const lines = m.content.split('\n');
        const firstLine = lines[0];
        return { role: m.role, content: `${firstLine}\n[result omitted]` };
      }
      return m;
    });

    messages.length = 0;
    if (system) messages.push(system);
    messages.push(...compactedOlder, ...recent);
  }
}
