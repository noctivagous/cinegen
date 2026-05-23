export type StoryboardFrame = {
  id: number;
  scene: string;
  label: string;
  scriptLink?: string;
  notes?: string;
  imageUrl?: string;
  generatingStatus?: string;
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
