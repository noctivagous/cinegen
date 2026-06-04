import { WebSocketServer } from 'ws';
import {
  json,
  loadAppState,
  saveAppState,
} from './proxy-utils.js';

export const stateClients = new Set();
let stateWss = null;

export function broadcastStateChange(domain, payload) {
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

export function handleStateApi(req, res) {
  const url = req.url || '';
  const parts = url.replace('/api/state/', '').split('/');
  const domain = parts[0];

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
