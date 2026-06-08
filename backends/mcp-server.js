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
        .replace(/\n/g, '\\n')

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
    // ── CineGen-specific tools (Phase 2) ──────────────────────────────────
    {
      name: 'create_project',
      description: 'Create a new CineGen project. Opens the blank project wizard, fills in the project name and settings, then finishes the wizard.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Project name (default: auto-generated "Untitled X")' },
          aspectRatio: { type: 'string', description: 'Aspect ratio (default: "2.39:1")', enum: ['16:9', '9:16', '1:1', '21:9', '2.39:1', '2.00:1', '1.85:1', '4:3', '1.37:1'] },
          resolution: { type: 'string', description: 'Resolution (default: "720p")' },
          frameRate: { type: 'string', description: 'Frame rate (default: "24")' },
          colorSpace: { type: 'string', description: 'Color space (default: "Rec.709")' },
        },
      },
    },
    {
      name: 'switch_project',
      description: 'Switch to an existing CineGen project by name or ID. Opens the projects modal and clicks on the matching project.',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string', description: 'Project ID or name to switch to' },
        },
        required: ['projectId'],
      },
    },
    {
      name: 'write_script',
      description: 'Write or append Fountain-format script content to the current project.',
      inputSchema: {
        type: 'object',
        properties: {
          content: { type: 'string', description: 'Fountain-format script content' },
          mode: { type: 'string', description: 'Write mode: "set" (replace) or "append"', enum: ['set', 'append'], default: 'set' },
        },
        required: ['content'],
      },
    },
    {
      name: 'generate_references',
      description: 'Trigger reference image generation for the current project/scene. Clicks the "Generate References" button in the pre-production workspace.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'generate_storyboard',
      description: 'Trigger storyboard frame generation for the current project. Clicks the "Generate Scene Frames" button.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'get_script_state',
      description: 'Get the current script state: whether content exists, content length, scene count.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'get_storyboard_state',
      description: 'Get the current storyboard state: frame count, how many are generating, how many have images.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'get_project_state',
      description: 'Get the current project state: active project ID, project name, current view, save status.',
      inputSchema: { type: 'object', properties: {} },
    },
    // ── Phase 3 tools ──────────────────────────────────────
    {
      name: 'assert_state',
      description: 'Assert that the CineGen app is in a specific state. Checks project, script, storyboard, and view state. Returns pass/fail with details.',
      inputSchema: {
        type: 'object',
        properties: {
          projectLoaded: { type: 'boolean', description: 'Assert a project is loaded (activeProjectId is not empty)' },
          projectName: { type: 'string', description: 'Assert the project name matches (partial match, case-insensitive)' },
          hasScript: { type: 'boolean', description: 'Assert script content exists' },
          scriptLengthMin: { type: 'number', description: 'Assert script content length is at least this value' },
          storyboardFrameCountMin: { type: 'number', description: 'Assert storyboard has at least this many frames' },
          storyboardGeneratedMin: { type: 'number', description: 'Assert at least this many storyboard frames have images' },
          view: { type: 'string', description: 'Assert current view matches (e.g. "script", "storyboard", "preprod")' },
          modalOpen: { type: 'string', description: 'Assert a specific modal is open (e.g. "projects-modal", "setup-assistant-modal")' },
          noModalOpen: { type: 'boolean', description: 'Assert no modal is open' },
        },
      },
    },
    {
      name: 'run_scenario',
      description: 'Run a test scenario from a JSON definition. Scenarios define steps with actions (create_project, write_script, generate_storyboard, assert_state) and optional polling waits.',
      inputSchema: {
        type: 'object',
        properties: {
          scenario: {
            type: 'string',
            description: 'JSON scenario object or path to scenario file. Scenario format: { "name": "...", "steps": [{"action": "create_project", "args": {...}}, {"action": "assert_state", "args": {...}, "pollMs": 1000}] }',
          },
        },
        required: ['scenario'],
      },
    },
    {
      name: 'run_vitest',
      description: 'Run Vitest tests from the MCP server. Executes "npm test" in the source directory and returns results.',
      inputSchema: {
        type: 'object',
        properties: {
          testFile: { type: 'string', description: 'Optional test file pattern to run (e.g. "project-service.test.ts")' },
        },
      },
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

  // ── create_project ──────────────────────────────────────────────
  if (name === 'create_project') {
    const projectName = args.name ? String(args.name) : '';
    const aspectRatio = args.aspectRatio ? String(args.aspectRatio) : '2.39:1';
    const resolution = args.resolution ? String(args.resolution) : '';
    const frameRate = args.frameRate ? String(args.frameRate) : '24';
    const colorSpace = args.colorSpace ? String(args.colorSpace) : 'Rec.709';

    await sendCommand('project', ['new']);
    await new Promise((r) => setTimeout(r, 500));

    await sendCommand('fill', ['[data-cg-testid="wizard-aspect-ratio"]', aspectRatio]);
    await sendCommand('fill', ['[data-cg-testid="wizard-fps"]', frameRate]);
    await sendCommand('fill', ['[data-cg-testid="wizard-colorspace"]', colorSpace]);

    if (projectName) {
      await sendCommand('fill', ['[data-cg-testid="wizard-project-name"]', projectName]);
    }
    if (resolution) {
      await sendCommand('fill', ['[data-cg-testid="wizard-resolution"]', resolution]);
    }

    await sendCommand('click', ['[data-cg-testid="wizard-next"]']);
    await new Promise((r) => setTimeout(r, 300));
    await sendCommand('click', ['[data-cg-testid="wizard-next"]']);
    await new Promise((r) => setTimeout(r, 1000));

    return { content: [{ type: 'text', text: JSON.stringify({ ok: true, action: 'create_project', name: projectName || 'Untitled' }, null, 2) }] };
  }

  // ── switch_project ─────────────────────────────────────────────
  if (name === 'switch_project') {
    const projectId = String(args.projectId ?? '');
    if (!projectId) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: 'projectId is required' }) }] };
    }

    await sendCommand('project', ['open']);
    await new Promise((r) => setTimeout(r, 500));
    await sendCommand('click', [`[data-cg-testid="open-project-${projectId}"]`]);

    return { content: [{ type: 'text', text: JSON.stringify({ ok: true, action: 'switch_project', projectId }, null, 2) }] };
  }

  // ── write_script ──────────────────────────────────────
  if (name === 'write_script') {
    const content = String(args.content ?? '');
    const mode = String(args.mode ?? 'set');

    if (!content && mode === 'set') {
      return { content: [{ type: 'text', text: JSON.stringify({ error: 'content is required for set mode' }) }] };
    }

    if (mode === 'set') {
      // Escape content for JS string literal, then call setScriptContent via evaluate
      const escaped = content
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r');
      await sendCommand('evaluate', [expr]);
      return { content: [{ type: 'text', text: JSON.stringify({ ok: true, action: 'set', length: content.length }) }] };
    } else if (mode === 'append') {
      // Read current content, append, then set via evaluate
      const result = await sendCommand('script', ['get']);
      const parsed = JSON.parse(result.content?.[0]?.text || '{}');
      const currentText = parsed.content?.text || '';
      const newContent = currentText + '\n' + content;
      const escaped = newContent
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(//g, '\\n')
        .replace(//g, '\\r');
      const expr = `window.setScriptContent("${escaped}")`;
      await sendCommand('evaluate', [expr]);
      return { content: [{ type: 'text', text: JSON.stringify({ ok: true, action: 'append', length: newContent.length }) }] };
    }
  }

  // ── generate_references ──────────────────────────────────────
  if (name === 'generate_references') {
    return await sendCommand('click', ['[data-cg-testid="generate-references"]']);
  }

  // ── generate_storyboard ──────────────────────────────────────
  if (name === 'generate_storyboard') {
    return await sendCommand('click', ['[data-cg-testid="generate-scene-frames"]']);
  }

  // ── get_script_state ─────────────────────────────────────────
  if (name === 'get_script_state') {
    return await sendCommand('script', ['state']);
  }

  // ── get_storyboard_state ────────────────────────────────────
  if (name === 'get_storyboard_state') {
    return await sendCommand('storyboard', ['state']);
  }

  // ── get_project_state ────────────────────────────────────────
  if (name === 'get_project_state') {
    return await sendCommand('readGUIState', []);
  }

  // ── assert_state ───────────────────────────────────────────
  if (name === 'assert_state') {
    const assertions = args || {};
    const results = { pass: true, assertions: {}, details: {} };

    // Get all state in parallel
    const [projResult, scriptResult, storyResult] = await Promise.all([
      sendCommand('readGUIState', []),
      sendCommand('script', ['state']),
      sendCommand('storyboard', ['state']),
    ]);

    let projState, scriptState, storyState;
    try { projState = JSON.parse(projResult.content?.[0]?.text || '{}'); } catch { projState = {}; }
    try { scriptState = JSON.parse(scriptResult.content?.[0]?.text || '{}'); } catch { scriptState = {}; }
    try { storyState = JSON.parse(storyResult.content?.[0]?.text || '{}'); } catch { storyState = {}; }

    // Assertions
    if (assertions.projectLoaded !== undefined) {
      const loaded = !!(projState.activeProjectId || projState.projectName);
      results.assertions.projectLoaded = loaded === assertions.projectLoaded;
        .replace(/\n/g, '\\n')

    if (assertions.projectName !== undefined) {
      const name = (projState.projectName || '').toLowerCase();
      const expected = String(assertions.projectName).toLowerCase();
      results.assertions.projectName = name.includes(expected);
        .replace(/\n/g, '\\n')

    if (assertions.hasScript !== undefined) {
      results.assertions.hasScript = scriptState.hasContent === assertions.hasScript;
        .replace(/\n/g, '\\n')

    if (assertions.scriptLengthMin !== undefined) {
      results.assertions.scriptLengthMin = (scriptState.contentLength || 0) >= assertions.scriptLengthMin;
        .replace(/\n/g, '\\n')

    if (assertions.storyboardFrameCountMin !== undefined) {
      results.assertions.storyboardFrameCountMin = (storyState.frameCount || 0) >= assertions.storyboardFrameCountMin;
        .replace(/\n/g, '\\n')

    if (assertions.storyboardGeneratedMin !== undefined) {
      results.assertions.storyboardGeneratedMin = (storyState.completed || 0) >= assertions.storyboardGeneratedMin;
        .replace(/\n/g, '\\n')

    if (assertions.view !== undefined) {
      results.assertions.view = (projState.currentView || '').toLowerCase() === String(assertions.view).toLowerCase();
        .replace(/\n/g, '\\n')

    if (assertions.modalOpen !== undefined) {
      results.assertions.modalOpen = (projState.openModal || '') === assertions.modalOpen;
        .replace(/\n/g, '\\n')

    if (assertions.noModalOpen !== undefined) {
      results.assertions.noModalOpen = !projState.openModal === assertions.noModalOpen;
        .replace(/\n/g, '\\n')

    results.details = { projState, scriptState, storyState };
    return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
  }

  // ── run_scenario ───────────────────────────────────────────
  if (name === 'run_scenario') {
    const scenarioStr = String(args.scenario || '');
    let scenario;
    try {
      // Try parsing as JSON directly
      scenario = JSON.parse(scenarioStr);
    } catch {
      // Try loading as a file path
      try {
        const fs = await import('fs/promises');
        const fileContent = await fs.readFile(scenarioStr, 'utf8');
        scenario = JSON.parse(fileContent);
      } catch (e) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: `Failed to parse scenario: ${e.message}` }) }] };
      }
    }

    const steps = scenario.steps || [];
    const stepResults = [];

    for (const step of steps) {
      const action = step.action;
      const stepArgs = step.args || {};
      const pollMs = step.pollMs || 0;
      const timeoutMs = step.timeoutMs || 30000;

      const stepStart = Date.now();
      let stepResult;

      // Execute the action
      if (action === 'create_project') {
        stepResult = await sendCommand('create_project', stepArgs);
      } else if (action === 'switch_project') {
        stepResult = await sendCommand('switch_project', stepArgs);
      } else if (action === 'write_script') {
        stepResult = await sendCommand('write_script', stepArgs);
      } else if (action === 'generate_references') {
        stepResult = await sendCommand('generate_references', stepArgs);
      } else if (action === 'generate_storyboard') {
        stepResult = await sendCommand('generate_storyboard', stepArgs);
      } else if (action === 'assert_state') {
        // Poll for assertion if pollMs is set
        if (pollMs > 0) {
          const pollStart = Date.now();
          let assertResult;
          while (Date.now() - pollStart < timeoutMs) {
            assertResult = await sendCommand('assert_state', stepArgs);
            try {
              const parsed = JSON.parse(assertResult.content?.[0]?.text || '{}');
              if (parsed.pass) break;
            } catch { /* ignore */ }
            await new Promise((r) => setTimeout(r, pollMs));
          }
          stepResult = assertResult;
        } else {
          stepResult = await sendCommand('assert_state', stepArgs);
        }
      } else if (action === 'waitFor') {
        stepResult = await sendCommand('waitFor', stepArgs);
      } else {
        stepResult = { content: [{ type: 'text', text: JSON.stringify({ error: `Unknown action: ${action}` }) }] };
      }

      stepResults.push({
        action,
        args: stepArgs,
        result: stepResult.content?.[0]?.text || 'no response',
        durationMs: Date.now() - stepStart,
      });

      // Check if assertion failed and stop if needed
        .replace(/\n/g, '\\n')
          const parsed = JSON.parse(stepResult.content?.[0]?.text || '{}');
          if (!parsed.pass) {
        .replace(/\n/g, '\\n')
        } catch { /* ignore */ }
      }
    }

    return { content: [{ type: 'text', text: JSON.stringify({ ok: true, steps: stepResults }, null, 2) }] };
  }

  // ── run_vitest ─────────────────────────────────────────────
  if (name === 'run_vitest') {
    const { exec } = await import('child_process');
    const testFile = args.testFile ? String(args.testFile) : '';
    const cmd = testFile ? `cd "${process.cwd()}" && npx vitest run ${testFile}` : `cd "${process.cwd()}" && npm test`;

    return new Promise((resolve) => {
      exec(cmd, { timeout: 120000 }, (error, stdout, stderr) => {
        const output = stdout + '\n' + stderr;
        resolve({
          content: [{
            type: 'text',
            text: JSON.stringify({
              ok: !error,
              exitCode: error?.code || 0,
              output: output.slice(0, 10000),
            }, null, 2),
          }],
        });
      });
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
