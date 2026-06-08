export type LocationCamera = {
  id: string;
  label: string;
  position: { x: number; y: number };
  rotation: number;
  description?: string;
  shotTransformations: LocationShotTransformation[];
};

export type LocationShotTransformation = {
  id: string;
  shotType: string;
  focalLength?: string;
  backdropUrl?: string;
  thumbnailUrl?: string;
  notes?: string;
  isActive: boolean;
};

export type LocationPlanView = {
  imageUrl?: string;
  overlaySvg?: string;
  scaleReference?: { pixels: number; feet: number };
};

export type LocationGuide = {
  locationId: string;
  planView?: LocationPlanView;
  cameras: LocationCamera[];
  metadata: {
    createdAt: number;
    updatedAt: number;
    version: number;
  };
};

export const SHOT_TYPES = [
  'ECU',
  'CU',
  'MCU',
  'MS',
  'MLS',
  'Cowboy',
  'LS/WS',
  'ELS'
] as const;

export type ShotType = typeof SHOT_TYPES[number];

export function isValidShotType(type: string): type is ShotType {
  return SHOT_TYPES.includes(type as ShotType);
}

export function createLocationGuide(locationId: string): LocationGuide {
  return {
    locationId,
    cameras: [],
    metadata: {
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1
    }
  };
}

export function createCamera(label: string, position: { x: number; y: number }, rotation = 0): LocationCamera {
  return {
    id: `cam-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    label,
    position,
    rotation,
    shotTransformations: []
  };
}

export function createShotTransformation(shotType: ShotType, focalLength?: string): LocationShotTransformation {
  return {
    id: `shot-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    shotType,
    focalLength,
    isActive: true
  };
}

export function getDefaultFocalLength(shotType: ShotType): string {
  const defaults: Record<ShotType, string> = {
    'ECU': '100mm',
    'CU': '85mm',
    'MCU': '70mm',
    'MS': '50mm',
    'MLS': '35mm',
    'Cowboy': '35mm',
    'LS/WS': '24mm',
    'ELS': '14mm'
  };
  return defaults[shotType] || '50mm';
}