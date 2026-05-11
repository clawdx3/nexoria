import { createServer } from 'http';
import { WebSocket } from 'ws';
import { AgentLoop, AgentToolRegistry } from '@nexoria/agent-core';
import { Config } from './config';

(async () => {
  const config = new Config();
  console.log('Nexoria Pro Agent starting...');

  // TODO: load agent profile from API, build tool registry, enter loop
  // connect to API WebSocket, claim commands, execute via agent-core loop
  // stream results back through WebSocket

  const loop = new AgentLoop();
  console.log('Pro Agent initialized. Waiting for commands...');

  // Keep process alive
  setInterval(() => {}, 1000 * 60 * 60);
})();
