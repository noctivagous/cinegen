import type { AiInteractionLogEvent } from '@/services/ai/types';

type Listener = (event: AiInteractionLogEvent) => void;

const listeners = new Set<Listener>();

export function emitAiInteractionLog(event: AiInteractionLogEvent): void {
  listeners.forEach((listener) => {
    try {
      listener(event);
    } catch (error) {
      console.warn('AI interaction log listener failed:', error);
    }
  });
}

export function subscribeAiInteractionLog(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
