import * as http from 'node:http';
import { Config } from './config';
import { HermesClient } from './hermes-client';
import { NexoriaRunnerClient } from './nexoria-client';
import { loadOrCreateKeys } from './keys/keys';

const config = new Config();
const missing = config.validate();
if (missing.length) {
  console.error('Missing config fields:', missing.join(', '));
  process.exit(1);
}

const instanceKey = `hermes-${config.workspaceId}`;
const nexoria = new NexoriaRunnerClient(config);
const hermes = new HermesClient(config);

loadOrCreateKeys(config.localDir);

const healthServer = http.createServer((req, res) => {
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', instanceKey, provider: 'hermes' }));
    return;
  }
  res.writeHead(404);
  res.end('Not Found');
});
healthServer.listen(3003, () => console.log('Hermes runner health server listening on port 3003'));

async function main() {
  await retry('register Hermes runner', () => nexoria.registerInstance(instanceKey));
  await nexoria.connect(instanceKey);
  console.log('Hermes runner connected:', instanceKey);

  setInterval(() => {
    nexoria.heartbeat(instanceKey).catch((err) => console.error('Heartbeat failed:', err.message));
  }, 15000);

  nexoria.onJobPushed((job) => runJob(job).catch((err) => failJob(job, err)));

  while (true) {
    try {
      const job = await nexoria.claimNextJob();
      if (job) await runJob(job);
      else await sleep(2500);
    } catch (err: any) {
      console.error('Claim loop error:', err.message);
      await sleep(5000);
    }
  }
}

async function runJob(job: any): Promise<void> {
  const input = job.input ?? {};
  console.log('Running Hermes job:', job.id, job.type);
  nexoria.emitJobEvent(job.id, {
    type: 'hermes_run_started',
    level: 'info',
    message: 'Hermes run started.',
    metadata: { hermesApiUrl: config.hermesApiUrl },
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.hermesRunTimeoutMs);
  let final = '';
  try {
    final = await hermes.runChat(job, (event) => {
      if (event.type === 'delta' && job.type === 'native_pro_chat' && input.chatSessionId) {
        nexoria.emitChatChunk(input.chatSessionId, job.id, event.content);
      }
      if (event.type === 'status') {
        nexoria.emitJobEvent(job.id, {
          type: 'hermes_status',
          level: 'info',
          message: event.message,
          metadata: event.metadata,
        });
      }
    }, controller.signal);
  } catch (err: any) {
    if (controller.signal.aborted) {
      throw new Error(`Hermes run timed out after ${Math.round(config.hermesRunTimeoutMs / 1000)}s`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (job.type === 'native_pro_chat' && input.chatSessionId) {
    nexoria.emitChatFinal(input.chatSessionId, job.id, final);
  }
  nexoria.emitJobComplete(job.id, { status: 'completed', result: { output: final } });
  console.log('Completed Hermes job:', job.id);
}

function failJob(job: any, err: any): void {
  const message = err?.message ?? String(err);
  console.error('Hermes job failed:', job?.id, message);
  if (job?.id) {
    nexoria.emitJobComplete(job.id, { status: 'failed', error: message });
  }
}

async function retry(label: string, fn: () => Promise<void>): Promise<void> {
  for (let attempt = 1; attempt <= 12; attempt++) {
    try {
      await fn();
      return;
    } catch (err: any) {
      const wait = Math.min(1000 * 2 ** attempt, 15000);
      console.error(`${label} failed (${attempt}/12): ${err.message}. Retrying in ${wait}ms...`);
      await sleep(wait);
    }
  }
  throw new Error(`${label} failed after retries`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
