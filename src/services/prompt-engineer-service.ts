import type { StoryboardFrame } from '@/storyboard/storyboard-types';
import type { SceneShot, SceneDetail } from '@/workspace/scene-types';
import type { StyleGuide, CharacterGuideEntry, LocationGuideEntry } from '@/services/ai/agents-service';
import { truncateToProviderLimit, type PromptElement } from '@/utils/prompt-truncation';
import { storyboardReferenceBank, sceneReferenceOverrides } from '@/data/project-data';
import type { StoryboardReferenceSlot, StoryboardReferenceCategory } from '@/storyboard/storyboard-types';

export interface BuildPromptInput {
  frame: StoryboardFrame;
  shot: SceneShot;
  scene: SceneDetail;
  projectSnapshot: ProjectSnapshot;
}

export interface ProjectSnapshot {
  genre?: string;
  tone?: string;
  notes?: string;
  aspectRatio?: string;
  styleGuide?: StyleGuide;
  colorPalette?: string[];
  characterGuide?: CharacterGuideEntry[];
  locationGuide?: LocationGuideEntry[];
  sceneReferenceOverrides?: unknown;
  breakdownData?: Record<string, string>[];
}

export interface GeneratedPrompt {
  text: string;
  elements: PromptElement[];
  dimensions: { w: number; h: number };
  refImageUrls: string[];
  sourceLog: string[];
}

const STORYBOARD_STYLE_PROMPT =
  'Pencil illustration of film frame, monochrome linework, cinematic composition, clear subject blocking, practical shot intent, no photorealism.';

const ASPECT_RATIO_SIZE_MAP: Record<string, string> = {
  '16:9': '1024x576',
  '9:16': '576x1024',
  '1:1': '1024x1024',
  '21:9': '1024x432',
  '2.39:1': '1024x432',
  '2.00:1': '1024x512',
  '1.85:1': '1024x544',
  '4:3': '1024x768',
  '1.37:1': '1024x752',
};

const EXPRESSION_PROMPT_MAP: Record<string, string> = {
  'determination': 'jaw set, focused gaze, unyielding posture',
  'assertion': 'upright stance, direct eye contact, commanding presence',
  'frustration': 'clenched fists, tight jaw, agitated movements',
  'irritation': 'narrowed eyes, pursed lips, slight head shake',
  'motivation': 'bright eyes, eager posture, forward lean',
  'joy': 'radiant smile, eyes crinkling with joy, warm open expression',
  'excitement': 'bouncing energy, wide eyes, rapid gestures',
  'laughter': 'thrown-back head, open mouth, shaking shoulders',
  'restlessness': 'shifting weight, darting eyes, fidgeting hands',
  'mania': 'erratic movement, wild eyes, uncontrollable energy',
  'contemplation': 'furrowed brow, distant gaze, still posture',
  'worry': 'nervous fidgeting, anxious glance, bitten lip',
  'overthinking': 'fixed stare, micro-expressions flickering, tense shoulders',
  'care': 'gentle tilt, soft eyes, reaching hand',
  'pensiveness': 'slumped shoulders, unfocused gaze, slow blinking',
  'sadness': 'tears streaming, hollow gaze, trembling lip',
  'melancholy': 'quiet sorrow, distant look, slow movements',
  'sorrow': 'heavy eyes, drooping posture, deep sighs',
  'detachment': 'blank expression, still face, unfocused eyes',
  'grief': 'wracking sobs, curled posture, shaking hands',
  'fear': 'wide eyes, shallow breathing, recoiling posture',
  'terror': 'eyes wide with terror, frozen, mouth open in silent scream',
  'stillness': 'calm composure, steady breath, unshakeable calm',
  'willpower': 'determined set of jaw, blazing eyes, straight spine',
  'paranoia': 'darting eyes, tense neck, glancing over shoulder',
};

function resolveExpressionText(shot: SceneShot): string {
  const beatSeq = shot.beatSequence;
  if (beatSeq) {
    const beats = beatSeq.split('→').map(b => b.trim());
    const fragments = beats.map((beat, i) => {
      const desc = EXPRESSION_PROMPT_MAP[beat.toLowerCase()] || beat;
      return `[~${i * 2}s] ${desc}`;
    });
    return `Expression arc: ${fragments.join(', then ')}.`;
  }

  const primary = shot.expression || shot.emotion;
  if (primary) {
    const desc = EXPRESSION_PROMPT_MAP[primary.toLowerCase()] || primary;
    return `Performance: ${desc}.`;
  }

  return '';
}

function resolveSubjectText(frame: StoryboardFrame, shot: SceneShot, scene: SceneDetail, snapshot: ProjectSnapshot): string {
  const parts: string[] = [];
  if (shot?.label && shot.label !== frame.label) {
    parts.push(shot.label);
  }
  if (frame.scriptLink) {
    parts.push(frame.scriptLink);
  }
  if (frame.label && !parts.some(p => p.toLowerCase().includes(frame.label!.toLowerCase()))) {
    parts.push(frame.label);
  }
  if (scene?.title) {
    parts.push(`in ${scene.title}`);
  }
  return parts.length ? parts.join('. ') + '.' : '';
}

function resolveCharacters(frame: StoryboardFrame, snapshot: ProjectSnapshot): string {
  const frameText = `${frame.label || ''} ${frame.scriptLink || ''} ${frame.notes || ''}`.toLowerCase();
  const mentioned: string[] = [];
  if (snapshot.characterGuide) {
    for (const char of snapshot.characterGuide) {
      if (frameText.includes(char.name.toLowerCase())) {
        const desc = char.physicalDescription ? ` (${char.physicalDescription})` : '';
        mentioned.push(`${char.name}${desc}`);
      }
    }
  }
  return mentioned.length ? mentioned.join(', ') : '';
}

function resolveLocation(scene: SceneDetail, shot: SceneShot, snapshot: ProjectSnapshot): string {
  const parts: string[] = [];
  if (scene?.title) parts.push(scene.title);
  const breakRow = resolveBreakdownRow(scene, snapshot);
  if (breakRow?.location) parts.push(`Location: ${breakRow.location}`);
  if (breakRow?.time) parts.push(`Time: ${breakRow.time}`);
  return parts.length ? parts.join('. ') + '.' : '';
}

function resolveBreakdownRow(scene: SceneDetail, snapshot: ProjectSnapshot): Record<string, string> | undefined {
  if (!snapshot.breakdownData) return undefined;
  const sceneNum = String(scene.title).replace(/\D/g, '');
  return snapshot.breakdownData.find(row => {
    const rowScene = String(row.scene ?? '').replace(/\D/g, '');
    return rowScene === sceneNum;
  });
}

function resolveFraming(shot: SceneShot): string {
  const parts: string[] = [];
  if (shot.shotType) parts.push(`Shot type: ${shot.shotType}`);
  if (shot.cameraAngle) parts.push(shot.cameraAngle);
  if (shot.composition) parts.push(shot.composition);
  return parts.length ? parts.join(', ') + '.' : '';
}

function resolveCameraMove(shot: SceneShot): string {
  if (shot.cameraMovement) return `Camera movement: ${shot.cameraMovement}.`;
  return '';
}

function resolveLens(shot: SceneShot, snapshot: ProjectSnapshot): string {
  const parts: string[] = [];
  if (shot.lens) parts.push(shot.lens);
  if (snapshot.styleGuide?.lensStyle) parts.push(snapshot.styleGuide.lensStyle);
  return parts.length ? `Lens: ${parts.join(', ')}.` : '';
}

function resolveVisualStyle(frame: StoryboardFrame, scene: SceneDetail, snapshot: ProjectSnapshot): string {
  const parts: string[] = [];
  const styleFromNotes = frame.notes?.match(/style\s*:\s*(.+)/i)?.[1]?.trim();
  if (styleFromNotes) {
    parts.push(styleFromNotes);
  } else {
    parts.push(STORYBOARD_STYLE_PROMPT);
  }
  if (snapshot.genre) parts.push(`Genre: ${snapshot.genre}`);
  const tone = scene?.visualToneOverride || snapshot.tone;
  if (tone) parts.push(`Tone: ${tone}`);
  if (snapshot.notes) parts.push(snapshot.notes);
  const palette = scene?.colorOverride?.length ? scene.colorOverride : snapshot.colorPalette;
  if (palette?.length) parts.push(`Color palette: ${palette.join(', ')}`);
  return parts.length ? parts.join('. ') + '.' : '';
}

function resolveLighting(shot: SceneShot, scene: SceneDetail, snapshot: ProjectSnapshot): string {
  const parts: string[] = [];
  if (shot.lightingTechnique) parts.push(shot.lightingTechnique);
  if (scene?.lightingOverride) parts.push(scene.lightingOverride);
  if (snapshot.styleGuide?.lightingMood) parts.push(snapshot.styleGuide.lightingMood);
  if (shot.sfxSelections) {
    const sfxParts: string[] = [];
    if (shot.sfxSelections.atmosphere) sfxParts.push(shot.sfxSelections.atmosphere.abbr);
    if (shot.sfxSelections.weather) sfxParts.push(shot.sfxSelections.weather.abbr);
    if (shot.sfxSelections.particleFx) sfxParts.push(shot.sfxSelections.particleFx.abbr);
    if (sfxParts.length) parts.push(sfxParts.join(', '));
  }
  return parts.length ? `Lighting: ${parts.join(', ')}.` : '';
}

function resolveMotionEnergy(shot: SceneShot, scene: SceneDetail): string {
  if (shot.cameraMovement) {
    const staticKeywords = ['static', 'locked', 'fixed', 'tripod'];
    const isStatic = staticKeywords.some(k => shot.cameraMovement!.toLowerCase().includes(k));
    return isStatic ? 'Static shot.' : `Motion energy: ${shot.cameraMovement}.`;
  }
  return '';
}

function resolveEffectiveReferences(sceneKey: string) {
  const bank = storyboardReferenceBank as Record<StoryboardReferenceCategory, StoryboardReferenceSlot[]>;
  const overrides = (sceneReferenceOverrides as Record<string, Partial<typeof bank>>)[sceneKey];
  const effective: Record<StoryboardReferenceCategory, StoryboardReferenceSlot[]> = {
    characters: [],
    locations: [],
    interiors: [],
    exteriors: [],
  };
  for (const cat of Object.keys(effective) as StoryboardReferenceCategory[]) {
    const base = bank[cat] || [];
    const override = overrides?.[cat] || [];
    const merged = [...base];
    for (const slot of override) {
      const idx = merged.findIndex(s => s.label.toLowerCase() === slot.label.toLowerCase());
      if (idx >= 0) merged[idx] = { ...merged[idx], ...slot };
      else merged.push(slot);
    }
    effective[cat] = merged.filter(s => s.enabled !== false);
  }
  return effective;
}

function getReferenceImageUrls(sceneKey: string): string[] {
  const effective = resolveEffectiveReferences(sceneKey);
  const catKeys = Object.keys(effective) as StoryboardReferenceCategory[];
  const urls: string[] = [];
  for (const cat of catKeys) {
    for (const slot of effective[cat]) {
      if (slot.imageUrl) urls.push(slot.imageUrl);
    }
  }
  return urls;
}

export function build10ElementPrompt(input: BuildPromptInput): GeneratedPrompt {
  const { frame, shot, scene, projectSnapshot: snapshot } = input;
  const aspectRatio = snapshot.aspectRatio || '16:9';

  const elements: PromptElement[] = [];

  // [1] SUBJECT
  const subjectText = resolveSubjectText(frame, shot, scene, snapshot);
  if (subjectText) {
    elements.push({ position: 1, name: 'Subject', text: subjectText, source: 'Frame.scriptLink / Shot.label' });
  }

  // [2] ACTION (embedded in subject already via scriptLink — add scene notes enrichment)
  if (scene?.master?.prompt) {
    elements.push({ position: 2, name: 'Action', text: `Scene intent: ${scene.master.prompt}.`, source: 'Scene.master' });
  }

  // [3] PERFORMANCE
  const perfText = resolveExpressionText(shot);
  if (perfText) {
    elements.push({ position: 3, name: 'Performance', text: perfText, source: `Shot.expression${shot.beatSequence ? '/beatSequence' : ''}` });
  } else if (scene?.notes) {
    elements.push({ position: 3, name: 'Performance', text: `Scene tone: ${scene.notes}.`, source: 'Scene.notes' });
  }

  // [4] SCENE / ENV
  const sceneText = resolveLocation(scene, shot, snapshot);
  if (sceneText) {
    elements.push({ position: 4, name: 'Scene/Environment', text: sceneText, source: 'Scene.title / Breakdown' });
  }

  // [5] FRAMING
  const framText = resolveFraming(shot);
  if (framText) {
    elements.push({ position: 5, name: 'Framing', text: framText, source: 'Shot.shotType / cameraAngle' });
  }

  // [6] CAMERA MOVE
  const camText = resolveCameraMove(shot);
  if (camText) {
    elements.push({ position: 6, name: 'Camera Move', text: camText, source: 'Shot.cameraMovement' });
  }

  // [7] LENS / OPTICS
  const lensText = resolveLens(shot, snapshot);
  if (lensText) {
    elements.push({ position: 7, name: 'Lens/Optics', text: lensText, source: 'Shot.lens / StyleGuide' });
  }

  // [8] VISUAL STYLE
  const styleText = resolveVisualStyle(frame, scene, snapshot);
  if (styleText) {
    elements.push({ position: 8, name: 'Visual Style', text: styleText, source: 'Frame.notes / Treatment' });
  }

  // [9] LIGHTING
  const lightText = resolveLighting(shot, scene, snapshot);
  if (lightText) {
    elements.push({ position: 9, name: 'Lighting', text: lightText, source: 'Shot.lightingTechnique / StyleGuide' });
  }

  // [10] MOTION ENERGY
  const motionText = resolveMotionEnergy(shot, scene);
  if (motionText) {
    elements.push({ position: 10, name: 'Motion Energy', text: motionText, source: 'Shot.cameraMovement' });
  }

  const size = ASPECT_RATIO_SIZE_MAP[aspectRatio] || '1024x576';
  const [w, h] = size.split('x').map(Number);

  const refImageUrls = getReferenceImageUrls(scene.title).slice(0, 4);
  const { text, sourceLog } = truncateToProviderLimit(elements, 3800);

  return {
    text,
    elements,
    dimensions: { w, h },
    refImageUrls,
    sourceLog,
  };
}
