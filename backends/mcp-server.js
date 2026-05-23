#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { WebSocketServer } from 'ws';
import { randomUUID } from 'crypto';

const PORT = process.env.CINEGEN_MCP_PORT ? Number(process.env.CINEGEN_MCP_PORT) : 3456;

const browserConnections = new Set();

/** Check whether at least one CineGen browser app is connected via WebSocket. */
function isAppConnected() {
  for (const ws of browserConnections) {
    if (ws.readyState === 1) return true;
  }
  return false;
}

/** Return the standard "no app" message used by every tool. */
function noAppResponse() {
  return {
    content: [{
      type: 'text',
      text: 'No CineGen app window is currently open.\n\nTo use CineGen tools, start the dev server with `npm run dev` and open the app in a browser. The app will automatically connect to this MCP server.'
    }]
  };
}

/** Pick a connected WebSocket (most recently added). */
function pickBrowserWs() {
  for (const ws of browserConnections) {
    if (ws.readyState === 1) return ws;
  }
  return null;
}

/** Send a command via WebSocket to the browser app and return the response. */
function sendCommand(cmd, args) {
  if (!isAppConnected()) return noAppResponse();
  const id = randomUUID();
  return new Promise((resolve) => {
    pending.set(id, resolve);
    const target = pickBrowserWs();
    if (target) {
      target.send(JSON.stringify({ type: 'command', id, cmd, args }));
    }
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        resolve({ content: [{ type: 'text', text: 'Timeout: no response from app' }] });
      }
    }, 15000);
  });
}

/** Send a raw WebSocket typed message and return the response. */
function sendRaw(type, id) {
  if (!isAppConnected()) return noAppResponse();
  return new Promise((resolve) => {
    pending.set(id, resolve);
    const target = pickBrowserWs();
    if (target) {
      target.send(JSON.stringify({ type, id }));
    }
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        resolve({ content: [{ type: 'text', text: 'Timeout' }] });
      }
    }, 10000);
  });
}

const mcpServer = new Server(
  {
    name: 'cinegen-mcp-server',
    version: '2.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

mcpServer.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'send_command',
      description: 'Send a command to the CineGen app console. Use cmd="evaluate" + args=["JS expression"] to run JavaScript. Use cmd="window" + args=["sa"] to open modals. Use cmd="help" to list all commands.',
      inputSchema: {
        type: 'object',
        properties: {
          cmd: {
            type: 'string',
            description: 'Command name (e.g. evaluate, inventory, click, fill, window, readGUIState, readGUIContents, help). Shortcut: prefix with "= " to evaluate as JS inline (e.g. "= window.openSetupAssistant()").'
          },
          args: {
            type: 'array',
            items: { type: 'string' },
            description: 'Command arguments as string array'
          },
        },
        required: ['cmd'],
      },
    },
    {
      name: 'evaluate',
      description: 'Run a JavaScript expression in the CineGen app context and return the structured result. Use for calling window.* functions, accessing state, or querying the DOM.',
      inputSchema: {
        type: 'object',
        properties: {
          expression: {
            type: 'string',
            description: 'JavaScript expression to evaluate (e.g. "window.loadApiKeys()", "window._saWizardApi.getState()", "window.CineGen.debug.readGUIState()", "document.getElementById(\'sa-provider-llm\').value")'
          },
        },
        required: ['expression'],
      },
    },
    {
      name: 'inventory',
      description: 'Scan the current view and list all interactive DOM elements (buttons, inputs, selects, toggles, tabs, links) with their IDs, text content, type, value, position, and data attributes. Use this to discover what elements are available to click or fill.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'click',
      description: 'Click an element by CSS selector or by matching text content. The tool tries the selector first, then falls back to text-content matching on buttons, links, and interactive elements.',
      inputSchema: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'CSS selector to find the element (e.g. "#sa-provider-llm", "#setup-next-btn"). Omit if using text-based matching.'
          },
          text: {
            type: 'string',
            description: 'Text content to match (case-insensitive, partial match). Omit if using CSS selector. Example: "Next", "Save", "Test Connection"'
          },
        },
      },
    },
    {
      name: 'fill',
      description: 'Fill an input, textarea, or select element by CSS selector and set its value. Dispatches native input and change events for reactive frameworks (Lit, Vue, React).',
      inputSchema: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'CSS selector to find the element (e.g. "#sa-prov-key-xai", "#sa-coverage-baseurl-llm")'
          },
          value: {
            type: 'string',
            description: 'Value to set on the element (text for inputs/textarea, option value for selects)'
          },
        },
        required: ['selector', 'value'],
      },
    },
    {
      name: 'read_state',
      description: 'Read the current GUI state of the CineGen app (open modal, current view, active project, sidebar/inspector visibility). Uses the readGUIState console command.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'read_contents',
      description: 'Read interactive DOM contents from the current app view. Returns organized lists of toolbar, modal, sidebar, workspace, and inspector elements with their IDs, text, and classes.',
      inputSchema: { type: 'object', properties: {} },
    },
  ],
}));

const pending = new Map();

mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  // ── send_command ──────────────────────────────────────────────────────────
  if (name === 'send_command') {
    if (!isAppConnected()) return noAppResponse();
    let cmd = String(args.cmd ?? '');
    const cmdArgs = Array.isArray(args.args) ? args.args.map(String) : [];

    // Inline JS evaluation via "= expression" prefix
    if (cmd.startsWith('= ')) {
      cmd = 'evaluate';
      cmdArgs.unshift(cmd.slice(2));
    }

    return await sendCommand(cmd, cmdArgs);
  }

  // ── evaluate ──────────────────────────────────────────────────────────────
  if (name === 'evaluate') {
    const expression = String(args.expression ?? '').trim();
    if (!expression) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: 'expression is required' }) }] };
    }
    return await sendCommand('evaluate', [expression]);
  }

  // ── inventory ─────────────────────────────────────────────────────────────
  if (name === 'inventory') {
    return await sendCommand('inventory', []);
  }

  // ── click ─────────────────────────────────────────────────────────────────
  if (name === 'click') {
    const selector = args.selector ? String(args.selector).trim() : '';
    const text = args.text ? String(args.text).trim() : '';
    if (!selector && !text) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: 'Provide either selector or text' }) }] };
    }
    if (text) {
      return await sendCommand('click', ['--text', text]);
    }
    return await sendCommand('click', [selector]);
  }

  // ── fill ──────────────────────────────────────────────────────────────────
  if (name === 'fill') {
    const selector = String(args.selector ?? '').trim();
    const value = String(args.value ?? '').trim();
    if (!selector) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: 'selector is required' }) }] };
    }
    return await sendCommand('fill', [selector, value]);
  }

  // ── read_state (legacy) ────────────────────────────────────────────────────
  if (name === 'read_state') {
    if (!isAppConnected()) return noAppResponse();
    const id = randomUUID();
    return new Promise((resolve) => {
      pending.set(id, resolve);
      const target = pickBrowserWs();
      if (target) target.send(JSON.stringify({ type: 'readState', id }));
      setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id);
          resolve({ content: [{ type: 'text', text: 'Timeout' }] });
        }
      }, 5000);
    });
  }

  // ── read_contents (legacy) ─────────────────────────────────────────────────
  if (name === 'read_contents') {
    if (!isAppConnected()) return noAppResponse();
    const id = randomUUID();
    return new Promise((resolve) => {
      pending.set(id, resolve);
      const target = pickBrowserWs();
      if (target) target.send(JSON.stringify({ type: 'readContents', id }));
      setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id);
          resolve({ content: [{ type: 'text', text: 'Timeout' }] });
        }
      }, 5000);
    });
  }

  return { content: [{ type: 'text', text: `Unknown tool: ${name}` }] };
});

let wss;
try {
  wss = new WebSocketServer({ port: PORT, path: '/ws' });
  console.error(`[MCP Server] WS: ws://localhost:${PORT}/ws`);
} catch (err) {
  console.error(`[MCP Server] Could not bind WebSocket server on port ${PORT}:`, err.message);
  console.error('[MCP Server] MCP stdio transport still active — browser bridge unavailable until port is free.');
}

// WebSocketServer errors are emitted asynchronously; catch them so a port
// conflict doesn't crash the whole process (which would kill the stdio MCP transport).
if (wss) {
  wss.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[MCP Server] Port ${PORT} already in use — browser bridge unavailable.`);
      console.error('[MCP Server] MCP stdio transport remains active.');
      wss.close();
      wss = null;
    } else {
      console.error('[MCP Server] WebSocket error:', err.message);
    }
  });
}

if (wss) {
  wss.on('connection', (ws) => {
    console.error('[MCP Server] Browser bridge connected');
    browserConnections.add(ws);

    ws.on('message', (data) => {
      let msg;
      try {
        msg = JSON.parse(String(data));
      } catch {
        return;
      }
      if (msg.type === 'result' || msg.type === 'state' || msg.type === 'contents') {
        const resolver = pending.get(msg.id);
        if (resolver) {
          pending.delete(msg.id);
          const text = JSON.stringify(msg.result ?? msg.state ?? msg.contents, null, 2);
          resolver({ content: [{ type: 'text', text }] });
        }
      }
    });

    ws.on('close', () => {
      browserConnections.delete(ws);
      console.error('[MCP Server] Browser bridge disconnected');
    });
  });
}

const transport = new StdioServerTransport();
await mcpServer.connect(transport);
const wsStatus = wss ? `WS: ws://localhost:${PORT}/ws` : 'WS unavailable (port in use)';
console.error(`[MCP Server] Listening on stdio, ${wsStatus}`);
