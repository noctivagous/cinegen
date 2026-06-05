import { alertCG } from '@/utils/alert-cg';
import { updateInspector } from '@/components/panels/cinegen-inspector';
import { previsSelectionState, currentSceneData, styleGuide, activeProjectId } from '@/data/project-data';
import { colorState } from '@/color/color-state';
import { getShotById } from '@/workspace/shot-frame-bridge';
import { CG_PREVIS_SELECTION_CHANGED } from '@/events/shell-events';
import { markProjectDirty } from '@/services/project-service';
import { markActiveShotPrompted } from '@/services/generation-queue-service';
import { getAgentHealth, buildGenerationPrompt } from '@/services/ai/agents-service';
import { getCameraLightingPreviewSrc } from '@/camera/camera-lighting-previews';
import { findExpressionById } from '@/components/panels/expression-palette';

/** Camera, lighting and atmosphere option data */

declare global {
  function renderGlobalAssets(idx: number): void;
}

export interface CameraItemParam {
  key: string;
  label: string;
  type: 'select' | 'range' | 'toggle';
  defaultValue: string | number | boolean;
  options?: { label: string; value: string }[];
  min?: number;
  max?: number;
  step?: number;
}

export interface CameraItem {
  abbr: string;
  name: string;
  desc: string;
  params?: CameraItemParam[];
}

interface CameraSubcategory {
  title: string;
  abbrs: string[];
}

interface CameraSection {
  id: string;
  title: string;
  icon: string;
  items: CameraItem[];
  subcategories?: CameraSubcategory[];
}

interface CameraLightingData extends Record<string, CameraSection> {
  shotTypes: CameraSection;
  angles: CameraSection;
  lighting: CameraSection;
  composition: CameraSection;
  movements: CameraSection;
}

// ==================== CAMERA / LIGHTING / ATMOSPHERE DATA ====================
export const cameraLightingData: CameraLightingData = {
  shotTypes: {
    id: 'shot-types',
    title: 'Shot Types & Framing',
    icon: 'fa-expand',
    items: [
      { abbr: 'MCU',    name: 'Medium Close-Up',     desc: 'Chest up — balances character with subtle environment', params: [{ key: 'focalLength', label: 'Focal Length', type: 'select', defaultValue: '70mm', options: [{ label: '35mm', value: '35mm' }, { label: '40mm', value: '40mm' }, { label: '50mm', value: '50mm' }, { label: '70mm', value: '70mm' }, { label: '85mm', value: '85mm' }, { label: '100mm', value: '100mm' }] }] },
      { abbr: 'CU',     name: 'Close-Up',            desc: 'Face or object fills the frame — builds intimacy and connection', params: [{ key: 'focalLength', label: 'Focal Length', type: 'select', defaultValue: '85mm', options: [{ label: '24mm', value: '24mm' }, { label: '35mm', value: '35mm' }, { label: '50mm', value: '50mm' }, { label: '70mm', value: '70mm' }, { label: '85mm', value: '85mm' }, { label: '100mm', value: '100mm' }, { label: '135mm', value: '135mm' }] }] },
      { abbr: 'ECU',    name: 'Extreme Close-Up',    desc: 'Tight on eyes, texture or small object — intense emotion or fine detail', params: [{ key: 'focalLength', label: 'Focal Length', type: 'select', defaultValue: '100mm', options: [{ label: '50mm', value: '50mm' }, { label: '70mm', value: '70mm' }, { label: '85mm', value: '85mm' }, { label: '100mm', value: '100mm' }, { label: '120mm', value: '120mm' }, { label: '135mm', value: '135mm' }, { label: '200mm', value: '200mm' }] }] },
      { abbr: 'MLS',    name: 'Medium Long Shot',    desc: 'Thighs up (3/4 shot) — balances subject and setting', params: [{ key: 'focalLength', label: 'Focal Length', type: 'select', defaultValue: '35mm', options: [{ label: '18mm', value: '18mm' }, { label: '24mm', value: '24mm' }, { label: '35mm', value: '35mm' }, { label: '40mm', value: '40mm' }, { label: '50mm', value: '50mm' }] }] },
      { abbr: 'Cowboy', name: 'Cowboy Shot',         desc: 'Mid-thigh up — like MLS extended further down', params: [{ key: 'focalLength', label: 'Focal Length', type: 'select', defaultValue: '40mm', options: [{ label: '24mm', value: '24mm' }, { label: '35mm', value: '35mm' }, { label: '40mm', value: '40mm' }, { label: '50mm', value: '50mm' }, { label: '70mm', value: '70mm' }] }] },
      { abbr: 'MS',     name: 'Medium Shot',         desc: 'Waist up — cuts at belt line; natural for dialogue and body language', params: [{ key: 'focalLength', label: 'Focal Length', type: 'select', defaultValue: '50mm', options: [{ label: '24mm', value: '24mm' }, { label: '35mm', value: '35mm' }, { label: '40mm', value: '40mm' }, { label: '50mm', value: '50mm' }, { label: '70mm', value: '70mm' }, { label: '85mm', value: '85mm' }] }] },
      { abbr: 'ELS',    name: 'Extreme Long Shot',   desc: 'Vast landscape with tiny figure — creates awe and isolation', params: [{ key: 'focalLength', label: 'Focal Length', type: 'select', defaultValue: '18mm', options: [{ label: '14mm', value: '14mm' }, { label: '18mm', value: '18mm' }, { label: '24mm', value: '24mm' }, { label: '35mm', value: '35mm' }] }] },
      { abbr: 'LS/WS',  name: 'Long / Wide Shot',   desc: 'Full shot — head to toe, figure fills frame with minimal margin', params: [{ key: 'focalLength', label: 'Focal Length', type: 'select', defaultValue: '24mm', options: [{ label: '14mm', value: '14mm' }, { label: '18mm', value: '18mm' }, { label: '24mm', value: '24mm' }, { label: '35mm', value: '35mm' }, { label: '40mm', value: '40mm' }] }] },
    ],
    subcategories: [
      { title: 'Close Shots', abbrs: ['MCU', 'CU', 'ECU'] },
      { title: 'Mid-Range Shots', abbrs: ['MLS', 'Cowboy', 'MS'] },
      { title: 'Wide / Long Shots', abbrs: ['ELS', 'LS/WS'] },
    ],
  },
  angles: {
    id: 'angles',
    title: 'Camera Angles',
    icon: 'fa-arrows-to-dot',
    items: [
      { abbr: 'Eye-Level',  name: 'Eye-Level',              desc: 'Neutral and natural — builds trust and relatability' },
      { abbr: 'Low Angle',  name: 'Low Angle',              desc: 'Camera looks up — conveys power, heroism or intimidation' },
      { abbr: 'High Angle', name: 'High Angle',             desc: 'Camera looks down — suggests vulnerability, overview or dominance' },
      { abbr: 'Dutch',      name: 'Dutch / Tilt Angle',     desc: 'Horizon tilted — creates unease, tension or dynamic energy' },
      { abbr: 'Overhead',   name: "Overhead / Bird's Eye",  desc: 'Straight down — reveals patterns, layouts or abstract beauty' },
      { abbr: "Worm's Eye", name: "Worm's Eye",             desc: 'Extreme low — makes subjects appear towering and dramatic' },
      { abbr: 'OTS',        name: 'Over-the-Shoulder',      desc: 'From behind one character — builds conversation flow' },
      { abbr: 'POV',        name: 'Point-of-View',          desc: "Character's direct view — immersive, subjective feel" },
    ]
  },
  lighting: {
    id: 'lighting',
    title: 'Lighting Techniques',
    icon: 'fa-lightbulb',
    items: [
      { abbr: '3-Point',   name: 'Three-Point Lighting',        desc: 'Key + fill + backlight — classic balance and subject separation', params: [{ key: 'colorTemp', label: 'Color Temp', type: 'select', defaultValue: 'Neutral', options: [{ label: 'Warm (3200K)', value: 'Warm' }, { label: 'Neutral (4400K)', value: 'Neutral' }, { label: 'Cool (5600K)', value: 'Cool' }] }, { key: 'contrast', label: 'Contrast', type: 'select', defaultValue: 'Normal', options: [{ label: 'Normal', value: 'Normal' }, { label: 'High', value: 'High' }, { label: 'Low', value: 'Low' }] }] },
      { abbr: 'High-Key',  name: 'High-Key Lighting',           desc: 'Bright, even, low contrast — clean, upbeat, optimistic feel', params: [{ key: 'colorTemp', label: 'Color Temp', type: 'select', defaultValue: 'Warm', options: [{ label: 'Warm (3200K)', value: 'Warm' }, { label: 'Neutral (4400K)', value: 'Neutral' }, { label: 'Cool (5600K)', value: 'Cool' }] }] },
      { abbr: 'Low-Key',   name: 'Low-Key Lighting',            desc: 'Deep shadows, high contrast — mystery, drama and tension', params: [{ key: 'colorTemp', label: 'Color Temp', type: 'select', defaultValue: 'Cool', options: [{ label: 'Warm (3200K)', value: 'Warm' }, { label: 'Neutral (4400K)', value: 'Neutral' }, { label: 'Cool (5600K)', value: 'Cool' }] }] },
      { abbr: 'Side',      name: 'Side Lighting',               desc: 'Light from left or right — sculpts texture and adds depth', params: [{ key: 'colorTemp', label: 'Color Temp', type: 'select', defaultValue: 'Neutral', options: [{ label: 'Warm (3200K)', value: 'Warm' }, { label: 'Neutral (4400K)', value: 'Neutral' }, { label: 'Cool (5600K)', value: 'Cool' }] }, { key: 'contrast', label: 'Contrast', type: 'select', defaultValue: 'Normal', options: [{ label: 'Normal', value: 'Normal' }, { label: 'High', value: 'High' }, { label: 'Low', value: 'Low' }] }] },
      { abbr: 'Backlit',   name: 'Backlighting / Silhouette',   desc: 'Light behind subject — mystery, outlines or ethereal glow', params: [{ key: 'colorTemp', label: 'Color Temp', type: 'select', defaultValue: 'Warm', options: [{ label: 'Warm (3200K)', value: 'Warm' }, { label: 'Neutral (4400K)', value: 'Neutral' }, { label: 'Cool (5600K)', value: 'Cool' }] }, { key: 'intensity', label: 'Intensity', type: 'select', defaultValue: 'Medium', options: [{ label: 'Low', value: 'Low' }, { label: 'Medium', value: 'Medium' }, { label: 'High', value: 'High' }] }] },
      { abbr: 'Rim',       name: 'Rim Lighting',                desc: 'Thin highlight around edges — separation and elegance', params: [{ key: 'colorTemp', label: 'Color Temp', type: 'select', defaultValue: 'Cool', options: [{ label: 'Warm (3200K)', value: 'Warm' }, { label: 'Neutral (4400K)', value: 'Neutral' }, { label: 'Cool (5600K)', value: 'Cool' }] }, { key: 'intensity', label: 'Intensity', type: 'select', defaultValue: 'Medium', options: [{ label: 'Low', value: 'Low' }, { label: 'Medium', value: 'Medium' }, { label: 'High', value: 'High' }] }] },
      { abbr: 'Golden Hr', name: 'Golden Hour',                 desc: 'Warm sunrise/sunset light — natural warmth and romance', params: [{ key: 'warmth', label: 'Warmth', type: 'select', defaultValue: 'Medium', options: [{ label: 'Low', value: 'Low' }, { label: 'Medium', value: 'Medium' }, { label: 'High', value: 'High' }] }] },
      { abbr: 'Blue Hr',   name: 'Blue Hour / Cool',            desc: 'Twilight tones — moody, calm and introspective', params: [{ key: 'coolness', label: 'Coolness', type: 'select', defaultValue: 'Medium', options: [{ label: 'Low', value: 'Low' }, { label: 'Medium', value: 'Medium' }, { label: 'High', value: 'High' }] }] },
      { abbr: 'Practical', name: 'Practical Lighting',          desc: 'Visible sources like lamps, windows, fire — grounded realism', params: [{ key: 'colorTemp', label: 'Color Temp', type: 'select', defaultValue: 'Warm', options: [{ label: 'Warm (3200K)', value: 'Warm' }, { label: 'Neutral (4400K)', value: 'Neutral' }, { label: 'Cool (5600K)', value: 'Cool' }] }, { key: 'intensity', label: 'Intensity', type: 'select', defaultValue: 'Medium', options: [{ label: 'Low', value: 'Low' }, { label: 'Medium', value: 'Medium' }, { label: 'High', value: 'High' }] }] },
      { abbr: 'Gels',      name: 'Colored Gels / Motivated',    desc: 'Tinted lights for emotional tone — neon, firelight or moonlight', params: [{ key: 'gelColor', label: 'Gel Color', type: 'select', defaultValue: 'Blue', options: [{ label: 'Red', value: 'Red' }, { label: 'Blue', value: 'Blue' }, { label: 'Green', value: 'Green' }, { label: 'Amber', value: 'Amber' }, { label: 'Pink', value: 'Pink' }, { label: 'Purple', value: 'Purple' }, { label: 'Orange', value: 'Orange' }] }, { key: 'intensity', label: 'Intensity', type: 'select', defaultValue: 'Medium', options: [{ label: 'Low', value: 'Low' }, { label: 'Medium', value: 'Medium' }, { label: 'High', value: 'High' }] }] },
      { abbr: 'Hard',      name: 'Hard Light',                  desc: 'Sharp shadows — tense, realistic, high energy', params: [{ key: 'colorTemp', label: 'Color Temp', type: 'select', defaultValue: 'Neutral', options: [{ label: 'Warm (3200K)', value: 'Warm' }, { label: 'Neutral (4400K)', value: 'Neutral' }, { label: 'Cool (5600K)', value: 'Cool' }] }] },
      { abbr: 'Soft',      name: 'Soft Light',                  desc: 'Diffused gentle shadows — flattering, dreamy, approachable', params: [{ key: 'colorTemp', label: 'Color Temp', type: 'select', defaultValue: 'Neutral', options: [{ label: 'Warm (3200K)', value: 'Warm' }, { label: 'Neutral (4400K)', value: 'Neutral' }, { label: 'Cool (5600K)', value: 'Cool' }] }] },
    ]
  },
  composition: {
    id: 'composition',
    title: 'Frame Composition',
    icon: 'fa-crop',
    items: [
      { abbr: 'Rule of ⅓', name: 'Rule of Thirds',              desc: 'Subject at imaginary grid intersections — natural balance and visual interest' },
      { abbr: 'Centered',  name: 'Centered Composition',        desc: 'Subject directly in middle — symmetry, strength and direct focus' },
      { abbr: 'Asymm.',    name: 'Asymmetrical Balance',        desc: 'Uneven yet complete arrangement — contrasting weights and shapes' },
      { abbr: 'Symm.',     name: 'Symmetrical Balance',         desc: 'Mirror-like arrangement — harmony, stability and formality' },
      { abbr: 'Lead Lines',name: 'Leading Lines',               desc: 'Lines that guide the eye toward the main subject' },
      { abbr: 'Frame²',   name: 'Framing Within a Frame',      desc: 'Doorways, windows or arches surround subject — depth and focus' },
      { abbr: 'Neg Space', name: 'Negative Space',              desc: 'Empty areas around the subject — isolation, importance or breathing room' },
      { abbr: 'φ Grid',    name: 'Golden Ratio / Phi Grid',     desc: 'Curved balance points — organic, pleasing natural proportions' },
      { abbr: 'FMB',       name: 'Foreground · Mid · Back',    desc: 'Layered elements at different distances — depth and 3D feel' },
      { abbr: 'Diagonal',  name: 'Diagonal Composition',        desc: 'Slanted lines or placement — dynamic energy and movement' },
      { abbr: 'Tight',     name: 'Tight Framing',              desc: 'Cropped close around subject — intensity and confinement' },
      { abbr: 'Loose',     name: 'Loose Framing',              desc: 'Ample space around subject — freedom, openness or context' },
      { abbr: 'Overlap',   name: 'Overlapping Elements',        desc: 'Layers that interact — builds relationships and depth' },
      { abbr: 'S-Curve',   name: 'S-Curve',                    desc: 'Flowing curved lines — leads the eye gently through the frame' },
      { abbr: '△ Comp',    name: 'Pyramid / Triangular',        desc: 'Converging lines pointing upward — strength and focus' },
      { abbr: '○ Comp',    name: 'Circular Composition',        desc: 'Round arrangements — draws attention inward, unity and enclosure' },
    ]
  },
  movements: {
    id: 'movements',
    title: 'Camera Movements',
    icon: 'fa-arrows-left-right',
    items: [
      { abbr: 'Static',     name: 'Static Locked Off Shot',  desc: 'Absolutely still camera on tripod — no movement, pure composition' },
      { abbr: 'POV Track',  name: 'POV Tracking Shot',      desc: 'Camera follows character smoothly through space — creates immersion' },
      { abbr: 'Dolly Zoom', name: 'Dolly Zoom',             desc: 'Camera moves while zooming opposite way — disorienting emotional effect' },
      { abbr: 'Pan',        name: 'Pan',                    desc: 'Horizontal sweep across scene — reveals environment' },
      { abbr: 'Tilt',       name: 'Tilt',                   desc: 'Vertical sweep up or down — shows height or detail' },
      { abbr: 'Orbit',      name: 'Orbit / Circle Shot',    desc: 'Camera circles subject — dramatic 360° view' },
      { abbr: 'Handheld',   name: 'Handheld',               desc: 'Shaky, organic movement — realism, urgency or intimacy' },
      { abbr: 'Steadicam',  name: 'Steadicam / Glide',      desc: 'Fluid floating motion — elegant and controlled' },
      { abbr: 'Zoom',       name: 'Zoom In / Out',          desc: 'Gradual push or pull — shift focus or reveal scale' },
      { abbr: 'Push In',    name: 'Slow Steady Push In',    desc: 'Gradual dolly forward — builds tension or draws attention' },
      { abbr: 'Whip Pan',   name: 'Dynamic Whip Pan',       desc: 'Extremely fast pan between subjects — kinetic energy' },
      { abbr: 'Crane',      name: 'Crane Rising Shot',      desc: 'Camera rises vertically — reveals scale and grandeur' },
      { abbr: 'Drone',      name: 'Drone Aerial Sweep',     desc: 'Sweeping bird\'s-eye movement — epic establishing scope' },
    ]
  }
};

export let cameraLightingSelections: Record<string, string | null> = {
  shotTypes: null, angles: null, lighting: null,
  composition: null, movements: null
};

export let cameraLightingParams: Record<string, Record<string, unknown>> = {};

const SECTION_TO_SHOT_FIELD: Record<string, keyof typeof cameraLightingData> = {
  shotTypes: 'shotType',
  angles: 'cameraAngle',
  lighting: 'lightingTechnique',
  composition: 'composition',
  movements: 'cameraMovement',
};

function writeSelectionToActiveShot(sectionKey: string, abbr: string | null): void {
  const sceneId = previsSelectionState.sceneId;
  const shotId = previsSelectionState.shotId;
  if (!sceneId || shotId == null) return;
  const shot = getShotById(sceneId, shotId);
  if (!shot) return;

  const field = SECTION_TO_SHOT_FIELD[sectionKey];
  if (!field) return;

  (shot as Record<string, unknown>)[field] = abbr ?? undefined;

  // Mirror back into currentSceneData so the change is persisted
  const scene = currentSceneData[sceneId];
  if (scene && Array.isArray(scene.coverage)) {
    const idx = scene.coverage.findIndex((s: { id: number }) => s.id === shotId);
    if (idx >= 0) scene.coverage[idx] = shot;
  }

  markProjectDirty(['scenes']);
}

/** Camera / lighting / atmosphere panel */

// ==================== CAMERA / LIGHTING / ATMOSPHERE VIEW ====================
/** Read active shot's cinematography metadata into global chip selections */
export function syncCameraSelectionsFromActiveShot(): void {
  const sceneId = previsSelectionState.sceneId;
  const shotId = previsSelectionState.shotId;
  if (!sceneId || shotId == null) return;

  const shot = getShotById(sceneId, shotId);
  if (!shot) return;

  const fieldToSection: Record<string, string> = {
    shotType: 'shotTypes',
    cameraAngle: 'angles',
    lightingTechnique: 'lighting',
    composition: 'composition',
    cameraMovement: 'movements',
  };

  cameraLightingSelections = {
    shotTypes: null,
    angles: null,
    lighting: null,
    composition: null,
    movements: null,
  };

  for (const [field, section] of Object.entries(fieldToSection)) {
    const val = (shot as Record<string, unknown>)[field];
    if (typeof val === 'string') {
      cameraLightingSelections[section] = val;
    }
  }
}

function renderCameraChip(sectionKey: string, item: CameraItem): string {
  const selected = cameraLightingSelections[sectionKey] === item.abbr;
  const safeAbbr = item.abbr.replace(/'/g, '\\x27');
  const prefs = window.CineGen?.preferences;
  const showThumbs = prefs?.cameraChipsShowThumbnails !== false;
  const showDescs = prefs?.cameraChipsShowDescriptions !== false;
  const previewSrc = getCameraLightingPreviewSrc(sectionKey, item.abbr);
  const thumb = previewSrc && showThumbs
    ? `<img class="cl-chip-thumb" src="${previewSrc}" alt="${item.name} preview" width="124" height="70" loading="lazy" />`
    : '';
  const hasThumbClass = previewSrc && showThumbs ? ' cl-chip--has-thumb' : '';
  return `<div class="cl-chip${selected ? ' cl-chip--selected' : ''}${hasThumbClass}"
               onclick="selectCameraItem('${sectionKey}','${safeAbbr}')">
    ${thumb}
    <span class="cl-chip-abbr">${item.abbr}</span>
    <span class="cl-chip-name">${item.name}</span>
    ${showDescs ? `<span class="cl-chip-desc">${item.desc}</span>` : ''}
  </div>`;
}

function renderSectionChips(sectionKey: string, sec: CameraSection): string {
  let chipsHtml: string;
  if (sec.subcategories?.length) {
    const byAbbr = new Map(sec.items.map(item => [item.abbr, item]));
    const boxes = sec.subcategories.map(sub => {
      const chips = sub.abbrs
        .map(abbr => byAbbr.get(abbr))
        .filter((item): item is CameraItem => item != null)
        .map(item => renderCameraChip(sectionKey, item))
        .join('');
      return `
        <div class="cl-subcategory">
          <div class="cl-subcategory-header">${sub.title}</div>
          <div class="cl-chips-grid cl-chips-grid--nested">${chips}</div>
        </div>`;
    }).join('');
    chipsHtml = `<div class="cl-subcategories">${boxes}</div>`;
  } else {
    chipsHtml = `<div class="cl-chips-grid">${sec.items.map(item => renderCameraChip(sectionKey, item)).join('')}</div>`;
  }
  return chipsHtml + renderSectionParams(sectionKey);
}

function renderSectionParams(sectionKey: string): string {
  const sel = cameraLightingSelections[sectionKey];
  if (!sel) return '';
  const item = cameraLightingData[sectionKey]?.items.find(i => i.abbr === sel);
  if (!item?.params?.length) return '';
  const currentParams = cameraLightingParams[sectionKey] || {};
  const paramHtml = item.params.map(p => {
    const val = currentParams[p.key] ?? p.defaultValue;
    if (p.type === 'select' && p.options) {
      const opts = p.options.map(o =>
        `<option value="${o.value}"${o.value === val ? ' selected' : ''}>${o.label}</option>`
      ).join('');
      return `<label class="cl-param cl-param--select">
        <span class="cl-param-label">${p.label}</span>
        <select class="cl-param-input bevel-sunken" onchange="setCameraItemParam('${sectionKey}','${p.key}',this.value)">${opts}</select>
      </label>`;
    }
    return '';
  }).join('');
  return `<div class="cl-params-bar">${paramHtml}</div>`;
}

export function renderCameraLighting(scrollToSection?: string): void {
  syncCameraSelectionsFromActiveShot();
  const content = document.getElementById('camera-lighting-content');
  if (!content) return;

  const sectionOrder = ['shotTypes', 'angles', 'composition', 'movements', 'lighting'];

  content.innerHTML = sectionOrder.map(key => {
    const sec = cameraLightingData[key];
    return `
      <div class="cl-section" id="cl-section-${sec.id}">
        <div class="cl-section-header">
          <i class="fa-solid ${sec.icon}"></i>
          <span>${sec.title}</span>
          <span class="cl-section-count">${sec.items.length} options</span>
        </div>
        ${renderSectionChips(key, sec)}
      </div>`;
  }).join('');

  _updateCameraPromptBar();

  if (scrollToSection) {
    const el = document.getElementById(`cl-section-${scrollToSection}`);
    if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  }
}

export function _updateCameraPromptBar() {
  const bar = document.getElementById('camera-lighting-prompt-bar');
  const txt = document.getElementById('camera-lighting-prompt-text');
  if (!bar || !txt) return;
  const parts = Object.entries(cameraLightingSelections)
    .filter(([, v]) => v !== null)
    .map(([k, abbr]) => {
      const item = cameraLightingData[k]?.items.find(i => i.abbr === abbr);
      if (!item) return abbr;
      let name = item.name;
      const paramValues = item.params
        ?.map(p => cameraLightingParams[k]?.[p.key] ?? null)
        .filter(v => v !== null) as string[];
      if (paramValues?.length) {
        name += ` (${paramValues.join(', ')})`;
      }
      return name;
    });
  if (parts.length) {
    txt.textContent = parts.join(' · ');
    bar.classList.remove('hidden');
  } else {
    bar.classList.add('hidden');
  }
}

export function selectCameraItem(sectionKey: string, abbr: string): void {
  const next = cameraLightingSelections[sectionKey] === abbr ? null : abbr;
  cameraLightingSelections[sectionKey] = next;
  if (next !== abbr) {
    delete cameraLightingParams[sectionKey];
  } else {
    cameraLightingParams[sectionKey] = {};
  }
  writeSelectionToActiveShot(sectionKey, next);
  renderCameraLighting();
  updateInspector('camera-lighting', cameraLightingSelections);
}

export function setCameraItemParam(sectionKey: string, paramKey: string, value: string): void {
  if (!cameraLightingParams[sectionKey]) {
    cameraLightingParams[sectionKey] = {};
  }
  cameraLightingParams[sectionKey][paramKey] = value;
  renderCameraLighting();
  updateInspector('camera-lighting', cameraLightingSelections);
}

export function buildPromptPartsFromSelections(selections: Record<string, string | null>): string[] {
  return Object.entries(selections)
    .filter((entry): entry is [string, string] => entry[1] !== null)
    .map(([k, abbr]) => {
      const item = cameraLightingData[k]?.items.find((i: CameraItem) => i.abbr === abbr);
      if (!item) return abbr;
      let name = item.name;
      const paramValues = item.params
        ?.map(p => cameraLightingParams[k]?.[p.key] ?? null)
        .filter(v => v !== null) as string[];
      if (paramValues?.length) {
        name += ` (${paramValues.join(', ')})`;
      }
      return name;
    });
}

function buildLocalCameraPrompt(): string | null {
  const sceneId = previsSelectionState.sceneId;
  const shotId = previsSelectionState.shotId;
  let parts: string[] = [];

  // Prefer active shot's stored cinematography metadata
  if (sceneId && shotId != null) {
    const shot = getShotById(sceneId, shotId);
    if (shot) {
      const fieldToSection: Record<string, string> = {
        shotType: 'shotTypes',
        cameraAngle: 'angles',
        lightingTechnique: 'lighting',
        composition: 'composition',
        cameraMovement: 'movements',
      };
      const shotSelections: Record<string, string | null> = {};
      for (const [field, section] of Object.entries(fieldToSection)) {
        const val = (shot as Record<string, unknown>)[field];
        shotSelections[section] = typeof val === 'string' ? val : null;
      }
      parts = buildPromptPartsFromSelections(shotSelections);

      // Inject expression/performance data when available
      if (shot.expression) {
        const expr = findExpressionById(shot.expression);
        if (expr) {
          parts.push(`performance: ${expr.promptDesc}`);
        } else {
          parts.push(`performance: ${shot.expression}`);
        }
      }
      if (shot.emotion && shot.emotion !== shot.expression) {
        parts.push(`emotion: ${shot.emotion}`);
      }
      if (shot.beatSequence) {
        parts.push(`emotional arc: ${shot.beatSequence}`);
      }
    }
  }

  // Fall back to global selections if no active shot metadata
  if (!parts.length) {
    parts = buildPromptPartsFromSelections(cameraLightingSelections);
  }

  if (!parts.length) {
    return null;
  }

  // Inject style guide context
  const palette = colorState.getPalette();
  if (palette.length) {
    parts.push(`color palette: ${palette.join(', ')}`);
  }
  if (styleGuide.lightingMood) {
    parts.push(`lighting mood: ${styleGuide.lightingMood}`);
  }
  if (styleGuide.visualTone) {
    parts.push(`visual tone: ${styleGuide.visualTone}`);
  }
  if (styleGuide.lensStyle) {
    parts.push(`lens style: ${styleGuide.lensStyle}`);
  }

  return parts.join(', ') + ', cinematic, 4K';
}

export async function buildCameraPrompt(): Promise<void> {
  const sceneId = previsSelectionState.sceneId;
  const shotId = previsSelectionState.shotId;

  // Try agent dispatch when we have an active project and shot
  if (activeProjectId && sceneId && shotId != null) {
    try {
      const health = await getAgentHealth();
      if (health.ready) {
        const shot = getShotById(sceneId, shotId);
        const result = await buildGenerationPrompt(
          activeProjectId,
          String(shotId),
          {
            sceneId,
            expression: shot?.expression,
            emotion: shot?.emotion,
            beatSequence: shot?.beatSequence,
            shotType: shot?.shotType,
            cameraAngle: shot?.cameraAngle,
            cameraMovement: shot?.cameraMovement,
            lens: shot?.lens,
            lightingTechnique: shot?.lightingTechnique,
            composition: shot?.composition,
            sfxSelections: shot?.sfxSelections,
          },
        );
        if (result.ok && result.data) {
          markActiveShotPrompted(sceneId, shotId);
          alertCG(`Shot Prompt (Agent):\n\n"${result.data}"\n\nCopy this into the shot's prompt field or AI generation input.`);
          return;
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[buildCameraPrompt] Agent dispatch failed, falling back to local builder:', msg);
    }
  }

  // Local fallback
  const prompt = buildLocalCameraPrompt();
  if (!prompt) {
    alertCG('Select at least one option from the panels below to build a shot prompt.');
    return;
  }
  markActiveShotPrompted(sceneId, shotId);
  alertCG(`Shot Prompt:\n\n"${prompt}"\n\nCopy this into the shot's prompt field or AI generation input.`);
}

export function clearCameraSelections(): void {
  Object.keys(cameraLightingSelections).forEach((k: string) => { cameraLightingSelections[k] = null; });
  cameraLightingParams = {};
  renderCameraLighting();
  updateInspector('camera-lighting', cameraLightingSelections);
}

export function selectAsset(name: string): void {
  updateInspector('asset', { name });
}

export function addAssetToScene(name: string): void {
  alertCG(`Asset "${name}" linked across all scenes. Continuity enforced.`);
  renderGlobalAssets(0);
}

export function installCameraLightingBundleGlobals(): void {
  const w = window as unknown as Record<string, unknown>;
  w.renderCameraLighting = renderCameraLighting;
  w.selectCameraItem = selectCameraItem;
  w.buildCameraPrompt = buildCameraPrompt;
  w.clearCameraSelections = clearCameraSelections;
  w.selectAsset = selectAsset;
  w.addAssetToScene = addAssetToScene;
  w.cameraLightingData = cameraLightingData;
  w.cameraLightingSelections = cameraLightingSelections;
  w.cameraLightingParams = cameraLightingParams;
  w.setCameraItemParam = setCameraItemParam;

  // Auto-sync camera lighting chips when shot selection changes
  window.addEventListener(CG_PREVIS_SELECTION_CHANGED, () => {
    syncCameraSelectionsFromActiveShot();
    renderCameraLighting();
    updateInspector('camera-lighting', cameraLightingSelections);
  });
}
