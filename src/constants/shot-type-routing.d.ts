export type ShotRoutingTag =
  | 'control-heavy'
  | 'motion-transfer'
  | 'reliable-default'
  | 'audio-native'
  | 'image-to-video';

export type ShotRoutingRule = {
  primary: { target: string; model: string };
  fallback: { target: string; model: string };
  reason: string;
};

export const DEFAULT_SHOT_TYPE_ROUTING: Record<ShotRoutingTag, ShotRoutingRule>;
export const SHOT_ROUTING_TAGS: string[];
export const SHOT_TYPE_ROUTING_SUMMARY: Record<
  string,
  { primary: string; fallback: string; reason: string }
>;

export function inferShotRoutingTag(shot?: Record<string, unknown> | null): ShotRoutingTag;
export function getShotRoutingRule(shotType?: string): ShotRoutingRule;
