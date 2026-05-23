# CineGen Backend Proxy Scripts

These scripts serve a single purpose: act as a **reverse proxy** that injects
API keys (stored securely in a server-side `.env` file) into requests from the
CineGen frontend. The browser never holds a key in Secured mode.

---

## How it works

1. The user enables **Secured (Backend Proxy)** mode in  
   *Settings → AI Providers & Models → Key Storage*.
2. They set the **Proxy URL** (e.g. `http://127.0.0.1:8080`) in the same panel.
3. CineGen sends all AI requests to the proxy with a `X-Cinegen-Target` header
   identifying the provider (`openai`, `anthropic`, `google`, `elevenlabs`,
   `fal`, `replicate`, `runway`, `luma`).
4. The proxy looks up the correct key from `.env`, adds the `Authorization`
   header, and forwards the request to the real provider API.
5. The response is passed back to the browser.

---

## Provider → env-var mapping

| Provider          | Env var               | Default base URL                              |
|-------------------|-----------------------|-----------------------------------------------|
| openai            | `OPENAI_API_KEY`      | https://api.openai.com                        |
| anthropic         | `ANTHROPIC_API_KEY`   | https://api.anthropic.com                     |
| google            | `GOOGLE_API_KEY`      | https://generativelanguage.googleapis.com     |
| elevenlabs        | `ELEVENLABS_API_KEY`  | https://api.elevenlabs.io                     |
| fal               | `FAL_KEY`             | https://fal.run                               |
| replicate         | `REPLICATE_API_TOKEN` | https://api.replicate.com                     |
| runway            | `RUNWAY_API_KEY`      | https://api.dev.runwayml.com                  |
| luma              | `LUMA_API_KEY`        | https://api.lumalabs.ai                       |
| xai               | `XAI_API_KEY`         | https://api.x.ai                              |
| custom            | `CUSTOM_API_KEY`      | (set `CUSTOM_BASE_URL` in .env)               |

---

## Running a proxy locally

Each script reads `.env` from its own directory. Copy `.env.example` to `.env`
and fill in your keys before starting.

```bash
# Node.js
node proxy.js          # http://127.0.0.1:8080

# Python
python proxy.py        # http://127.0.0.1:8080

# PHP (built-in server)
php -S 127.0.0.1:8080 proxy.php
```

---

## Security notes

- Run the proxy on `127.0.0.1` (loopback only) — never expose it publicly.
- `.env` is listed in `.gitignore`; never commit keys.
- CORS is restricted to the CineGen page origin by default.
- The proxy only forwards to known provider domains; arbitrary `X-Cinegen-Target`
  values are rejected.
