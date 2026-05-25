/** Human-readable shortcut label for UI chips (tree, grid, dock head). */

export function isMacPlatform(): boolean {
  return typeof navigator !== 'undefined' && navigator.platform.toLowerCase().includes('mac');
}

const MODIFIER_LABELS: Record<string, { mac: string; other: string }> = {
  alt: { mac: '⌥', other: 'Alt' },
  ctrl: { mac: '⌃', other: 'Ctrl' },
  cmd: { mac: '⌘', other: 'Ctrl' },
  meta: { mac: '⌘', other: 'Ctrl' },
  shift: { mac: '⇧', other: 'Shift' },
};

/**
 * @param combo Registry combo, e.g. `Alt+1`, `Alt+T`
 * @param options.joinWith Plus between parts on non-Mac (default). Mac joins with no separator.
 */
export function formatShortcutLabel(
  combo: string,
  options?: { joinWith?: string }
): string {
  const isMac = isMacPlatform();
  const joinWith = options?.joinWith ?? (isMac ? '' : '+');
  const parts = combo
    .replace(/\s+/g, '')
    .split('+')
    .filter(Boolean)
    .map((part) => {
      const key = part.toLowerCase();
      const mod = MODIFIER_LABELS[key];
      if (mod) return isMac ? mod.mac : mod.other;
      return part.length === 1 ? part.toUpperCase() : part;
    });
  return parts.join(joinWith);
}
