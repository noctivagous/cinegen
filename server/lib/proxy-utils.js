import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const KEYS_PATH = path.join(__dirname, '..', 'keys.json');
export const ROUTING_PATH = path.join(__dirname, '..', 'routing.json');
export const SETTINGS_PATH = path.join(__dirname, '..', 'settings.json');
export const APP_STATE_PATH = path.join(__dirname, '..', 'app-state.json');
export const PROJECTS_DIR = path.join(__dirname, '..', 'projects');

export const CINE_DOC_RE = /^[a-zA-Z0-9._-]+\.(cinescript|cinetreatment|cinestoryboard|cinescenes|cinebreakdown|cinecharacters|cinelocations|cinereferenceimages|cinestyle|cinefeatures|cineshotlibrary|cinecamerapresets|cinespatialannotations|cinegenerationqueue|cinereviewqueue|cinecosttracking|cineagentlog|cinescratchpad|cinedrafts|json)$/;

export const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || 'null,http://localhost,http://127.0.0.1,file://').split(',').map((s) => s.trim());

export function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin':  allowed,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Cinegen-Target, X-Cinegen-Path, X-Cinegen-Base-Url',
  };
}

export function json(res, status, data) {
  const origin = '*';
  res.writeHead(status, { ...corsHeaders(origin), 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

export function readBody(req) {
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

export function loadAppState() {
  try {
    if (fs.existsSync(APP_STATE_PATH)) {
      return JSON.parse(fs.readFileSync(APP_STATE_PATH, 'utf-8'));
    }
  } catch { /* ignore corrupt file */ }
  return {};
}

export function saveAppState(data) {
  fs.writeFileSync(APP_STATE_PATH, JSON.stringify(data, null, 2), 'utf-8');
}
