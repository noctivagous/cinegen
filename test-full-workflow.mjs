#!/usr/bin/env node
// Full end-to-end test: Create project -> Write script -> Generate references -> Generate storyboard -> Verify
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const transport = new StdioClientTransport({
  command: 'node',
  args: ['backends/mcp-server.js'],
});

const client = new Client(
  { name: 'e2e-test', version: '1.0.0' },
  { capabilities: {} }
);

await client.connect(transport);
console.log('Connected to CineGen MCP server\n');

// Poll for condition
async function pollFor(conditionFn, timeoutMs = 30000, intervalMs = 1000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = await conditionFn();
    if (result) return result;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error(`Timeout waiting for condition`);
}

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

async function ensureFountainGlobals(maxMs = 30000) {
  console.log('[Test] Ensuring fountain globals...');
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const checkResult = await client.callTool({ 
      name: 'evaluate', 
      arguments: { expression: 'typeof window.syncBreakdownFromScript === "function"' } 
    });
    const text = checkResult.content?.[0]?.text || '';
    if (text.includes('true')) {
      console.log('[Test] Globals ready!\n');
      return true;
    }
    const installResult = await client.callTool({ 
      name: 'evaluate', 
      arguments: { expression: 'typeof window.installFountainBundleGlobals === "function" ? (window.installFountainBundleGlobals(), "installed") : "not-available"' } 
    });
    const installText = installResult.content?.[0]?.text || '';
    if (installText.includes('installed')) {
      console.log('[Test] Manually installed globals!');
      await new Promise(r => setTimeout(r, 500));
      continue;
    }
    await new Promise(r => setTimeout(r, 500));
  }
  console.log('[Test] Timeout ensuring globals');
  return false;
}

async function main() {
  await waitForBrowser();
  await ensureFountainGlobals();

  console.log('\n=== STEP 1: Create new project ===');
  const createResult = await client.callTool({ 
    name: 'create_project', 
    arguments: { name: 'Test Film', aspectRatio: '16:9', frameRate: '24' } 
  });
  console.log('Result:', createResult.content[0].text.slice(0, 300));

  await new Promise(r => setTimeout(r, 3000));

  console.log('\n=== STEP 2: Write script ===');
  const script = `TITLE: "Test Film"
GENRE: Drama

INT. COFFEE SHOP - DAY

JANE (30s) sits at a corner table, typing on a laptop.

A BARISTA approaches with coffee.

BARISTA
Here you go.

JANE
Thanks.

She takes a sip, eyes never leaving the screen.

EXT. CITY STREET - DAY

Jane walks briskly, laptop bag over shoulder.

Her phone BUZZES. She checks it, stops dead.

JANE
(whispers)
No...

INT. JANE'S APARTMENT - NIGHT

Jane paces. Phone to ear.

JANE
(into phone)
I'll be there in twenty minutes.`;

  const writeResult = await client.callTool({ 
    name: 'write_script', 
    arguments: { content: script, mode: 'set' } 
  });
  console.log('Result:', writeResult.content[0].text.slice(0, 200));

  // Wait for scene parsing
  console.log('\n=== Waiting for scene parsing... ===');
  await pollFor(async () => {
    const result = await client.callTool({ name: 'get_script_state', arguments: {} });
    const parsed = JSON.parse(result.content[0].text);
    if (parsed.sceneCount > 0) return parsed;
    return null;
  }, 30000);

  console.log('\n=== STEP 3: Verify script state ===');
  const scriptState = await client.callTool({ name: 'get_script_state', arguments: {} });
  console.log('Result:', scriptState.content[0].text.slice(0, 500));

  console.log('\n=== STEP 4: Generate references ===');
  const refResult = await client.callTool({ name: 'generate_references', arguments: {} });
  console.log('Result:', refResult.content[0].text.slice(0, 200));

  await new Promise(r => setTimeout(r, 15000));

  console.log('\n=== STEP 5: Generate storyboard frames ===');
  const frameResult = await client.callTool({ name: 'generate_storyboard', arguments: {} });
  console.log('Result:', frameResult.content[0].text.slice(0, 200));

  await new Promise(r => setTimeout(r, 30000));

  console.log('\n=== STEP 6: Final verification ===');
  const finalState = await client.callTool({ 
    name: 'assert_state', 
    arguments: { 
      projectLoaded: true, 
      hasScript: true, 
      storyboardFrameCountMin: 5 
    } 
  });
  console.log('Result:', finalState.content[0].text.slice(0, 800));

  await client.close();
  console.log('\n=== Full workflow test complete ===');
}

main().catch(console.error);