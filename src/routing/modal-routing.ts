/**
 * Modal URL routing — syncs modal open/close and nested state with ?modal= query param.
 * Called from modal-manager on open/close and from project-routing on view switch / init.
 */

/* ── Modal ID ↔ URL-safe name mapping ──────────────────────────────────── */

interface ModalUrlEntry {
  name: string;
  nestedKeys?: string[];
}

const MODAL_URL_MAP: Record<string, ModalUrlEntry> = {
  'guide-modal': { name: 'guide', nestedKeys: ['s'] },
  'projects-modal': { name: 'projects' },
  'settings-modal': { name: 'settings' },
  'appearance-modal': { name: 'appearance' },
  'ai-assist-modal': { name: 'ai-assist', nestedKeys: ['t'] },
  'project-settings-modal': { name: 'project-settings' },
  'ai-providers-modal': { name: 'ai-providers' },
  'ai-provider-info-modal': { name: 'ai-provider-info' },
  'section-settings-modal': { name: 'section-settings' },
  'project-features-modal': { name: 'project-features' },
  'sound-editor-modal': { name: 'sound-editor' },
  'wizards-modal': { name: 'wizards' },
  'script-wizard-modal': { name: 'wizard', nestedKeys: ['w'] },
  'visual-wizard-modal': { name: 'wizard', nestedKeys: ['w'] },
  'concept-wizard-modal': { name: 'wizard', nestedKeys: ['w'] },
  'asset-wizard-modal': { name: 'wizard', nestedKeys: ['w'] },
  'storyboard-wizard-modal': { name: 'wizard', nestedKeys: ['w'] },
  'debug-modal': { name: 'debug' },
  'setup-assistant-modal': { name: 'setup-assistant' },
  'moodboard-item-detail': { name: 'moodboard-item', nestedKeys: ['id'] },
};

/* ── Reverse map: URL name + optional nested discriminator → modal ID ──── */

const NAME_TO_IDS: Record<string, { discriminatorKey?: string; modalId: string }[]> = {};

for (const [modalId, entry] of Object.entries(MODAL_URL_MAP)) {
  const list = NAME_TO_IDS[entry.name] ??= [];
  list.push({ modalId, discriminatorKey: entry.nestedKeys?.[0] });
}

/* ── Helpers ───────────────────────────────────────────────────────────── */

export function modalIdToUrlName(modalId: string): string | null {
  const entry = MODAL_URL_MAP[modalId];
  return entry ? entry.name : null;
}

export function modalUrlNameToId(name: string, discriminator?: string): string | null {
  const candidates = NAME_TO_IDS[name];
  if (!candidates || candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0].modalId;
  if (discriminator) {
    const found = candidates.find((c) => c.discriminatorKey === discriminator);
    if (found) return found.modalId;
  }
  return candidates[0].modalId;
}

function getNestedParamKeys(modalId: string): string[] {
  return MODAL_URL_MAP[modalId]?.nestedKeys ?? [];
}

/* ── Extract modal state from current URL ──────────────────────────────── */

export interface ModalUrlState {
  modalId: string | null;
  nested: Record<string, string>;
}

export function extractModalParams(): ModalUrlState {
  const params = new URLSearchParams(window.location.search);
  const name = params.get('modal');
  if (!name) return { modalId: null, nested: {} };

  const nested: Record<string, string> = {};
  const candidateModalIds: string[] = [];

  // Find all modal IDs that share this URL name
  const allIds = NAME_TO_IDS[name];
  if (allIds) {
    for (const candidate of allIds) {
      candidateModalIds.push(candidate.modalId);
    }
  }

  // Collect nested params from URL
  let discriminatorKey: string | undefined;
  let discriminatorValue: string | undefined;

  for (const candidateId of candidateModalIds) {
    const keys = getNestedParamKeys(candidateId);
    for (const k of keys) {
      const v = params.get(k);
      if (v !== null) nested[k] = v;
    }
    // Check if this candidate has a discriminator key
    const entry = MODAL_URL_MAP[candidateId];
    if (entry?.nestedKeys?.length && entry.nestedKeys[0]) {
      const firstKey = entry.nestedKeys[0];
      const val = params.get(firstKey);
      if (val !== null) {
        discriminatorKey = firstKey;
        discriminatorValue = val;
      }
    }
  }

  // Resolve modal ID: try discriminator first, then fallback
  let modalId: string | null = null;
  if (candidateModalIds.length === 1) {
    modalId = candidateModalIds[0];
  } else if (discriminatorKey && discriminatorValue) {
    modalId = modalUrlNameToId(name, discriminatorKey);
  }

  return { modalId, nested };
}

/* ── Build query string from modal state ───────────────────────────────── */

export function buildModalQuery(modalId: string | null, nested?: Record<string, string>): string {
  if (!modalId) return '';
  const name = modalIdToUrlName(modalId);
  if (!name) return '';

  const params = new URLSearchParams();
  params.set('modal', name);

  if (nested) {
    const keys = getNestedParamKeys(modalId);
    for (const k of keys) {
      const v = nested[k];
      if (v) params.set(k, v);
    }
  }

  return params.toString();
}

/* ── Sync URL after modal open/close ───────────────────────────────────── */

import { type ModalId } from '@/services/modal-manager';

let _skipModalUrlSync = false;

export function setSkipModalUrlSync(v: boolean): void {
  _skipModalUrlSync = v;
}

export function syncUrlFromModal(
  modalId: ModalId | null,
  nested?: Record<string, string>
): void {
  if (_skipModalUrlSync) return;

  const qs = buildModalQuery(modalId, nested);
  const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
  const state: Record<string, unknown> = {
    ...(history.state as Record<string, unknown>),
    modal: modalId,
    modalNested: nested ?? null,
  };
  history.replaceState(state, '', url);
}

/* ── Merge existing modal params into a new URL path (for view-routing) ── */

export function modalQueryString(): string {
  const { modalId, nested } = extractModalParams();
  if (!modalId) return '';
  return buildModalQuery(modalId, nested);
}