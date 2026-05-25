export const PREPROD_MODES = new Set(['script', 'storyboard', 'both']);

export const TREE_VIEW_REQUIREMENTS: Record<string, { requiredFields?: string[] }> = {
  default: {},
  overview: {},
  'preprod-workspace': {},
  breakdown: {},
  'scene-detail': {},
  timeline: {},
  'location-scout': {},
  assets: {},
  'camera-lighting': {},
  casting: {},
  'chip-global': {},
  'asset-detail': { requiredFields: ['detailKey'] },
};

export const SUPPORTED_TREE_VIEWS = new Set(Object.keys(TREE_VIEW_REQUIREMENTS));

/**
 * Canonical legacy-to-web-component mapping for hierarchy/view routing.
 * Keep this aligned with `project-tree.cinetree` so migration parity remains explicit.
 */
export const LEGACY_NODE_VIEW_CONTRACT = [
  { nodeType: 'script', view: 'preprod-workspace', required: { preprodMode: 'script' } },
  { nodeType: 'storyboard', view: 'preprod-workspace', required: { preprodMode: 'storyboard' } },
  { nodeType: 'scriptboard', view: 'preprod-workspace', required: { preprodMode: 'both' } },
  { nodeType: 'breakdown', view: 'breakdown' },
  { nodeType: 'location-scout', view: 'location-scout' },
  { nodeType: 'casting', view: 'casting' },
  { nodeType: 'scene', view: 'scene-detail', required: { sceneId: '(scene id)' } },
  { nodeType: 'scene-shot', view: 'scene-detail', required: { sceneId: '(scene id)', shotId: '(coverage shot id)' } },
  { nodeType: 'storyboard-frame', view: 'preprod-workspace', required: { preprodMode: 'storyboard', frameId: '(frame id)' } },
  { nodeType: 'sequence', view: 'timeline' },
  { nodeType: 'assets', view: 'assets' },
  { nodeType: 'bin', view: 'asset-detail', required: { detailKey: '(detail key)' } },
  { nodeType: 'audio', view: 'asset-detail', required: { detailKey: '(detail key)' } },
  { nodeType: 'production', view: 'asset-detail', required: { detailKey: '(detail key)' } },
  { nodeType: 'folder', view: 'overview' },
];
