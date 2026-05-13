export class Config {
  nexoriaApiUrl = process.env.NEXORIA_API_URL || 'http://localhost:3000/api/v1';
  workspaceId = process.env.NEXORIA_WORKSPACE_ID || '';
  agentProfileId = process.env.NEXORIA_AGENT_PROFILE_ID || '';
  localDir = process.env.LOCAL_DIR || './data';
  hermesApiUrl = process.env.HERMES_API_URL || 'http://hermes:8642';
  hermesApiKey = process.env.HERMES_API_KEY || process.env.API_SERVER_KEY || '';
  hermesModel = process.env.HERMES_MODEL || process.env.LLM_MODEL || '';
  hermesRunTimeoutMs = Number(process.env.HERMES_RUN_TIMEOUT_MS || 5 * 60 * 1000);
  nexoriaMcpUrl = process.env.NEXORIA_MCP_URL || `${this.nexoriaApiUrl}/mcp`;
  nexoriaMcpToken = process.env.NEXORIA_MCP_TOKEN || '';

  validate(): string[] {
    const missing: string[] = [];
    if (!this.workspaceId) missing.push('workspaceId');
    if (!this.hermesApiKey) missing.push('hermesApiKey');
    return missing;
  }
}
