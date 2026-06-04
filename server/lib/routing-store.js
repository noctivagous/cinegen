import fs from 'node:fs';
import {
  ROUTING_PATH,
  json,
} from './proxy-utils.js';

export function loadStoredRouting() {
  try {
    if (fs.existsSync(ROUTING_PATH)) {
      return JSON.parse(fs.readFileSync(ROUTING_PATH, 'utf-8'));
    }
  } catch { /* ignore corrupt file */ }
  return { modalities: { llm: {}, image: {}, video: {}, audio: {} } };
}

export function saveStoredRouting(data) {
  fs.writeFileSync(ROUTING_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

export function handleRoutingApi(req, res) {
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
