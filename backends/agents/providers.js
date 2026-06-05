import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { providerRuntimeByProxyTarget } from '../../src/constants/provider-registry.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');

const KEYS_PATH = path.join(REPO_ROOT, 'server', 'keys.json');
const ROUTING_PATH = path.join(REPO_ROOT, 'server', 'routing.json');

dotenv.config({ path: path.join(REPO_ROOT, 'backends', '.env') });

function loadStoredKeys() {
  try {
    if (fs.existsSync(KEYS_PATH)) {
      const raw = JSON.parse(fs.readFileSync(KEYS_PATH, 'utf-8'));
      if (!Array.isArray(raw.vendors)) raw.vendors = [];
      return raw;
    }
  } catch { /* ignore */ }
  return { vendors: [] };
}

function loadStoredRouting() {
  try {
    if (fs.existsSync(ROUTING_PATH)) {
      return JSON.parse(fs.readFileSync(ROUTING_PATH, 'utf-8'));
    }
  } catch { /* ignore */ }
  return { modalities: {} };
}

function buildProviders() {
  const stored = loadStoredKeys();
  const storedBySlot = {};
  for (const v of stored.vendors || []) {
    if (v.apiKey) storedBySlot[v.slotId || v.id] = v;
  }

  const runtimeByTarget = providerRuntimeByProxyTarget();
  const envProviders = Object.fromEntries(
    Object.entries(runtimeByTarget).map(([proxyTarget, meta]) => {
      const key = meta.envKey ? process.env[meta.envKey] : '';
      const envBaseUrl = meta.envBaseUrlKey ? process.env[meta.envBaseUrlKey] : '';
      return [proxyTarget, {
        key,
        baseUrl: envBaseUrl || meta.defaultBaseUrl || '',
        authHeader: meta.authHeader,
        slotId: meta.slotId,
      }];
    }),
  );

  for (const [, prov] of Object.entries(envProviders)) {
    const runtime = storedBySlot[prov.slotId];
    if (runtime?.apiKey) prov.key = runtime.apiKey;
    if (runtime?.baseUrl) prov.baseUrl = runtime.baseUrl;
  }

  return { envProviders, storedBySlot };
}

function getDefaultLLMConfig() {
  const routing = loadStoredRouting();
  const llmModality = routing.modalities?.llm;
  if (!llmModality || !llmModality.model) return null;

  const { envProviders } = buildProviders();

  const vendorId = llmModality.vendorId;
  if (vendorId) {
    const stored = loadStoredKeys();
    const vendor = (stored.vendors || []).find(v => v.id === vendorId);
    if (vendor?.apiKey) {
      return {
        apiKey: vendor.apiKey,
        baseUrl: vendor.baseUrl || llmModality.baseUrl || '',
        model: llmModality.model,
        provider: llmModality.provider,
      };
    }
  }

  const targetBase = (llmModality.baseUrl || '').toLowerCase();
  for (const [, prov] of Object.entries(envProviders)) {
    if (prov.key && prov.baseUrl.toLowerCase() === targetBase) {
      return {
        apiKey: prov.key,
        baseUrl: prov.baseUrl,
        model: llmModality.model,
        provider: llmModality.provider,
      };
    }
  }

  for (const [, prov] of Object.entries(envProviders)) {
    if (prov.key) {
      return {
        apiKey: prov.key,
        baseUrl: prov.baseUrl || llmModality.baseUrl || '',
        model: llmModality.model,
        provider: llmModality.provider,
      };
    }
  }

  return null;
}

export const PROVIDER_PROMPT_LIMITS = {
  runway: { maxChars: 1000, maxRefs: 3, notes: 'Concise, motion-focused prompts best' },
  luma: { maxChars: 5000, maxRefs: 3, notes: 'Longer prompts OK up to 5000' },
  kling: { maxChars: Infinity, maxRefs: 4, notes: 'No strict limit, multi-step structure helps' },
  veo: { maxChars: 5000, maxRefs: 3, notes: 'Structured with clear subject-action-setting' },
  pika: { maxChars: 1000, maxRefs: 3, notes: 'Brevity key, under 200 chars ideal' },
  seedance: { maxChars: 5000, maxRefs: 9, notes: 'Keep under 200 words for best results' },
  sora: { maxChars: 1000, maxRefs: 0, notes: 'Similar to Runway style' },
};

export { loadStoredKeys, loadStoredRouting, buildProviders, getDefaultLLMConfig };
