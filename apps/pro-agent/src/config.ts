import * as fs from 'node:fs';
import * as YAML from 'yaml';

export class Config {
  nexoriaApiUrl: string = process.env.NEXORIA_API_URL || 'http://localhost:3000/api/v1';
  agentToken: string = process.env.NEXORIA_AGENT_TOKEN || '';
  workspaceId: string = process.env.NEXORIA_WORKSPACE_ID || '';
  agentProfileId: string = process.env.NEXORIA_AGENT_PROFILE_ID || '';
  llmProvider: string = process.env.LLM_PROVIDER || process.env.PRO_AGENT_LLM_PROVIDER || 'ollama';
  llmApiKey: string = process.env.LLM_API_KEY || process.env.PRO_AGENT_LLM_API_KEY || process.env.OLLAMA_API_KEY || '';
  llmModel: string = process.env.LLM_MODEL || process.env.PRO_AGENT_LLM_MODEL || process.env.OLLAMA_MODEL || 'gpt-4o';
  localDir: string = process.env.LOCAL_DIR || './data';
  syncToApi: boolean = process.env.SYNC_TO_API !== 'false';

  constructor(configPath = './config.yaml') {
    if (fs.existsSync(configPath)) {
      const raw = YAML.parse(fs.readFileSync(configPath, 'utf8'));
      Object.assign(this, raw);
    }
    // Env vars always win over YAML
    if (process.env.NEXORIA_API_URL) this.nexoriaApiUrl = process.env.NEXORIA_API_URL;
    if (process.env.NEXORIA_AGENT_TOKEN) this.agentToken = process.env.NEXORIA_AGENT_TOKEN;
    if (process.env.NEXORIA_WORKSPACE_ID) this.workspaceId = process.env.NEXORIA_WORKSPACE_ID;
    if (process.env.NEXORIA_AGENT_PROFILE_ID) this.agentProfileId = process.env.NEXORIA_AGENT_PROFILE_ID;
    if (process.env.LLM_PROVIDER || process.env.PRO_AGENT_LLM_PROVIDER) this.llmProvider = process.env.LLM_PROVIDER || process.env.PRO_AGENT_LLM_PROVIDER!;
    if (process.env.LLM_API_KEY || process.env.PRO_AGENT_LLM_API_KEY || process.env.OLLAMA_API_KEY) this.llmApiKey = process.env.LLM_API_KEY || process.env.PRO_AGENT_LLM_API_KEY || process.env.OLLAMA_API_KEY!;
    if (process.env.LLM_MODEL || process.env.PRO_AGENT_LLM_MODEL || process.env.OLLAMA_MODEL) this.llmModel = process.env.LLM_MODEL || process.env.PRO_AGENT_LLM_MODEL || process.env.OLLAMA_MODEL!;
    if (process.env.LOCAL_DIR) this.localDir = process.env.LOCAL_DIR;
    if (process.env.SYNC_TO_API) this.syncToApi = process.env.SYNC_TO_API !== 'false';
  }

  validate(): string[] {
    const missing: string[] = [];
    if (!this.agentToken) missing.push('agentToken');
    if (!this.workspaceId) missing.push('workspaceId');
    if (!this.llmApiKey) missing.push('llmApiKey');
    return missing;
  }
}
