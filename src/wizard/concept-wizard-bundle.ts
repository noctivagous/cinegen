import {
  createEmptyConceptWizardState,
  type ConceptWizardState,
  type ConceptWizardVibe,
  type ConceptWizardUpload,
  type ConceptGeneratedImage,
  type ConceptLocation,
  type ConceptArchetype,
  type ConceptWizardImageCategory,
  generateUploadId,
  generateLocationId,
  generateArchetypeId,
  generateImageId,
} from '@/wizard/concept-wizard-state';

let _state: ConceptWizardState = createEmptyConceptWizardState();

export function getConceptWizardState(): ConceptWizardState {
  return _state;
}

export function resetConceptWizardState(): void {
  _state = createEmptyConceptWizardState();
}

export function setConceptWizardProjectId(id: string): void {
  _state.projectId = id;
}

export function setMoodDescription(text: string): void {
  _state.moodDescription = text;
}

export function setSceneSettings(text: string): void {
  _state.sceneSettings = text;
}

export function setLightingDesc(text: string): void {
  _state.lightingDesc = text;
}

export function setAtmosphereNotes(text: string): void {
  _state.atmosphereNotes = text;
}

export function setVibe(partial: Partial<ConceptWizardVibe>): void {
  _state.currentVibe = { ..._state.currentVibe, ...partial };
}

export function addAtmosphereTag(tag: string): void {
  if (!_state.atmosphereTags.includes(tag)) {
    _state.atmosphereTags.push(tag);
  }
}

export function removeAtmosphereTag(tag: string): void {
  _state.atmosphereTags = _state.atmosphereTags.filter((t) => t !== tag);
}

export function addColorToPalette(color: string): void {
  if (!_state.colorPalette.includes(color)) {
    _state.colorPalette.push(color);
  }
}

export function removeColorFromPalette(color: string): void {
  _state.colorPalette = _state.colorPalette.filter((c) => c !== color);
}

export function readImageAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read image'));
    reader.readAsDataURL(file);
  });
}

export async function addUploadedImage(file: File, category: ConceptWizardImageCategory = 'mood-board'): Promise<ConceptWizardUpload> {
  const dataUrl = await readImageAsDataUrl(file);
  const upload: ConceptWizardUpload = {
    id: generateUploadId(),
    file,
    dataUrl,
    name: file.name,
    category,
    tags: [],
  };
  _state.uploadedImages.push(upload);
  return upload;
}

export function removeUploadedImage(id: string): void {
  _state.uploadedImages = _state.uploadedImages.filter((img) => img.id !== id);
}

export function setUploadCategory(id: string, category: ConceptWizardImageCategory): void {
  const img = _state.uploadedImages.find((i) => i.id === id);
  if (img) img.category = category;
}

export function getImagesByCategory(category: ConceptWizardImageCategory): ConceptWizardUpload[] {
  return _state.uploadedImages.filter((img) => img.category === category);
}

export function setConceptsGenerating(v: boolean): void {
  _state.conceptsGenerating = v;
}

export function applyGeneratedConcepts(data: {
  atmosphereTags?: string[];
  colorPalette?: string[];
  lightingMood?: string;
  styleNotes?: string;
  locations?: Array<{ name: string; description: string; intExt: string }>;
  archetypes?: Array<{ archetype: string; name: string; description: string; vibe: string; role: string }>;
}): void {
  _state.generatedAtmosphereTags = data.atmosphereTags ?? [];
  _state.generatedColorPalette = data.colorPalette ?? [];
  _state.lightingMood = data.lightingMood ?? '';
  _state.styleNotes = data.styleNotes ?? '';
  _state.locations = (data.locations ?? []).map((loc) => ({
    id: generateLocationId(),
    name: loc.name,
    description: loc.description,
    intExt: (loc.intExt as ConceptLocation['intExt']) || 'INT/EXT',
  }));
  _state.archetypes = (data.archetypes ?? []).map((arch) => ({
    id: generateArchetypeId(),
    archetype: arch.archetype,
    name: arch.name,
    description: arch.description ?? '',
    vibe: arch.vibe ?? '',
    role: (arch.role as ConceptArchetype['role']) || 'supporting',
  }));
}

export function addGeneratedImage(prompt: string, url: string, category: ConceptGeneratedImage['category']): void {
  _state.generatedImages.push({
    id: generateImageId(),
    prompt,
    url,
    category,
  });
}

export function addLocation(name: string, intExt: ConceptLocation['intExt'] = 'INT/EXT'): ConceptLocation {
  const loc: ConceptLocation = {
    id: generateLocationId(),
    name,
    description: '',
    intExt,
  };
  _state.locations.push(loc);
  return loc;
}

export function removeLocation(id: string): void {
  _state.locations = _state.locations.filter((l) => l.id !== id);
}

export function updateLocation(id: string, partial: Partial<ConceptLocation>): void {
  const loc = _state.locations.find((l) => l.id === id);
  if (loc) Object.assign(loc, partial);
}

export function assignPlateToLocation(locId: string, imageId: string): void {
  const loc = _state.locations.find((l) => l.id === locId);
  if (loc) loc.generatedImageId = imageId;
}

export function addArchetype(archetype: string, name: string): ConceptArchetype {
  const arch: ConceptArchetype = {
    id: generateArchetypeId(),
    archetype,
    name,
    description: '',
    vibe: '',
    role: 'supporting',
  };
  _state.archetypes.push(arch);
  return arch;
}

export function removeArchetype(id: string): void {
  _state.archetypes = _state.archetypes.filter((a) => a.id !== id);
}

export function updateArchetype(id: string, partial: Partial<ConceptArchetype>): void {
  const arch = _state.archetypes.find((a) => a.id === id);
  if (arch) Object.assign(arch, partial);
}

export function setGenerationPrompts(prompts: string[]): void {
  _state.generationPrompts = prompts;
}

export function setScriptOutline(outline: string): void {
  _state.scriptOutline = outline;
}

export function setSceneKitBuilt(): void {
  _state.sceneKitBuilt = true;
}

export function buildConceptPayload(): {
  projectId: string;
  moodDescription: string;
  vibe: ConceptWizardVibe;
  colorPalette: string[];
  sceneSettings: string;
  lightingDesc: string;
  atmosphereNotes: string;
  atmosphereTags: string[];
  imageDataUrls: string[];
} {
  return {
    projectId: _state.projectId,
    moodDescription: _state.moodDescription,
    vibe: { ..._state.currentVibe },
    colorPalette: [..._state.colorPalette],
    sceneSettings: _state.sceneSettings,
    lightingDesc: _state.lightingDesc,
    atmosphereNotes: _state.atmosphereNotes,
    atmosphereTags: [..._state.atmosphereTags],
    imageDataUrls: _state.uploadedImages.map((img) => img.dataUrl),
  };
}

/**
 * Apply the concept wizard's generated scene kit into the live project data.
 * Writes styleGuide, colorState, mood board items, and placeholder characters.
 */
export function applyConceptWizardSceneKit(): {
  styleGuideUpdated: boolean;
  moodBoardItemsAdded: number;
  charactersAdded: number;
  promptTemplate: string;
} {
  const s = _state;
  const result = {
    styleGuideUpdated: false,
    moodBoardItemsAdded: 0,
    charactersAdded: 0,
    promptTemplate: '',
  };

  // 1. Style guide + color state
  const palette = s.generatedColorPalette?.length ? s.generatedColorPalette : s.colorPalette;
  if (palette.length) {
    const { styleGuide: sg } = require('@/data/project-data') as typeof import('@/data/project-data');
    sg.colorPalette = [...palette];
    sg.lightingMood = s.lightingMood || s.lightingDesc || '';
    sg.visualTone = s.styleNotes || s.moodDescription || '';
    result.styleGuideUpdated = true;

    const { colorState } = require('@/color/color-state') as typeof import('@/color/color-state');
    colorState.setPalette(palette);
  }

  // 2. Mood board images
  if (s.generatedImages.length) {
    const { addMoodBoardItem, activeMoodBoardId, moodBoards } = require('@/data/project-data') as typeof import('@/data/project-data');
    let targetBoardId = activeMoodBoardId;
    if (!targetBoardId && moodBoards.length) {
      targetBoardId = moodBoards[0].id;
    }
    if (targetBoardId) {
      for (const img of s.generatedImages) {
        addMoodBoardItem(targetBoardId, {
          type: 'image',
          label: img.prompt.slice(0, 60),
          source: img.url,
          active: false,
          notes: '',
          order: 0,
          metadata: {},
        });
        result.moodBoardItemsAdded += 1;
      }
    }
  }

  // 3. Placeholder characters from archetypes
  if (s.archetypes.length) {
    const { assetLibrary: lib } = require('@/data/project-data') as typeof import('@/data/project-data');
    if (!lib.characters) lib.characters = [];
    for (const arch of s.archetypes) {
      lib.characters.push({
        id: arch.id,
        name: arch.name,
        role: arch.role,
        desc: `${arch.archetype}: ${arch.description} (${arch.vibe})`,
        type: 'actor',
        usageRefs: [],
      });
      result.charactersAdded += 1;
    }
  }

  // 4. Style-locked prompt template
  const tone = s.styleNotes || s.moodDescription || '';
  const lighting = s.lightingMood || s.lightingDesc || '';
  const paletteStr = (s.generatedColorPalette?.length ? s.generatedColorPalette : s.colorPalette).join(', ');
  const tags = (s.generatedAtmosphereTags?.length ? s.generatedAtmosphereTags : s.atmosphereTags).join(', ');
  result.promptTemplate = [
    tone && `Tone: ${tone}`,
    lighting && `Lighting: ${lighting}`,
    paletteStr && `Palette: ${paletteStr}`,
    tags && `Atmosphere: ${tags}`,
  ].filter(Boolean).join(' | ');

  return result;
}

export function buildScriptOutlinePayload(): {
  characters: Array<{ name: string; role: string; description: string }>;
  locations: Array<{ name: string; intExt: string; description: string }>;
  style: { palette: string[]; mood: string; notes: string };
} {
  return {
    characters: _state.archetypes.map((a) => ({
      name: a.name,
      role: a.role,
      description: `${a.archetype}: ${a.description} (${a.vibe})`,
    })),
    locations: _state.locations.map((l) => ({
      name: l.name,
      intExt: l.intExt,
      description: l.description,
    })),
    style: {
      palette: [..._state.generatedColorPalette],
      mood: _state.lightingMood,
      notes: _state.styleNotes,
    },
  };
}
