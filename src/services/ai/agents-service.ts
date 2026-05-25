/**
 * source/src/services/ai/agents-service.ts
 *
 * Client-side service for calling the CineGen Agent API endpoints.
 * All requests go through /api/agents/* which is handled by the Node proxy server
 * (source/server/proxy.js) and routed to the Mastra agent layer (backends/agents/).
 *
 * This service is the frontend integration layer for:
 *   - Script Agent (Production Office)
 *   - ProductionContext read/write
 *   - AI Director review queue (approve/reject)
 *   - Agent health check
 *
 * Used by:
 *   - Entry-point wizards (Start-from-Script, Visual-First, etc.)
 *   - Department panels (Production Office, AI Director)
 *   - setup-assistant-bundle.ts (future: post-setup script import step)
 */

// ── Types (mirrors backends/agents/tools/production-context.tool.js schemas) ──

export interface StyleGuide {
  colorPalette?: string;
  lightingMood?: string;
  lensStyle?: string;
  visualTone?: string;
  styleReference?: string;
}

export interface CharacterBibleEntry {
  id: string;
  name: string;
  role: 'protagonist' | 'antagonist' | 'supporting' | 'extra';
  physicalDescription: string;
  performanceNotes: string;
  sceneAppearances: string[];
  references: {
    face?: string;
    body?: string;
    profile?: string;
    threeQuarter?: string;
    closeUp?: string;
    costume: string[];
  };
  voice: {
    provider: 'elevenlabs';
    voiceId: string;
    previewUrl?: string;
  } | null;
}

export interface LocationBibleEntry {
  id: string;
  name: string;
  intExt: 'INT' | 'EXT' | 'INT/EXT';
  description: string;
  atmosphere: string;
  references: string[];
  sceneAppearances: string[];
}

export interface Shot {
  id: string;
  sceneId: string;
  number: number;
  description: string;
  type: 'Master Shot' | 'Coverage' | 'B-Roll' | 'Pickup' | 'Insert';
  cameraAngle: string;
  cameraMovement: string;
  lens: string;
  characters: string[];
  purpose: string;
  status: 'pending' | 'generating' | 'generated' | 'approved' | 'rejected';
}

export interface ReviewItem {
  id: string;
  type: 'shot-list' | 'storyboard' | 'clip' | 'character' | 'location' | 'audio' | 'rough-cut';
  department: string;
  referenceId: string;
  title: string;
  status: 'pending' | 'approved' | 'rejected';
  notes: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface ProductionContext {
  projectId: string;
  updatedAt: string;
  styleGuide: StyleGuide;
  characterBible: CharacterBibleEntry[];
  locationBible: LocationBibleEntry[];
  shotList: Shot[];
  generationQueue: unknown[];
  reviewQueue: ReviewItem[];
  approvedClips: unknown[];
  generationLog: Array<{
    id: string;
    event: string;
    agentId: string;
    payload?: Record<string, unknown>;
    timestamp: string;
  }>;
}

export interface ScriptAnalysisResult {
  projectId: string;
  totalScenes: number;
  characters: Array<{
    name: string;
    role: 'protagonist' | 'antagonist' | 'supporting' | 'extra';
    description: string;
    sceneAppearances: string[];
  }>;
  locations: Array<{
    name: string;
    intExt: 'INT' | 'EXT' | 'INT/EXT';
    description: string;
    sceneAppearances: string[];
  }>;
  shotList: Shot[];
  reviewGateId: string;
  summary: string;
}

export interface AgentHealthStatus {
  ready: boolean;
  provider: string;
  configured: boolean;
}

// ── Base URL helper ───────────────────────────────────────────────────────────

function baseUrl(): string {
  return typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';
}

async function agentFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error ?? `Agent API error (${res.status}): ${path}`);
  }
  return data as T;
}

// ── Agent health ──────────────────────────────────────────────────────────────

/**
 * Returns whether the Mastra agent layer is ready (LLM key configured).
 */
export async function getAgentHealth(): Promise<AgentHealthStatus> {
  return agentFetch<AgentHealthStatus>('/api/agents/health');
}

// ── Script Agent ──────────────────────────────────────────────────────────────

/**
 * Analyzes a Fountain screenplay and returns extracted entities + shot list.
 * Called by the Start-from-Script wizard at step 2 (Core Elements Extraction).
 *
 * @param projectId - The active project ID
 * @param fountainText - Raw Fountain-format screenplay text
 * @returns ScriptAnalysisResult with characters, locations, shot list, and review gate ID
 */
export async function analyzeScript(
  projectId: string,
  fountainText: string,
): Promise<{ ok: boolean; projectId: string; data: ScriptAnalysisResult }> {
  return agentFetch('/api/agents/script/analyze', {
    method: 'POST',
    body: JSON.stringify({ projectId, fountainText }),
  });
}

// ── ProductionContext ─────────────────────────────────────────────────────────

/**
 * Reads the full ProductionContext for a project.
 * Returns null if no context exists yet.
 */
export async function getProductionContext(
  projectId: string,
): Promise<ProductionContext | null> {
  return agentFetch<ProductionContext | null>(
    `/api/agents/project/${encodeURIComponent(projectId)}/context`,
  );
}

/**
 * Deep-merges a partial update into the ProductionContext.
 * Arrays are replaced (not merged). Objects are deep-merged.
 */
export async function updateProductionContext(
  projectId: string,
  update: Partial<ProductionContext>,
): Promise<{ ok: boolean; projectId: string }> {
  return agentFetch(`/api/agents/project/${encodeURIComponent(projectId)}/context`, {
    method: 'POST',
    body: JSON.stringify(update),
  });
}

// ── AI Director review queue ──────────────────────────────────────────────────

/**
 * Returns all pending review items for the AI Director dashboard.
 */
export async function getReviewQueue(
  projectId: string,
): Promise<{ projectId: string; items: ReviewItem[] }> {
  return agentFetch(
    `/api/agents/project/${encodeURIComponent(projectId)}/review-queue`,
  );
}

/**
 * Approves a review item and advances the workflow state machine.
 * Triggers the next agent in the pipeline.
 */
export async function approveReviewItem(
  projectId: string,
  itemId: string,
  notes = '',
): Promise<{ ok: boolean; nextState: string }> {
  return agentFetch(
    `/api/agents/project/${encodeURIComponent(projectId)}/review/${encodeURIComponent(itemId)}/approve`,
    { method: 'POST', body: JSON.stringify({ notes }) },
  );
}

/**
 * Rejects a review item, re-queuing it for the responsible agent.
 */
export async function rejectReviewItem(
  projectId: string,
  itemId: string,
  reason = '',
): Promise<{ ok: boolean; nextState: string }> {
  return agentFetch(
    `/api/agents/project/${encodeURIComponent(projectId)}/review/${encodeURIComponent(itemId)}/reject`,
    { method: 'POST', body: JSON.stringify({ reason }) },
  );
}

// ── Convenience: wizard integration helpers ───────────────────────────────────

/**
 * Run the Start-from-Script wizard step 2 — Core Elements Extraction.
 * Parses the script, populates Casting and Production Design placeholders,
 * and creates a shot-list review item in the AI Director queue.
 *
 * Returns the structured extraction result. The caller should show a review
 * gate before advancing to step 3.
 */
export async function runScriptWizardStep2(
  projectId: string,
  fountainText: string,
): Promise<ScriptAnalysisResult> {
  const response = await analyzeScript(projectId, fountainText);
  return response.data;
}

// ── Visual-First Wizard: Element Identification & Color Extraction ──────────

/**
 * Analyzes uploaded images to identify characters, locations, and props.
 * Called by the Visual-First wizard at step 2 (Auto-Identify Elements).
 *
 * @param projectId - The active project ID
 * @param images - Array of { dataUrl, category } for uploaded images
 * @returns Detected elements with names, roles, and type info
 */
export async function identifyVisualElements(
  projectId: string,
  images: Array<{ dataUrl: string; category: string }>,
): Promise<{ characters: Array<{ name: string }>; locations: Array<{ name: string; intExt: string }>; props: Array<{ name: string }> }> {
  const res = await agentFetch<{
    characters: Array<{ name: string }>;
    locations: Array<{ name: string; intExt: string }>;
    props: Array<{ name: string }>;
  }>('/api/agents/visual/identify', {
    method: 'POST',
    body: JSON.stringify({ projectId, images }),
  });
  return res;
}

/**
 * Extracts a dominant color palette from uploaded images.
 * Called by the Visual-First wizard at step 6 (Style Lock).
 *
 * @param projectId - The active project ID
 * @param images - Array of { dataUrl } for color extraction
 * @returns Palette hex array + mood label
 */
export async function extractColorPalette(
  projectId: string,
  images: Array<{ dataUrl: string }>,
): Promise<{ palette: string[]; mood: string }> {
  return agentFetch<{ palette: string[]; mood: string }>(
    '/api/agents/visual/extract-colors',
    { method: 'POST', body: JSON.stringify({ projectId, images }) },
  );
}

/**
 * Generates a script outline from visual context (characters, locations, style).
 * Called by the Visual-First wizard at step 5.
 *
 * @param projectId - The active project ID
 * @param context - Visual context with characters, locations, and style info
 * @returns Generated script outline text
 */
export async function generateScriptFromVisuals(
  projectId: string,
  context: {
    characters: Array<{ name: string; role: string; description: string }>;
    locations: Array<{ name: string; intExt: string; description: string }>;
    style: { palette: string[]; mood: string; notes: string };
  },
): Promise<{ outline: string }> {
  return agentFetch<{ outline: string }>('/api/agents/script/generate-outline', {
    method: 'POST',
    body: JSON.stringify({ projectId, ...context }),
  });
}

// ── Concept / Mood Wizard ──────────────────────────────────────────────────────

/**
 * Generate conceptual film elements from mood/vibe input.
 * Returns atmosphere tags, color palette, lighting mood, style notes, locations, and archetypes.
 * Wizard trigger: Concept/Mood step 1 → "Generate Concepts" button.
 */
export async function generateConcepts(
  projectId: string,
  payload: {
    moodDescription?: string;
    vibe?: { temperature?: number; tension?: number; lighting?: number; energy?: number; stylization?: number };
    colorPalette?: string[];
    sceneSettings?: string;
    lightingDesc?: string;
    atmosphereNotes?: string;
    atmosphereTags?: string[];
    imageDataUrls?: string[];
  },
): Promise<{
  atmosphereTags: string[];
  colorPalette: string[];
  lightingMood: string;
  styleNotes: string;
  locations: Array<{ name: string; description: string; intExt: string }>;
  archetypes: Array<{ archetype: string; name: string; description: string; vibe: string; suggestedRole: string }>;
}> {
  return agentFetch('/api/agents/concept/generate-concepts', {
    method: 'POST',
    body: JSON.stringify({ projectId, ...payload }),
  });
}

/**
 * Generate a style/background image from a text prompt.
 * Wizard trigger: Concept/Mood steps 3, 4, 6 (style image, background plates, asset generation).
 */
export async function generateConceptImage(
  prompt: string,
): Promise<{ url: string; provider: string; model: string }> {
  return agentFetch('/api/agents/concept/generate-image', {
    method: 'POST',
    body: JSON.stringify({ prompt }),
  });
}

// ── Phase 2: Casting & Production Design ─────────────────────────────────────

/**
 * Build character bibles for a project's characters.
 * Generates multi-angle reference images and voice casting suggestions.
 * Wizard trigger: Start-from-Script step 3, Visual-First step 3.
 */
export async function buildCharacterBibles(
  projectId: string,
  characters?: Array<{ name: string; role: string; description: string }>,
): Promise<{ ok: boolean; projectId: string; data: string }> {
  return agentFetch('/api/agents/casting/build-bibles', {
    method: 'POST',
    body: JSON.stringify({ projectId, characters }),
  });
}

/**
 * Build location bibles with background plates.
 * Generates empty background plates for each location in the script.
 * Wizard trigger: Start-from-Script step 4, Concept/Mood step 4.
 */
export async function buildLocationBibles(
  projectId: string,
  locations?: Array<{ name: string; intExt: string; description: string }>,
): Promise<{ ok: boolean; projectId: string; data: string }> {
  return agentFetch('/api/agents/production-design/build-bibles', {
    method: 'POST',
    body: JSON.stringify({ projectId, locations }),
  });
}

/**
 * Generate storyboard frames for shots in the approved shot list.
 * Wizard trigger: Start-from-Script step 8.
 * @param shotIds - Optional array of shot IDs to storyboard. If omitted, all pending shots.
 */
export async function generateStoryboardFrames(
  projectId: string,
  shotIds?: string[],
): Promise<{ ok: boolean; projectId: string; data: string }> {
  return agentFetch('/api/agents/storyboard/generate', {
    method: 'POST',
    body: JSON.stringify({ projectId, shotIds }),
  });
}

// ── Phase 3: Cinematography pipeline ─────────────────────────────────────────

/**
 * Build an optimized generation prompt for a specific shot.
 * Called from the Cinematography department "Build Prompt" action.
 */
export async function buildGenerationPrompt(
  projectId: string,
  shotId: string,
  preferredProvider?: string,
): Promise<{ ok: boolean; projectId: string; shotId: string; data: string }> {
  return agentFetch('/api/agents/cinematography/build-prompt', {
    method: 'POST',
    body: JSON.stringify({ projectId, shotId, preferredProvider }),
  });
}

/**
 * Route a shot to the optimal video generation provider.
 * Returns cost estimate and provider selection.
 */
export async function routeGenerationJob(
  projectId: string,
  shotId: string,
  shotType?: string,
): Promise<{ ok: boolean; projectId: string; data: string }> {
  return agentFetch('/api/agents/cinematography/route-shot', {
    method: 'POST',
    body: JSON.stringify({ projectId, shotId, shotType }),
  });
}

// ── Phase 4: Oversight & consistency ─────────────────────────────────────────

/**
 * Audit a generated clip for consistency against character/set references.
 * Automatically called after generation completes.
 */
export async function auditGeneratedClip(
  projectId: string,
  shotId: string,
  clipDescription?: string,
): Promise<{ ok: boolean; projectId: string; shotId: string; data: string }> {
  return agentFetch('/api/agents/cinematography/audit-clip', {
    method: 'POST',
    body: JSON.stringify({ projectId, shotId, clipDescription }),
  });
}

/**
 * Translate spatial annotations (motion arrows, masks) to provider-specific prompt params.
 * Called from the Cinematography annotation canvas.
 */
export async function translateSpatialAnnotations(
  projectId: string,
  shotId: string,
  annotations: Record<string, unknown>,
  provider?: string,
): Promise<{ ok: boolean; projectId: string; shotId: string; data: string }> {
  return agentFetch('/api/agents/cinematography/annotate-spatial', {
    method: 'POST',
    body: JSON.stringify({ projectId, shotId, annotations, provider }),
  });
}

// ── Phase 5: Post production & sound ─────────────────────────────────────────

/**
 * Prepare the complete audio assembly plan: dialogue TTS, SFX, music cues.
 * Called from the Sound Department toolbar.
 */
export async function prepareAudioPlan(
  projectId: string,
): Promise<{ ok: boolean; projectId: string; data: string }> {
  return agentFetch('/api/agents/sound/prepare-audio', {
    method: 'POST',
    body: JSON.stringify({ projectId }),
  });
}

/**
 * Assemble the sequence: arrange approved clips in story order with transitions.
 * Called from the Post Production "AI Assemble" action.
 */
export async function assembleSequence(
  projectId: string,
  targetDurationSeconds?: number,
): Promise<{ ok: boolean; projectId: string; data: string }> {
  return agentFetch('/api/agents/post/assemble-sequence', {
    method: 'POST',
    body: JSON.stringify({ projectId, targetDurationSeconds }),
  });
}

/**
 * Analyze and suggest color grading for all clips based on the StyleGuide.
 * Called from the Post Production "Auto-Color" action.
 */
export async function colorGradeSequence(
  projectId: string,
): Promise<{ ok: boolean; projectId: string; data: string }> {
  return agentFetch('/api/agents/post/color-grade', {
    method: 'POST',
    body: JSON.stringify({ projectId }),
  });
}

/**
 * Generate a Fountain-format script outline from rough text beats.
 * Wizard trigger: Storyboard Sketch Mode wizard step 2.
 * @param beats - Array of beat entries with title, description, cameraNotes
 * @param characters - Optional array of { name, description }
 * @param locations - Optional array of { name, intExt }
 */
export async function generateOutlineFromBeats(
  projectId: string,
  payload: {
    beats: Array<{ title: string; description: string; cameraNotes?: string }>;
    characters?: Array<{ name: string; description?: string }>;
    locations?: Array<{ name: string; intExt?: string }>;
  },
): Promise<{ ok: boolean; projectId: string; data: string }> {
  return agentFetch('/api/agents/beat-board/generate-outline', {
    method: 'POST',
    body: JSON.stringify({ projectId, ...payload }),
  });
}
