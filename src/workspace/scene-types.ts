export type SceneShot = {
  id: number;
  type?: string;
  label: string;
  duration: string;
  bestTake?: boolean;
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
