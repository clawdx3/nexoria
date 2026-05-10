import { EventEmitter } from 'events';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string; // for tool responses
}

export interface LLMRequest {
  messages: LLMMessage[];
  model: string;
  tools?: LLMTool[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface LLMResponse {
  content: string;
  toolCalls?: LLMToolCall[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
}

export interface LLMTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}

export interface LLMToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

export interface LLMProvider {
  id: string;
  type: string; // Changed from literal union to allow any provider type
  baseUrl: string;
  apiKey: string;
  models: string[];
  
  send(request: LLMRequest): Promise<LLMResponse>;
  stream?(request: LLMRequest, callback: (chunk: string) => void): Promise<LLMResponse>;
}

export class LLMRouter extends EventEmitter {
  private providers: Map<string, LLMProvider> = new Map();
  private modelMap: Map<string, string> = new Map(); // model alias -> provider.model

  registerProvider(provider: LLMProvider): void {
    this.providers.set(provider.id, provider);
    for (const model of provider.models) {
      this.modelMap.set(model, `${provider.id}/${model}`);
    }
    console.log(`[llm] registered provider ${provider.id} with models: ${provider.models.join(', ')}`);
  }

  removeProvider(id: string): void {
    const provider = this.providers.get(id);
    if (provider) {
      for (const model of provider.models) {
        this.modelMap.delete(model);
      }
      this.providers.delete(id);
    }
  }

  async send(request: LLMRequest): Promise<LLMResponse> {
    const provider = this.resolveProvider(request.model);
    if (!provider) {
      throw new Error(`No provider found for model: ${request.model}`);
    }
    
    console.log(`[llm] sending to ${provider.id}/${request.model}`);
    const startTime = Date.now();
    
    try {
      const response = await provider.send(request);
      console.log(`[llm] response from ${provider.id} in ${Date.now() - startTime}ms`);
      this.emit('usage', {
        provider: provider.id,
        model: response.model,
        usage: response.usage,
      });
      return response;
    } catch (err) {
      console.error(`[llm] error from ${provider.id}:`, err);
      throw err;
    }
  }

  async *stream(request: LLMRequest): AsyncGenerator<string, LLMResponse, void> {
    const provider = this.resolveProvider(request.model);
    if (!provider) {
      throw new Error(`No provider found for model: ${request.model}`);
    }

    if (!provider.stream) {
      // Fallback to non-streaming
      const response = await provider.send(request);
      yield response.content;
      return response;
    }

    let fullContent = '';
    const response = await provider.stream(request, (chunk) => {
      fullContent += chunk;
    });
    
    yield response.content;
    return response;
  }

  private resolveProvider(model: string): LLMProvider | null {
    // Direct reference: "openai/gpt-5.5"
    if (model.includes('/')) {
      const [providerId, modelName] = model.split('/');
      return this.providers.get(providerId) || null;
    }
    
    // Alias lookup
    const mapped = this.modelMap.get(model);
    if (mapped) {
      const [providerId] = mapped.split('/');
      return this.providers.get(providerId) || null;
    }
    
    // Fallback: find any provider with this model
    for (const [, provider] of this.providers) {
      if (provider.models.includes(model)) {
        return provider;
      }
    }
    
    return null;
  }

  listModels(): string[] {
    return Array.from(this.modelMap.keys());
  }
}
