#!/usr/bin/env node
// Test CineGen MCP tools - wait for browser connection
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const transport = new StdioClientTransport({
  command: 'node',
  args: ['backends/mcp-server.js'],
});

const client = new Client(
  { name: 'test-client', version: '1.0.0' },
  { capabilities: {} }
);

await client.connect(transport);
console.log('Connected to CineGen MCP server\n');

// Wait for browser to connect
async function waitForBrowser(maxMs = 30000) {
  console.log('[Test] Waiting for browser to connect...');
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const result = await client.callTool({ name: 'get_project_state', arguments: {} });
    const text = result.content?.[0]?.text || '';
    if (!text.includes('No CineGen app window')) {
      console.log('[Test] Browser connected!\n');
      return true;
    }
    await new Promise(r => setTimeout(r, 500));
  }
  console.log('[Test] Timeout waiting for browser');
  return false;
}

await waitForBrowser();

console.log('\n=== Testing get_project_state ===');
const stateResult = await client.callTool({ name: 'get_project_state', arguments: {} });
console.log('Result:', stateResult.content[0].text.slice(0, 800));

console.log('\n=== Testing get_script_state ===');
const scriptResult = await client.callTool({ name: 'get_script_state', arguments: {} });
console.log('Result:', scriptResult.content[0].text.slice(0, 800));

console.log('\n=== Testing get_storyboard_state ===');
const storyResult = await client.callTool({ name: 'get_storyboard_state', arguments: {} });
console.log('Result:', storyResult.content[0].text.slice(0, 800));

console.log('\n=== Testing assert_state (project loaded, hasScript, frames>=5) ===');
const assertResult = await client.callTool({ 
  name: 'assert_state', 
  arguments: { projectLoaded: true, hasScript: true, storyboardFrameCountMin: 5 } 
});
console.log('Result:', assertResult.content[0].text.slice(0, 800));

console.log('\n=== Testing write_script (append) ===');
const writeResult = await client.callTool({ 
  name: 'write_script', 
  arguments: { content: '\n\nEXT. STREET - NIGHT\n\nJohn walks alone.', mode: 'append' } 
});
console.log('Result:', writeResult.content[0].text.slice(0, 500));

console.log('\n=== Verifying script state after append ===');
const scriptResult2 = await client.callTool({ name: 'get_script_state', arguments: {} });
console.log('Result:', scriptResult2.content[0].text.slice(0, 800));

await client.close();
console.log('\n=== All tests complete ===');