import * as fs from 'node:fs';
import * as YAML from 'yaml';

export class Config {
  nexoriaApiUrl: string = process.env.NEXORIA_API_URL || 'http://localhost:3000/api/v1';
  agentToken: string = process.env.NEXORIA_AGENT_TOKEN || '';
  workspaceId: string = process.env.NEXORIA_WORKSPACE_ID || '';
  agentProfileId: string = process.env.NEXORIA_AGENT_PROFILE_ID || '';
  llmProvider: string = process.env.LLM_PROVIDER || 'openai';
  llmApiKey: string = process.env.LLM_API_KEY || '';
  llmModel: string = process.env.LLM_MODEL || 'gpt-4o';
  localDir: string = process.env.LOCAL_DIR || './data';
  syncToApi: boolean = process.env.SYNC_TO_API !== 'false';

  constructor(configPath = './config.yaml') {
    if (fs.existsSync(configPath)) {
      const raw = YAML.parse(fs.readFileSync(configPath, 'utf8'));
      Object.assign(this, raw);
    }
  }

  validate(): string[] {
    const missing: string[] = [];
    if (!this.agentToken) missing.push('agentToken');
    if (!this.workspaceId) missing.push('workspaceId');
    if (!this.agentProfileId) missing.push('agentProfileId');
    if (!this.llmApiKey) missing.push('llmApiKey');
    return missing;
  }
}
