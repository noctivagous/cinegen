/**
 * Draft generation service — free-form image generation that writes to `drafts.cinedrafts`.
 *
 * Unlike the production storyboard path, Drafts require no pre-existing shot or scene.
 * All cinematography parameters and style guide are injected as optional prompting context.
 * Results are stored as append-only CineProjectDraft entries and never mutate shot state.
 */

import { styleGuide } from '@/data/project-data';
import { colorState } from '@/color/color-state';
import { appendProjectDraft } from '@/data/project-data';
import { markProjectDirty } from '@/services/project-service';
import { resolveModalityVendorRoute } from '@/services/ai/resolve-modality-vendor';
import { buildProxyHeaders, proxyPath } from '@/services/ai/provider-router';
import { ImageGenerationService } from '@/services/ai/image-generation-service';
import { cameraLightingSelections, cameraLightingData } from '@/camera/camera-lighting-bundle';
import { STORYBOARD_STYLE_PROMPT } from '@/storyboard/storyboard-prompt-builder';
import type { AiVendorRoute } from '@/services/ai/types';

export interface DraftGenerationResult {
  id: string;
  ok: boolean;
  error?: string;
  outputUrl?: string;
}

const _imageService = new ImageGenerationService();

/**
 * Generate an image in draft context — no pre-existing shot required.
 * Writes a CineProjectDraft entry to projectDrafts and marks the doc dirty.
 */
export async function generateDraftEntry(userPrompt: string, injectStyleGuide = true): Promise<DraftGenerationResult> {
  const id = `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const createdAt = Date.now();

  const route = resolveModalityVendorRoute('image');

  if (!route) {
    // No provider — create a text slate
    appendProjectDraft({
      id,
      prompt: userPrompt,
      createdAt,
      tags: [],
    });
    markProjectDirty(['drafts']);
    return { id, ok: true };
  }

  const fullPrompt = buildDraftPrompt(userPrompt, injectStyleGuide);

  try {
    const outputUrl = await generateImage(fullPrompt, route.vendor, route.model);

    appendProjectDraft({
      id,
      prompt: userPrompt,
      provider: route.vendor.providerId || route.vendor.slotId,
      modelId: route.model,
      outputUrl,
      createdAt,
      tags: [],
    });
    markProjectDirty(['drafts']);
    return { id, ok: true, outputUrl };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    // Still save the failed attempt with no outputUrl
    appendProjectDraft({
      id,
      prompt: userPrompt,
      provider: route.vendor.providerId || route.vendor.slotId,
      modelId: route.model,
      createdAt,
      tags: [],
    });
    markProjectDirty(['drafts']);
    return { id, ok: false, error: msg };
  }
}

function buildDraftPrompt(userPrompt: string, injectStyleGuide = true): string {
  const parts: string[] = [];
  if (userPrompt) parts.push(userPrompt);

  // Inject active camera/lighting selections as optional context
  for (const [k, abbr] of Object.entries(cameraLightingSelections || {})) {
    if (!abbr) continue;
    const section = (cameraLightingData as Record<string, unknown>)?.[k] as
      | { items?: { abbr: string; name: string }[] }
      | undefined;
    if (section) {
      const item = section.items?.find((i) => i.abbr === abbr);
      if (item) parts.push(item.name);
    }
  }

  if (injectStyleGuide) {
    if (styleGuide?.lightingMood) parts.push(`Lighting mood: ${styleGuide.lightingMood}`);
    if (styleGuide?.visualTone) parts.push(`Visual tone: ${styleGuide.visualTone}`);
    if (styleGuide?.lensStyle) parts.push(`Lens style: ${styleGuide.lensStyle}`);
    const palette = colorState?.getPalette();
    if (palette?.length) parts.push(`Color palette: ${palette.join(', ')}`);
  }

  parts.push(STORYBOARD_STYLE_PROMPT);

  let prompt = parts.join(', ');
  if (prompt.length > 3800) prompt = prompt.slice(0, 3797) + '...';
  return prompt;
}

async function generateImage(
  prompt: string,
  vendor: AiVendorRoute,
  model: string
): Promise<string> {
  const size = '1024x576';

  if (vendor.providerId === 'fal-ai') {
    const res = await fetch(proxyPath(`/${model}`), {
      method: 'POST',
      headers: buildProxyHeaders(vendor),
      body: JSON.stringify({ prompt }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        (err as { error?: { message?: string } })?.error?.message ||
          `API error (HTTP ${res.status})`
      );
    }
    const data = await res.json();
    const imgUrl = data.images?.[0]?.url || data.image?.url;
    if (imgUrl) return fetchImageAsDataUrl(imgUrl);
    throw new Error('No image URL in fal.ai response');
  }

  const result = await _imageService.generate({ vendor, model, prompt, count: 1, size });
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
