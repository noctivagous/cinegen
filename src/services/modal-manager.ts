/**
 * ModalManager — centralized modal open/close/focus/backdrop handling.
 *
 * Modal chrome (overlay, backdrop, header/footer) lives in `<cg-modal-shell>`;
 * register the shell element's `id` here. Lazy-load body components via modal-loader.
 */

import { ensureModalReady } from '@/components/modals/modal-loader';
import { broadcastStateChange, subscribeStateSync } from '@/services/state-sync';

export type ModalId = string;

export interface ModalEntry {
  /** Logical modal id (e.g. 'guide-modal'). */
  id: ModalId;
  /** DOM element id; defaults to `id` if omitted. */
  elementId?: string;
  /** Called before the modal is shown. */
  onBeforeOpen?: () => void;
  /** Called after the modal is shown. */
  onAfterOpen?: () => void;
  /** Called before the modal is hidden. */
  onBeforeClose?: () => void;
  /** Called after the modal is hidden. */
  onAfterClose?: () => void;
  /** CSS class added to document.body while this modal is open. */
  bodyClass?: string;
  /** When true, document.body.style.overflow is set to 'hidden' while open. */
  bodyOverflow?: boolean;
  /** Optional vertical overflow behavior applied on the modal host element while open. */
  hostOverflowY?: '' | 'auto' | 'hidden' | 'scroll' | 'visible';
}

const registry = new Map<ModalId, ModalEntry>();
let _modalSaveDebounce: ReturnType<typeof setTimeout> | null = null;
const priorHostOverflowY = new Map<ModalId, string>();

function getEl(entry: ModalEntry): HTMLElement | null {
  return document.getElementById(entry.elementId ?? entry.id);
}

/** Register a modal with the manager. Safe to call multiple times (idempotent). */
export function registerModal(entry: ModalEntry): void {
  registry.set(entry.id, entry);
}

/** Unregister a modal. */
export function unregisterModal(id: ModalId): void {
  registry.delete(id);
}

/** Show a modal and close all other registered modals first. */
export function openModal(id: ModalId): void {
  void openModalAsync(id);
}

/** Async variant — awaits lazy-loaded modal chunks before showing. */
export async function openModalAsync(id: ModalId): Promise<void> {
  await ensureModalReady(id);

  const entry = registry.get(id);
  if (!entry) {
    console.warn(`ModalManager: modal "${id}" is not registered.`);
    return;
  }
  const el = getEl(entry);
  if (!el) {
    console.warn(`ModalManager: DOM element for "${id}" not found.`);
    return;
  }

  closeAllModalsExcept(id);

  entry.onBeforeOpen?.();

  el.hidden = false;
  el.setAttribute('aria-hidden', 'false');

  if (entry.bodyClass) document.body.classList.add(entry.bodyClass);
  if (entry.bodyOverflow) document.body.style.overflow = 'hidden';
  if (entry.hostOverflowY !== undefined) {
    priorHostOverflowY.set(id, el.style.overflowY);
    el.style.overflowY = entry.hostOverflowY;
  }

  entry.onAfterOpen?.();
  _broadcastModalState();
}

/** Hide a modal if it is currently open. */
export function closeModal(id: ModalId): void {
  const entry = registry.get(id);
  if (!entry) return;
  const el = getEl(entry);
  if (!el || el.hidden) return;

  entry.onBeforeClose?.();

  el.hidden = true;
  el.setAttribute('aria-hidden', 'true');

  if (entry.bodyClass) document.body.classList.remove(entry.bodyClass);
  if (entry.bodyOverflow) document.body.style.overflow = '';
  if (entry.hostOverflowY !== undefined) {
    const previous = priorHostOverflowY.get(id) ?? '';
    el.style.overflowY = previous;
    priorHostOverflowY.delete(id);
  }

  entry.onAfterClose?.();
  _broadcastModalState();
}

/** Close every registered modal. */
export function closeAllModals(): void {
  registry.forEach((entry) => {
    closeModal(entry.id);
  });
}

/** Close every registered modal except the given one. */
export function closeAllModalsExcept(id: ModalId): void {
  registry.forEach((entry) => {
    if (entry.id !== id) {
      closeModal(entry.id);
    }
  });
}

/** True if the modal is registered and not hidden. */
export function isModalOpen(id: ModalId): boolean {
  const entry = registry.get(id);
  if (!entry) return false;
  const el = getEl(entry);
  return el ? !el.hidden : false;
}

/** Return the id of the first open modal, or undefined if none. */
export function getOpenModalId(): ModalId | undefined {
  for (const entry of registry.values()) {
    if (isModalOpen(entry.id)) return entry.id;
  }
  return undefined;
}

/** Global Escape-key handler — closes the topmost open modal. */
export function handleModalEscapeKey(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return;

  // Don't interfere with open toolbar-split menus.
  if (document.querySelector('cg-toolbar-split.toolbar-split--open')) return;

  // Find the first open modal and close it.
  // Order in the registry determines priority (later = higher).
  const openId = getOpenModalId();
  if (openId) {
    closeModal(openId);
  }
}

function _broadcastModalState(): void {
  const mode = (import.meta.env.VITE_PROJECT_PERSISTENCE_MODE as string) || 'local';
  if (mode !== 'server') return;
  if (_modalSaveDebounce) clearTimeout(_modalSaveDebounce);
  _modalSaveDebounce = setTimeout(() => {
    _modalSaveDebounce = null;
    const openId = getOpenModalId();
    broadcastStateChange('modal', { openModalId: openId ?? null });
  }, 150);
}

/** Persist the currently open modal to the server. */
export function saveModalState(): void {
  _broadcastModalState();
}

/** Restore the open modal from server state. */
export function loadModalState(serverState: { openModalId?: string | null }): void {
  if (serverState.openModalId && registry.has(serverState.openModalId)) {
    openModal(serverState.openModalId);
  }
}

/** Subscribe to remote modal state changes. */
export function subscribeModalSync(): () => void {
  return subscribeStateSync((domain, payload) => {
    if (domain === 'modal' && payload && typeof payload === 'object') {
      const p = payload as Record<string, unknown>;
      const remoteOpenId = p.openModalId as string | null | undefined;
      const localOpenId = getOpenModalId();
      if (remoteOpenId && remoteOpenId !== localOpenId) {
        openModal(remoteOpenId);
      } else if (remoteOpenId === null && localOpenId) {
        closeModal(localOpenId);
      }
    }
  });
}

/** Install the global Escape listener. Idempotent. */
export function initModalManager(): void {
  if ((document as unknown as { _cgModalManagerInit?: boolean })._cgModalManagerInit) return;
  (document as unknown as { _cgModalManagerInit?: boolean })._cgModalManagerInit = true;
  document.addEventListener('keydown', handleModalEscapeKey);
}
