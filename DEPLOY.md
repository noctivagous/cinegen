# Deploying `source/` (self-contained bundle)

Upload this entire `source/` directory to your server or host. It includes the Vite frontend, the Node API proxy, and key storage.

## Requirements

- Node.js 20+
- npm

## First-time setup

```bash
cd source   # or your upload path
npm install
```

Edit `backends/.env` (created from `.env.example` on install) and add provider API keys, **or** enter keys in the app via Settings → AI Models (stored in `server/keys.json`).

## Development

```bash
npm run dev
```

Opens the app at http://localhost:5173/ with the proxy and `/api/*` routes on the same origin.

## Production

```bash
npm run build
npm start
```

Serves the built app from `dist/` on port 3000 (override with `PORT` / `HOST`).

## Layout

| Path | Purpose |
|------|---------|
| `index.html`, `src/`, `css/`, `img/` | Frontend app |
| `server/proxy.js` | AI proxy + `/api/settings/*` + persistence |
| `server/index.mjs` | Production static server + proxy |
| `backends/.env` | Optional env-based API keys (not committed) |
| `server/keys.json` | Runtime keys from the UI (not committed) |
| `dist/` | Production build output (generated) |

## Security

- Never commit `backends/.env` or `server/keys.json`.
- Restrict network access to your deployment; the proxy forwards authenticated requests to AI providers.
