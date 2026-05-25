import { registerKeybinding } from '@/keybindings/keybinding-registry';
import { formatShortcutLabel } from '@/keybindings/shortcut-display';
import { togglePrevisTimelineDock } from '@/services/layout-service';

/** Toggle the bottom previs timeline overlay drawer. */
export const PREVIS_TIMELINE_TOGGLE_COMBO = 'Alt+T';

export function getPrevisTimelineShortcutChip(): string {
  return formatShortcutLabel(PREVIS_TIMELINE_TOGGLE_COMBO);
}

export function registerPrevisTimelineKeybinding(): void {
  registerKeybinding({
    id: 'previs-timeline-toggle',
    combo: PREVIS_TIMELINE_TOGGLE_COMBO,
    description: 'Toggle Previs timeline drawer',
    action: () => togglePrevisTimelineDock(),
  });
}
