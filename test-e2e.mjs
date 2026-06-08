#!/usr/bin/env node
// End-to-end test: kills old MCP server, starts new one, waits for browser reconnect
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { execSync } from 'child_process';

const PORT = 3456;

// 1. Kill anything using port 3456
console.log('[Test] Killing old processes on port 3456...');
try { execSync(`lsof -ti:${PORT} | xargs kill -9 2>/dev/null || true`, { timeout: 5000 }); } catch {}
await new Promise(r => setTimeout(r, 2000));

// 2. Start MCP server (stdio transport - spawned by StdioClientTransport)
console.log('[Test] Starting MCP server and connecting client...\n');
const transport = new StdioClientTransport({
  command: 'node',
  args: ['backends/mcp-server.js'],
});

const client = new Client(
  { name: 'e2e-test', version: '1.0.0' },
  { capabilities: {} }
);

await client.connect(transport);
console.log('[Test] Connected to MCP server\n');

// 3. Wait for browser to reconnect (auto-reconnect after 3000ms)
console.log('[Test] Waiting for browser to reconnect (10s timeout)...');
let browserConnected = false;
for (let i = 0; i < 20; i++) {
  await new Promise(r => setTimeout(r, 500));
  try {
    const result = await client.callTool({ name: 'get_project_state', arguments: {} });
    const text = result.content?.[0]?.text || '';
    if (!text.includes('No CineGen app window')) {
      browserConnected = true;
      console.log('[Test] Browser connected!\n');
      break;
    }
  } catch {}
}
if (!browserConnected) {
  console.log('[Test] Browser not connected - will run offline tests\n');
}

// 4. Run tests
let passed = 0, failed = 0;
const test = async (name, fn) => {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ✗ ${name}: ${e.message}`);
    failed++;
  }
};

await test('List tools (≥15)', async () => {
  const { tools } = await client.listTools();
  if (tools.length < 15) throw new Error(`Got ${tools.length}`);
});

await test('get_project_state returns JSON', async () => {
  const result = await client.callTool({ name: 'get_project_state', arguments: {} });
  const text = result.content?.[0]?.text || '';
  JSON.parse(text);
});

await test('get_script_state returns JSON', async () => {
  const result = await client.callTool({ name: 'get_script_state', arguments: {} });
  const text = result.content?.[0]?.text || '';
  JSON.parse(text);
});

await test('get_storyboard_state returns JSON', async () => {
  const result = await client.callTool({ name: 'get_storyboard_state', arguments: {} });
  const text = result.content?.[0]?.text || '';
  JSON.parse(text);
});

await test('assert_state with no assertions returns pass:true', async () => {
  const result = await client.callTool({ name: 'assert_state', arguments: { } });
  const parsed = JSON.parse(result.content?.[0]?.text || '{}');
  if (parsed.pass !== true) throw new Error('Expected pass:true');
});

await test('run_vitest executes tests', async () => {
  const result = await client.callTool({ name: 'run_vitest', arguments: {} });
  const parsed = JSON.parse(result.content?.[0]?.text || '{}');
  if (typeof parsed.ok !== 'boolean') throw new Error('Expected ok boolean');
}, 30000);

console.log(`\n[Test] Results: ${passed} passed, ${failed} failed`);
await client.close();
process.exit(failed > 0 ? 1 : 0);
