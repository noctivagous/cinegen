import fs from 'node:fs';
import {
  KEYS_PATH,
  json,
  corsHeaders,
} from './proxy-utils.js';
import {
  providerRuntimeByProxyTarget,
  providerRuntimeBySlotId,
} from '../../src/constants/provider-registry.js';

let _agentModule = null;

export function setAgentModule(mod) {
  _agentModule = mod;
}

export function loadStoredKeys() {
  try {
    if (fs.existsSync(KEYS_PATH)) {
      const raw = JSON.parse(fs.readFileSync(KEYS_PATH, 'utf-8'));
      if (!Array.isArray(raw.vendors)) raw.vendors = [];
      return raw;
    }
  } catch { /* ignore corrupt file */ }
  return { vendors: [] };
}

export function saveStoredKeys(data) {
  fs.writeFileSync(KEYS_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

export function buildProviders() {
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

export function augmentVendorsWithEnvKeys(stored) {
  const { envProviders } = buildProviders();
  const runtimeBySlot = providerRuntimeBySlotId();
  const vendors = [...(stored.vendors || [])];

  for (const [slotId, envProv] of Object.entries(envProviders)) {
    if (!envProv.key) continue;
    const meta = runtimeBySlot[slotId];
    if (!meta) continue;

    let vendor = vendors.find((v) => v.slotId === slotId);
    if (!vendor) {
      vendor = {
        id: `env-${slotId}`,
        name: meta.name || slotId,
        providerId: meta.providerId || 'generic-rest',
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

export function maskVendorsForClient(stored) {
  return {
    ...stored,
    vendors: (stored.vendors || []).map((v) => ({
      ...v,
      hasServerKey: Boolean(v.hasServerKey || v.apiKey),
      apiKey: v.apiKey ? '••••••••' : '',
    })),
  };
}

export function handleKeyApi(req, res) {
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

        for (const inv of incoming) {
          const existing = (stored.vendors || []).findIndex((v) => v.id === inv.id);
          const merged = { ...inv };
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

        if (_agentModule) {
          try { _agentModule.reload?.(); } catch { /* ignore */ }
        }

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
