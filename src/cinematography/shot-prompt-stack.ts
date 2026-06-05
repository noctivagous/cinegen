import {
  assetLibrary,
  sceneReferenceOverrides,
  storyboardReferenceBank,
  styleGuide,
} from '@/data/project-data';
import { buildPromptPartsFromShot } from '@/camera/camera-lighting-bundle';
import { cameraLightingData } from '@/camera/camera-lighting-bundle';
import { sfxSectionMeta } from '@/camera/sfx-data';
import { convertScriptLinesForPrompt } from '@/script/script-prompt-sanitize';
import type { SceneShot, SceneDetail } from '@/workspace/scene-types';
import type { StoryboardFrame } from '@/storyboard/storyboard-types';
import type { StoryboardReferenceSlot } from '@/storyboard/storyboard-types';

export type PromptStackItemKind = 'image' | 'text' | 'preset' | 'script';

export interface PromptStackParam {
  key: string;
  label: string;
  value: string;
}

export interface PromptStackItem {
  id: string;
  kind: PromptStackItemKind;
  category: string;
  label: string;
  body?: string;
  imageUrl?: string;
  params?: PromptStackParam[];
  source: string;
}

type AssetRecord = { id?: string; name?: string; desc?: string; description?: string };

export interface BuildPromptStackInput {
  sceneId: string;
  scene: SceneDetail;
  shot: SceneShot | null;
  frame?: StoryboardFrame | null;
  scriptLines: string[];
  characterLabels: string[];
  wardrobeLabels: string[];
  locationLabel: string;
}

function resolveAssetNames(ids: string[] | undefined, category: keyof typeof assetLibrary): string[] {
  if (!ids?.length) return [];
  const lib = (assetLibrary[category] as AssetRecord[]) || [];
  return ids.map((id) => lib.find((a) => a.id === id)?.name || id);
}

function resolveEffectiveReferences(sceneKey: string): Record<string, StoryboardReferenceSlot[]> {
  const bank = storyboardReferenceBank;
  const overrides = (sceneReferenceOverrides as Record<string, Partial<typeof bank>>)[sceneKey];
  const cats = ['characters', 'locations', 'interiors', 'exteriors'] as const;
  const effective: Record<string, StoryboardReferenceSlot[]> = {};
  for (const cat of cats) {
    const base = bank[cat] || [];
    const override = overrides?.[cat] || [];
    const merged = [...base];
    for (const slot of override) {
      const idx = merged.findIndex((s) => s.label.toLowerCase() === slot.label.toLowerCase());
      if (idx >= 0) merged[idx] = { ...merged[idx], ...slot };
      else merged.push(slot);
    }
    effective[cat] = merged.filter((s) => s.enabled !== false && s.imageUrl);
  }
  return effective;
}

function presetParamsForShot(shot: SceneShot, sectionKey: string, abbr: string): PromptStackParam[] {
  const item = cameraLightingData[sectionKey]?.items.find((i) => i.abbr === abbr);
  if (!item?.params?.length) return [];
  const stored = shot.cinematographyParams?.[sectionKey];
  return item.params.map((p) => ({
    key: p.key,
    label: p.label,
    value: String(stored?.[p.key] ?? p.defaultValue ?? ''),
  }));
}

function sfxParamsForShot(
  shot: SceneShot,
  sectionKey: 'atmosphere' | 'weather' | 'particleFx'
): PromptStackParam[] {
  const sel = shot.sfxSelections?.[sectionKey];
  if (!sel) return [];
  const section = sfxSectionMeta[sectionKey === 'particleFx' ? 'particleFx' : sectionKey];
  const item = section?.items.find((i) => i.abbr === sel.abbr);
  if (!item?.params?.length) return [];
  return item.params.map((p) => ({
    key: p.key,
    label: p.label,
    value: String(sel.params?.[p.key] ?? p.defaultValue ?? ''),
  }));
}

export function buildShotPromptStack(input: BuildPromptStackInput): PromptStackItem[] {
  const { scene, shot, frame, scriptLines, characterLabels, wardrobeLabels, locationLabel, sceneId } = input;
  const items: PromptStackItem[] = [];
  let seq = 0;
  const push = (item: Omit<PromptStackItem, 'id'> & { id?: string }) => {
    items.push({ ...item, id: item.id ?? `stack-${++seq}` });
  };

  if (frame?.imageUrl) {
    push({
      kind: 'image',
      category: 'Frame',
      label: frame.label || 'Storyboard frame',
      imageUrl: frame.imageUrl,
      source: 'StoryboardFrame.imageUrl',
    });
  }

  const refs = resolveEffectiveReferences(sceneId);
  for (const [cat, slots] of Object.entries(refs)) {
    for (const slot of slots) {
      if (!slot.imageUrl) continue;
      push({
        kind: 'image',
        category: cat === 'characters' ? 'Character Guide' : cat === 'exteriors' ? 'Backdrop' : 'Set Reference',
        label: slot.label,
        imageUrl: slot.imageUrl,
        body: slot.prompt || slot.notes,
        source: `ReferenceBank.${cat}`,
      });
    }
  }

  if (shot?.sceneReferenceSlots?.length) {
    shot.sceneReferenceSlots.forEach((url, i) => {
      push({
        kind: 'image',
        category: 'Shot Reference',
        label: `Reference ${i + 1}`,
        imageUrl: url,
        source: 'Shot.sceneReferenceSlots',
      });
    });
  }

  const chars =
    characterLabels.length > 0
      ? characterLabels
      : resolveAssetNames(scene.characterIds as string[] | undefined, 'characters');
  if (chars.length) {
    push({
      kind: 'text',
      category: 'Characters',
      label: chars.join(', '),
      body: chars.join(', '),
      source: 'Scene.characterIds',
    });
  }

  const wardrobe =
    wardrobeLabels.length > 0
      ? wardrobeLabels
      : resolveAssetNames(scene.wardrobeIds as string[] | undefined, 'wardrobe');
  if (wardrobe.length) {
    push({
      kind: 'text',
      category: 'Wardrobe',
      label: wardrobe.join(', '),
      body: wardrobe.join(', '),
      source: 'Scene.wardrobeIds',
    });
  }

  if (locationLabel) {
    push({
      kind: 'text',
      category: 'Location',
      label: locationLabel,
      body: locationLabel,
      source: 'Scene.title',
    });
  }

  if (shot) {
    const fieldMap: Record<string, { section: string; field: keyof SceneShot }> = {
      shotTypes: { section: 'shotTypes', field: 'shotType' },
      angles: { section: 'angles', field: 'cameraAngle' },
      movements: { section: 'movements', field: 'cameraMovement' },
      lighting: { section: 'lighting', field: 'lightingTechnique' },
      composition: { section: 'composition', field: 'composition' },
    };

    for (const { section, field } of Object.values(fieldMap)) {
      const abbr = shot[field];
      if (typeof abbr !== 'string') continue;
      const preset = cameraLightingData[section]?.items.find((i) => i.abbr === abbr);
      push({
        kind: 'preset',
        category: 'Cinematography',
        label: preset?.name || abbr,
        body: preset?.desc,
        params: presetParamsForShot(shot, section, abbr),
        source: `Shot.${String(field)}`,
      });
    }

    if (shot.lens) {
      push({
        kind: 'preset',
        category: 'Lens',
        label: shot.lens,
        source: 'Shot.lens',
      });
    }

    const sfxKeys = ['atmosphere', 'weather', 'particleFx'] as const;
    for (const key of sfxKeys) {
      const sel = shot.sfxSelections?.[key];
      if (!sel) continue;
      const metaKey = key === 'particleFx' ? 'particleFx' : key;
      const item = sfxSectionMeta[metaKey]?.items.find((i) => i.abbr === sel.abbr);
      push({
        kind: 'preset',
        category: 'Special Effects',
        label: item?.name || sel.abbr,
        body: item?.desc,
        params: sfxParamsForShot(shot, key),
        source: `Shot.sfxSelections.${key}`,
      });
    }

    if (shot.expression || shot.emotion) {
      push({
        kind: 'text',
        category: 'Performance',
        label: shot.expression || shot.emotion || '',
        body: [shot.expression, shot.emotion].filter(Boolean).join(' · '),
        source: 'Shot.expression',
      });
    }
  }

  if (styleGuide.visualTone || styleGuide.lightingMood) {
    push({
      kind: 'text',
      category: 'Style Guide',
      label: [styleGuide.visualTone, styleGuide.lightingMood].filter(Boolean).join(' · '),
      body: [
        styleGuide.visualTone && `Tone: ${styleGuide.visualTone}`,
        styleGuide.lightingMood && `Lighting mood: ${styleGuide.lightingMood}`,
        styleGuide.colorPalette?.length && `Palette: ${styleGuide.colorPalette.join(', ')}`,
      ]
        .filter(Boolean)
        .join('\n'),
      source: 'StyleGuide',
    });
  }

  if (scriptLines.length) {
    const conversion = convertScriptLinesForPrompt(scriptLines);
    if (conversion.promptText) {
      push({
        kind: 'script',
        category: 'Script (model prompt)',
        label: 'Sanitized dialogue & action',
        body: conversion.promptText,
        source: 'Screenplay (filtered)',
      });
    }
    const excluded = conversion.lines.filter((l) => l.kind === 'skipped');
    if (excluded.length) {
      push({
        kind: 'text',
        category: 'Script (excluded)',
        label: `${excluded.length} slug/cue lines withheld`,
        body: excluded.map((l) => l.raw).join('\n'),
        source: 'Screenplay (not sent)',
      });
    }
  }

  if (shot) {
    const assembled = buildPromptPartsFromShot(shot).join(' · ');
    if (assembled) {
      push({
        kind: 'text',
        category: 'Assembled prompt',
        label: 'Cinematography summary',
        body: assembled,
        source: 'buildPromptPartsFromShot',
      });
    }
  }

  return items;
}

export function serializePromptStackText(items: PromptStackItem[]): string {
  return items
    .filter((i) => i.kind !== 'image')
    .map((i) => {
      const params = i.params?.length
        ? ` (${i.params.map((p) => `${p.label}: ${p.value}`).join(', ')})`
        : '';
      return `[${i.category}] ${i.label}${params}${i.body && i.body !== i.label ? `: ${i.body}` : ''}`;
    })
    .join('\n');
}
