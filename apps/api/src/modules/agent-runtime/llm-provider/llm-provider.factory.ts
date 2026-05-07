import { Injectable } from '@nestjs/common';
import { generateText, LanguageModel } from 'ai';
import { createOpenAI, openai } from '@ai-sdk/openai';
import { AgentContext } from '../../../shared/interfaces/agent.interfaces';

@Injectable()
export class LlmProviderFactory {
  resolveModel(ctx: AgentContext): LanguageModel {
    const { modelProvider, modelName, modelConfig } = ctx.agentProfile;
    const asLanguageModel = (model: unknown): LanguageModel => model as LanguageModel;

    switch (modelProvider) {
      case 'openai':
        return asLanguageModel(openai(modelName, { ...modelConfig }));
      case 'anthropic':
        // Use OpenRouter as proxy for anthropic or custom integration
        return asLanguageModel(createOpenAI({
          apiKey: modelConfig?.apiKey || process.env.OPENROUTER_API_KEY,
          baseURL: modelConfig?.baseUrl || 'https://openrouter.ai/api/v1',
        })(modelName));
      case 'openrouter':
        return asLanguageModel(createOpenAI({
          apiKey: modelConfig?.apiKey || process.env.OPENROUTER_API_KEY,
          baseURL: modelConfig?.baseUrl || 'https://openrouter.ai/api/v1',
        })(modelName));
      case 'ollama': {
        const apiKey = modelConfig?.apiKey || process.env.OLLAMA_API_KEY;
        if (!apiKey) {
          throw new Error('Missing Ollama API key. Set OLLAMA_API_KEY to use the Ollama provider.');
        }
        return asLanguageModel(createOpenAI({
          apiKey,
          baseURL: modelConfig?.baseUrl || process.env.OLLAMA_BASE_URL || 'https://ollama.com/v1',
        })(modelName));
      }
      case 'custom':
        return asLanguageModel(createOpenAI({
          apiKey: modelConfig?.apiKey,
          baseURL: modelConfig?.baseUrl,
        })(modelName));
      default:
        return asLanguageModel(openai('gpt-4o'));
    }
  }

  async generate(ctx: AgentContext, system: string, messages: { role: string; content: string }[]): Promise<{ text: string; tokens: number }> {
    const model = this.resolveModel(ctx);
    const result = await generateText({
      model,
      system,
      messages: messages.map((m) => ({ role: m.role as any, content: m.content })),
      maxTokens: ctx.agentProfile.modelConfig?.maxTokens ?? 2048,
      temperature: ctx.agentProfile.modelConfig?.temperature ?? 0.7,
    });
    return { text: result.text, tokens: result.usage?.totalTokens ?? 0 };
  }
}
