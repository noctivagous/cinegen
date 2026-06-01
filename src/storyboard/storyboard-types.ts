export type StoryboardFrame = {
  id: number;
  scene: string;
  /** Coverage shot id in the matching production scene (`coverage[].id`). */
  shotId?: number;
  /** Approximate previs timing in seconds (non-locked editorial timing). */
  durationSeconds?: number;
  label: string;
  scriptLink?: string;
  /** Character span in Fountain text linked to this frame. */
  scriptRange?: { start: number; end: number };
  notes?: string;
  imageUrl?: string;
  generatingStatus?: string;
  /** Auto-assembled enriched prompt (read-only, for transparency). */
  generatedPrompt?: string;
  /** Optional user-edited override that takes precedence over auto-generation. */
  userPromptOverride?: string;
};

export type StoryboardVisibilityPart = 'scene' | 'frame' | 'notes';

export type StoryboardReferenceCategory = 'characters' | 'locations' | 'interiors' | 'exteriors';
export type StoryboardReferenceSource = 'ai' | 'user';
export type StoryboardReferenceGenerationStatus = 'idle' | 'generating' | 'ready' | 'error';

export type StoryboardReferenceSlot = {
  id: string;
  category: StoryboardReferenceCategory;
  label: string;
  prompt: string;
  imageUrl?: string;
  notes?: string;
  locked?: boolean;
  source: StoryboardReferenceSource;
  updatedAt?: string;
};

export type StoryboardReferenceBank = Record<StoryboardReferenceCategory, StoryboardReferenceSlot[]>;
export type SceneReferenceOverrides = Record<string, Partial<StoryboardReferenceBank>>;
