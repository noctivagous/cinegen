import { storyboardFrames, currentSceneData, projectScratchPad, setProjectScratchPad, styleGuide } from '@/data/project-data';
import { colorState } from '@/color/color-state';
import { markProjectDirty } from '@/services/project-service';
import type { SceneShot } from '@/workspace/scene-types';
import type { StoryboardFrame } from '@/storyboard/storyboard-types';
import { buildStoryboardPrompt, STORYBOARD_STYLE_PROMPT } from '@/storyboard/storyboard-prompt-builder';
import { previewStylePrompt, resolvePreviewStyle } from '@/storyboard/storyboard-preview-styles';
import { resolveModalityVendorRoute } from '@/services/ai/resolve-modality-vendor';
import { buildProxyHeaders, proxyPath } from '@/services/ai/provider-router';
import { ImageGenerationService } from '@/services/ai/image-generation-service';
import { VideoGenerationService } from '@/services/ai/video-generation-service';
import type { AiVendorRoute } from '@/services/ai/types';
import { assignFrameToShot, reconcileShotFrameLinks, sceneNumberFromSceneId } from '@/workspace/shot-frame-bridge';
import { maybeAdvanceShotToStoryboarded } from '@/workspace/shot-lifecycle';
import {
  enqueueGenerationJob,
  updateGenerationJob,
} from '@/services/generation-queue-service';
import { requestProjectTreeRefresh } from '@/tree/project-tree-service';
import { getCinegenStoryboard } from '@/panels/panel-hosts';
import { alertCG } from '@/utils/alert-cg';
import { CG_STORYBOARD_FRAMES_CHANGED } from '@/events/shell-events';
import { cameraLightingSelections, cameraLightingData } from '@/camera/camera-lighting-bundle';
// Side-effect import: registers <cinegen-generation-progress> custom element before first use.
import '@/components/modals/cinegen-generation-progress';

export interface ShotStoryboardEntry {
  sceneId: string;
  sceneNumber: number;
  shot: SceneShot;
}

export interface ShotGenerationResult {
  sceneId: string;
  shotId: number;
  label: string;
  ok: boolean;
  error?: string;
}

/** Return all shots across all scenes that are eligible for storyboard generation. */
export function getShotsEligibleForStoryboard(): ShotStoryboardEntry[] {
  const out: ShotStoryboardEntry[] = [];
  for (const [sceneId, scene] of Object.entries(currentSceneData)) {
    if (!scene?.coverage?.length) continue;
    const sceneNumber = sceneNumberFromSceneId(sceneId);
    for (const shot of scene.coverage) {
      if (!shot.shotType) continue;
      out.push({ sceneId, sceneNumber, shot });
    }
  }
  return out;
}

/**
 * Generate a single storyboard frame for the given shot.
 * If an image provider is configured, generates the image.
 * Otherwise, creates a text slate with shot parameters.
 */
export async function generateStoryboardFrameForShot(
  sceneId: string,
  shot: SceneShot,
  sceneNumber: number
): Promise<ShotGenerationResult> {
  const label = `Shot ${shot.number ?? ''} — ${shot.shotType ?? ''}`.trim() || shot.label || `Shot ${shot.id}`;
  const frameId = Date.now() + Math.floor(Math.random() * 1000);

  const frame: StoryboardFrame = {
    id: frameId,
    scene: String(sceneNumber),
    shotId: shot.id,
    label,
    durationSeconds: 3,
  };

  const route = resolveModalityVendorRoute('image');
  let queueJobId: string | null = null;
  let promptResult: ReturnType<typeof buildStoryboardPrompt> | null = null;
  if (route) {
    promptResult = buildStoryboardPrompt(frame);
    const job = enqueueGenerationJob({
      sceneId,
      shotId: shot.id,
      modality: 'image',
      provider: route.vendor.providerId || route.vendor.slotId || 'image',
      model: route.model,
      prompt: promptResult.prompt,
    });
    queueJobId = job.id;
    updateGenerationJob(job.id, { status: 'running' });
  }
  if (!route) {
    const slateLines: string[] = ['Storyboard slate — AI image provider not configured'];
    if (shot.shotType) slateLines.push(`Type: ${shot.shotType}`);
    if (shot.cameraAngle) slateLines.push(`Angle: ${shot.cameraAngle}`);
    if (shot.cameraMovement) slateLines.push(`Movement: ${shot.cameraMovement}`);
    if (shot.lens) slateLines.push(`Lens: ${shot.lens}`);
    if (shot.lightingTechnique) slateLines.push(`Light: ${shot.lightingTechnique}`);
    if (shot.composition) slateLines.push(`Composition: ${shot.composition}`);
    if (shot.sfxSelections?.atmosphere) slateLines.push(`Atmosphere: ${shot.sfxSelections.atmosphere.abbr}`);
    slateLines.push(`Style: ${STORYBOARD_STYLE_PROMPT}`);
    frame.notes = slateLines.join('\n');
    frame.generatingStatus = 'slate';
  } else if (promptResult) {
    try {
      frame.generatedPrompt = promptResult.prompt;
      frame.generatingStatus = 'Generating…';
      const dataUrl = await generateFrameImageForPrompt(
        promptResult.prompt,
        promptResult.size,
        promptResult.refImageUrls,
        route.vendor,
        route.model
      );
      frame.imageUrl = dataUrl;
      frame.generatingStatus = undefined;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      frame.generatingStatus = `error:${msg}`;
      if (queueJobId) updateGenerationJob(queueJobId, { status: 'failed', error: msg });
      storyboardFrames.push(frame);
      assignFrameToShot(sceneId, frameId, shot.id);
      maybeAdvanceShotToStoryboarded(shot);
      window.dispatchEvent(new CustomEvent(CG_STORYBOARD_FRAMES_CHANGED));
      return { sceneId, shotId: shot.id, label, ok: false, error: msg };
    }
  }

  storyboardFrames.push(frame);
  assignFrameToShot(sceneId, frameId, shot.id);
  maybeAdvanceShotToStoryboarded(shot);
  if (queueJobId) {
    updateGenerationJob(queueJobId, {
      status: 'complete',
      outputUrl: typeof frame.imageUrl === 'string' ? frame.imageUrl : undefined,
    });
  }
  window.dispatchEvent(new CustomEvent(CG_STORYBOARD_FRAMES_CHANGED));

  return { sceneId, shotId: shot.id, label, ok: true };
}

/**
 * Generate storyboard frames for all eligible shots across all scenes.
 * Opens a progress modal, processes sequentially, and reports results.
 */
export async function generateAllShotStoryboards(): Promise<void> {
  const eligible = getShotsEligibleForStoryboard();
  if (!eligible.length) {
    alertCG('No shots with cinematography settings found. Set a shot type on at least one shot first.');
    return;
  }

  const modal = document.createElement('cinegen-generation-progress') as any;
  modal.show(eligible);
  document.body.appendChild(modal);

  const results: ShotGenerationResult[] = [];
  for (const entry of eligible) {
    modal.setShotStatus(entry.sceneId, entry.shot.id, 'generating');
    const result = await generateStoryboardFrameForShot(entry.sceneId, entry.shot, entry.sceneNumber);
    results.push(result);
    modal.setShotStatus(
      entry.sceneId,
      entry.shot.id,
      result.ok ? 'done' : 'failed',
      result.error
    );
  }

  if (eligible.length > 0) {
    reconcileShotFrameLinks(eligible[0].sceneId);
  }
  requestProjectTreeRefresh();
  getCinegenStoryboard()?.refresh();
  markProjectDirty(['storyboard', 'scenes']);

  modal.finish(results);
}

const _imageService = new ImageGenerationService();

/**
 * Generate an image for a given storyboard frame.
 * Uses frame.userPromptOverride if set, otherwise builds prompt via buildStoryboardPrompt.
 */
export async function generateFrameImage(frame: StoryboardFrame): Promise<string> {
  const route = resolveModalityVendorRoute('image');
  if (!route) {
    throw new Error('No image generation provider configured. Open Settings → AI Models & Modalities to set one up.');
  }
  const { vendor, model } = route;
  let prompt: string;
  let size: string;
  let refImages: string[];
  if (frame.userPromptOverride) {
    prompt = frame.userPromptOverride;
    size = '1024x1024';
    refImages = [];
  } else {
    const result = buildStoryboardPrompt(frame);
    prompt = result.prompt;
    size = result.size;
    refImages = result.refImageUrls;
    frame.generatedPrompt = prompt;
  }
  return generateFrameImageForPrompt(prompt, size, refImages, vendor, model);
}

/** Generate a storyboard still for the active frame using the current preview style. */
export async function generateStoryboardForFrame(frame: StoryboardFrame, sceneId: string): Promise<void> {
  const live = (storyboardFrames as StoryboardFrame[]).find((f) => f.id === frame.id) ?? frame;
  if (live.generatingStatus && !live.generatingStatus.startsWith('error:')) return;

  live.generatingStatus = 'Generating…';
  window.dispatchEvent(new CustomEvent(CG_STORYBOARD_FRAMES_CHANGED));

  const route = resolveModalityVendorRoute('image');
  let queueJobId: string | null = null;

  try {
    const promptResult = buildStoryboardPrompt(live);
    live.generatedPrompt = promptResult.prompt;

    if (route && live.shotId != null) {
      const job = enqueueGenerationJob({
        sceneId,
        shotId: live.shotId,
        modality: 'image',
        provider: route.vendor.providerId || route.vendor.slotId || 'image',
        model: route.model,
        prompt: promptResult.prompt,
      });
      queueJobId = job.id;
      updateGenerationJob(job.id, { status: 'running' });
    }

    if (!route) {
      const shot = sceneId && live.shotId != null
        ? (currentSceneData[sceneId]?.coverage as SceneShot[] | undefined)?.find((s) => s.id === live.shotId)
        : null;
      const style = resolvePreviewStyle(live.previewStyle, shot?.storyboardPreviewStyle);
      live.notes = `Storyboard slate — configure image provider\nStyle: ${previewStylePrompt(style)}`;
      live.generatingStatus = 'slate';
      window.dispatchEvent(new CustomEvent(CG_STORYBOARD_FRAMES_CHANGED));
      markProjectDirty(['storyboard']);
      return;
    }

    const dataUrl = await generateFrameImageForPrompt(
      promptResult.prompt,
      promptResult.size,
      promptResult.refImageUrls,
      route.vendor,
      route.model
    );
    live.imageUrl = dataUrl;
    live.generatingStatus = undefined;
    if (queueJobId) updateGenerationJob(queueJobId, { status: 'complete', outputUrl: dataUrl });
    markProjectDirty(['storyboard']);
    window.dispatchEvent(new CustomEvent(CG_STORYBOARD_FRAMES_CHANGED));
    getCinegenStoryboard()?.refresh();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    live.generatingStatus = `error:${msg}`;
    if (queueJobId) updateGenerationJob(queueJobId, { status: 'failed', error: msg });
    window.dispatchEvent(new CustomEvent(CG_STORYBOARD_FRAMES_CHANGED));
    throw err;
  }
}

/** Generate an image via the configured provider and return a data URL. */
async function generateFrameImageForPrompt(
  prompt: string,
  size: string,
  refImageUrls: string[],
  vendor: AiVendorRoute,
  model: string
): Promise<string> {
  if (vendor.providerId === 'fal-ai') {
    const body: Record<string, unknown> = { prompt };
    if (refImageUrls.length) body.image_urls = refImageUrls;
    const res = await fetch(proxyPath(`/${model}`), {
      method: 'POST',
      headers: buildProxyHeaders(vendor),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        (err as { error?: { message?: string } })?.error?.message || `API error (HTTP ${res.status})`
      );
    }
    const data = await res.json();
    const imgUrl = data.images?.[0]?.url || data.image?.url;
    if (imgUrl) return fetchImageAsDataUrl(imgUrl);
    throw new Error('No image URL in fal.ai response');
  }

  const result = await _imageService.generate({
    vendor,
    model,
    prompt,
    count: 1,
    size,
  });

  if (!result.response.ok) {
    const errMsg =
      (result.data as { error?: { message?: string } } | null)?.error?.message ||
      result.rawText ||
      `API error (HTTP ${result.response.status})`;
    throw new Error(errMsg);
  }

  const data = result.data as { data?: Array<{ b64_json?: string; url?: string }> } | null;
  const b64 = data?.data?.[0]?.b64_json;
  if (b64) return `data:image/png;base64,${b64}`;
  const url = data?.data?.[0]?.url;
  if (url) return fetchImageAsDataUrl(url);
  throw new Error('No image data in API response');
}

async function fetchImageAsDataUrl(url: string): Promise<string> {
  const res = await fetch(url, { mode: 'cors' });
  if (!res.ok) throw new Error(`Failed to fetch image: HTTP ${res.status}`);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export interface ScratchPadGenerationResult {
  id: string;
  ok: boolean;
  error?: string;
  prompt?: string;
  outputUrl?: string;
}

/**
 * Generate an image in ScratchPad (draft) context — no pre-existing shot required.
 * All cinematography parameters optional. Result stored in projectScratchPad.
 */
export async function generateScratchPadEntry(userPrompt?: string): Promise<ScratchPadGenerationResult> {
  const id = `sp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = Date.now();
  const title = userPrompt ? userPrompt.slice(0, 60) + (userPrompt.length > 60 ? '…' : '') : 'Untitled Draft';

  const route = resolveModalityVendorRoute('image');

  if (!route) {
    const slateLines = ['ScratchPad slate — AI image provider not configured'];
    const selections = buildLocalCameraPromptForDraft();
    if (selections.length) slateLines.push(selections.join(', '));
    const text = slateLines.join('\n');
    setProjectScratchPad({
      ...projectScratchPad,
      entries: [...projectScratchPad.entries, { id, title, text, createdAt: now, updatedAt: now }],
    });
    markProjectDirty(['scratchpad']);
    return { id, ok: true, prompt: slateLines.join(', ') };
  }

  try {
    const prompt = buildScratchPadImagePrompt(userPrompt);
    const dataUrl = await generateFrameImageForPrompt(
      prompt,
      getSizeForAspectRatio('16:9'),
      [],
      route.vendor,
      route.model
    );
    const text = userPrompt || '';
    setProjectScratchPad({
      ...projectScratchPad,
      entries: [...projectScratchPad.entries, { id, title, text, createdAt: now, updatedAt: now }],
    });
    markProjectDirty(['scratchpad']);

    return { id, ok: true, prompt, outputUrl: dataUrl };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    setProjectScratchPad({
      ...projectScratchPad,
      entries: [...projectScratchPad.entries, { id, title, text: `${userPrompt || ''}\n\nError: ${msg}`, createdAt: now, updatedAt: now }],
    });
    markProjectDirty(['scratchpad']);
    return { id, ok: false, error: msg };
  }
}

function buildLocalCameraPromptForDraft(): string[] {
  const parts: string[] = [];
  for (const [k, abbr] of Object.entries(cameraLightingSelections || {})) {
    if (!abbr) continue;
    const section = (cameraLightingData as Record<string, unknown>)?.[k] as { items?: { abbr: string; name: string }[] } | undefined;
    if (section) {
      const item = section.items?.find((i) => i.abbr === abbr);
      if (item) parts.push(item.name);
    }
  }
  if (styleGuide?.lightingMood) parts.push(`Lighting: ${styleGuide.lightingMood}`);
  if (styleGuide?.visualTone) parts.push(`Tone: ${styleGuide.visualTone}`);
  const palette = colorState?.getPalette();
  if (palette?.length) parts.push(`Palette: ${palette.join(', ')}`);
  return parts;
}

function buildScratchPadImagePrompt(userPrompt?: string): string {
  const parts: string[] = [];
  if (userPrompt) parts.push(userPrompt);

  for (const [k, abbr] of Object.entries(cameraLightingSelections || {})) {
    if (!abbr) continue;
    const section = (cameraLightingData as Record<string, unknown>)?.[k] as { items?: { abbr: string; name: string }[] } | undefined;
    if (section) {
      const item = section.items?.find((i) => i.abbr === abbr);
      if (item) parts.push(item.name);
    }
  }

  if (styleGuide?.lightingMood) parts.push(`Lighting mood: ${styleGuide.lightingMood}`);
  if (styleGuide?.visualTone) parts.push(`Visual tone: ${styleGuide.visualTone}`);
  if (styleGuide?.lensStyle) parts.push(`Lens style: ${styleGuide.lensStyle}`);

  const palette = colorState?.getPalette();
  if (palette?.length) parts.push(`Color palette: ${palette.join(', ')}`);

  parts.push(STORYBOARD_STYLE_PROMPT);

  let prompt = parts.join(', ');
  if (prompt.length > 3800) prompt = prompt.slice(0, 3797) + '...';
  return prompt;
}

function getSizeForAspectRatio(aspectRatio?: string): string {
  const ASPECT_RATIO_TO_SIZE: Record<string, string> = {
    '16:9': '1024x576', '2.39:1': '1024x432', '1:1': '1024x1024',
  };
  return ASPECT_RATIO_TO_SIZE[aspectRatio || ''] || '1024x576';
}

const _videoService = new VideoGenerationService();

/** Generate a rendered video clip for a shot using the configured video provider. */
export async function generateVideoForShot(
  sceneId: string,
  shotId: number,
  prompt: string
): Promise<string | undefined> {
  const route = resolveModalityVendorRoute('video');
  if (!route) {
    throw new Error('No video generation provider configured. Open Settings → AI Models & Modalities.');
  }

  const job = enqueueGenerationJob({
    sceneId,
    shotId,
    modality: 'video',
    provider: route.vendor.providerId || route.vendor.slotId || 'video',
    model: route.model,
    prompt,
  });
  updateGenerationJob(job.id, { status: 'running' });

  try {
    const result = await _videoService.generate({
      vendor: route.vendor,
      model: route.model,
      prompt,
      duration: 5,
      aspectRatio: '16:9',
      resolution: '480p',
    });
    const clip = result.data?.data?.[0];
    const url = clip?.video?.url || clip?.url;
    if (!url) throw new Error('No video URL in provider response');
    updateGenerationJob(job.id, { status: 'complete', outputUrl: url });
    markProjectDirty(['generationQueue']);
    return url;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    updateGenerationJob(job.id, { status: 'failed', error: msg });
    throw err;
  }
}

/**
 * Build inline draft frames from the script scene content.
 * Pure builder — no side effects, no mutations.
 */
export function buildStoryboardDraftFrames(
  scene: string,
  sceneHeading: string,
  anchor: string | undefined,
  sceneBodyLines: string[]
): StoryboardFrame[] {
  const cleanedHeading = sceneHeading || `Scene ${scene}`;
  const snippets = sceneBodyLines.slice(0, 3);
  const labels = [
    `AI Draft - Establishing shot (${cleanedHeading})`,
    `AI Draft - Action beat (${cleanedHeading})`,
    `AI Draft - Character beat (${cleanedHeading})`,
  ];
  return labels.map((label, idx) => ({
    id: Date.now() + idx,
    scene,
    label,
    scriptLink: snippets[idx] || anchor,
    notes: `AI draft frame ${idx + 1}. Adjust framing, lens intent, and movement as needed.\nStyle: ${STORYBOARD_STYLE_PROMPT}`,
  }));
}
