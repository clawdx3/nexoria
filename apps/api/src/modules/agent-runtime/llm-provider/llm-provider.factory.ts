import { Injectable } from '@nestjs/common';
import { generateText, LanguageModel } from 'ai';
import { openai } from '@ai-sdk/openai';
import { AgentContext } from '../../../shared/interfaces/agent.interfaces';

@Injectable()
export class LlmProviderFactory {
  resolveModel(ctx: AgentContext): LanguageModel {
    const { modelProvider, modelName, modelConfig } = ctx.agentProfile;
    switch (modelProvider) {
      case 'openai':
        return openai(modelName, { ...modelConfig });
      case 'anthropic':
        // Use OpenRouter as proxy for anthropic or custom integration
        return openai(modelName, {
          apiKey: modelConfig?.apiKey || process.env.OPENROUTER_API_KEY,
          baseURL: modelConfig?.baseUrl || 'https://openrouter.ai/api/v1',
        });
      case 'openrouter':
        return openai(modelName, {
          apiKey: modelConfig?.apiKey || process.env.OPENROUTER_API_KEY,
          baseURL: modelConfig?.baseUrl || 'https://openrouter.ai/api/v1',
        });
      case 'custom':
        return openai(modelName, {
          apiKey: modelConfig?.apiKey,
          baseURL: modelConfig?.baseUrl,
        });
      default:
        return openai('gpt-4o');
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
