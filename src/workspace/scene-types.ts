export type SceneShot = {
  id: number;
  /** 1-based order within the scene (Shot 1, Shot 2, …). */
  number?: number;
  type?: string;
  /** Explicit previs role for timeline/margin labelling. */
  previsRole?: 'master' | 'coverage' | 'broll' | 'pickup';
  /** Explicit pickup tag; pickup shots can be inserted without restructuring scene flow. */
  isPickup?: boolean;
  label: string;
  duration: string;
  /** Approximate previs timing in seconds (non-locked editorial timing). */
  durationSeconds?: number;
  bestTake?: boolean;
  /** Primary Fountain anchor for this camera setup. */
  scriptLink?: string;
  /** Ordered storyboard frame ids belonging to this shot. */
  frameIds?: number[];
};

export type SceneBroll = {
  id: number;
  label: string;
  duration: string;
};

export type SceneMaster = {
  label: string;
  duration: string;
  status: string;
  prompt: string;
};

export type SceneDetail = {
  title: string;
  master: SceneMaster;
  coverage: SceneShot[];
  broll: SceneBroll[];
  pickups: SceneBroll[];
  notes: string;
};
