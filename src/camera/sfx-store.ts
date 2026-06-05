import type { CameraItem } from '@/camera/camera-lighting-bundle';
import { sfxSections } from '@/camera/sfx-data';

export type SFXSelection = { abbr: string; params?: Record<string, unknown> } | null;

export let sfxSelections: Record<string, SFXSelection> = {
  atmosphere: null,
  weather: null,
  particleFx: null,
};

export let sfxParams: Record<string, Record<string, unknown>> = {};

export function selectSFXItem(category: string, abbr: string): void {
  const next = sfxSelections[category]?.abbr === abbr ? null : { abbr };
  sfxSelections[category] = next;
  if (!next) {
    delete sfxParams[category];
  } else {
    sfxParams[category] = {};
  }
}

export function setSFXParam(category: string, paramKey: string, value: string): void {
  if (!sfxParams[category]) {
    sfxParams[category] = {};
  }
  sfxParams[category][paramKey] = value;
}

export function clearSFXSelections(): void {
  Object.keys(sfxSelections).forEach((k: string) => { sfxSelections[k] = null; });
  sfxParams = {};
}

export function getSFXPromptParts(): string[] {
  return Object.entries(sfxSelections)
    .filter((e): e is [string, { abbr: string; params?: Record<string, unknown> }] => e[1] !== null)
    .map(([category, sel]) => {
      const items = sfxSections[category];
      if (!items) return sel.abbr;
      const item = items.find((i: CameraItem) => i.abbr === sel.abbr);
      if (!item) return sel.abbr;
      let name = item.name;
      const params = sfxParams[category];
      const paramValues = item.params
        ?.map(p => params?.[p.key] ?? null)
        .filter(v => v !== null) as string[];
      if (paramValues?.length) {
        name += ` (${paramValues.join(', ')})`;
      }
      return name;
    });
}

export function sfxSelectionsToJSON(): Record<string, SFXSelection> {
  return Object.fromEntries(
    Object.entries(sfxSelections).map(([k, v]) => {
      if (!v) return [k, null];
      return [k, { abbr: v.abbr, params: sfxParams[k] ? { ...sfxParams[k] } : undefined }];
    })
  );
}

export function loadSFXSelectionsFromJSON(data: Record<string, unknown>): void {
  for (const [k, v] of Object.entries(data)) {
    if (sfxSelections[k] !== undefined) {
      sfxSelections[k] = v as SFXSelection;
      const entry = v as SFXSelection;
      if (entry?.params) {
        sfxParams[k] = { ...entry.params };
      }
    }
  }
}
