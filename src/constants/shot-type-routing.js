/**
 * SSOT: shot-type tag → video provider routing (primary/fallback target + model).
 * Consumed by backends/agents and frontend generation helpers.
 */

/** @typedef {'control-heavy' | 'motion-transfer' | 'reliable-default' | 'audio-native' | 'image-to-video'} ShotRoutingTag */

/** @type {Record<ShotRoutingTag, { primary: { target: string; model: string }; fallback: { target: string; model: string }; reason: string }>} */
export const DEFAULT_SHOT_TYPE_ROUTING = {
  'control-heavy': {
    primary: { target: 'runway', model: 'gen4' },
    fallback: { target: 'google', model: 'veo-3.1' },
    reason: 'Runway Motion Brush + Advanced Camera Controls for precise control',
  },
  'motion-transfer': {
    primary: { target: 'fal', model: 'fal-ai/kling-video/v2.0/standard/image-to-video' },
    fallback: { target: 'runway', model: 'gen4' },
    reason: 'Kling reference-video motion transfer',
  },
  'reliable-default': {
    primary: { target: 'google', model: 'veo-3.1' },
    fallback: { target: 'fal', model: 'fal-ai/kling-video/v2.0/standard/image-to-video' },
    reason: 'Veo 3.1 best overall prompt adherence and safety',
  },
  'audio-native': {
    primary: { target: 'google', model: 'veo-3.0' },
    fallback: { target: 'fal', model: 'fal-ai/kling-video/v2.0/standard/image-to-video' },
    reason: 'Veo 3 native ambient sound generation',
  },
  'image-to-video': {
    primary: { target: 'fal', model: 'fal-ai/kling-video/v2.0/pro/image-to-video' },
    fallback: { target: 'runway', model: 'gen4' },
    reason: 'Seedance/Kling cinematic image-to-video',
  },
};

export const SHOT_ROUTING_TAGS = Object.keys(DEFAULT_SHOT_TYPE_ROUTING);

/** Legacy summary shape used by generation-agent.js */
export const SHOT_TYPE_ROUTING_SUMMARY = Object.fromEntries(
  Object.entries(DEFAULT_SHOT_TYPE_ROUTING).map(([tag, rule]) => [
    tag,
    {
      primary: rule.primary.target,
      fallback: rule.fallback.target,
      reason: rule.reason,
    },
  ])
);

/**
 * Map UI cinematography fields (ECU, movement, frames) → routing tag.
 * @param {Record<string, unknown> | null | undefined} shot
 * @returns {ShotRoutingTag}
 */
export function inferShotRoutingTag(shot) {
  const movement = String(shot?.cameraMovement || '').toLowerCase();
  const type = String(shot?.shotType || '').toLowerCase();
  const atmosphere = Array.isArray(shot?.atmosphereTags)
    ? shot.atmosphereTags.join(' ').toLowerCase()
    : '';

  if (/motion.?transfer|reference.?video/.test(movement)) return 'motion-transfer';
  if (/ambient|soundscape|audio|dialogue bed/.test(atmosphere)) return 'audio-native';

  const frameIds = shot?.frameIds ?? shot?.linkedFrameIds;
  if (Array.isArray(frameIds) && frameIds.length > 0) return 'image-to-video';

  if (/handheld|steadicam|drone|crane|arc|dolly|truck|pan|tilt|zoom|tracking|push|pull/.test(movement)) {
    return 'control-heavy';
  }

  if (/cu|ecu|close|mcu|insert/.test(type)) return 'image-to-video';

  return 'reliable-default';
}

/**
 * @param {ShotRoutingTag | string | undefined} shotType
 * @returns {typeof DEFAULT_SHOT_TYPE_ROUTING[ShotRoutingTag]}
 */
export function getShotRoutingRule(shotType) {
  return DEFAULT_SHOT_TYPE_ROUTING[shotType] || DEFAULT_SHOT_TYPE_ROUTING['reliable-default'];
}
