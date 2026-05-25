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

/** Map backends/.env slot ids to client provider rows (GET /api/settings/keys merge). */
const ENV_SLOT_VENDOR_META = {
  openai:     { name: 'OpenAI', providerId: 'openai-compatible' },
  anthropic:  { name: 'Anthropic (Claude)', providerId: 'anthropic-messages-api' },
  google:     { name: 'Google AI (Gemini / Veo)', providerId: 'google-gemini-api' },
  elevenlabs: { name: 'ElevenLabs (Audio)', providerId: 'elevenlabs-api' },
  fal:        { name: 'fal.ai (Flux / Kling)', providerId: 'fal-ai' },
  replicate:  { name: 'Replicate', providerId: 'replicate-api' },
  runway:     { name: 'Runway ML', providerId: 'runway-api' },
  luma:       { name: 'Luma AI (Dream Machine)', providerId: 'luma-api' },
  xai:        { name: 'xAI (Grok)', providerId: 'openai-compatible' },
  together:   { name: 'Together AI', providerId: 'openai-compatible' },
  groq:       { name: 'Groq', providerId: 'openai-compatible' },
  mistral:    { name: 'Mistral AI', providerId: 'openai-compatible' },
  deepseek:   { name: 'DeepSeek', providerId: 'openai-compatible' },
  custom:     { name: 'Custom', providerId: 'generic-rest' },
};

function augmentVendorsWithEnvKeys(stored) {
  const { envProviders } = buildProviders();
  const vendors = [...(stored.vendors || [])];

  for (const [slotId, envProv] of Object.entries(envProviders)) {
    if (!envProv.key) continue;
    const meta = ENV_SLOT_VENDOR_META[slotId];
    if (!meta) continue;

    let vendor = vendors.find((v) => v.slotId === slotId);
    if (!vendor) {
      vendor = {
        id: `env-${slotId}`,
        name: meta.name,
        providerId: meta.providerId,
        slotId,
        baseUrl: envProv.baseUrl || '',
        apiKey: envProv.key,
        hasServerKey: true,
      };
      vendors.push(vendor);
      continue;
    }

    vendor.hasServerKey = true;
    if (!vendor.slotId) vendor.slotId = slotId;
    if (!vendor.providerId) vendor.providerId = meta.providerId;
    if (!vendor.name) vendor.name = meta.name;
    if (!vendor.baseUrl && envProv.baseUrl) vendor.baseUrl = envProv.baseUrl;
    if (!vendor.apiKey) vendor.apiKey = envProv.key;
  }

  return { ...stored, vendors };
}

function maskVendorsForClient(stored) {
  return {
    ...stored,
    vendors: (stored.vendors || []).map((v) => ({
      ...v,
      hasServerKey: Boolean(v.hasServerKey || v.apiKey),
      apiKey: v.apiKey ? '••••••••' : '',
    })),
  };
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
    const stored = augmentVendorsWithEnvKeys(loadStoredKeys());
    json(res, 200, maskVendorsForClient(stored));
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

        const merged = augmentVendorsWithEnvKeys(stored);
        json(res, 200, maskVendorsForClient(merged));
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

/* ── Agent API handler (/api/agents/*) ───────────────────────────────────── */

/**
 * Lazy-loaded agent router. Imported on first agent request so the app boots
 * normally even when no LLM key is configured. Each endpoint returns a clear
 * error JSON when the Mastra instance is not available.
 */
let _agentModule = null;
async function getAgentModule() {
  if (!_agentModule) {
    _agentModule = await import('../../backends/agents/mastra.js');
  }
  return _agentModule;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString();
        resolve(text ? JSON.parse(text) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

async function handleAgentApi(req, res) {
  const origin = req.headers['origin'] || 'null';
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders(origin));
    res.end();
    return;
  }

  const url = req.url || '';
  // Route: POST /api/agents/script/analyze
  if (url === '/api/agents/script/analyze' && req.method === 'POST') {
    let body;
    try {
      body = await readBody(req);
    } catch {
      json(res, 400, { error: 'Invalid JSON body' });
      return;
    }
    const { projectId, fountainText } = body;
    if (!projectId || !fountainText) {
      json(res, 400, { error: 'projectId and fountainText are required' });
      return;
    }
    try {
      const { getMastra } = await getAgentModule();
      const mastra = await getMastra();
      const agent = mastra.getAgentById('scriptAgent');
      const prompt =
        `Analyze the following Fountain screenplay for project "${projectId}".\n\n` +
        `Return a complete ScriptAnalysisOutput JSON object.\n\n` +
        `PROJECT ID: ${projectId}\n\n` +
        `FOUNTAIN SCRIPT:\n${fountainText}`;
      const result = await agent.generate(prompt, {
        output: 'object',
      });
      json(res, 200, { ok: true, projectId, data: result.object ?? result.text });
    } catch (err) {
      console.error('[cinegen/agents] script/analyze error:', err.message);
      json(res, 503, { error: err.message });
    }
    return;
  }

  // Route: POST /api/agents/casting/build-bibles
  if (url === '/api/agents/casting/build-bibles' && req.method === 'POST') {
    let body;
    try { body = await readBody(req); } catch { json(res, 400, { error: 'Invalid JSON body' }); return; }
    const { projectId, characters } = body;
    if (!projectId) { json(res, 400, { error: 'projectId is required' }); return; }
    try {
      const { getMastra } = await getAgentModule();
      const mastra = await getMastra();
      const agent = mastra.getAgentById('characterCastingAgent');
      const charList = Array.isArray(characters)
        ? characters.map((c) => `- ${c.name} (${c.role}): ${c.description}`).join('\n')
        : '(read from ProductionContext)';
      const result = await agent.generate(
        `Build character bibles for project "${projectId}".\nCharacters:\n${charList}`,
      );
      json(res, 200, { ok: true, projectId, data: result.text });
    } catch (err) {
      console.error('[cinegen/agents] casting/build-bibles error:', err.message);
      json(res, 503, { error: err.message });
    }
    return;
  }

  // Route: POST /api/agents/production-design/build-bibles
  if (url === '/api/agents/production-design/build-bibles' && req.method === 'POST') {
    let body;
    try { body = await readBody(req); } catch { json(res, 400, { error: 'Invalid JSON body' }); return; }
    const { projectId, locations } = body;
    if (!projectId) { json(res, 400, { error: 'projectId is required' }); return; }
    try {
      const { getMastra } = await getAgentModule();
      const mastra = await getMastra();
      const agent = mastra.getAgentById('locationSetAgent');
      const locList = Array.isArray(locations)
        ? locations.map((l) => `- ${l.name} (${l.intExt}): ${l.description}`).join('\n')
        : '(read from ProductionContext)';
      const result = await agent.generate(
        `Build location bibles for project "${projectId}".\nLocations:\n${locList}`,
      );
      json(res, 200, { ok: true, projectId, data: result.text });
    } catch (err) {
      console.error('[cinegen/agents] production-design/build-bibles error:', err.message);
      json(res, 503, { error: err.message });
    }
    return;
  }

  // Route: POST /api/agents/storyboard/generate
  if (url === '/api/agents/storyboard/generate' && req.method === 'POST') {
    let body;
    try { body = await readBody(req); } catch { json(res, 400, { error: 'Invalid JSON body' }); return; }
    const { projectId, shotIds } = body;
    if (!projectId) { json(res, 400, { error: 'projectId is required' }); return; }
    try {
      const { getMastra } = await getAgentModule();
      const mastra = await getMastra();
      const agent = mastra.getAgentById('storyboardAgent');
      const scope = Array.isArray(shotIds) && shotIds.length
        ? `for shot IDs: ${shotIds.join(', ')}`
        : 'for all pending shots';
      const result = await agent.generate(
        `Generate storyboard frames for project "${projectId}" ${scope}.`,
      );
      json(res, 200, { ok: true, projectId, data: result.text });
    } catch (err) {
      console.error('[cinegen/agents] storyboard/generate error:', err.message);
      json(res, 503, { error: err.message });
    }
    return;
  }

  // Route: POST /api/agents/beat-board/generate-outline
  if (url === '/api/agents/beat-board/generate-outline' && req.method === 'POST') {
    let body;
    try { body = await readBody(req); } catch { json(res, 400, { error: 'Invalid JSON body' }); return; }
    const { projectId, beats, characters, locations } = body;
    if (!projectId) { json(res, 400, { error: 'projectId is required' }); return; }
    if (!beats || !Array.isArray(beats) || beats.length === 0) {
      json(res, 400, { error: 'beats array is required and must not be empty' }); return;
    }
    try {
      const { getMastra } = await getAgentModule();
      const mastra = await getMastra();
      const agent = mastra.getAgentById('beatOutlineAgent');
      const beatText = beats.map((b, i) =>
        `Beat ${i + 1}: ${b.title || 'Untitled'}\n${b.description || ''}${b.cameraNotes ? `\n[Camera: ${b.cameraNotes}]` : ''}`
      ).join('\n\n');
      const charText = (characters || []).map(c => `- ${c.name}${c.description ? `: ${c.description}` : ''}`).join('\n');
      const locText = (locations || []).map(l => `- ${l.name} (${l.intExt || 'INT/EXT'})`).join('\n');
      const prompt = [
        `Generate a Fountain-format script outline for project "${projectId}" based on these beats:`,
        '',
        beatText,
        '',
        charText ? `Characters:\n${charText}` : '',
        locText ? `Locations:\n${locText}` : '',
        '',
        'Output JSON with outline (Fountain text), sceneCount, detectedCharacters, and detectedLocations.',
      ].filter(Boolean).join('\n');
      const result = await agent.generate(prompt);
      json(res, 200, { ok: true, projectId, data: result.object || result.text });
    } catch (err) {
      console.error('[cinegen/agents] beat-board/generate-outline error:', err.message);
      json(res, 503, { error: err.message });
    }
    return;
  }

  // Route: POST /api/agents/cinematography/build-prompt
  if (url === '/api/agents/cinematography/build-prompt' && req.method === 'POST') {
    let body;
    try { body = await readBody(req); } catch { json(res, 400, { error: 'Invalid JSON body' }); return; }
    const { projectId, shotId, preferredProvider } = body;
    if (!projectId || !shotId) { json(res, 400, { error: 'projectId and shotId are required' }); return; }
    try {
      const { getMastra } = await getAgentModule();
      const mastra = await getMastra();
      const agent = mastra.getAgentById('promptEngineerAgent');
      const result = await agent.generate(
        `Build an optimized generation prompt for shot "${shotId}" in project "${projectId}".` +
        (preferredProvider ? ` Preferred provider: ${preferredProvider}.` : ''),
      );
      json(res, 200, { ok: true, projectId, shotId, data: result.text });
    } catch (err) {
      console.error('[cinegen/agents] cinematography/build-prompt error:', err.message);
      json(res, 503, { error: err.message });
    }
    return;
  }

  // Route: POST /api/agents/cinematography/route-shot
  if (url === '/api/agents/cinematography/route-shot' && req.method === 'POST') {
    let body;
    try { body = await readBody(req); } catch { json(res, 400, { error: 'Invalid JSON body' }); return; }
    const { projectId, shotId, shotType } = body;
    if (!projectId) { json(res, 400, { error: 'projectId is required' }); return; }
    try {
      const { getMastra } = await getAgentModule();
      const mastra = await getMastra();
      const agent = mastra.getAgentById('generationAgent');
      const result = await agent.generate(
        `Process generation job for shot "${shotId || 'next queued'}" (type: ${shotType || 'reliable-default'}) ` +
        `in project "${projectId}". Determine provider, log cost estimate.`,
      );
      json(res, 200, { ok: true, projectId, data: result.text });
    } catch (err) {
      console.error('[cinegen/agents] cinematography/route-shot error:', err.message);
      json(res, 503, { error: err.message });
    }
    return;
  }

  // Route: POST /api/agents/cinematography/audit-clip
  if (url === '/api/agents/cinematography/audit-clip' && req.method === 'POST') {
    let body;
    try { body = await readBody(req); } catch { json(res, 400, { error: 'Invalid JSON body' }); return; }
    const { projectId, shotId, clipDescription } = body;
    if (!projectId || !shotId) { json(res, 400, { error: 'projectId and shotId are required' }); return; }
    try {
      const { getMastra } = await getAgentModule();
      const mastra = await getMastra();
      const agent = mastra.getAgentById('consistencyAuditorAgent');
      const result = await agent.generate(
        `Audit the generated clip for shot "${shotId}" in project "${projectId}". ` +
        (clipDescription ? `Clip description: ${clipDescription}` : 'Check against ProductionContext references.'),
      );
      json(res, 200, { ok: true, projectId, shotId, data: result.text });
    } catch (err) {
      console.error('[cinegen/agents] audit-clip error:', err.message);
      json(res, 503, { error: err.message });
    }
    return;
  }

  // Route: POST /api/agents/cinematography/annotate-spatial
  if (url === '/api/agents/cinematography/annotate-spatial' && req.method === 'POST') {
    let body;
    try { body = await readBody(req); } catch { json(res, 400, { error: 'Invalid JSON body' }); return; }
    const { projectId, shotId, annotations, provider } = body;
    if (!projectId || !shotId) { json(res, 400, { error: 'projectId and shotId are required' }); return; }
    try {
      const { getMastra } = await getAgentModule();
      const mastra = await getMastra();
      const agent = mastra.getAgentById('spatialAnnotationAgent');
      const annotationStr = JSON.stringify(annotations || {}, null, 2);
      const result = await agent.generate(
        `Translate spatial annotations for shot "${shotId}" in project "${projectId}" ` +
        `targeting ${provider || 'veo'} provider.\nAnnotations: ${annotationStr}`,
      );
      json(res, 200, { ok: true, projectId, shotId, data: result.text });
    } catch (err) {
      console.error('[cinegen/agents] annotate-spatial error:', err.message);
      json(res, 503, { error: err.message });
    }
    return;
  }

  // Route: POST /api/agents/sound/prepare-audio
  if (url === '/api/agents/sound/prepare-audio' && req.method === 'POST') {
    let body;
    try { body = await readBody(req); } catch { json(res, 400, { error: 'Invalid JSON body' }); return; }
    const { projectId } = body;
    if (!projectId) { json(res, 400, { error: 'projectId is required' }); return; }
    try {
      const { getMastra } = await getAgentModule();
      const mastra = await getMastra();
      const agent = mastra.getAgentById('audioAgent');
      const result = await agent.generate(
        `Prepare the complete audio assembly plan for project "${projectId}". ` +
        `Analyze all scenes, spot dialogue TTS requests, SFX cues, and music cues.`,
      );
      json(res, 200, { ok: true, projectId, data: result.text });
    } catch (err) {
      console.error('[cinegen/agents] sound/prepare-audio error:', err.message);
      json(res, 503, { error: err.message });
    }
    return;
  }

  // Route: POST /api/agents/post/assemble-sequence
  if (url === '/api/agents/post/assemble-sequence' && req.method === 'POST') {
    let body;
    try { body = await readBody(req); } catch { json(res, 400, { error: 'Invalid JSON body' }); return; }
    const { projectId, targetDurationSeconds } = body;
    if (!projectId) { json(res, 400, { error: 'projectId is required' }); return; }
    try {
      const { getMastra } = await getAgentModule();
      const mastra = await getMastra();
      const agent = mastra.getAgentById('sequenceAssemblyAgent');
      const result = await agent.generate(
        `Assemble the sequence for project "${projectId}". ` +
        (targetDurationSeconds ? `Target duration: ${targetDurationSeconds} seconds. ` : '') +
        'Arrange approved clips in story order, plan transitions and stitching.',
      );
      json(res, 200, { ok: true, projectId, data: result.text });
    } catch (err) {
      console.error('[cinegen/agents] post/assemble-sequence error:', err.message);
      json(res, 503, { error: err.message });
    }
    return;
  }

  // Route: POST /api/agents/post/color-grade
  if (url === '/api/agents/post/color-grade' && req.method === 'POST') {
    let body;
    try { body = await readBody(req); } catch { json(res, 400, { error: 'Invalid JSON body' }); return; }
    const { projectId } = body;
    if (!projectId) { json(res, 400, { error: 'projectId is required' }); return; }
    try {
      const { getMastra } = await getAgentModule();
      const mastra = await getMastra();
      const agent = mastra.getAgentById('finishColorAgent');
      const result = await agent.generate(
        `Analyze and prepare color grading for project "${projectId}". ` +
        'Match the StyleGuide, flag inconsistencies, suggest corrections.',
      );
      json(res, 200, { ok: true, projectId, data: result.text });
    } catch (err) {
      console.error('[cinegen/agents] post/color-grade error:', err.message);
      json(res, 503, { error: err.message });
    }
    return;
  }

  // Route: POST /api/agents/visual/identify
  if (url === '/api/agents/visual/identify' && req.method === 'POST') {
    let body;
    try { body = await readBody(req); } catch { json(res, 400, { error: 'Invalid JSON body' }); return; }
    const { projectId, images } = body;
    if (!projectId || !Array.isArray(images)) { json(res, 400, { error: 'projectId and images array are required' }); return; }
    try {
      const { getMastra } = await getAgentModule();
      const mastra = await getMastra();
      const agent = mastra.getAgentById('visualAnalysisAgent');
      const summary = images.map((img) => `Image category: ${img.category || 'unknown'}`).join('\n');
      const result = await agent.generate(
        `Analyze the following uploaded images for project "${projectId}".\n\n${summary}\n\n` +
        'Identify characters (name, description, role), locations (name, description, INT/EXT), and props (name, description).\n' +
        'Return a JSON object with "characters", "locations", and "props" arrays.',
        { output: 'object' },
      );
      json(res, 200, result.object ?? { characters: [], locations: [], props: [] });
    } catch (err) {
      console.error('[cinegen/agents] visual/identify error:', err.message);
      json(res, 503, { error: err.message });
    }
    return;
  }

  // Route: POST /api/agents/visual/extract-colors
  if (url === '/api/agents/visual/extract-colors' && req.method === 'POST') {
    let body;
    try { body = await readBody(req); } catch { json(res, 400, { error: 'Invalid JSON body' }); return; }
    const { projectId, images } = body;
    if (!projectId || !Array.isArray(images)) { json(res, 400, { error: 'projectId and images array are required' }); return; }
    try {
      const { extractDominantColors } = await import('../../backends/agents/visual/color-extractor.js');
      const result = await extractDominantColors(images, 6);
      json(res, 200, result);
    } catch (err) {
      console.error('[cinegen/agents] visual/extract-colors error:', err.message);
      json(res, 503, { error: err.message });
    }
    return;
  }

  // Route: POST /api/agents/script/generate-outline
  if (url === '/api/agents/script/generate-outline' && req.method === 'POST') {
    let body;
    try { body = await readBody(req); } catch { json(res, 400, { error: 'Invalid JSON body' }); return; }
    const { projectId, characters, locations, style } = body;
    if (!projectId) { json(res, 400, { error: 'projectId is required' }); return; }
    try {
      const { getMastra } = await getAgentModule();
      const mastra = await getMastra();
      const agent = mastra.getAgentById('scriptAgent');
      const charText = Array.isArray(characters) ? characters.map((c) => `- ${c.name} (${c.role}): ${c.description}`).join('\n') : '(none provided)';
      const locText = Array.isArray(locations) ? locations.map((l) => `- ${l.name} (${l.intExt}): ${l.description}`).join('\n') : '(none provided)';
      const styleText = style ? `Palette: ${(style.palette || []).join(', ')}\nMood: ${style.mood || 'N/A'}\nNotes: ${style.notes || 'N/A'}` : '(none provided)';
      const result = await agent.generate(
        `Generate a Fountain-format script outline for project "${projectId}" based on the following visual context.\n\n` +
        `CHARACTERS:\n${charText}\n\nLOCATIONS:\n${locText}\n\nSTYLE:\n${styleText}\n\n` +
        'Create a short outline with scene headings, brief action descriptions, and character appearances. Return as a "outline" string field in JSON.',
        { output: 'object' },
      );
      json(res, 200, { outline: (result.object?.outline ?? result.text) || '' });
    } catch (err) {
      console.error('[cinegen/agents] script/generate-outline error:', err.message);
      json(res, 503, { error: err.message });
    }
    return;
  }

  // Route: POST /api/agents/concept/generate-concepts
  if (url === '/api/agents/concept/generate-concepts' && req.method === 'POST') {
    let body;
    try { body = await readBody(req); } catch { json(res, 400, { error: 'Invalid JSON body' }); return; }
    const { projectId, moodDescription, vibe, colorPalette, sceneSettings, lightingDesc, atmosphereNotes, atmosphereTags, imageDataUrls } = body;
    if (!projectId) { json(res, 400, { error: 'projectId is required' }); return; }
    try {
      const { getMastra } = await getAgentModule();
      const mastra = await getMastra();
      const agent = mastra.getAgentById('conceptAnalysisAgent');
      const prompt = [
        `Generate conceptual film elements for project "${projectId}".`,
        moodDescription ? `\n\nMOOD DESCRIPTION:\n${moodDescription}` : '',
        vibe ? `\n\nVIBE SLIDERS:\nTemperature: ${vibe.temperature ?? 0}/5 (cool→warm)\nTension: ${vibe.tension ?? 0}/5 (peaceful→tense)\nLighting: ${vibe.lighting ?? 0}/5 (night→day)\nEnergy: ${vibe.energy ?? 0}/5 (calm→energetic)\nStylization: ${vibe.stylization ?? 50}/100 (grounded→stylized)` : '',
        Array.isArray(colorPalette) && colorPalette.length ? `\n\nCOLOR HINTS:\n${colorPalette.join(', ')}` : '',
        sceneSettings ? `\n\nSCENE SETTINGS:\n${sceneSettings}` : '',
        lightingDesc ? `\n\nLIGHTING NOTES:\n${lightingDesc}` : '',
        atmosphereNotes ? `\n\nATMOSPHERE NOTES:\n${atmosphereNotes}` : '',
        Array.isArray(atmosphereTags) && atmosphereTags.length ? `\n\nATMOSPHERE TAGS:\n${atmosphereTags.join(', ')}` : '',
        Array.isArray(imageDataUrls) && imageDataUrls.length ? `\n\nREFERENCE IMAGES PROVIDED: ${imageDataUrls.length} image(s) available for style context.` : '',
      ].join('');
      const result = await agent.generate(prompt, { output: 'object' });
      json(res, 200, result.object ?? {
        atmosphereTags: [], colorPalette: [], lightingMood: '', styleNotes: '',
        locations: [], archetypes: [],
      });
    } catch (err) {
      console.error('[cinegen/agents] concept/generate-concepts error:', err.message);
      json(res, 503, { error: err.message });
    }
    return;
  }

  // Route: POST /api/agents/concept/generate-image
  if (url === '/api/agents/concept/generate-image' && req.method === 'POST') {
    let body;
    try { body = await readBody(req); } catch { json(res, 400, { error: 'Invalid JSON body' }); return; }
    const { prompt } = body;
    if (!prompt) { json(res, 400, { error: 'prompt is required' }); return; }
    try {
      const { generateImage } = await import('../../backends/agents/concept/image-generator.js');
      const result = await generateImage(prompt);
      json(res, 200, result);
    } catch (err) {
      console.error('[cinegen/agents] concept/generate-image error:', err.message);
      json(res, 503, { error: err.message });
    }
    return;
  }

  // Route: GET /api/agents/project/:projectId/context
  const ctxGetMatch = url.match(/^\/api\/agents\/project\/([^/]+)\/context$/);
  if (ctxGetMatch && req.method === 'GET') {
    const projectId = decodeURIComponent(ctxGetMatch[1]);
    const { loadProductionContext } = await getProductionContextHelpers();
    json(res, 200, loadProductionContext(projectId));
    return;
  }

  // Route: POST /api/agents/project/:projectId/context
  const ctxPostMatch = url.match(/^\/api\/agents\/project\/([^/]+)\/context$/);
  if (ctxPostMatch && req.method === 'POST') {
    const projectId = decodeURIComponent(ctxPostMatch[1]);
    let body;
    try { body = await readBody(req); } catch {
      json(res, 400, { error: 'Invalid JSON body' });
      return;
    }
    const { updateProductionContext } = await getProductionContextHelpers();
    updateProductionContext(projectId, body);
    json(res, 200, { ok: true, projectId });
    return;
  }

  // Route: GET /api/agents/project/:projectId/review-queue
  const reviewMatch = url.match(/^\/api\/agents\/project\/([^/]+)\/review-queue$/);
  if (reviewMatch && req.method === 'GET') {
    const projectId = decodeURIComponent(reviewMatch[1]);
    const { Orchestrator } = await import('../../backends/agents/orchestrator.js');
    const orch = new Orchestrator(projectId);
    json(res, 200, { projectId, items: orch.getPendingReviews() });
    return;
  }

  // Route: POST /api/agents/project/:projectId/review/:itemId/approve
  const approveMatch = url.match(/^\/api\/agents\/project\/([^/]+)\/review\/([^/]+)\/approve$/);
  if (approveMatch && req.method === 'POST') {
    const projectId = decodeURIComponent(approveMatch[1]);
    const itemId = decodeURIComponent(approveMatch[2]);
    let body;
    try { body = await readBody(req); } catch { body = {}; }
    const { Orchestrator } = await import('../../backends/agents/orchestrator.js');
    const orch = new Orchestrator(projectId);
    const result = await orch.approveReviewItem(itemId, body.notes || '');
    json(res, 200, { ok: true, ...result });
    return;
  }

  // Route: POST /api/agents/project/:projectId/review/:itemId/reject
  const rejectMatch = url.match(/^\/api\/agents\/project\/([^/]+)\/review\/([^/]+)\/reject$/);
  if (rejectMatch && req.method === 'POST') {
    const projectId = decodeURIComponent(rejectMatch[1]);
    const itemId = decodeURIComponent(rejectMatch[2]);
    let body;
    try { body = await readBody(req); } catch { body = {}; }
    const { Orchestrator } = await import('../../backends/agents/orchestrator.js');
    const orch = new Orchestrator(projectId);
    const result = await orch.rejectReviewItem(itemId, body.reason || '');
    json(res, 200, { ok: true, ...result });
    return;
  }

  // Route: GET /api/agents/health — reports whether Mastra is ready
  if (url === '/api/agents/health' && req.method === 'GET') {
    const { resolveDefaultModel } = await getAgentModule();
    const model = resolveDefaultModel();
    json(res, 200, {
      ready: model !== null,
      provider: process.env.CINEGEN_LLM_PROVIDER || 'anthropic',
      configured: model !== null,
    });
    return;
  }

  json(res, 404, { error: `Unknown agent route: ${url}` });
}

// Inline helpers to read/write production-context.json without importing the full tool module
let _pcHelpers = null;
async function getProductionContextHelpers() {
  if (!_pcHelpers) {
    const mod = await import('../../backends/agents/tools/production-context.tool.js');
    _pcHelpers = {
      loadProductionContext: (projectId) => {
        const all = (() => {
          try {
            const p = path.join(__dirname, 'production-context.json');
            if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf-8'));
          } catch { /* ignore */ }
          return {};
        })();
        return all[projectId] ?? null;
      },
      updateProductionContext: (projectId, update) => {
        const p = path.join(__dirname, 'production-context.json');
        let all = {};
        try {
          if (fs.existsSync(p)) all = JSON.parse(fs.readFileSync(p, 'utf-8'));
        } catch { /* ignore */ }
        const existing = all[projectId] || { projectId, updatedAt: new Date().toISOString() };
        // Deep merge
        function deepMerge(t, s) {
          const r = { ...t };
          for (const [k, v] of Object.entries(s)) {
            if (v !== null && typeof v === 'object' && !Array.isArray(v)) r[k] = deepMerge(r[k] || {}, v);
            else r[k] = v;
          }
          return r;
        }
        all[projectId] = deepMerge(existing, { ...update, updatedAt: new Date().toISOString() });
        fs.writeFileSync(p, JSON.stringify(all, null, 2), 'utf-8');
      },
    };
  }
  return _pcHelpers;
}

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
