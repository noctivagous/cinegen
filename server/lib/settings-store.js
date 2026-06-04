import fs from 'node:fs';
import {
  SETTINGS_PATH,
  json,
} from './proxy-utils.js';

export function loadSettingsStore() {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'));
    }
  } catch { /* ignore corrupt file */ }
  return {};
}

export function saveSettingsStore(data) {
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

export function handleSettingsStore(req, res) {
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
