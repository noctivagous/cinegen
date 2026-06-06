import {
  AGENT_STATIC_ROUTES,
  projectContextPath,
  projectReviewApprovePath,
  projectReviewQueuePath,
  projectReviewRejectPath,
} from '@/constants/agent-routes.js';

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

export interface CharacterGuideEntry {
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

export interface LocationGuideEntry {
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
  characterGuide: CharacterGuideEntry[];
  locationGuide: LocationGuideEntry[];
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

// ── Typed agent errors ─────────────────────────────────────────────────────────

export type AgentErrorCode =
  | 'NO_LLM_CONFIGURED'
  | 'MISSING_KEY'
  | 'API_ERROR'
  | 'INVALID_RESPONSE'
  | 'NETWORK_ERROR'
  | 'UNKNOWN_AGENT';

export interface AgentError {
  code: AgentErrorCode;
  message: string;
  status: number | null;
  retryable: boolean;
}

function isAgentError(err: unknown): err is AgentError {
  return typeof err === 'object' && err !== null && 'code' in err && 'retryable' in err;
}

function createAgentError(
  code: AgentErrorCode,
  message: string,
  retryable: boolean,
  status: number | null,
): AgentError {
  return { code, message, status, retryable };
}

// ── Base URL helper ───────────────────────────────────────────────────────────

function baseUrl(): string {
  return typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';
}

async function agentFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${baseUrl()}${path}`, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
    });
  } catch (err) {
    throw createAgentError(
      'NETWORK_ERROR',
      err instanceof Error ? err.message : 'Failed to reach agent API',
      true,
      null,
    );
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    const text = await res.text().catch(() => '');
    throw createAgentError(
      'INVALID_RESPONSE',
      `Agent returned non-JSON response (${res.status}): ${text.slice(0, 200)}`,
      false,
      res.status,
    );
  }

  if (!res.ok) {
    const errorData = data as Record<string, unknown> | undefined;
    const serverCode = errorData?.code as string | undefined;
    const serverMessage = (errorData?.error as string) ?? `Agent API error (${res.status})`;

    if (res.status === 503 || res.status === 502 || res.status === 504) {
      throw createAgentError(
        (serverCode as AgentErrorCode) || 'API_ERROR',
        serverMessage,
        true,
        res.status,
      );
    }
    throw createAgentError(
      (serverCode as AgentErrorCode) || 'API_ERROR',
      serverMessage,
      res.status >= 500,
      res.status,
    );
  }

  return data as T;
}

// ── Agent health ──────────────────────────────────────────────────────────────

/**
 * Returns whether the Mastra agent layer is ready (LLM key configured).
 */
export async function getAgentHealth(): Promise<AgentHealthStatus> {
  return agentFetch<AgentHealthStatus>(AGENT_STATIC_ROUTES.HEALTH);
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
  return agentFetch(AGENT_STATIC_ROUTES.SCRIPT_ANALYZE, {
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
    projectContextPath(projectId),
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
  return agentFetch(projectContextPath(projectId), {
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
    projectReviewQueuePath(projectId),
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
    projectReviewApprovePath(projectId, itemId),
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
    projectReviewRejectPath(projectId, itemId),
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
  }>(AGENT_STATIC_ROUTES.VISUAL_IDENTIFY, {
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
    AGENT_STATIC_ROUTES.VISUAL_EXTRACT_COLORS,
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
  return agentFetch<{ outline: string }>(AGENT_STATIC_ROUTES.SCRIPT_GENERATE_OUTLINE, {
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
  return agentFetch(AGENT_STATIC_ROUTES.CONCEPT_GENERATE_CONCEPTS, {
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
  return agentFetch(AGENT_STATIC_ROUTES.CONCEPT_GENERATE_IMAGE, {
    method: 'POST',
    body: JSON.stringify({ prompt }),
  });
}

// ── Phase 2: Casting & Production Design ─────────────────────────────────────

/**
 * Build character guides for a project's characters.
 * Generates multi-angle reference images and voice casting suggestions.
 * Wizard trigger: Start-from-Script step 3, Visual-First step 3.
 */
export async function buildCharacterGuides(
  projectId: string,
  characters?: Array<{ name: string; role: string; description: string }>,
): Promise<{ ok: boolean; projectId: string; data: string }> {
  return agentFetch(AGENT_STATIC_ROUTES.CASTING_BUILD_GUIDES, {
    method: 'POST',
    body: JSON.stringify({ projectId, characters }),
  });
}

/**
 * Build location guides with background plates.
 * Generates empty background plates for each location in the script.
 * Wizard trigger: Start-from-Script step 4, Concept/Mood step 4.
 */
export async function buildLocationGuides(
  projectId: string,
  locations?: Array<{ name: string; intExt: string; description: string }>,
): Promise<{ ok: boolean; projectId: string; data: string }> {
  return agentFetch(AGENT_STATIC_ROUTES.PRODUCTION_DESIGN_BUILD_GUIDES, {
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
  sceneContent?: { heading: string; bodyLines: string[] },
): Promise<{ ok: boolean; projectId: string; data: any }> {
  return agentFetch(AGENT_STATIC_ROUTES.STORYBOARD_GENERATE, {
    method: 'POST',
    body: JSON.stringify({ projectId, shotIds, sceneContent }),
  });
}

// ── Phase 3: Cinematography pipeline ─────────────────────────────────────────

export interface PromptEngineerContext {
  sceneId?: string;
  expression?: string;
  emotion?: string;
  beatSequence?: string;
  preferredProvider?: string;
  shotType?: string;
  cameraAngle?: string;
  cameraMovement?: string;
  lens?: string;
  lightingTechnique?: string;
  composition?: string;
  sfxSelections?: {
    atmosphere?: { abbr: string; params?: Record<string, unknown> };
    weather?: { abbr: string; params?: Record<string, unknown> };
    particleFx?: { abbr: string; params?: Record<string, unknown> };
  };
}

/**
 * Build an optimized generation prompt for a specific shot.
 * Called from the Cinematography department "Build Prompt" action.
 * Sends richer context so the backend agent can optimize per-provider.
 */
export async function buildGenerationPrompt(
  projectId: string,
  shotId: string,
  context?: PromptEngineerContext,
): Promise<{ ok: boolean; projectId: string; shotId: string; data: string }> {
  return agentFetch(AGENT_STATIC_ROUTES.CINEMATOGRAPHY_BUILD_PROMPT, {
    method: 'POST',
    body: JSON.stringify({
      projectId,
      shotId,
      preferredProvider: context?.preferredProvider,
      sceneId: context?.sceneId,
      expression: context?.expression,
      emotion: context?.emotion,
      beatSequence: context?.beatSequence,
      shotType: context?.shotType,
      cameraAngle: context?.cameraAngle,
      cameraMovement: context?.cameraMovement,
      lens: context?.lens,
      lightingTechnique: context?.lightingTechnique,
      composition: context?.composition,
      sfxSelections: context?.sfxSelections,
    }),
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
  shotMetadata?: Record<string, unknown>,
): Promise<{ ok: boolean; projectId: string; data: string }> {
  return agentFetch(AGENT_STATIC_ROUTES.CINEMATOGRAPHY_ROUTE_SHOT, {
    method: 'POST',
    body: JSON.stringify({ projectId, shotId, shotType, shotMetadata }),
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
  return agentFetch(AGENT_STATIC_ROUTES.CINEMATOGRAPHY_AUDIT_CLIP, {
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
  return agentFetch(AGENT_STATIC_ROUTES.CINEMATOGRAPHY_ANNOTATE_SPATIAL, {
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
  return agentFetch(AGENT_STATIC_ROUTES.SOUND_PREPARE_AUDIO, {
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
  return agentFetch(AGENT_STATIC_ROUTES.POST_ASSEMBLE_SEQUENCE, {
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
  return agentFetch(AGENT_STATIC_ROUTES.POST_COLOR_GRADE, {
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
  return agentFetch(AGENT_STATIC_ROUTES.BEAT_BOARD_GENERATE_OUTLINE, {
    method: 'POST',
    body: JSON.stringify({ projectId, ...payload }),
  });
}
