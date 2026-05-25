import {
  createEmptyVisualWizardState,
  generateImageId,
  generateCharId,
  generateLocId,
  generatePropId,
  type VisualWizardState,
  type VisualWizardUpload,
  type VisualWizardCharacter,
  type VisualWizardLocation,
  type VisualWizardProp,
  type VisualWizardImageCategory,
} from '@/wizard/visual-wizard-state';

let _state: VisualWizardState = createEmptyVisualWizardState();

export function getVisualWizardState(): VisualWizardState {
  return _state;
}

export function resetVisualWizardState(): void {
  _state = createEmptyVisualWizardState();
}

export function setVisualWizardProjectId(projectId: string): void {
  _state.projectId = projectId;
}

export function setVisualWizardLightingMood(mood: string): void {
  _state.lightingMood = mood;
}

export function setVisualWizardStyleNotes(notes: string): void {
  _state.styleNotes = notes;
}

export function setVisualWizardColorPalette(palette: string[]): void {
  _state.colorPalette = palette;
}

export function addColorToPalette(color: string): void {
  if (!_state.colorPalette.includes(color)) {
    _state.colorPalette.push(color);
  }
}

export function removeColorFromPalette(color: string): void {
  _state.colorPalette = _state.colorPalette.filter((c) => c !== color);
}

export function setScriptGenerated(outline: string): void {
  _state.scriptGenerated = true;
  _state.scriptOutline = outline;
}

export function setSceneKitBuilt(): void {
  _state.sceneKitBuilt = true;
}

export function setStoryboardsGenerated(count: number): void {
  _state.storyboardsGenerated = true;
  _state.storyboardFrameCount = count;
}

export function readImageAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}

export async function addUploadedImage(
  file: File,
  category: VisualWizardImageCategory,
  customName?: string,
): Promise<VisualWizardUpload> {
  const dataUrl = await readImageAsDataUrl(file);
  const upload: VisualWizardUpload = {
    id: generateImageId(),
    file,
    dataUrl,
    name: customName || file.name.replace(/\.[^.]+$/, ''),
    category,
    tags: [],
  };
  _state.uploadedImages.push(upload);
  return upload;
}

export function removeUploadedImage(id: string): void {
  _state.uploadedImages = _state.uploadedImages.filter((img) => img.id !== id);
}

export function setUploadCategory(id: string, category: VisualWizardImageCategory): void {
  const img = _state.uploadedImages.find((i) => i.id === id);
  if (img) img.category = category;
}

export function getImagesByCategory(category: VisualWizardImageCategory): VisualWizardUpload[] {
  return _state.uploadedImages.filter((img) => img.category === category);
}

function findImageById(id: string): VisualWizardUpload | undefined {
  return _state.uploadedImages.find((img) => img.id === id);
}

export function addDetectedCharacter(name: string): VisualWizardCharacter {
  const char: VisualWizardCharacter = {
    id: generateCharId(),
    name,
    role: 'supporting',
    faceImage: null,
    profileImage: null,
    threeQuarterImage: null,
    fullBodyImage: null,
    age: '',
    build: '',
    vibe: '',
  };
  _state.characters.push(char);
  return char;
}

export function removeCharacter(id: string): void {
  _state.characters = _state.characters.filter((c) => c.id !== id);
}

export function updateCharacter(id: string, partial: Partial<VisualWizardCharacter>): void {
  const char = _state.characters.find((c) => c.id === id);
  if (char) Object.assign(char, partial);
}

export function assignImageToCharacter(
  charId: string,
  imageId: string,
  slot: 'faceImage' | 'profileImage' | 'threeQuarterImage' | 'fullBodyImage',
): void {
  const char = _state.characters.find((c) => c.id === charId);
  const img = findImageById(imageId);
  if (char && img) {
    char[slot] = img;
  }
}

export function addDetectedLocation(name: string, intExt: 'INT' | 'EXT' | 'INT/EXT'): VisualWizardLocation {
  const loc: VisualWizardLocation = {
    id: generateLocId(),
    name,
    exteriorImages: [],
    interiorImages: [],
    isInterior: intExt !== 'EXT',
    intExt,
    description: '',
  };
  _state.locations.push(loc);
  return loc;
}

export function removeLocation(id: string): void {
  _state.locations = _state.locations.filter((l) => l.id !== id);
}

export function updateLocation(id: string, partial: Partial<VisualWizardLocation>): void {
  const loc = _state.locations.find((l) => l.id === id);
  if (loc) Object.assign(loc, partial);
}

export function assignImageToLocation(locId: string, imageId: string, interior: boolean): void {
  const loc = _state.locations.find((l) => l.id === locId);
  const img = findImageById(imageId);
  if (loc && img) {
    if (interior) {
      if (!loc.interiorImages.find((i) => i.id === imageId)) {
        loc.interiorImages.push(img);
      }
    } else {
      if (!loc.exteriorImages.find((i) => i.id === imageId)) {
        loc.exteriorImages.push(img);
      }
    }
  }
}

export function addDetectedProp(name: string): VisualWizardProp {
  const prop: VisualWizardProp = {
    id: generatePropId(),
    name,
    image: null,
    description: '',
  };
  _state.props.push(prop);
  return prop;
}

export function removeProp(id: string): void {
  _state.props = _state.props.filter((p) => p.id !== id);
}

export function updateProp(id: string, partial: Partial<VisualWizardProp>): void {
  const prop = _state.props.find((p) => p.id === id);
  if (prop) Object.assign(prop, partial);
}

export function assignImageToProp(propId: string, imageId: string): void {
  const prop = _state.props.find((p) => p.id === propId);
  const img = findImageById(imageId);
  if (prop && img) {
    prop.image = img;
  }
}

export function buildSceneKitPayload(): {
  characters: VisualWizardCharacter[];
  locations: VisualWizardLocation[];
  props: VisualWizardProp[];
  style: { palette: string[]; lightingMood: string; notes: string };
} {
  return {
    characters: _state.characters,
    locations: _state.locations,
    props: _state.props,
    style: {
      palette: _state.colorPalette,
      lightingMood: _state.lightingMood,
      notes: _state.styleNotes,
    },
  };
}

export function buildGenerateOutlinePayload(): {
  characters: Array<{ name: string; role: string; description: string }>;
  locations: Array<{ name: string; intExt: string; description: string }>;
  style: { palette: string[]; mood: string; notes: string };
} {
  return {
    characters: _state.characters.map((c) => ({
      name: c.name,
      role: c.role,
      description: [c.age, c.build, c.vibe].filter(Boolean).join(', '),
    })),
    locations: _state.locations.map((l) => ({
      name: l.name,
      intExt: l.intExt,
      description: l.description,
    })),
    style: {
      palette: _state.colorPalette,
      mood: _state.lightingMood,
      notes: _state.styleNotes,
    },
  };
}

export function collectCategoryImagesForIdentify(): Array<{ dataUrl: string; category: string }> {
  return _state.uploadedImages.map((img) => ({
    dataUrl: img.dataUrl,
    category: img.category,
  }));
}

export function collectColorExtractionImages(): Array<{ dataUrl: string }> {
  return _state.uploadedImages.slice(0, 6).map((img) => ({
    dataUrl: img.dataUrl,
  }));
}
