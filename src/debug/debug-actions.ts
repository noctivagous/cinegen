import { openModal, closeModal, getOpenModalId } from '@/services/modal-manager';

export function clickButton(selectorOrText: string): boolean {
  let el: HTMLElement | null = null;
  if (selectorOrText.startsWith('#') || selectorOrText.includes('.') || selectorOrText.includes('[')) {
    el = document.querySelector(selectorOrText) as HTMLElement | null;
  } else {
    const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
    el = buttons.find((b) => (b as HTMLElement).textContent?.trim().includes(selectorOrText)) as HTMLElement | null;
  }
  if (el) {
    el.click();
    return true;
  }
  return false;
}

export function openWindow(name: string): boolean {
  const map: Record<string, string> = {
    sa: 'setup-assistant-modal',
    'setup-assistant': 'setup-assistant-modal',
    settings: 'settings-modal',
    projects: 'projects-modal',
    guide: 'guide-modal',
    'ai-assist': 'ai-assist-modal',
    'project-settings': 'project-settings-modal',
    debug: 'debug-modal',
  };
  const id = map[name.toLowerCase()];
  if (!id) return false;
  openModal(id);
  return true;
}

export function closeWindow(): boolean {
  const id = getOpenModalId();
  if (!id) return false;
  closeModal(id);
  return true;
}

export function selectDropdown(id: string, value: string): boolean {
  const sel = document.getElementById(id) as HTMLSelectElement | null;
  if (!sel) return false;
  sel.value = value;
  sel.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

export function typeInput(id: string, text: string): boolean {
  const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null;
  if (!el) return false;
  el.value = text;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
}

export function toggleSection(name: string): boolean {
  const tree = document.querySelector('cinegen-project-tree');
  if (!tree) return false;
  const el = (tree as HTMLElement).querySelector(`[data-name="${name}"]`);
  if (!el) return false;
  (el as HTMLElement).click();
  return true;
}
