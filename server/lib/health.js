import { json } from './proxy-utils.js';
import { stateClients } from './state-ws.js';

export function handleHealth(req, res) {
  json(res, 200, {
    persistence: true,
    mode: 'server',
    timestamp: Date.now(),
  });
}

export function handleConnections(req, res) {
  json(res, 200, { count: stateClients.size });
}
