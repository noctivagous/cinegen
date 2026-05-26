/**
 * NOTE:
 * The canonical routing modality set is in `services/routing-modalities.ts`.
 * Setup Assistant intentionally presents `video` before `image` because that
 * step is framed around shot generation decisions first, then storyboard images.
 */
export const ROUTING_MODALITIES = ['llm', 'video', 'image', 'audio'] as const;
export type RoutingModality = (typeof ROUTING_MODALITIES)[number];

/** Modalities that must have provider coverage and a default model before setup is complete. */
export const REQUIRED_ROUTING_MODALITIES: readonly RoutingModality[] = ['llm', 'video', 'image'];

export function isRoutingModalityRequired(mod: string): mod is RoutingModality {
  return (REQUIRED_ROUTING_MODALITIES as readonly string[]).includes(mod);
}

export const MODALITY_META: Record<
  RoutingModality,
  {
    label: string;
    badge: string;
    badgeClass: string;
    scopeKey: string;
    desc: string;
    tip: string;
  }
> = {
  llm: {
    label: 'Language / Text AI',
    badge: 'REQUIRED',
    badgeClass: 'sa-badge--required',
    scopeKey: 'language',
    desc: 'Powers AI assistants, script writing, dialogue suggestions, and all in-app text generation.',
    tip: 'Recommended: OpenAI GPT-4.1 mini (cost-effective) or Anthropic Claude Sonnet.',
  },
  video: {
    label: 'Video Generation',
    badge: 'REQUIRED',
    badgeClass: 'sa-badge--required',
    scopeKey: 'video',
    desc: 'Generates shots, takes, and coverage clips from your script scenes.',
    tip: 'Recommended: Google Veo 3.1 (best quality + native audio), Kling 2.6 via fal.ai, or Runway Gen-4.5.',
  },
  image: {
    label: 'Image / Storyboards',
    badge: 'REQUIRED',
    badgeClass: 'sa-badge--required',
    scopeKey: 'image',
    desc: 'Creates storyboard frames, reference images, and character / location visuals.',
    tip: 'Recommended: FLUX 1.1 Pro via fal.ai or GPT Image 2 via OpenAI.',
  },
  audio: {
    label: 'Audio — TTS · SFX · Music',
    badge: 'OPTIONAL',
    badgeClass: 'sa-badge--optional',
    scopeKey: 'audio',
    desc: 'Voice acting, sound effects, and music generation for your scenes.',
    tip: 'Recommended: ElevenLabs (best voice cloning + SFX). Suno/Udio for music (via custom endpoint).',
  },
};
