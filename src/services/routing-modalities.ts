export const ROUTING_MODALITIES = ['llm', 'image', 'video', 'audio'] as const;

export type RoutingModalityKey = (typeof ROUTING_MODALITIES)[number];

export function apiScopeForModality(modalityKey: RoutingModalityKey): string {
  return modalityKey === 'llm' ? 'language' : modalityKey;
}
