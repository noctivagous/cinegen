export interface KeybindingEntry {
  id: string;
  combo: string;
  action: () => void | Promise<void>;
  description: string;
  allowInInput?: boolean;
}

const registry = new Map<string, KeybindingEntry>();

function normalizeCombo(combo: string): string {
  const parts = combo
    .toLowerCase()
    .replace(/\s+/g, '')
    .split('+')
    .filter(Boolean);
  const order = ['ctrl', 'alt', 'shift', 'meta', 'cmd'];
  const modifiers = parts.filter((p) => order.includes(p)).sort((a, b) => order.indexOf(a) - order.indexOf(b));
  const key = parts.find((p) => !order.includes(p)) ?? '';
  return [...modifiers, key].join('+');
}

function eventToCombo(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey) parts.push('ctrl');
  if (e.altKey) parts.push('alt');
  if (e.shiftKey) parts.push('shift');
  if (e.metaKey) parts.push('meta');
  const key = e.key.toLowerCase();
  if (!['control', 'alt', 'shift', 'meta', 'cmd', 'os'].includes(key)) {
    parts.push(key);
  }
  return parts.join('+');
}

export function registerKeybinding(entry: KeybindingEntry): void {
  registry.set(normalizeCombo(entry.combo), entry);
}

export function unregisterKeybinding(combo: string): void {
  registry.delete(normalizeCombo(combo));
}

export function getKeybinding(combo: string): KeybindingEntry | undefined {
  return registry.get(normalizeCombo(combo));
}

export function getAllKeybindings(): KeybindingEntry[] {
  return Array.from(registry.values());
}

export function handleKeydown(e: KeyboardEvent): void {
  const combo = eventToCombo(e);
  const entry = registry.get(combo);
  if (!entry) return;

  const active = document.activeElement;
  const inInput =
    active instanceof HTMLInputElement ||
    active instanceof HTMLTextAreaElement ||
    active?.getAttribute('contenteditable') === 'true';

  if (inInput && !entry.allowInInput) return;

  e.preventDefault();
  void entry.action();
}
