import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { json } from './lib/proxy-utils.js';
import { handleKeyApi } from './lib/key-store.js';
import { handleRoutingApi } from './lib/routing-store.js';
import { handleSettingsStore } from './lib/settings-store.js';
import { handleStateApi, setupStateWebSocket } from './lib/state-ws.js';
import { handleProxy } from './lib/proxy-forward.js';
import { handleProjectsApi } from './lib/project-store.js';
import { handleAgentApi } from './lib/agent-handler.js';
import { handleHealth, handleConnections } from './lib/health.js';
import { buildProviders } from './lib/key-store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(repoRoot, 'backends', '.env') });

/* ── Request router ───────────────────────────────────────────────────────── */
function handleRequest(req, res) {
  const url = req.url || '';

  if (url.startsWith('/api/agents/')) {
    handleAgentApi(req, res).catch((err) => {
      console.error('[cinegen/agents] unhandled error:', err);
      if (!res.headersSent) json(res, 500, { error: 'Internal agent error', detail: err.message });
    });
    return;
  }

  if (url.startsWith('/api/settings/keys')) {
    handleKeyApi(req, res);
    return;
  }

  if (url.startsWith('/api/settings/routing')) {
    handleRoutingApi(req, res);
    return;
  }

  if (url.startsWith('/api/settings/store/')) {
    handleSettingsStore(req, res);
    return;
  }

  if (url.startsWith('/api/state/')) {
    handleStateApi(req, res);
    return;
  }

  if (url === '/api/health') {
    handleHealth(req, res);
    return;
  }

  if (url === '/api/connections') {
    handleConnections(req, res);
    return;
  }

  if (url.startsWith('/api/projects')) {
    handleProjectsApi(req, res);
    return;
  }

  if (url.startsWith('/proxy')) {
    handleProxy(req, res);
    return;
  }

  // Not our concern — pass through
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
}

/* ── Exports ──────────────────────────────────────────────────────────────── */
export function isProxyOrApiRequest(url) {
  return !!url && (
    url.startsWith('/proxy') ||
    url.startsWith('/api/agents/') ||
    url.startsWith('/api/settings/keys') ||
    url.startsWith('/api/settings/routing') ||
    url.startsWith('/api/settings/store/') ||
    url.startsWith('/api/state/') ||
    url.startsWith('/api/projects') ||
    url === '/api/health' ||
    url === '/api/connections' ||
    url === '/ws-state'
  );
}

export function createRequestHandler() {
  return handleRequest;
}

export function logProviderStatus() {
  const { envProviders } = buildProviders();
  const configured = Object.entries(envProviders).filter(([, v]) => v.key).map(([k]) => k);
  console.log('[cinegen] Configured AI providers:', configured.length ? configured.join(', ') : '(none — check .env or settings modal)');
}

export { setupStateWebSocket };
