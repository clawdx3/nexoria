import { z } from 'zod';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ProAgentLoop } from './loop';
import { Config } from './config';
import { SubagentSpawner } from './subagents';
import { WsProAgentApiClient } from './api-client';

const execAsync = promisify(exec);

const WORKSPACE_DIR = process.env.NEXORIA_WORKSPACE_DIR || '/app/workspace';
const MAX_OUTPUT = 50000;
const TIMEOUT_MS = 30000;

function truncate(text: string, max: number = MAX_OUTPUT): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + `\n... [truncated, ${text.length} chars total]`;
}

function safePath(p: string): string {
  const resolved = path.resolve(WORKSPACE_DIR, p);
  if (!resolved.startsWith(WORKSPACE_DIR)) {
    throw new Error(`Path traversal denied: ${p}`);
  }
  return resolved;
}

export function registerDangerousTools(agent: ProAgentLoop, config: Config): void {
  // ───── terminal ─────
  agent.registerTool({
    name: 'terminal',
    description: 'Execute a shell command. Returns stdout/stderr. Timeout: 30s. CWD defaults to workspace dir.',
    schema: z.object({
      command: z.string().describe('The shell command to execute'),
      cwd: z.string().optional().describe('Working directory (relative to workspace)'),
      timeout: z.number().optional().describe('Timeout in ms (max 60000)'),
    }),
    riskLevel: 3,
    execute: async (args: { command: string; cwd?: string; timeout?: number }) => {
      const cwd = args.cwd ? safePath(args.cwd) : WORKSPACE_DIR;
      const timeout = Math.min(args.timeout || TIMEOUT_MS, 60000);
      try {
        const { stdout, stderr } = await execAsync(args.command, {
          cwd,
          timeout,
          maxBuffer: 1024 * 1024,
          env: { ...process.env, HOME: '/tmp' },
        });
        return {
          success: true,
          stdout: truncate(stdout),
          stderr: truncate(stderr),
          exitCode: 0,
        };
      } catch (err: any) {
        return {
          success: false,
          stdout: truncate(err.stdout || ''),
          stderr: truncate(err.stderr || err.message),
          exitCode: err.code ?? 1,
        };
      }
    },
  });

  // ───── fs ─────
  agent.registerTool({
    name: 'fs',
    description: 'Read, write, list, or delete workspace files. All paths are relative to workspace root.',
    schema: z.object({
      action: z.enum(['read', 'write', 'list', 'delete', 'mkdir']),
      path: z.string().describe('File or directory path relative to workspace'),
      content: z.string().optional().describe('Content for write action'),
      recursive: z.boolean().optional().describe('Recursive list or delete'),
    }),
    riskLevel: 3,
    execute: async (args: { action: string; path: string; content?: string; recursive?: boolean }) => {
      const target = safePath(args.path);
      try {
        switch (args.action) {
          case 'read': {
            const stat = await fs.stat(target);
            if (stat.size > 5 * 1024 * 1024) {
              return { success: false, error: 'File too large (>5MB)' };
            }
            const content = await fs.readFile(target, 'utf-8');
            return { success: true, content: truncate(content), size: stat.size };
          }
          case 'write': {
            if (args.content === undefined) return { success: false, error: 'Content required for write' };
            await fs.mkdir(path.dirname(target), { recursive: true });
            await fs.writeFile(target, args.content, 'utf-8');
            return { success: true, bytesWritten: Buffer.byteLength(args.content) };
          }
          case 'list': {
            const entries = await fs.readdir(target, { withFileTypes: true, recursive: args.recursive ?? false });
            const items = entries.map((e) => ({
              name: e.name,
              type: e.isDirectory() ? 'directory' : 'file',
              path: path.relative(WORKSPACE_DIR, path.join(e.parentPath || target, e.name)),
            }));
            return { success: true, items: items.slice(0, 200), total: items.length };
          }
          case 'delete': {
            const stat = await fs.stat(target);
            if (stat.isDirectory()) {
              await fs.rm(target, { recursive: args.recursive ?? false });
            } else {
              await fs.unlink(target);
            }
            return { success: true, deleted: args.path };
          }
          case 'mkdir': {
            await fs.mkdir(target, { recursive: args.recursive ?? true });
            return { success: true, created: args.path };
          }
          default:
            return { success: false, error: `Unknown action: ${args.action}` };
        }
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    },
  });

  // ───── execute_code ─────
  agent.registerTool({
    name: 'execute_code',
    description: 'Execute Python or Node.js code in a sandboxed environment. Returns stdout/stderr.',
    schema: z.object({
      language: z.enum(['python', 'javascript', 'bash']),
      code: z.string().describe('The code to execute'),
      timeout: z.number().optional().describe('Timeout in ms (max 60000)'),
    }),
    riskLevel: 3,
    execute: async (args: { language: string; code: string; timeout?: number }) => {
      const timeout = Math.min(args.timeout || TIMEOUT_MS, 60000);
      const tmpFile = `/tmp/nexoria_exec_${Date.now()}`;

      const commands: Record<string, { ext: string; cmd: (f: string) => string }> = {
        python: { ext: '.py', cmd: (f) => `python3 ${f}` },
        javascript: { ext: '.js', cmd: (f) => `node ${f}` },
        bash: { ext: '.sh', cmd: (f) => `bash ${f}` },
      };

      const lang = commands[args.language];
      if (!lang) return { success: false, error: `Unsupported language: ${args.language}` };

      const filePath = `${tmpFile}${lang.ext}`;
      try {
        await fs.writeFile(filePath, args.code, 'utf-8');
        const { stdout, stderr } = await execAsync(lang.cmd(filePath), {
          timeout,
          maxBuffer: 1024 * 1024,
          cwd: WORKSPACE_DIR,
          env: { ...process.env, HOME: '/tmp' },
        });
        return { success: true, stdout: truncate(stdout), stderr: truncate(stderr) };
      } catch (err: any) {
        return {
          success: false,
          stdout: truncate(err.stdout || ''),
          stderr: truncate(err.stderr || err.message),
        };
      } finally {
        await fs.unlink(filePath).catch(() => {});
      }
    },
  });

  // ───── web_fetch ─────
  agent.registerTool({
    name: 'web_fetch',
    description: 'Fetch a URL and return the content. Useful for reading web pages, APIs, or documentation.',
    schema: z.object({
      url: z.string().url().describe('The URL to fetch'),
      format: z.enum(['text', 'json']).optional().describe('Response format (default: text)'),
      maxChars: z.number().optional().describe('Max characters to return (default: 10000)'),
    }),
    riskLevel: 2,
    execute: async (args: { url: string; format?: string; maxChars?: number }) => {
      const maxChars = args.maxChars || 10000;
      try {
        const res = await fetch(args.url, {
          headers: { 'User-Agent': 'Nexoria-Pro-Agent/1.0' },
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) return { success: false, error: `HTTP ${res.status}: ${res.statusText}` };

        if (args.format === 'json') {
          const data = await res.json();
          return { success: true, data };
        }

        const text = await res.text();
        return { success: true, content: truncate(text, maxChars), url: args.url };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    },
  });

  // ───── search_web ─────
  agent.registerTool({
    name: 'search_web',
    description: 'Search the web using DuckDuckGo and return a list of results with titles, URLs, and snippets. No API key required.',
    schema: z.object({
      query: z.string().describe('Search query'),
      maxResults: z.number().optional().describe('Max results to return (default: 5)'),
    }),
    riskLevel: 2,
    execute: async (args: { query: string; maxResults?: number }) => {
      const maxResults = Math.min(args.maxResults || 5, 10);
      try {
        const encoded = encodeURIComponent(args.query);
        const html = await (await fetch(`https://html.duckduckgo.com/html/?q=${encoded}`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NexoriaBot/1.0)' },
          signal: AbortSignal.timeout(10000),
        })).text();

        const results: Array<{ title: string; url: string; snippet: string }> = [];
        const linkRe = /<a rel="nofollow" class="result__a" href="(https?:\/\/[^"]+)">(.*?)<\/a>/g;
        const snippetRe = /<a class="result__snippet">(.*?)<\/a>/g;

        let linkMatch;
        let snippetMatch;
        while ((linkMatch = linkRe.exec(html)) !== null && results.length < maxResults) {
          snippetMatch = snippetRe.exec(html);
          results.push({
            title: linkMatch[2].replace(/<[^>]+>/g, ''),
            url: linkMatch[1],
            snippet: (snippetMatch ? snippetMatch[1] : '').replace(/<[^>]+>/g, ''),
          });
        }

        if (results.length === 0) {
          return { success: false, error: 'No search results found' };
        }
        return { success: true, results };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    },
  });

  // ───── generate_image ─────
  agent.registerTool({
    name: 'generate_image',
    description: 'Generate an image using AI (DALL-E) and save it to the workspace. Requires OPENAI_API_KEY env var.',
    schema: z.object({
      prompt: z.string().describe('Detailed image description'),
      filename: z.string().describe('Output filename (e.g., logo.png)'),
      size: z.enum(['1024x1024', '1792x1024', '1024x1792']).optional().describe('Image dimensions (default: 1024x1024)'),
      quality: z.enum(['standard', 'hd']).optional().describe('Image quality (default: standard)'),
    }),
    riskLevel: 2,
    execute: async (args: { prompt: string; filename: string; size?: string; quality?: string }) => {
      const apiKey = process.env.OPENAI_API_KEY || config.llmApiKey;
      if (!apiKey) return { success: false, error: 'No OPENAI_API_KEY configured' };
      try {
        const res = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'dall-e-3',
            prompt: args.prompt,
            n: 1,
            size: args.size || '1024x1024',
            quality: args.quality || 'standard',
            response_format: 'url',
          }),
          signal: AbortSignal.timeout(60000),
        });
        if (!res.ok) return { success: false, error: `OpenAI ${res.status}: ${await res.text()}` };
        const data = await res.json() as any;
        const imageUrl = data.data?.[0]?.url;
        if (!imageUrl) return { success: false, error: 'No image URL returned' };

        const imageRes = await fetch(imageUrl, { signal: AbortSignal.timeout(30000) });
        if (!imageRes.ok) return { success: false, error: 'Failed to download generated image' };
        const buffer = Buffer.from(await imageRes.arrayBuffer());
        const target = safePath(args.filename);
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.writeFile(target, buffer);
        return { success: true, filename: args.filename, sizeBytes: buffer.length, path: args.filename };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    },
  });

  // ───── create_chart ─────
  agent.registerTool({
    name: 'create_chart',
    description: 'Create a chart/image from data using Python matplotlib and save it to the workspace.',
    schema: z.object({
      data: z.array(z.record(z.any())).describe('Array of data rows (objects)'),
      chartType: z.enum(['bar', 'line', 'pie', 'scatter', 'hist']).describe('Chart type'),
      xKey: z.string().describe('Key for X-axis / categories'),
      yKey: z.string().describe('Key for Y-axis / values'),
      title: z.string().optional().describe('Chart title'),
      filename: z.string().describe('Output filename (e.g., sales.png)'),
      width: z.number().optional().describe('Width in inches (default: 8)'),
      height: z.number().optional().describe('Height in inches (default: 5)'),
    }),
    riskLevel: 2,
    execute: async (args: { data: any[]; chartType: string; xKey: string; yKey: string; title?: string; filename: string; width?: number; height?: number }) => {
      const code = `
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import json

data = json.loads('''${JSON.stringify(args.data)}''')
chart_type = '${args.chartType}'
x_key = '${args.xKey}'
y_key = '${args.yKey}'
title = ${args.title ? `'${args.title.replace(/'/g, "\\'")}'` : 'None'}
filename = '${safePath(args.filename)}'
width = ${args.width || 8}
height = ${args.height || 5}

fig, ax = plt.subplots(figsize=(width, height))
x = [str(d.get(x_key, '')) for d in data]
y = [float(d.get(y_key, 0) or 0) for d in data]

if chart_type == 'bar':
    ax.bar(x, y)
elif chart_type == 'line':
    ax.plot(x, y, marker='o')
elif chart_type == 'pie':
    ax.pie(y, labels=x, autopct='%1.1f%%')
elif chart_type == 'scatter':
    ax.scatter(range(len(y)), y)
elif chart_type == 'hist':
    ax.hist(y, bins=10)

if title and chart_type != 'pie':
    ax.set_title(title)
    ax.set_xlabel(x_key)
    ax.set_ylabel(y_key)

plt.tight_layout()
plt.savefig(filename, dpi=150, bbox_inches='tight')
print('saved', filename)
`;
      try {
        const { stdout, stderr } = await execAsync(`python3 -c "${code.replace(/"/g, '\\"')}"`, {
          timeout: 30000,
          maxBuffer: 1024 * 1024,
          cwd: WORKSPACE_DIR,
          env: { ...process.env, HOME: '/tmp' },
        });
        const stat = await fs.stat(safePath(args.filename));
        return { success: true, filename: args.filename, sizeBytes: stat.size, stdout, stderr };
      } catch (err: any) {
        return { success: false, error: err.stderr || err.message };
      }
    },
  });

  // ───── convert_document ─────
  agent.registerTool({
    name: 'convert_document',
    description: 'Convert between document formats using pandoc (markdown, pdf, docx, html, etc.). Requires pandoc in the container.',
    schema: z.object({
      inputPath: z.string().describe('Input file path relative to workspace'),
      outputPath: z.string().describe('Output file path relative to workspace'),
      fromFormat: z.string().optional().describe('Input format (e.g., markdown, html)'),
      toFormat: z.string().optional().describe('Output format (e.g., pdf, docx)'),
      extraArgs: z.string().optional().describe('Extra pandoc arguments'),
    }),
    riskLevel: 2,
    execute: async (args: { inputPath: string; outputPath: string; fromFormat?: string; toFormat?: string; extraArgs?: string }) => {
      const input = safePath(args.inputPath);
      const output = safePath(args.outputPath);
      const fromFmt = args.fromFormat ? ` -f ${args.fromFormat}` : '';
      const toFmt = args.toFormat ? ` -t ${args.toFormat}` : '';
      const extras = args.extraArgs || '';
      try {
        const { stdout, stderr } = await execAsync(`pandoc "${input}" -o "${output}"${fromFmt}${toFmt} ${extras}`, {
          timeout: 60000,
          cwd: WORKSPACE_DIR,
          env: { ...process.env, HOME: '/tmp' },
        });
        const stat = await fs.stat(output);
        return { success: true, outputPath: args.outputPath, sizeBytes: stat.size, stdout, stderr };
      } catch (err: any) {
        return { success: false, error: err.stderr || err.message };
      }
    },
  });

  // ───── analyze_document ─────
  agent.registerTool({
    name: 'analyze_document',
    description: 'Extract text content from PDF, DOCX, or other documents. Uses pdftotext or pandoc under the hood.',
    schema: z.object({
      path: z.string().describe('Document path relative to workspace'),
      maxChars: z.number().optional().describe('Max characters to return (default: 20000)'),
    }),
    riskLevel: 2,
    execute: async (args: { path: string; maxChars?: number }) => {
      const target = safePath(args.path);
      const maxChars = args.maxChars || 20000;
      try {
        const ext = path.extname(target).toLowerCase();
        let text = '';
        if (ext === '.pdf') {
          const { stdout } = await execAsync(`pdftotext "${target}" -`, { timeout: 30000, maxBuffer: 10 * 1024 * 1024 });
          text = stdout;
        } else if (ext === '.docx' || ext === '.doc' || ext === '.odt' || ext === '.epub') {
          const { stdout } = await execAsync(`pandoc "${target}" -t plain`, { timeout: 30000, maxBuffer: 10 * 1024 * 1024 });
          text = stdout;
        } else if (ext === '.txt' || ext === '.md' || ext === '.csv' || ext === '.json') {
          text = await fs.readFile(target, 'utf-8');
        } else {
          return { success: false, error: `Unsupported format: ${ext}. Try convert_document first.` };
        }
        return { success: true, content: truncate(text, maxChars), length: text.length };
      } catch (err: any) {
        return { success: false, error: err.stderr || err.message };
      }
    },
  });

  // ───── send_email ─────
  agent.registerTool({
    name: 'send_email',
    description: 'Send an email via SMTP using the configured mail server (mailgun, sendgrid, or local SMTP).',
    schema: z.object({
      to: z.string().email().describe('Recipient email address'),
      subject: z.string().describe('Email subject'),
      body: z.string().describe('Plain text body'),
      from: z.string().optional().describe('Sender address (default: from env)'),
    }),
    riskLevel: 2,
    execute: async (args: { to: string; subject: string; body: string; from?: string }) => {
      const fromAddr = args.from || process.env.SMTP_FROM || 'noreply@nexoria.ai';
      const smtpHost = process.env.SMTP_HOST;
      const smtpPort = process.env.SMTP_PORT || '587';
      const smtpUser = process.env.SMTP_USER;
      const smtpPass = process.env.SMTP_PASS;

      if (!smtpHost) {
        return { success: false, error: 'SMTP not configured (SMTP_HOST missing)' };
      }

      try {
        const emailCode = `
import smtplib, ssl, email.mime.text, email.mime.multipart, sys
msg = email.mime.multipart.MIMEMultipart()
msg['From'] = '${fromAddr}'
msg['To'] = '${args.to}'
msg['Subject'] = '${args.subject.replace(/'/g, "\\'")}'
msg.attach(email.mime.text.MIMEText(sys.argv[1], 'plain'))
with smtplib.SMTP('${smtpHost}', ${smtpPort}) as s:
    s.starttls(context=ssl.create_default_context())
    s.login('${smtpUser}', '${smtpPass}')
    s.send_message(msg)
print('sent')
`;
        const { stdout, stderr } = await execAsync(`python3 -c "${emailCode.replace(/"/g, '\\"')}" "${args.body.replace(/"/g, '\\"')}"`, {
          timeout: 15000,
          cwd: WORKSPACE_DIR,
        });
        return { success: true, messageId: stdout.trim() };
      } catch (err: any) {
        return { success: false, error: err.stderr || err.message };
      }
    },
  });

  // ───── process_list ─────
  agent.registerTool({
    name: 'process_list',
    description: 'List running processes. Useful for debugging and monitoring.',
    schema: z.object({
      filter: z.string().optional().describe('Filter by process name'),
    }),
    riskLevel: 2,
    execute: async (args: { filter?: string }) => {
      try {
        const cmd = args.filter
          ? `ps aux | head -1 && ps aux | grep -i "${args.filter}" | grep -v grep`
          : 'ps aux --sort=-%mem | head -20';
        const { stdout } = await execAsync(cmd, { timeout: 5000 });
        return { success: true, processes: stdout.trim() };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    },
  });
}

export function registerWorkspaceTools(agent: ProAgentLoop, config: Config, api: WsProAgentApiClient): void {
  // ───── create_task ─────
  agent.registerTool({
    name: 'create_task',
    description: 'Create a tracked task in the workspace with title, description, and optional priority.',
    schema: z.object({
      title: z.string().describe('Task title'),
      description: z.string().optional().describe('Task details'),
      priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    }),
    riskLevel: 2,
    execute: async (args: { title: string; description?: string; priority?: string }) => {
      try {
        const task = await api.createTask(args.title, args.description || '', {
          priority: args.priority ?? 'medium',
          createdByTool: 'create_task',
        });
        return { success: true, task };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    },
  });

  // ───── list_tasks ─────
  agent.registerTool({
    name: 'list_tasks',
    description: 'List workspace tasks with optional status filter.',
    schema: z.object({
      status: z.enum(['pending', 'in_progress', 'done', 'cancelled']).optional().describe('Filter by status'),
    }),
    riskLevel: 1,
    execute: async (args: { status?: string }) => {
      try {
        const tasks = await api.listTasks(args.status);
        return { success: true, tasks };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    },
  });

  // ───── update_task ─────
  agent.registerTool({
    name: 'update_task',
    description: 'Update a task status, priority, title, or description.',
    schema: z.object({
      taskId: z.string().describe('UUID of the task'),
      status: z.enum(['pending', 'in_progress', 'done', 'cancelled']).optional(),
      priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
      title: z.string().optional(),
      description: z.string().optional(),
    }),
    riskLevel: 2,
    execute: async (args: { taskId: string; status?: string; priority?: string; title?: string; description?: string }) => {
      try {
        const patch: Record<string, any> = {};
        if (args.status) patch.status = args.status;
        if (args.priority) patch.priority = args.priority;
        if (args.title !== undefined) patch.title = args.title;
        if (args.description !== undefined) patch.description = args.description;
        const updated = await api.updateTask(args.taskId, patch);
        return { success: true, task: updated };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    },
  });

  // ───── create_approval ─────
  agent.registerTool({
    name: 'create_approval',
    description: 'Create an approval request for the user to review.',
    schema: z.object({
      title: z.string().describe('Short title'),
      description: z.string().describe('Detailed explanation'),
      type: z.enum(['general', 'task', 'social_post', 'budget', 'content']).optional(),
    }),
    riskLevel: 2,
    execute: async (args: { title: string; description: string; type?: string }) => {
      try {
        const approval = await api.createApproval(args.title, args.description, {
          type: args.type ?? 'general',
          createdByTool: 'create_approval',
        });
        return { success: true, approval };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    },
  });

  // ───── list_approvals ─────
  agent.registerTool({
    name: 'list_approvals',
    description: 'List pending or recent approvals.',
    schema: z.object({
      status: z.enum(['pending', 'approved', 'rejected', 'cancelled']).optional(),
    }),
    riskLevel: 1,
    execute: async (args: { status?: string }) => {
      try {
        const approvals = await api.listApprovals(args.status);
        return { success: true, approvals };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    },
  });
}

export function registerDelegationTool(agent: ProAgentLoop, config: Config, spawner: SubagentSpawner, api: WsProAgentApiClient): void {
  agent.registerTool({
    name: 'delegate_to_specialist',
    description: `Delegate a task to a specialist agent that runs locally. The specialist runs its own agent loop with specialized tools and returns the result. A task is automatically created to track the delegation. If a taskId is provided, that task will be updated to done/failed instead of creating a separate tracking task.`,
    schema: z.object({
      specialistId: z.string().describe('Specialist ID: social_media, email_outreach, researcher, content_creator, code_reviewer'),
      prompt: z.string().describe('The detailed task/prompt for the specialist'),
      taskId: z.string().optional().describe('Optional existing task ID to update upon completion'),
    }),
    riskLevel: 1,
    execute: async (args: { specialistId: string; prompt: string; taskId?: string }) => {
      const specialist = spawner.getSpecialist(args.specialistId);
      const specialistName = specialist?.name ?? args.specialistId;
      let trackingTaskId: string | null = args.taskId ?? null;

      if (!args.taskId) {
        try {
          const task = await api.createTask(
            `[${specialistName}] Delegated task`,
            args.prompt.slice(0, 500),
            {
              source: 'pro-agent-delegation',
              specialistId: args.specialistId,
              specialistName,
              createdByTool: 'delegate_to_specialist',
              delegationStatus: 'in_progress',
            },
          );
          trackingTaskId = task.id;
          console.log(`[subagent] Created task ${trackingTaskId} for ${args.specialistId}`);
        } catch (err: any) {
          console.error(`[subagent] Failed to create task: ${err.message}`);
        }
      } else {
        try {
          await api.updateTask(args.taskId, {
            status: 'in_progress',
            metadata: {
              source: 'pro-agent-delegation',
              specialistId: args.specialistId,
              specialistName,
              delegationStatus: 'started',
              delegatedAt: new Date().toISOString(),
            },
          });
          console.log(`[subagent] Existing task ${args.taskId} set to in_progress`);
        } catch (err: any) {
          console.error(`[subagent] Failed to update task ${args.taskId}: ${err.message}`);
        }
      }

      console.log(`[subagent] Spawning ${args.specialistId}...`);
      const parentProfile: any = {
        modelProvider: config.llmProvider,
        modelName: config.llmModel,
        modelConfig: { apiKey: config.llmApiKey },
      };
      const result = await spawner.spawn(args.specialistId, args.prompt, config.workspaceId, parentProfile);
      console.log(`[subagent] ${args.specialistId} completed: ${result.success ? 'success' : 'failed'}`);

      if (trackingTaskId) {
        try {
          await api.updateTask(trackingTaskId, {
            status: result.success ? 'done' : 'failed',
            description: result.output ? result.output.slice(0, 2000) : result.error || 'No output',
            metadata: {
              source: 'pro-agent-delegation',
              specialistId: args.specialistId,
              specialistName,
              delegationStatus: result.success ? 'completed' : 'failed',
              completedAt: new Date().toISOString(),
            },
          });
          console.log(`[subagent] Task ${trackingTaskId} updated to ${result.success ? 'done' : 'failed'}`);
        } catch (err: any) {
          console.error(`[subagent] Failed to update task ${trackingTaskId}: ${err.message}`);
        }
      }

      return result;
    },
  });
}

export function registerMemoryTools(agent: ProAgentLoop, config: Config): void {
  agent.registerTool({
    name: 'nudge_memory',
    description: 'Persist important knowledge so the agent remembers it across conversations. Use after learning something important about the user, completing a significant task, or when the user asks to remember something.',
    schema: z.object({
      content: z.string().describe('Knowledge to persist'),
      type: z.enum(['fact', 'preference', 'avoidance', 'pattern']).describe('Type of memory'),
      tier: z.enum(['daily', 'long_term']).optional().describe('Target tier'),
    }),
    riskLevel: 1,
    execute: async (args: { content: string; type: string; tier?: string }, ctx: any) => {
      try {
        const res = await fetch(`${config.nexoriaApiUrl}/workspaces/${config.workspaceId}/memory`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.agentToken}`,
          },
          body: JSON.stringify({
            userId: ctx.triggeredByUserId,
            sessionId: ctx.sessionId,
            content: args.content,
            tier: args.tier ?? 'long_term',
            type: args.type,
            confidence: 0.95,
            metadata: { source: 'nudge_memory', agentProfileId: 'pro-agent' },
          }),
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) return { success: false, error: `API ${res.status}` };
        const data = await res.json() as any;
        return { success: true, memoryId: data.id, content: args.content };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    },
  });

  agent.registerTool({
    name: 'search_memory',
    description: 'Search the agent\'s memory for facts, preferences, or past insights. Use this before answering questions about the user or workspace history.',
    schema: z.object({
      query: z.string().describe('Search query'),
      limit: z.number().optional().describe('Max results (default: 5)'),
    }),
    riskLevel: 1,
    execute: async (args: { query: string; limit?: number }) => {
      try {
        const res = await fetch(`${config.nexoriaApiUrl}/workspaces/${config.workspaceId}/memory/search`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.agentToken}`,
          },
          body: JSON.stringify({ query: args.query, limit: args.limit ?? 5 }),
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) return { success: false, error: `API ${res.status}` };
        const data = await res.json() as any;
        return { success: true, memories: data };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    },
  });
}
