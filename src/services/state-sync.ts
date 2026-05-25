/**
 * WebSocket client for real-time state synchronization across browser instances.
 *
 * Connects to /ws-state on the Vite dev server.
 * Handles reconnection, dispatches custom events for state updates from other clients,
 * and broadcasts local state changes.
 */

const WS_URL = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws-state`;

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectDelay = 1000;
const MAX_RECONNECT_DELAY = 30000;
let _clientId = '';

function generateClientId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function dispatchStateUpdate(domain: string, payload: unknown): void {
  window.dispatchEvent(new CustomEvent('cg-state-sync', {
    detail: { domain, payload, source: 'remote' },
  }));
}

function connect(): void {
  if (ws?.readyState === WebSocket.OPEN || ws?.readyState === WebSocket.CONNECTING) return;

  try {
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      reconnectDelay = 1000;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(String(event.data));
        if (msg.type === 'state-update' && msg.domain && msg.payload) {
          dispatchStateUpdate(msg.domain, msg.payload);
        }
      } catch {
        /* ignore malformed */
      }
    };

    ws.onclose = () => {
      ws = null;
      scheduleReconnect();
    };

    ws.onerror = () => {
      /* onclose will fire after error; let it handle reconnect */
    };
  } catch {
    scheduleReconnect();
  }
}

function scheduleReconnect(): void {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
    connect();
  }, reconnectDelay);
}

/** Broadcast a local state change to all connected clients via the server. */
export function broadcastStateChange(domain: string, payload: Record<string, unknown>): void {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  try {
    ws.send(JSON.stringify({ type: 'state-change', clientId: _clientId, domain, payload }));
  } catch {
    /* ignore */
  }
}

/** Subscribe to remote state updates. Returns an unsubscribe function. */
export function subscribeStateSync(callback: (domain: string, payload: unknown) => void): () => void {
  const handler = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    if (detail?.source === 'remote') {
      callback(detail.domain, detail.payload);
    }
  };
  window.addEventListener('cg-state-sync', handler);
  return () => window.removeEventListener('cg-state-sync', handler);
}

/** Initialize the WebSocket connection for state sync. Idempotent. */
export function initStateSync(): void {
  if (!_clientId) _clientId = generateClientId();
  connect();
}

/** True if the WebSocket is currently open. */
export function isStateSyncConnected(): boolean {
  return ws !== null && ws.readyState === WebSocket.OPEN;
}
