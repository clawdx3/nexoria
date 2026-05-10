import OpenAI from 'openai';
import { LLMProvider, LLMRequest, LLMResponse, LLMTool } from '../llm/router';

export class OpenAIProvider implements LLMProvider {
  id: string;
  type: string = 'openai';
  baseUrl: string;
  apiKey: string;
  models: string[];
  private client: OpenAI;

  constructor(config: { id: string; baseUrl?: string; apiKey: string; models: string[] }) {
    this.id = config.id;
    this.baseUrl = config.baseUrl || 'https://api.openai.com/v1';
    this.apiKey = config.apiKey;
    this.models = config.models;
    
    this.client = new OpenAI({
      apiKey: this.apiKey,
      baseURL: this.baseUrl,
    });
  }

  async send(request: LLMRequest): Promise<LLMResponse> {
    const tools = request.tools?.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters,
      },
    }));

    const response = await this.client.chat.completions.create({
      model: request.model,
      messages: request.messages as any,
      tools: tools?.length ? tools : undefined,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens,
    });

    const choice = response.choices[0];
    const message = choice.message;

    return {
      content: message.content || '',
      toolCalls: message.tool_calls?.map((tc) => ({
        id: tc.id,
        type: 'function',
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments,
        },
      })),
      usage: {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
      },
      model: response.model,
    };
  }
}

export class OpenRouterProvider extends OpenAIProvider {
  type: string = 'openrouter';

  constructor(config: { id: string; apiKey: string; models: string[] }) {
    super({
      ...config,
      baseUrl: 'https://openrouter.ai/api/v1',
    });
  }
}

export class OllamaProvider implements LLMProvider {
  id: string;
  type: string = 'ollama';
  baseUrl: string;
  apiKey: string;
  models: string[];

  constructor(config: { id: string; baseUrl: string; apiKey?: string; models: string[] }) {
    this.id = config.id;
    this.baseUrl = config.baseUrl.replace(/\/v1$/, ''); // Normalize base URL
    this.apiKey = config.apiKey || '';
    this.models = config.models;
  }

  async send(request: LLMRequest): Promise<LLMResponse> {
    const url = `${this.baseUrl}/api/chat`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey ? { 'Authorization': `Bearer ${this.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        stream: false,
        options: {
          temperature: request.temperature ?? 0.7,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.status} ${await response.text()}`);
    }

    const data: any = await response.json();

    return {
      content: data.message?.content || '',
      usage: {
        promptTokens: data.prompt_eval_count || 0,
        completionTokens: data.eval_count || 0,
        totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
      },
      model: request.model,
    };
  }
}

// Factory to create providers from config
export function createProvider(config: {
  id: string;
  type: string;
  baseUrl?: string;
  apiKey?: string;
  models: string[];
}): LLMProvider {
  switch (config.type) {
    case 'openai':
      return new OpenAIProvider({ ...config, apiKey: config.apiKey || '' });
    case 'openrouter':
      return new OpenRouterProvider({ ...config, apiKey: config.apiKey || '' });
    case 'ollama':
      return new OllamaProvider({ ...config, apiKey: config.apiKey || '', baseUrl: config.baseUrl || 'http://localhost:11434' });
    default:
      throw new Error(`Unknown provider type: ${config.type}`);
  }
}