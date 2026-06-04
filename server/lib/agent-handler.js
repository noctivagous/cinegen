import path from 'node:path';
import fs from 'node:fs';
import { AGENT_STATIC_ROUTES } from '../../src/constants/agent-routes.js';
import {
  corsHeaders,
  json,
  readBody,
  __dirname,
} from './proxy-utils.js';

let _agentModule = null;

export function setAgentAgentModule(mod) {
  _agentModule = mod;
}

async function getAgentModule() {
  if (!_agentModule) {
    _agentModule = await import('../../backends/agents/mastra.js');
  }
  return _agentModule;
}

async function getProductionContextHelpers() {
  if (!_pcHelpers) {
    const mod = await import('../../backends/agents/tools/production-context.tool.js');
    _pcHelpers = {
      loadProductionContext: (projectId) => {
        const all = (() => {
          try {
            const p = path.join(__dirname, 'production-context.json');
            if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf-8'));
          } catch { /* ignore */ }
          return {};
        })();
        return all[projectId] ?? null;
      },
      updateProductionContext: (projectId, update) => {
        const p = path.join(__dirname, 'production-context.json');
        let all = {};
        try {
          if (fs.existsSync(p)) all = JSON.parse(fs.readFileSync(p, 'utf-8'));
        } catch { /* ignore */ }
        const existing = all[projectId] || { projectId, updatedAt: new Date().toISOString() };
        function deepMerge(t, s) {
          const r = { ...t };
          for (const [k, v] of Object.entries(s)) {
            if (v !== null && typeof v === 'object' && !Array.isArray(v)) r[k] = deepMerge(r[k] || {}, v);
            else r[k] = v;
          }
          return r;
        }
        all[projectId] = deepMerge(existing, { ...update, updatedAt: new Date().toISOString() });
        fs.writeFileSync(p, JSON.stringify(all, null, 2), 'utf-8');
      },
    };
  }
  return _pcHelpers;
}

let _pcHelpers = null;

export async function handleAgentApi(req, res) {
  const origin = req.headers['origin'] || 'null';
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders(origin));
    res.end();
    return;
  }

  const url = req.url || '';

  if (url === AGENT_STATIC_ROUTES.SCRIPT_ANALYZE && req.method === 'POST') {
    let body;
    try {
      body = await readBody(req);
    } catch {
      json(res, 400, { error: 'Invalid JSON body' });
      return;
    }
    const { projectId, fountainText } = body;
    if (!projectId || !fountainText) {
      json(res, 400, { error: 'projectId and fountainText are required' });
      return;
    }
    try {
      const { getMastra } = await getAgentModule();
      const mastra = await getMastra();
      const agent = mastra.getAgentById('scriptAgent');
      const prompt =
        `Analyze the following Fountain screenplay for project "${projectId}".\n\n` +
        `Return a complete ScriptAnalysisOutput JSON object.\n\n` +
        `PROJECT ID: ${projectId}\n\n` +
        `FOUNTAIN SCRIPT:\n${fountainText}`;
      const result = await agent.generate(prompt, {
        output: 'object',
      });
      json(res, 200, { ok: true, projectId, data: result.object ?? result.text });
    } catch (err) {
      console.error('[cinegen/agents] script/analyze error:', err.message);
      json(res, 503, { error: err.message });
    }
    return;
  }

  if (url === AGENT_STATIC_ROUTES.CASTING_BUILD_GUIDES && req.method === 'POST') {
    let body;
    try { body = await readBody(req); } catch { json(res, 400, { error: 'Invalid JSON body' }); return; }
    const { projectId, characters } = body;
    if (!projectId) { json(res, 400, { error: 'projectId is required' }); return; }
    try {
      const { getMastra } = await getAgentModule();
      const mastra = await getMastra();
      const agent = mastra.getAgentById('characterCastingAgent');
      const charList = Array.isArray(characters)
        ? characters.map((c) => `- ${c.name} (${c.role}): ${c.description}`).join('\n')
        : '(read from ProductionContext)';
      const result = await agent.generate(
        `Build character guides for project "${projectId}".\nCharacters:\n${charList}`,
      );
      json(res, 200, { ok: true, projectId, data: result.text });
    } catch (err) {
      console.error('[cinegen/agents] casting/build-guides error:', err.message);
      json(res, 503, { error: err.message });
    }
    return;
  }

  if (url === AGENT_STATIC_ROUTES.PRODUCTION_DESIGN_BUILD_GUIDES && req.method === 'POST') {
    let body;
    try { body = await readBody(req); } catch { json(res, 400, { error: 'Invalid JSON body' }); return; }
    const { projectId, locations } = body;
    if (!projectId) { json(res, 400, { error: 'projectId is required' }); return; }
    try {
      const { getMastra } = await getAgentModule();
      const mastra = await getMastra();
      const agent = mastra.getAgentById('locationSetAgent');
      const locList = Array.isArray(locations)
        ? locations.map((l) => `- ${l.name} (${l.intExt}): ${l.description}`).join('\n')
        : '(read from ProductionContext)';
      const result = await agent.generate(
        `Build location guides for project "${projectId}".\nLocations:\n${locList}`,
      );
      json(res, 200, { ok: true, projectId, data: result.text });
    } catch (err) {
      console.error('[cinegen/agents] production-design/build-guides error:', err.message);
      json(res, 503, { error: err.message });
    }
    return;
  }

  if (url === AGENT_STATIC_ROUTES.STORYBOARD_GENERATE && req.method === 'POST') {
    let body;
    try { body = await readBody(req); } catch { json(res, 400, { error: 'Invalid JSON body' }); return; }
    const { projectId, shotIds } = body;
    if (!projectId) { json(res, 400, { error: 'projectId is required' }); return; }
    try {
      const { getMastra } = await getAgentModule();
      const mastra = await getMastra();
      const agent = mastra.getAgentById('storyboardAgent');
      const scope = Array.isArray(shotIds) && shotIds.length
        ? `for shot IDs: ${shotIds.join(', ')}`
        : 'for all pending shots';
      const result = await agent.generate(
        `Generate storyboard frames for project "${projectId}" ${scope}.`,
      );
      json(res, 200, { ok: true, projectId, data: result.text });
    } catch (err) {
      console.error('[cinegen/agents] storyboard/generate error:', err.message);
      json(res, 503, { error: err.message });
    }
    return;
  }

  if (url === AGENT_STATIC_ROUTES.BEAT_BOARD_GENERATE_OUTLINE && req.method === 'POST') {
    let body;
    try { body = await readBody(req); } catch { json(res, 400, { error: 'Invalid JSON body' }); return; }
    const { projectId, beats, characters, locations } = body;
    if (!projectId) { json(res, 400, { error: 'projectId is required' }); return; }
    if (!beats || !Array.isArray(beats) || beats.length === 0) {
      json(res, 400, { error: 'beats array is required and must not be empty' }); return;
    }
    try {
      const { getMastra } = await getAgentModule();
      const mastra = await getMastra();
      const agent = mastra.getAgentById('beatOutlineAgent');
      const beatText = beats.map((b, i) =>
        `Beat ${i + 1}: ${b.title || 'Untitled'}\n${b.description || ''}${b.cameraNotes ? `\n[Camera: ${b.cameraNotes}]` : ''}`
      ).join('\n\n');
      const charText = (characters || []).map(c => `- ${c.name}${c.description ? `: ${c.description}` : ''}`).join('\n');
      const locText = (locations || []).map(l => `- ${l.name} (${l.intExt || 'INT/EXT'})`).join('\n');
      const prompt = [
        `Generate a Fountain-format script outline for project "${projectId}" based on these beats:`,
        '',
        beatText,
        '',
        charText ? `Characters:\n${charText}` : '',
        locText ? `Locations:\n${locText}` : '',
        '',
        'Output JSON with outline (Fountain text), sceneCount, detectedCharacters, and detectedLocations.',
      ].filter(Boolean).join('\n');
      const result = await agent.generate(prompt);
      json(res, 200, { ok: true, projectId, data: result.object || result.text });
    } catch (err) {
      console.error('[cinegen/agents] beat-board/generate-outline error:', err.message);
      json(res, 503, { error: err.message });
    }
    return;
  }

  if (url === AGENT_STATIC_ROUTES.CINEMATOGRAPHY_BUILD_PROMPT && req.method === 'POST') {
    let body;
    try { body = await readBody(req); } catch { json(res, 400, { error: 'Invalid JSON body' }); return; }
    const { projectId, shotId, preferredProvider } = body;
    if (!projectId || !shotId) { json(res, 400, { error: 'projectId and shotId are required' }); return; }
    try {
      const { getMastra } = await getAgentModule();
      const mastra = await getMastra();
      const agent = mastra.getAgentById('promptEngineerAgent');
      const result = await agent.generate(
        `Build an optimized generation prompt for shot "${shotId}" in project "${projectId}".` +
        (preferredProvider ? ` Preferred provider: ${preferredProvider}.` : ''),
      );
      json(res, 200, { ok: true, projectId, shotId, data: result.text });
    } catch (err) {
      console.error('[cinegen/agents] cinematography/build-prompt error:', err.message);
      json(res, 503, { error: err.message });
    }
    return;
  }

  if (url === AGENT_STATIC_ROUTES.CINEMATOGRAPHY_ROUTE_SHOT && req.method === 'POST') {
    let body;
    try { body = await readBody(req); } catch { json(res, 400, { error: 'Invalid JSON body' }); return; }
    const { projectId, shotId, shotType } = body;
    if (!projectId) { json(res, 400, { error: 'projectId is required' }); return; }
    try {
      const { getMastra } = await getAgentModule();
      const mastra = await getMastra();
      const agent = mastra.getAgentById('generationAgent');
      const result = await agent.generate(
        `Process generation job for shot "${shotId || 'next queued'}" (type: ${shotType || 'reliable-default'}) ` +
        `in project "${projectId}". Determine provider, log cost estimate.`,
      );
      json(res, 200, { ok: true, projectId, data: result.text });
    } catch (err) {
      console.error('[cinegen/agents] cinematography/route-shot error:', err.message);
      json(res, 503, { error: err.message });
    }
    return;
  }

  if (url === AGENT_STATIC_ROUTES.CINEMATOGRAPHY_AUDIT_CLIP && req.method === 'POST') {
    let body;
    try { body = await readBody(req); } catch { json(res, 400, { error: 'Invalid JSON body' }); return; }
    const { projectId, shotId, clipDescription } = body;
    if (!projectId || !shotId) { json(res, 400, { error: 'projectId and shotId are required' }); return; }
    try {
      const { getMastra } = await getAgentModule();
      const mastra = await getMastra();
      const agent = mastra.getAgentById('consistencyAuditorAgent');
      const result = await agent.generate(
        `Audit the generated clip for shot "${shotId}" in project "${projectId}". ` +
        (clipDescription ? `Clip description: ${clipDescription}` : 'Check against ProductionContext references.'),
      );
      json(res, 200, { ok: true, projectId, shotId, data: result.text });
    } catch (err) {
      console.error('[cinegen/agents] audit-clip error:', err.message);
      json(res, 503, { error: err.message });
    }
    return;
  }

  if (url === AGENT_STATIC_ROUTES.CINEMATOGRAPHY_ANNOTATE_SPATIAL && req.method === 'POST') {
    let body;
    try { body = await readBody(req); } catch { json(res, 400, { error: 'Invalid JSON body' }); return; }
    const { projectId, shotId, annotations, provider } = body;
    if (!projectId || !shotId) { json(res, 400, { error: 'projectId and shotId are required' }); return; }
    try {
      const { getMastra } = await getAgentModule();
      const mastra = await getMastra();
      const agent = mastra.getAgentById('spatialAnnotationAgent');
      const annotationStr = JSON.stringify(annotations || {}, null, 2);
      const result = await agent.generate(
        `Translate spatial annotations for shot "${shotId}" in project "${projectId}" ` +
        `targeting ${provider || 'veo'} provider.\nAnnotations: ${annotationStr}`,
      );
      json(res, 200, { ok: true, projectId, shotId, data: result.text });
    } catch (err) {
      console.error('[cinegen/agents] annotate-spatial error:', err.message);
      json(res, 503, { error: err.message });
    }
    return;
  }

  if (url === AGENT_STATIC_ROUTES.SOUND_PREPARE_AUDIO && req.method === 'POST') {
    let body;
    try { body = await readBody(req); } catch { json(res, 400, { error: 'Invalid JSON body' }); return; }
    const { projectId } = body;
    if (!projectId) { json(res, 400, { error: 'projectId is required' }); return; }
    try {
      const { getMastra } = await getAgentModule();
      const mastra = await getMastra();
      const agent = mastra.getAgentById('audioAgent');
      const result = await agent.generate(
        `Prepare the complete audio assembly plan for project "${projectId}". ` +
        `Analyze all scenes, spot dialogue TTS requests, SFX cues, and music cues.`,
      );
      json(res, 200, { ok: true, projectId, data: result.text });
    } catch (err) {
      console.error('[cinegen/agents] sound/prepare-audio error:', err.message);
      json(res, 503, { error: err.message });
    }
    return;
  }

  if (url === AGENT_STATIC_ROUTES.POST_ASSEMBLE_SEQUENCE && req.method === 'POST') {
    let body;
    try { body = await readBody(req); } catch { json(res, 400, { error: 'Invalid JSON body' }); return; }
    const { projectId, targetDurationSeconds } = body;
    if (!projectId) { json(res, 400, { error: 'projectId is required' }); return; }
    try {
      const { getMastra } = await getAgentModule();
      const mastra = await getMastra();
      const agent = mastra.getAgentById('sequenceAssemblyAgent');
      const result = await agent.generate(
        `Assemble the sequence for project "${projectId}". ` +
        (targetDurationSeconds ? `Target duration: ${targetDurationSeconds} seconds. ` : '') +
        'Arrange approved clips in story order, plan transitions and stitching.',
      );
      json(res, 200, { ok: true, projectId, data: result.text });
    } catch (err) {
      console.error('[cinegen/agents] post/assemble-sequence error:', err.message);
      json(res, 503, { error: err.message });
    }
    return;
  }

  if (url === AGENT_STATIC_ROUTES.POST_COLOR_GRADE && req.method === 'POST') {
    let body;
    try { body = await readBody(req); } catch { json(res, 400, { error: 'Invalid JSON body' }); return; }
    const { projectId } = body;
    if (!projectId) { json(res, 400, { error: 'projectId is required' }); return; }
    try {
      const { getMastra } = await getAgentModule();
      const mastra = await getMastra();
      const agent = mastra.getAgentById('finishColorAgent');
      const result = await agent.generate(
        `Analyze and prepare color grading for project "${projectId}". ` +
        'Match the StyleGuide, flag inconsistencies, suggest corrections.',
      );
      json(res, 200, { ok: true, projectId, data: result.text });
    } catch (err) {
      console.error('[cinegen/agents] post/color-grade error:', err.message);
      json(res, 503, { error: err.message });
    }
    return;
  }

  if (url === AGENT_STATIC_ROUTES.VISUAL_IDENTIFY && req.method === 'POST') {
    let body;
    try { body = await readBody(req); } catch { json(res, 400, { error: 'Invalid JSON body' }); return; }
    const { projectId, images } = body;
    if (!projectId || !Array.isArray(images)) { json(res, 400, { error: 'projectId and images array are required' }); return; }
    try {
      const { getMastra } = await getAgentModule();
      const mastra = await getMastra();
      const agent = mastra.getAgentById('visualAnalysisAgent');
      const summary = images.map((img) => `Image category: ${img.category || 'unknown'}`).join('\n');
      const result = await agent.generate(
        `Analyze the following uploaded images for project "${projectId}".\n\n${summary}\n\n` +
        'Identify characters (name, description, role), locations (name, description, INT/EXT), and props (name, description).\n' +
        'Return a JSON object with "characters", "locations", and "props" arrays.',
        { output: 'object' },
      );
      json(res, 200, result.object ?? { characters: [], locations: [], props: [] });
    } catch (err) {
      console.error('[cinegen/agents] visual/identify error:', err.message);
      json(res, 503, { error: err.message });
    }
    return;
  }

  if (url === AGENT_STATIC_ROUTES.VISUAL_EXTRACT_COLORS && req.method === 'POST') {
    let body;
    try { body = await readBody(req); } catch { json(res, 400, { error: 'Invalid JSON body' }); return; }
    const { projectId, images } = body;
    if (!projectId || !Array.isArray(images)) { json(res, 400, { error: 'projectId and images array are required' }); return; }
    try {
      const { extractDominantColors } = await import('../../backends/agents/visual/color-extractor.js');
      const result = await extractDominantColors(images, 6);
      json(res, 200, result);
    } catch (err) {
      console.error('[cinegen/agents] visual/extract-colors error:', err.message);
      json(res, 503, { error: err.message });
    }
    return;
  }

  if (url === AGENT_STATIC_ROUTES.SCRIPT_GENERATE_OUTLINE && req.method === 'POST') {
    let body;
    try { body = await readBody(req); } catch { json(res, 400, { error: 'Invalid JSON body' }); return; }
    const { projectId, characters, locations, style } = body;
    if (!projectId) { json(res, 400, { error: 'projectId is required' }); return; }
    try {
      const { getMastra } = await getAgentModule();
      const mastra = await getMastra();
      const agent = mastra.getAgentById('scriptAgent');
      const charText = Array.isArray(characters) ? characters.map((c) => `- ${c.name} (${c.role}): ${c.description}`).join('\n') : '(none provided)';
      const locText = Array.isArray(locations) ? locations.map((l) => `- ${l.name} (${l.intExt}): ${l.description}`).join('\n') : '(none provided)';
      const styleText = style ? `Palette: ${(style.palette || []).join(', ')}\nMood: ${style.mood || 'N/A'}\nNotes: ${style.notes || 'N/A'}` : '(none provided)';
      const result = await agent.generate(
        `Generate a Fountain-format script outline for project "${projectId}" based on the following visual context.\n\n` +
        `CHARACTERS:\n${charText}\n\nLOCATIONS:\n${locText}\n\nSTYLE:\n${styleText}\n\n` +
        'Create a short outline with scene headings, brief action descriptions, and character appearances. Return as a "outline" string field in JSON.',
        { output: 'object' },
      );
      json(res, 200, { outline: (result.object?.outline ?? result.text) || '' });
    } catch (err) {
      console.error('[cinegen/agents] script/generate-outline error:', err.message);
      json(res, 503, { error: err.message });
    }
    return;
  }

  if (url === AGENT_STATIC_ROUTES.CONCEPT_GENERATE_CONCEPTS && req.method === 'POST') {
    let body;
    try { body = await readBody(req); } catch { json(res, 400, { error: 'Invalid JSON body' }); return; }
    const { projectId, moodDescription, vibe, colorPalette, sceneSettings, lightingDesc, atmosphereNotes, atmosphereTags, imageDataUrls } = body;
    if (!projectId) { json(res, 400, { error: 'projectId is required' }); return; }
    try {
      const { getMastra } = await getAgentModule();
      const mastra = await getMastra();
      const agent = mastra.getAgentById('conceptAnalysisAgent');
      const prompt = [
        `Generate conceptual film elements for project "${projectId}".`,
        moodDescription ? `\n\nMOOD DESCRIPTION:\n${moodDescription}` : '',
        vibe ? `\n\nVIBE SLIDERS:\nTemperature: ${vibe.temperature ?? 0}/5 (cool→warm)\nTension: ${vibe.tension ?? 0}/5 (peaceful→tense)\nLighting: ${vibe.lighting ?? 0}/5 (night→day)\nEnergy: ${vibe.energy ?? 0}/5 (calm→energetic)\nStylization: ${vibe.stylization ?? 50}/100 (grounded→stylized)` : '',
        Array.isArray(colorPalette) && colorPalette.length ? `\n\nCOLOR HINTS:\n${colorPalette.join(', ')}` : '',
        sceneSettings ? `\n\nSCENE SETTINGS:\n${sceneSettings}` : '',
        lightingDesc ? `\n\nLIGHTING NOTES:\n${lightingDesc}` : '',
        atmosphereNotes ? `\n\nATMOSPHERE NOTES:\n${atmosphereNotes}` : '',
        Array.isArray(atmosphereTags) && atmosphereTags.length ? `\n\nATMOSPHERE TAGS:\n${atmosphereTags.join(', ')}` : '',
        Array.isArray(imageDataUrls) && imageDataUrls.length ? `\n\nREFERENCE IMAGES PROVIDED: ${imageDataUrls.length} image(s) available for style context.` : '',
      ].join('');
      const result = await agent.generate(prompt, { output: 'object' });
      json(res, 200, result.object ?? {
        atmosphereTags: [], colorPalette: [], lightingMood: '', styleNotes: '',
        locations: [], archetypes: [],
      });
    } catch (err) {
      console.error('[cinegen/agents] concept/generate-concepts error:', err.message);
      json(res, 503, { error: err.message });
    }
    return;
  }

  if (url === AGENT_STATIC_ROUTES.CONCEPT_GENERATE_IMAGE && req.method === 'POST') {
    let body;
    try { body = await readBody(req); } catch { json(res, 400, { error: 'Invalid JSON body' }); return; }
    const { prompt } = body;
    if (!prompt) { json(res, 400, { error: 'prompt is required' }); return; }
    try {
      const { generateImage } = await import('../../backends/agents/concept/image-generator.js');
      const result = await generateImage(prompt);
      json(res, 200, result);
    } catch (err) {
      console.error('[cinegen/agents] concept/generate-image error:', err.message);
      json(res, 503, { error: err.message });
    }
    return;
  }

  const ctxGetMatch = url.match(/^\/api\/agents\/project\/([^/]+)\/context$/);
  if (ctxGetMatch && req.method === 'GET') {
    const projectId = decodeURIComponent(ctxGetMatch[1]);
    const { loadProductionContext } = await getProductionContextHelpers();
    json(res, 200, loadProductionContext(projectId));
    return;
  }

  const ctxPostMatch = url.match(/^\/api\/agents\/project\/([^/]+)\/context$/);
  if (ctxPostMatch && req.method === 'POST') {
    const projectId = decodeURIComponent(ctxPostMatch[1]);
    let body;
    try { body = await readBody(req); } catch {
      json(res, 400, { error: 'Invalid JSON body' });
      return;
    }
    const { updateProductionContext } = await getProductionContextHelpers();
    updateProductionContext(projectId, body);
    json(res, 200, { ok: true, projectId });
    return;
  }

  const reviewMatch = url.match(/^\/api\/agents\/project\/([^/]+)\/review-queue$/);
  if (reviewMatch && req.method === 'GET') {
    const projectId = decodeURIComponent(reviewMatch[1]);
    const { Orchestrator } = await import('../../backends/agents/orchestrator.js');
    const orch = new Orchestrator(projectId);
    json(res, 200, { projectId, items: orch.getPendingReviews() });
    return;
  }

  const approveMatch = url.match(/^\/api\/agents\/project\/([^/]+)\/review\/([^/]+)\/approve$/);
  if (approveMatch && req.method === 'POST') {
    const projectId = decodeURIComponent(approveMatch[1]);
    const itemId = decodeURIComponent(approveMatch[2]);
    let body;
    try { body = await readBody(req); } catch { body = {}; }
    const { Orchestrator } = await import('../../backends/agents/orchestrator.js');
    const orch = new Orchestrator(projectId);
    const result = await orch.approveReviewItem(itemId, body.notes || '');
    json(res, 200, { ok: true, ...result });
    return;
  }

  const rejectMatch = url.match(/^\/api\/agents\/project\/([^/]+)\/review\/([^/]+)\/reject$/);
  if (rejectMatch && req.method === 'POST') {
    const projectId = decodeURIComponent(rejectMatch[1]);
    const itemId = decodeURIComponent(rejectMatch[2]);
    let body;
    try { body = await readBody(req); } catch { body = {}; }
    const { Orchestrator } = await import('../../backends/agents/orchestrator.js');
    const orch = new Orchestrator(projectId);
    const result = await orch.rejectReviewItem(itemId, body.reason || '');
    json(res, 200, { ok: true, ...result });
    return;
  }

  if (url === AGENT_STATIC_ROUTES.HEALTH && req.method === 'GET') {
    const { resolveDefaultModel } = await getAgentModule();
    const model = resolveDefaultModel();
    json(res, 200, {
      ready: model !== null,
      provider: process.env.CINEGEN_LLM_PROVIDER || 'anthropic',
      configured: model !== null,
    });
    return;
  }

  json(res, 404, { error: `Unknown agent route: ${url}` });
}
