/** Context-menu destinations for a storyboard frame (shared by bundle + Lit grid). */
export const STORYBOARD_FRAME_DESTINATIONS = [
  { id: 'script', label: 'Script — go to anchor', icon: 'fa-scroll' },
  { id: 'preprod-both', label: 'Script + Storyboard', icon: 'fa-columns' },
  { id: 'storyboard', label: 'Storyboard', icon: 'fa-images' },
  { id: 'scene', label: 'Scene workspace', icon: 'fa-photo-film' },
  { id: 'breakdown', label: 'Breakdown — this scene', icon: 'fa-table-list' },
  { id: 'global', label: 'Global view — entities in frame', icon: 'fa-globe' },
] as const;
