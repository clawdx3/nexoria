import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { AgentProfile } from '@nexoria/agent-core';

export function resolveLlmAdapter(profile: AgentProfile) {
  const { modelProvider, modelName, modelConfig } = profile;

  let provider: any;
  switch (modelProvider) {
    case 'openai':
      provider = createOpenAI({ apiKey: modelConfig?.apiKey || process.env.OPENAI_API_KEY });
      break;
    case 'anthropic':
    case 'openrouter':
      provider = createOpenAI({
        apiKey: modelConfig?.apiKey || process.env.OPENROUTER_API_KEY,
        baseURL: modelConfig?.baseUrl || 'https://openrouter.ai/api/v1',
      });
      break;
    case 'ollama':
      provider = createOpenAI({
        apiKey: modelConfig?.apiKey || process.env.OLLAMA_API_KEY || 'ollama',
        baseURL: modelConfig?.baseUrl || process.env.OLLAMA_BASE_URL || 'https://ollama.com/v1',
      });
      break;
    default:
      provider = createOpenAI({ apiKey: modelConfig?.apiKey || process.env.OPENAI_API_KEY });
  }

  const model = provider(modelName || 'gpt-4o');

  return async (
    system: string,
    messages: Array<{ role: string; content: string }>,
    options?: { maxTokens?: number; temperature?: number },
  ) => {
    const MAX_RETRIES = 3;
    let lastErr: any;
    for (let i = 0; i < MAX_RETRIES; i++) {
      try {
        const result = await generateText({
          model,
          system,
          messages: messages.map((m) => ({ role: m.role as any, content: m.content })),
          maxTokens: options?.maxTokens ?? 2048,
          temperature: options?.temperature ?? 0.7,
        });
        return { text: result.text, usage: { totalTokens: result.usage?.totalTokens ?? 0 } };
      } catch (err: any) {
        lastErr = err;
        const status = err?.statusCode || err?.response?.statusCode || err?.status;
        if (status === 429 || status === 503 || err?.message?.toLowerCase().includes('service unavailable')) {
          const wait = Math.min(1000 * (2 ** i), 8000);
          console.warn(`[llm] Retry ${i + 1}/${MAX_RETRIES} after ${wait}ms due to ${err.message || status}`);
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }
        throw err;
      }
    }
    throw lastErr;
  };
}
