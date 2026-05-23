import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';
import { WebSocketServer } from 'ws';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(repoRoot, 'backends', '.env') });

const KEYS_PATH = path.join(__dirname, 'keys.json');
const ROUTING_PATH = path.join(__dirname, 'routing.json');
const SETTINGS_PATH = path.join(__dirname, 'settings.json');
const APP_STATE_PATH = path.join(__dirname, 'app-state.json');

/* ── Runtime key store ───────────────────────────────────────────────────── */
function loadStoredKeys() {
  try {
    if (fs.existsSync(KEYS_PATH)) {
      const raw = JSON.parse(fs.readFileSync(KEYS_PATH, 'utf-8'));
      if (!Array.isArray(raw.vendors)) raw.vendors = [];
      return raw;
    }
  } catch { /* ignore corrupt file */ }
  return { vendors: [] };
}

function saveStoredKeys(data) {
  fs.writeFileSync(KEYS_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

/* ── Runtime routing store (model preferences per modality) ──────────────── */
function loadStoredRouting() {
  try {
    if (fs.existsSync(ROUTING_PATH)) {
      return JSON.parse(fs.readFileSync(ROUTING_PATH, 'utf-8'));
    }
  } catch { /* ignore corrupt file */ }
  return { modalities: { llm: {}, image: {}, video: {}, audio: {} } };
}

function saveStoredRouting(data) {
  fs.writeFileSync(ROUTING_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

/* Build a merged provider: runtime keys override process.env */
function buildProviders() {
  const stored = loadStoredKeys();
  const storedBySlot = {};
  for (const v of stored.vendors || []) {
    if (v.apiKey) storedBySlot[v.slotId || v.id] = v;
  }

  const envProviders = {
    openai:     { key: process.env.OPENAI_API_KEY,      baseUrl: process.env.OPENAI_BASE_URL      || 'https://api.openai.com',                      authHeader: 'Bearer',    slotId: 'openai' },
    anthropic:  { key: process.env.ANTHROPIC_API_KEY,   baseUrl: 'https://api.anthropic.com',                                                       authHeader: 'x-api-key', slotId: 'anthropic' },
    google:     { key: process.env.GOOGLE_API_KEY,      baseUrl: 'https://generativelanguage.googleapis.com',                                        authHeader: 'Bearer',    slotId: 'google' },
    elevenlabs: { key: process.env.ELEVENLABS_API_KEY,  baseUrl: 'https://api.elevenlabs.io',                                                        authHeader: 'xi-api-key', slotId: 'elevenlabs' },
    fal:        { key: process.env.FAL_KEY,             baseUrl: 'https://fal.run',                                                                  authHeader: 'Key',        slotId: 'fal' },
    replicate:  { key: process.env.REPLICATE_API_TOKEN, baseUrl: 'https://api.replicate.com',                                                        authHeader: 'Bearer',    slotId: 'replicate' },
    runway:     { key: process.env.RUNWAY_API_KEY,      baseUrl: process.env.RUNWAY_BASE_URL      || 'https://api.dev.runwayml.com',                 authHeader: 'Bearer',    slotId: 'runway' },
    luma:       { key: process.env.LUMA_API_KEY,        baseUrl: 'https://api.lumalabs.ai',                                                          authHeader: 'Bearer',    slotId: 'luma' },
    xai:        { key: process.env.XAI_API_KEY,         baseUrl: 'https://api.x.ai',                                                                 authHeader: 'Bearer',    slotId: 'xai' },
    together:   { key: process.env.TOGETHER_API_KEY,    baseUrl: process.env.TOGETHER_BASE_URL    || 'https://api.together.xyz',                     authHeader: 'Bearer',    slotId: 'together' },
    groq:       { key: process.env.GROQ_API_KEY,        baseUrl: process.env.GROQ_BASE_URL        || 'https://api.groq.com/openai/v1',                 authHeader: 'Bearer',    slotId: 'groq' },
    mistral:    { key: process.env.MISTRAL_API_KEY,     baseUrl: process.env.MISTRAL_BASE_URL     || 'https://api.mistral.ai/v1',                      authHeader: 'Bearer',    slotId: 'mistral' },
    deepseek:   { key: process.env.DEEPSEEK_API_KEY,    baseUrl: process.env.DEEPSEEK_BASE_URL    || 'https://api.deepseek.com/v1',                    authHeader: 'Bearer',    slotId: 'deepseek' },
    custom:     { key: process.env.CUSTOM_API_KEY,       baseUrl: process.env.CUSTOM_BASE_URL      || '',                                             authHeader: 'Bearer',    slotId: 'custom' },
  };

  for (const [, prov] of Object.entries(envProviders)) {
    const runtime = storedBySlot[prov.slotId];
    if (runtime?.apiKey) prov.key = runtime.apiKey;
    if (runtime?.baseUrl) prov.baseUrl = runtime.baseUrl;
  }

  return { envProviders, storedBySlot };
}

const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || 'null,http://localhost,http://127.0.0.1,file://').split(',').map((s) => s.trim());

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin':  allowed,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Cinegen-Target, X-Cinegen-Path, X-Cinegen-Base-Url',
  };
}

/* ── JSON response helper ─────────────────────────────────────────────────── */
function json(res, status, data) {
  const origin = '*';
  res.writeHead(status, { ...corsHeaders(origin), 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

/* ── Key management handler (POST/GET/DELETE /api/settings/keys) ──────────── */
function handleKeyApi(req, res) {
  const method = req.method;

  if (method === 'GET') {
    const stored = loadStoredKeys();
    const masked = {
      ...stored,
      vendors: (stored.vendors || []).map((v) => ({
        ...v,
        apiKey: v.apiKey ? '••••••••' : '',
      })),
    };
    json(res, 200, masked);
    return;
  }

  if (method === 'POST') {
    const bodyChunks = [];
    req.on('data', (c) => bodyChunks.push(c));
    req.on('end', () => {
      try {
        const body = JSON.parse(Buffer.concat(bodyChunks).toString());
        const stored = loadStoredKeys();
        const incoming = Array.isArray(body.vendors) ? body.vendors : [];

        // Merge incoming vendors into stored (replace by id, preserve existing keys if not overwritten)
        for (const inv of incoming) {
          const existing = (stored.vendors || []).findIndex((v) => v.id === inv.id);
          const merged = { ...inv };
          // If incoming sends empty or masked key, keep the stored real key
          const isMasked = /^•+$/.test(merged.apiKey || '') || merged.apiKey === '••••••••';
          if ((!merged.apiKey || isMasked) && existing >= 0) {
            merged.apiKey = stored.vendors[existing].apiKey;
          }
          if (existing >= 0) {
            stored.vendors[existing] = merged;
          } else {
            stored.vendors.push(merged);
          }
        }
        if (body.selectedVendorId !== undefined) stored.selectedVendorId = body.selectedVendorId;

        saveStoredKeys(stored);

        // Return masked
        const masked = {
          ...stored,
          vendors: (stored.vendors || []).map((v) => ({
            ...v,
            apiKey: v.apiKey ? '••••••••' : '',
          })),
        };
        json(res, 200, masked);
      } catch (e) {
        json(res, 400, { error: 'Invalid JSON body', detail: e.message });
      }
    });
    return;
  }

  if (method === 'DELETE') {
    const urlPath = req.url || '';
    const parts = urlPath.split('/');
    const vendorId = parts[parts.length - 1];
    if (!vendorId || vendorId === 'keys') {
      saveStoredKeys({ vendors: [], selectedVendorId: '' });
      json(res, 200, { ok: true, cleared: 'all' });
      return;
    }
    const stored = loadStoredKeys();
    stored.vendors = (stored.vendors || []).filter((v) => v.id !== vendorId);
    saveStoredKeys(stored);
    json(res, 200, { ok: true });
    return;
  }

  json(res, 405, { error: 'Method not allowed' });
}

/* ── Routing API handler (GET/POST /api/settings/routing) ─────────────────── */
function handleRoutingApi(req, res) {
  if (req.method === 'GET') {
    json(res, 200, loadStoredRouting());
    return;
  }

  if (req.method === 'POST') {
    const bodyChunks = [];
    req.on('data', (c) => bodyChunks.push(c));
    req.on('end', () => {
      try {
        const body = JSON.parse(Buffer.concat(bodyChunks).toString());
        const stored = loadStoredRouting();
        const merged = { ...stored, ...body };
        saveStoredRouting(merged);
        json(res, 200, merged);
      } catch (e) {
        json(res, 400, { error: 'Invalid JSON body', detail: e.message });
      }
    });
    return;
  }

  if (req.method === 'DELETE') {
    const reset = { modalities: { llm: {}, image: {}, video: {}, audio: {} } };
    saveStoredRouting(reset);
    json(res, 200, reset);
    return;
  }

  json(res, 405, { error: 'Method not allowed' });
}

/* ── Proxy handler ────────────────────────────────────────────────────────── */
function handleProxy(req, res) {
  const origin = req.headers['origin'] || 'null';

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders(origin));
    res.end();
    return;
  }

  const targetName = (req.headers['x-cinegen-target'] || '').toLowerCase().trim();
  const { envProviders, storedBySlot } = buildProviders();
  const provider = envProviders[targetName];

  if (!provider) {
    res.writeHead(400, { ...corsHeaders(origin), 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `Unknown provider: "${targetName}". Set X-Cinegen-Target header.` }));
    return;
  }

  const forwardHeaders = { ...req.headers };
  ['host', 'x-cinegen-target', 'x-cinegen-path', 'x-cinegen-base-url', 'origin', 'referer'].forEach((h) => delete forwardHeaders[h]);
  const clientAuth = forwardHeaders['authorization'];

  if (!clientAuth && !provider.key) {
    res.writeHead(503, { ...corsHeaders(origin), 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `No API key configured for provider "${targetName}". Add the key in Settings → AI Models.` }));
    return;
  }

  const reqPath = (req.url ?? '/').replace(/^\/proxy/, '') || '/';
  const overrideBaseUrl = req.headers['x-cinegen-base-url'];
  const effectiveBaseUrl = typeof overrideBaseUrl === 'string' && overrideBaseUrl ? overrideBaseUrl : (provider.baseUrl || '');
  if (!effectiveBaseUrl) {
    res.writeHead(503, { ...corsHeaders(origin), 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `No base URL for provider "${targetName}". Set a base URL in Settings.` }));
    return;
  }
  const targetUrl = new URL(reqPath, effectiveBaseUrl);

  if (clientAuth) {
    delete forwardHeaders['x-api-key'];
    delete forwardHeaders['xi-api-key'];
  } else if (provider.key) {
    const cleanKey = provider.key.trim();
    const authKey = provider.authHeader.toLowerCase();
    if (authKey === 'x-api-key' || authKey === 'xi-api-key') {
      forwardHeaders[provider.authHeader] = cleanKey;
      delete forwardHeaders['authorization'];
    } else if (authKey === 'key') {
      forwardHeaders['Authorization'] = `Key ${cleanKey}`;
    } else {
      forwardHeaders['Authorization'] = `Bearer ${cleanKey}`;
    }
  }

  const bodyChunks = [];
  req.on('data', (chunk) => bodyChunks.push(chunk));
  req.on('end', () => {
    const bodyBuffer = Buffer.concat(bodyChunks);
    const lib = targetUrl.protocol === 'https:' ? https : http;
    const options = {
      hostname: targetUrl.hostname,
      port: targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80),
      path: targetUrl.pathname + targetUrl.search,
      method: req.method,
      headers: { ...forwardHeaders, host: targetUrl.hostname },
    };

    const proxyReq = lib.request(options, (proxyRes) => {
      const responseHeaders = { ...corsHeaders(origin), ...proxyRes.headers };
      delete responseHeaders['transfer-encoding'];
      res.writeHead(proxyRes.statusCode ?? 200, responseHeaders);
      proxyRes.pipe(res, { end: true });
    });

    proxyReq.on('error', (err) => {
      console.error('[cinegen] proxy upstream error:', err.message);
      if (!res.headersSent) {
        res.writeHead(502, { ...corsHeaders(origin), 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Upstream request failed', detail: err.message }));
      }
    });

    if (bodyBuffer.length) proxyReq.write(bodyBuffer);
    proxyReq.end();
  });
}

/* ── Generic settings store handler (GET/PUT/DELETE /api/settings/store/:key) ─ */
function loadSettingsStore() {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'));
    }
  } catch { /* ignore corrupt file */ }
  return {};
}

function saveSettingsStore(data) {
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

function handleSettingsStore(req, res) {
  const urlPath = req.url || '';
  const parts = urlPath.replace('/api/settings/store/', '').split('/');
  const key = parts[0];
  if (!key) {
    json(res, 400, { error: 'Key required (GET/PUT/DELETE /api/settings/store/:key)' });
    return;
  }

  if (req.method === 'GET') {
    const store = loadSettingsStore();
    const value = store[key] ?? null;
    json(res, 200, { key, value });
    return;
  }

  if (req.method === 'PUT') {
    const bodyChunks = [];
    req.on('data', (c) => bodyChunks.push(c));
    req.on('end', () => {
      try {
        const body = JSON.parse(Buffer.concat(bodyChunks).toString());
        const store = loadSettingsStore();
        store[key] = body.value;
        saveSettingsStore(store);
        json(res, 200, { key, stored: true });
      } catch (e) {
        json(res, 400, { error: 'Invalid JSON body', detail: e.message });
      }
    });
    return;
  }

  if (req.method === 'DELETE') {
    const store = loadSettingsStore();
    delete store[key];
    saveSettingsStore(store);
    json(res, 200, { key, removed: true });
    return;
  }

  json(res, 405, { error: 'Method not allowed' });
}

/* ── App state persistence ───────────────────────────────────────────────── */
function loadAppState() {
  try {
    if (fs.existsSync(APP_STATE_PATH)) {
      return JSON.parse(fs.readFileSync(APP_STATE_PATH, 'utf-8'));
    }
  } catch { /* ignore corrupt file */ }
  return {};
}

function saveAppState(data) {
  fs.writeFileSync(APP_STATE_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

function handleStateApi(req, res) {
  const url = req.url || '';
  const parts = url.replace('/api/state/', '').split('/');
  const domain = parts[0]; // app-shell | modal | layout

  if (!domain || !['app-shell', 'modal', 'layout'].includes(domain)) {
    json(res, 400, { error: 'Invalid state domain. Use app-shell, modal, or layout.' });
    return;
  }

  if (req.method === 'GET') {
    const state = loadAppState();
    json(res, 200, state[domain] ?? {});
    return;
  }

  if (req.method === 'PUT') {
    const bodyChunks = [];
    req.on('data', (c) => bodyChunks.push(c));
    req.on('end', () => {
      try {
        const body = JSON.parse(Buffer.concat(bodyChunks).toString());
        const state = loadAppState();
        state[domain] = { ...(state[domain] || {}), ...body };
        saveAppState(state);
        broadcastStateChange(domain, body);
        json(res, 200, { domain, stored: true });
      } catch (e) {
        json(res, 400, { error: 'Invalid JSON body', detail: e.message });
      }
    });
    return;
  }

  json(res, 405, { error: 'Method not allowed' });
}

/* ── Health check ────────────────────────────────────────────────────────── */
function handleHealth(req, res) {
  json(res, 200, {
    persistence: true,
    mode: 'server',
    timestamp: Date.now(),
  });
}

/* ── Connection count ──────────────────────────────────────────────────────── */
function handleConnections(req, res) {
  json(res, 200, { count: stateClients.size });
}

/* ── WebSocket state sync ────────────────────────────────────────────────── */
const stateClients = new Set();
let stateWss = null;

function broadcastStateChange(domain, payload) {
  if (!stateWss) return;
  const message = JSON.stringify({ type: 'state-update', domain, payload });
  for (const client of stateClients) {
    if (client.readyState === 1) {
      try { client.send(message); } catch { /* ignore */ }
    }
  }
}

export function setupStateWebSocket(server) {
  if (stateWss) return;
  stateWss = new WebSocketServer({ noServer: true });

  server.httpServer?.on('upgrade', (req, socket, head) => {
    if (req.url === '/ws-state') {
      stateWss.handleUpgrade(req, socket, head, (ws) => {
        stateWss.emit('connection', ws, req);
      });
    }
  });

  stateWss.on('connection', (ws) => {
    stateClients.add(ws);
    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(String(data));
        if (msg.type === 'state-change' && msg.domain && msg.payload) {
          // Persist and broadcast to other clients
          const state = loadAppState();
          state[msg.domain] = { ...(state[msg.domain] || {}), ...msg.payload };
          saveAppState(state);
          const broadcast = JSON.stringify({ type: 'state-update', domain: msg.domain, payload: msg.payload });
          for (const client of stateClients) {
            if (client !== ws && client.readyState === 1) {
              try { client.send(broadcast); } catch { /* ignore */ }
            }
          }
        }
      } catch { /* ignore malformed */ }
    });
    ws.on('close', () => {
      stateClients.delete(ws);
    });
  });
}

/* ── Request router ───────────────────────────────────────────────────────── */
function handleRequest(req, res) {
  const url = req.url || '';

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
    url.startsWith('/api/settings/keys') ||
    url.startsWith('/api/settings/routing') ||
    url.startsWith('/api/settings/store/') ||
    url.startsWith('/api/state/') ||
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
