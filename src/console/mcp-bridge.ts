import { executeConsoleCommand } from '@/console/command-registry';
import { sendToAppConsole, readAppConsole } from '@/console/console-service';

let _ws: WebSocket | null = null;
const RECONNECT_DELAY_MS = 3000;

/** Stable per-tab identity so the MCP server can group reconnections. */
const TAB_ID = 'cg-' + Math.random().toString(36).slice(2, 10);

export function initMcpBridge(): void {
  connect();
}

function connect(): void {
  try {
    _ws = new WebSocket('ws://localhost:3456/ws');

    _ws.onopen = () => {
      console.info('[MCP Bridge] Connected to MCP server');
      _ws?.send(JSON.stringify({ type: 'hello', tabId: TAB_ID, role: 'client' }));
    };

    _ws.onmessage = async (event) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(String(event.data));
      } catch {
        return;
      }
      if (msg.type === 'command') {
        const cmd = String(msg.cmd ?? '');
        const args = Array.isArray(msg.args) ? (msg.args as string[]) : [];
        const full = [cmd, ...args].join(' ');
        sendToAppConsole(full, true);
        const result = await executeConsoleCommand(full);
        _ws?.send(JSON.stringify({ type: 'result', id: msg.id, result }));
      } else if (msg.type === 'readState') {
        const state = await executeConsoleCommand('readGUIState');
        _ws?.send(
          JSON.stringify({
            type: 'state',
            id: msg.id,
            state,
          })
        );
      } else if (msg.type === 'readContents') {
        const contents = await executeConsoleCommand('readGUIContents');
        _ws?.send(
          JSON.stringify({
            type: 'contents',
            id: msg.id,
            contents,
          })
        );
      }
    };

    _ws.onclose = () => {
      _ws = null;
      setTimeout(connect, RECONNECT_DELAY_MS);
    };

    _ws.onerror = () => {
      _ws?.close();
    };
  } catch {
    setTimeout(connect, RECONNECT_DELAY_MS);
  }
}
