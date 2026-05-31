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
  /** Optional script character span for box-outline boundaries. */
  scriptRange?: { start: number; end: number };
  /** Ordered storyboard frame ids belonging to this shot. */
  frameIds?: number[];

  /** Cinematography metadata (P0 Shot Architecture) */
  shotType?: string; // ECU, CU, MCU, MS, MLS, LS/WS, ELS
  cameraAngle?: string; // Eye-Level, Low Angle, High Angle, Dutch, Overhead, Worm's Eye, OTS, POV
  cameraMovement?: string; // Static, Pan, Tilt, Dolly, Truck, Zoom, Handheld, Steadicam, Arc, Crane, Drone
  lens?: string; // Wide (14–24mm), Standard (35–50mm), Portrait (85mm), Telephoto (135mm+), Macro, Anamorphic
  lightingTechnique?: string; // 3-Point, High-Key, Low-Key, Side, Backlit, Rim, Golden Hour, Blue Hour, Practical, Gels, Hard, Soft
  composition?: string; // Rule of Thirds, Centered, Leading Lines, Symmetry, Frame-within-Frame, Depth of Field, Negative Space
  atmosphereTags?: string[];

  /** Shot lifecycle status */
  status?: 'planned' | 'storyboarded' | 'prompted' | 'queued' | 'generated' | 'reviewed' | 'approved' | 'rejected' | 'locked';

  /** Linked downstream artifacts */
  linkedFrameIds?: string[];
  linkedClipId?: string;
  linkedAudioId?: string;

  /** Reference image IDs (characters, location plates, style refs) for generation */
  sceneReferenceSlots?: string[];
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
