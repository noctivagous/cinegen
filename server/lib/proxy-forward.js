import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';
import {
  corsHeaders,
  json,
  CINE_DOC_RE,
} from './proxy-utils.js';
import { buildProviders } from './key-store.js';

export function handleProxy(req, res) {
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
