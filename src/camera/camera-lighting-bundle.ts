import { alertCG } from '@/utils/alert-cg';
import { updateInspector } from '@/components/panels/cinegen-inspector';
import { previsSelectionState, currentSceneData, styleGuide, activeProjectId } from '@/data/project-data';
import { colorState } from '@/color/color-state';
import { getShotById } from '@/workspace/shot-frame-bridge';
import { CG_PREVIS_SELECTION_CHANGED } from '@/events/shell-events';
import { markProjectDirty } from '@/services/project-service';
import { getAgentHealth, buildGenerationPrompt } from '@/services/ai/agents-service';

/** Camera, lighting and atmosphere option data */

declare global {
  function renderGlobalAssets(idx: number): void;
}

interface CameraItem {
  abbr: string;
  name: string;
  desc: string;
}

interface CameraSection {
  id: string;
  title: string;
  icon: string;
  items: CameraItem[];
}

interface CameraLightingData extends Record<string, CameraSection> {
  shotTypes: CameraSection;
  angles: CameraSection;
  lighting: CameraSection;
  composition: CameraSection;
  movements: CameraSection;
  atmosphere: CameraSection;
}

// ==================== CAMERA / LIGHTING / ATMOSPHERE DATA ====================
export const cameraLightingData: CameraLightingData = {
  shotTypes: {
    id: 'shot-types',
    title: 'Shot Types & Framing',
    icon: 'fa-expand',
    items: [
      { abbr: 'ECU',    name: 'Extreme Close-Up',    desc: 'Tight on eyes, texture or small object — intense emotion or fine detail' },
      { abbr: 'CU',     name: 'Close-Up',            desc: 'Face or object fills the frame — builds intimacy and connection' },
      { abbr: 'MCU',    name: 'Medium Close-Up',     desc: 'Chest up — balances character with subtle environment' },
      { abbr: 'MS',     name: 'Medium Shot',         desc: 'Waist up — natural for dialogue and body language' },
      { abbr: 'MLS',    name: 'Medium Long Shot',    desc: 'Knees up — shows action within the setting' },
      { abbr: 'LS/WS',  name: 'Long / Wide Shot',   desc: 'Full body or entire scene — establishes context and scale' },
      { abbr: 'ELS',    name: 'Extreme Long Shot',   desc: 'Vast landscape with tiny figure — creates awe and isolation' },
    ]
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
      { abbr: '3-Point',   name: 'Three-Point Lighting',        desc: 'Key + fill + backlight — classic balance and subject separation' },
      { abbr: 'High-Key',  name: 'High-Key Lighting',           desc: 'Bright, even, low contrast — clean, upbeat, optimistic feel' },
      { abbr: 'Low-Key',   name: 'Low-Key Lighting',            desc: 'Deep shadows, high contrast — mystery, drama and tension' },
      { abbr: 'Side',      name: 'Side Lighting',               desc: 'Light from left or right — sculpts texture and adds depth' },
      { abbr: 'Backlit',   name: 'Backlighting / Silhouette',   desc: 'Light behind subject — mystery, outlines or ethereal glow' },
      { abbr: 'Rim',       name: 'Rim Lighting',                desc: 'Thin highlight around edges — separation and elegance' },
      { abbr: 'Golden Hr', name: 'Golden Hour',                 desc: 'Warm sunrise/sunset light — natural warmth and romance' },
      { abbr: 'Blue Hr',   name: 'Blue Hour / Cool',            desc: 'Twilight tones — moody, calm and introspective' },
      { abbr: 'Practical', name: 'Practical Lighting',          desc: 'Visible sources like lamps, windows, fire — grounded realism' },
      { abbr: 'Gels',      name: 'Colored Gels / Motivated',    desc: 'Tinted lights for emotional tone — neon, firelight or moonlight' },
      { abbr: 'Hard',      name: 'Hard Light',                  desc: 'Sharp shadows — tense, realistic, high energy' },
      { abbr: 'Soft',      name: 'Soft Light',                  desc: 'Diffused gentle shadows — flattering, dreamy, approachable' },
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
      { abbr: 'POV Track',  name: 'POV Tracking Shot',      desc: 'Camera follows character smoothly through space — creates immersion' },
      { abbr: 'Dolly Zoom', name: 'Dolly Zoom',             desc: 'Camera moves while zooming opposite way — disorienting emotional effect' },
      { abbr: 'Pan',        name: 'Pan',                    desc: 'Horizontal sweep across scene — reveals environment' },
      { abbr: 'Tilt',       name: 'Tilt',                   desc: 'Vertical sweep up or down — shows height or detail' },
      { abbr: 'Orbit',      name: 'Orbit / Circle Shot',    desc: 'Camera circles subject — dramatic 360° view' },
      { abbr: 'Handheld',   name: 'Handheld',               desc: 'Shaky, organic movement — realism, urgency or intimacy' },
      { abbr: 'Steadicam',  name: 'Steadicam / Glide',      desc: 'Fluid floating motion — elegant and controlled' },
      { abbr: 'Zoom',       name: 'Zoom In / Out',          desc: 'Gradual push or pull — shift focus or reveal scale' },
    ]
  },
  atmosphere: {
    id: 'atmosphere',
    title: 'Atmospheric Effects',
    icon: 'fa-cloud-rain',
    items: [
      { abbr: 'Fog',       name: 'Fog / Mist',              desc: 'Low visibility — mysterious depth and ethereal mood' },
      { abbr: 'Rain',      name: 'Rain',                    desc: 'Wet surfaces and falling drops — tension, melancholy or romance' },
      { abbr: 'God Rays',  name: 'God Rays / Vol. Light',   desc: 'Shafts of light through haze — dramatic and sacred atmosphere' },
      { abbr: 'Dust',      name: 'Dust / Particles',        desc: 'Floating motes in the air — age, decay or dry heat' },
      { abbr: 'Haze',      name: 'Haze / Atmos. Haze',     desc: 'Soft horizon diffusion — distance and scale in outdoor shots' },
      { abbr: 'Smoke',     name: 'Smoke',                   desc: 'Billowing or drifting smoke — danger, mystery or aftermath' },
      { abbr: 'Snow',      name: 'Snow / Frost',            desc: 'Falling flakes or ice — isolation, purity or cold threat' },
      { abbr: 'Heat',      name: 'Heat Shimmer',            desc: 'Shimmering distortion off hot surfaces — oppressive heat' },
    ]
  }
};

export let cameraLightingSelections: Record<string, string | null> = {
  shotTypes: null, angles: null, lighting: null,
  composition: null, movements: null, atmosphere: null
};

const SECTION_TO_SHOT_FIELD: Record<string, keyof typeof cameraLightingData | 'atmosphereTags'> = {
  shotTypes: 'shotType',
  angles: 'cameraAngle',
  lighting: 'lightingTechnique',
  composition: 'composition',
  movements: 'cameraMovement',
  atmosphere: 'atmosphereTags',
};

function writeSelectionToActiveShot(sectionKey: string, abbr: string | null): void {
  const sceneId = previsSelectionState.sceneId;
  const shotId = previsSelectionState.shotId;
  if (!sceneId || shotId == null) return;
  const shot = getShotById(sceneId, shotId);
  if (!shot) return;

  const field = SECTION_TO_SHOT_FIELD[sectionKey];
  if (!field) return;

  if (field === 'atmosphereTags') {
    if (abbr) {
      shot.atmosphereTags = [abbr];
    } else {
      shot.atmosphereTags = [];
    }
  } else {
    (shot as Record<string, unknown>)[field] = abbr ?? undefined;
  }

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
    atmosphere: null,
  };

  for (const [field, section] of Object.entries(fieldToSection)) {
    const val = (shot as Record<string, unknown>)[field];
    if (typeof val === 'string') {
      cameraLightingSelections[section] = val;
    }
  }

  if (Array.isArray(shot.atmosphereTags) && shot.atmosphereTags.length) {
    cameraLightingSelections['atmosphere'] = shot.atmosphereTags[0];
  }
}

export function renderCameraLighting(scrollToSection?: string): void {
  syncCameraSelectionsFromActiveShot();
  const content = document.getElementById('camera-lighting-content');
  if (!content) return;

  const sectionOrder = ['shotTypes', 'angles', 'composition', 'movements', 'lighting', 'atmosphere'];

  content.innerHTML = sectionOrder.map(key => {
    const sec = cameraLightingData[key];
    return `
      <div class="cl-section" id="cl-section-${sec.id}">
        <div class="cl-section-header">
          <i class="fa-solid ${sec.icon}"></i>
          <span>${sec.title}</span>
          <span class="cl-section-count">${sec.items.length} options</span>
        </div>
        <div class="cl-chips-grid">
          ${sec.items.map((item: CameraItem) => {
            const selected = cameraLightingSelections[key] === item.abbr;
            const safeAbbr = item.abbr.replace(/'/g, '\\x27');
            return `<div class="cl-chip${selected ? ' cl-chip--selected' : ''}"
                         onclick="selectCameraItem('${key}','${safeAbbr}')">
              <span class="cl-chip-abbr">${item.abbr}</span>
              <span class="cl-chip-name">${item.name}</span>
              <span class="cl-chip-desc">${item.desc}</span>
            </div>`;
          }).join('')}
        </div>
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
      return item ? item.name : abbr;
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
  writeSelectionToActiveShot(sectionKey, next);
  renderCameraLighting();
  updateInspector('camera-lighting', cameraLightingSelections);
}

function buildPromptPartsFromSelections(selections: Record<string, string | null>): string[] {
  return Object.entries(selections)
    .filter((entry): entry is [string, string] => entry[1] !== null)
    .map(([k, abbr]) => {
      const item = cameraLightingData[k]?.items.find((i: CameraItem) => i.abbr === abbr);
      return item ? item.name : abbr;
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
      if (Array.isArray(shot.atmosphereTags) && shot.atmosphereTags.length) {
        shotSelections['atmosphere'] = shot.atmosphereTags[0];
      } else {
        shotSelections['atmosphere'] = null;
      }
      parts = buildPromptPartsFromSelections(shotSelections);
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
        const result = await buildGenerationPrompt(
          activeProjectId,
          String(shotId),
        );
        if (result.ok && result.data) {
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
  alertCG(`Shot Prompt:\n\n"${prompt}"\n\nCopy this into the shot's prompt field or AI generation input.`);
}

export function clearCameraSelections(): void {
  Object.keys(cameraLightingSelections).forEach((k: string) => { cameraLightingSelections[k] = null; });
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

  // Auto-sync camera lighting chips when shot selection changes
  window.addEventListener(CG_PREVIS_SELECTION_CHANGED, () => {
    syncCameraSelectionsFromActiveShot();
    renderCameraLighting();
    updateInspector('camera-lighting', cameraLightingSelections);
  });
}
