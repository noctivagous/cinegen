/** Canonical output contract for all entry wizards. */

export interface WizardOutput {
  /** Fountain screenplay text — triggers syncFountainToProject(). */
  fountainText?: string;

  /** Characters to add to assetLibrary.characters. */
  characters?: WizardCharacterEntry[];

  /** Locations to add to assetLibrary.locations. */
  locations?: WizardLocationEntry[];

  /** Props to add to assetLibrary.props. */
  props?: WizardPropEntry[];

  /** Project-wide style defaults (merged, not replaced). */
  styleGuide?: StyleGuideDelta;

  /** Per-scene overrides keyed by sceneId (merged into SceneDetail). */
  sceneOverrides?: Record<string, SceneOverride>;

  /** Persistent Beat Board data (for the future Beat Board section). */
  beatBoard?: BeatBoardOutput;

  /** Mood board items to append to the active mood board. */
  moodBoardItems?: WizardMoodBoardItem[];

  /** Department feature branches to enable. */
  featureBranches: string[];

  /** Where to navigate after completion. */
  targetView?: TargetViewHint;
}

export interface StyleGuideDelta {
  colorPalette?: string[];
  lightingMood?: string;
  visualTone?: string;
  lensStyle?: string;
  styleReference?: string;
}

export interface SceneOverride {
  /** Overrides project-wide color palette for this scene. */
  colorOverride?: string[];
  /** Overrides project-wide lighting mood for this scene. */
  lightingMood?: string;
  /** Overrides project-wide visual tone for this scene. */
  visualTone?: string;
  /** Beat Board beat title (ref-only, not used in prompts). */
  beatTitle?: string;
  /** Beat Board beat duration in seconds. */
  beatDuration?: number;
  /** Raw cinematography notes, used to generate extra shots. */
  cameraNotes?: string;
}

export interface BeatBoardOutput {
  entries: BeatBoardEntry[];
}

export interface BeatBoardEntry {
  id: string;
  order: number;
  title: string;
  description: string;
  sceneId?: string;
  characters: string[];
  locationId?: string;
  cameraNotes?: string;
  durationSeconds: number;
  assetNeeds: string[];
}

export interface WizardCharacterEntry {
  id: string;
  name: string;
  role: string;
  description: string;
  icon?: string;
}

export interface WizardLocationEntry {
  id: string;
  name: string;
  intExt: string;
  description?: string;
}

export interface WizardPropEntry {
  id: string;
  name: string;
  description?: string;
}

export interface WizardMoodBoardItem {
  type: 'image' | 'video' | 'sound' | 'text';
  label: string;
  source: string;
  notes?: string;
}

export interface TargetViewHint {
  viewName: string;
  label: string;
  sectionKey?: string | null;
}
