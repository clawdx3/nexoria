import { AgentLoop, AgentToolRegistry, CompositeMemoryManager, AgentProfile, ToolContext, MemoryProvider } from '@nexoria/agent-core';

export interface SpecialistProfile {
  id: string;
  name: string;
  systemPrompt: string;
  enabledTools: string[];
  maxSteps?: number;
}

const SPECIALISTS: SpecialistProfile[] = [
  {
    id: 'social_media',
    name: 'Social Media Agent',
    systemPrompt: `You are a social media content specialist. You create engaging social media posts for platforms like Facebook, Instagram, LinkedIn, and Twitter/X.
When asked to create a post:
1. Write the post copy (concise, engaging, with appropriate hashtags)
2. Suggest visual content (image description or graphic ideas)
3. Provide platform-specific variations if asked for multiple platforms
4. Return the final post text ready to publish.
Do NOT use tools unless specifically asked to research something first. Just write the content directly.`,
    enabledTools: ['web_fetch', 'fs'],
    maxSteps: 5,
  },
  {
    id: 'email_outreach',
    name: 'Email Outreach Agent',
    systemPrompt: `You are an email outreach specialist. You write professional outreach emails for sales, partnerships, networking, and marketing campaigns.
When asked to write an email:
1. Write a clear, compelling subject line
2. Write the email body with proper structure (greeting, value proposition, call to action, signature)
3. Keep it concise and professional
4. Return the complete email ready to send.
Do NOT use tools unless asked to research the recipient first. Just write the content directly.`,
    enabledTools: ['web_fetch', 'fs'],
    maxSteps: 5,
  },
  {
    id: 'researcher',
    name: 'Research Agent',
    systemPrompt: `You are a research specialist. You gather information from the web, analyze data, and compile research summaries.
When asked to research something:
1. Use web_fetch to find relevant information
2. Synthesize findings into a clear summary
3. Cite sources where possible
4. Return a structured research brief.
Always use web_fetch to get current information. Do not make up facts.`,
    enabledTools: ['web_fetch', 'fs', 'terminal'],
    maxSteps: 8,
  },
  {
    id: 'content_creator',
    name: 'Content Creator Agent',
    systemPrompt: `You are a content creation specialist. You write blog posts, articles, documentation, and long-form content.
When asked to create content:
1. Structure the content with clear headings
2. Write engaging, well-researched copy
3. Include relevant examples and actionable takeaways
4. Return the complete content ready to publish.
Use fs to save content to files if the output is long. Use web_fetch if you need to research a topic first.`,
    enabledTools: ['web_fetch', 'fs'],
    maxSteps: 8,
  },
  {
    id: 'code_reviewer',
    name: 'Code Review Agent',
    systemPrompt: `You are a code review specialist. You analyze code for bugs, security issues, performance problems, and style improvements.
When asked to review code:
1. Read the code using fs
2. Identify issues and suggest improvements
3. Provide specific code fixes where applicable
4. Return a structured review with severity levels (critical, warning, suggestion).
Use fs to read files, terminal to run linters if available.`,
    enabledTools: ['fs', 'terminal', 'execute_code'],
    maxSteps: 8,
  },
];

export class SubagentSpawner {
  private readonly specialists = new Map<string, SpecialistProfile>();

  constructor(
    private readonly llm: (system: string, messages: Array<{ role: string; content: string }>, opts?: { maxTokens?: number; temperature?: number }) => Promise<{ text: string; usage?: { totalTokens: number } }>,
    private readonly allTools: AgentToolRegistry,
    private readonly memoryProvider: MemoryProvider,
  ) {
    for (const s of SPECIALISTS) {
      this.specialists.set(s.id, s);
      this.specialists.set(s.name.toLowerCase().replace(/ /g, '_'), s);
    }
  }

  getSpecialist(idOrName: string): SpecialistProfile | undefined {
    return this.specialists.get(idOrName) || this.specialists.get(idOrName.toLowerCase().replace(/ /g, '_'));
  }

  listSpecialists(): SpecialistProfile[] {
    const seen = new Set<string>();
    const result: SpecialistProfile[] = [];
    for (const s of this.specialists.values()) {
      if (!seen.has(s.id)) {
        seen.add(s.id);
        result.push(s);
      }
    }
    return result;
  }

  async spawn(specialistId: string, prompt: string, workspaceId: string): Promise<{ success: boolean; output: string | null; error?: string; specialistName: string }> {
    const specialist = this.getSpecialist(specialistId);
    if (!specialist) {
      return { success: false, output: null, error: `Unknown specialist: ${specialistId}. Available: ${this.listSpecialists().map(s => s.id).join(', ')}`, specialistName: specialistId };
    }

    const registry = new AgentToolRegistry();
    const allToolsList = this.allTools.listAll();
    for (const tool of allToolsList) {
      if (specialist.enabledTools.includes(tool.name)) {
        registry.register(tool);
      }
    }

    const memoryManager = new CompositeMemoryManager(this.memoryProvider);
    const loop = new AgentLoop();

    const profile: AgentProfile = {
      id: specialist.id,
      name: specialist.name,
      systemPrompt: specialist.systemPrompt,
      modelProvider: 'ollama',
      modelName: '',
      modelConfig: {},
      enabledTools: specialist.enabledTools,
      role: 'specialist',
      defaultAutonomyLevel: 2,
      runtimeMode: 'native_pro',
    };

    const ctx: ToolContext = {
      agentProfile: profile,
      workspaceId,
      triggeredByUserId: 'pro-agent-orchestrator',
      userRole: 'system',
      autonomyLevel: 3,
    };

    const result = await loop.run(
      {
        profile,
        llm: async (params) => {
          const res = await this.llm(params.system, params.messages, {
            maxTokens: params.maxTokens ?? 2048,
            temperature: params.temperature ?? 0.7,
          });
          return { text: res.text };
        },
        toolRegistry: registry,
        memoryManager,
        context: ctx,
        maxSteps: specialist.maxSteps ?? 5,
        maxTokens: 2048,
        temperature: 0.7,
      },
      prompt,
    );

    return {
      success: result.success,
      output: result.finalOutput,
      error: result.error,
      specialistName: specialist.name,
    };
  }
}
