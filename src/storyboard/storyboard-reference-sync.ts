import {
  assetLibrary,
  notifyStoryboardReferencesChanged,
  storyboardReferenceBank,
} from '@/data/project-data';
import { markProjectDirty } from '@/services/project-service';
import type { StoryboardReferenceSlot } from '@/storyboard/storyboard-types';

type ReferenceCategory = 'characters' | 'locations' | 'interiors' | 'exteriors';
const CATEGORIES: ReferenceCategory[] = ['characters', 'locations', 'interiors', 'exteriors'];

function normalizedBank(): Record<ReferenceCategory, StoryboardReferenceSlot[]> {
  for (const cat of CATEGORIES) {
    if (!Array.isArray((storyboardReferenceBank as Record<string, unknown>)[cat])) {
      (storyboardReferenceBank as Record<string, unknown>)[cat] = [];
    }
  }
  return storyboardReferenceBank as unknown as Record<ReferenceCategory, StoryboardReferenceSlot[]>;
}

function upsertSlot(
  bankArr: StoryboardReferenceSlot[],
  label: string,
  imageUrl: string,
): StoryboardReferenceSlot {
  const existing = bankArr.find(
    (s) => s.label.toLowerCase() === label.toLowerCase(),
  );
  if (existing) {
    if (!existing.locked) {
      existing.imageUrl = imageUrl;
      existing.source = 'user';
      existing.updatedAt = new Date().toISOString();
    }
    return existing;
  }
  const slot: StoryboardReferenceSlot = {
    id: `user-${label.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
    category: 'characters',
    label,
    prompt: `${label}, consistent appearance reference`,
    imageUrl,
    source: 'user',
    updatedAt: new Date().toISOString(),
  };
  bankArr.push(slot);
  return slot;
}

export function syncAssetLibraryToReferenceBank(): void {
  const bank = normalizedBank();

  const chars = Array.isArray(assetLibrary.characters) ? assetLibrary.characters : [];
  for (const char of chars) {
    if (!char || typeof char !== 'object') continue;
    const entry = char as Record<string, unknown>;
    const name = String(entry.name || entry.label || '');
    if (!name) continue;
    const refs = entry.references as Record<string, unknown> | undefined;
    if (!refs || typeof refs !== 'object') continue;
    const faceUrl = refs.face as string | undefined;
    if (faceUrl) {
      const slot = upsertSlot(bank.characters, name, faceUrl);
      slot.category = 'characters';
    }
    const bodyUrl = refs.body as string | undefined;
    if (bodyUrl && !faceUrl) {
      const slot = upsertSlot(bank.characters, name, bodyUrl);
      slot.category = 'characters';
    }
  }

  const locs = Array.isArray(assetLibrary.locations) ? assetLibrary.locations : [];
  for (const loc of locs) {
    if (!loc || typeof loc !== 'object') continue;
    const entry = loc as Record<string, unknown>;
    const name = String(entry.name || '');
    if (!name) continue;
    const refs = entry.references;
    const refArray = Array.isArray(refs) ? (refs as string[]) : [];
    const first = refArray.find((u) => u.startsWith('data:image/'));
    if (first) {
      const slot = upsertSlot(bank.locations, name, first);
      slot.category = 'locations';
    }
  }

  notifyStoryboardReferencesChanged();
  markProjectDirty(['storyboard']);
}
