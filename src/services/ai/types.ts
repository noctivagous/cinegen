export type CapabilityKey = 'text' | 'image' | 'video' | 'audio';

export interface AiVendorRoute {
  id: string;
  name: string;
  providerId: string;
  slotId?: string;
  baseUrl?: string;
}

export interface AiJsonResult<T> {
  response: Response;
  data: T | null;
  rawText: string;
}

export interface AiInteractionLogEvent {
  capability: CapabilityKey;
  level: 'info' | 'error';
  message: string;
}
