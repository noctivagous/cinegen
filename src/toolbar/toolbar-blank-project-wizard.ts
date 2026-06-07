import type { FeatureTreeNode } from '@/components/primitives/cg-feature-tree';
import {
  buildNextUntitledName,
  createNewProject,
  persistActiveProjectSettings,
} from '@/services/project-service';
import { projectRegistry } from '@/data/project-data';
import {
  buildAllEnabledFeaturesConfig,
  buildBlankProjectFeaturesConfig,
  flattenCatalogIds,
} from '@/tree/project-feature-catalog';
import {
  buildFeatureTreeForModal,
  configFromFeatureTreeNodes,
  effectiveParentId,
  setProjectFeaturesConfig,
} from '@/services/project-features-service';
import { requestProjectTreeRefresh } from '@/tree/project-tree-service';
import { storageService } from '@/services/persistence';
import { SCRIPT_PREVIS_MARGIN_COLLAPSED_KEY } from '@/constants/storage-keys';
import {
  closeProjectsModal,
  syncActiveProjectName,
  renderProjectsModalList,
} from '@/toolbar/toolbar-project-modals-service';
import { hydrateScriptEditorFromProject } from '@/script/fountain-bundle';
import { appShellStore } from '@/stores/app-shell-store';
import { alertCG } from '@/utils/alert-cg';
import { escHtml } from '@/utils/html';

let bwSlide = -1;
let bwFeatureNodes: FeatureTreeNode[] | null = null;
let bwFeatureOrder: string[] | null = null;

const BW_PRESETS = [
  { id: 'all', label: 'All', roots: ['all'] },
  { id: 'pre-production', label: 'Pre-Production', roots: ['production-office'] },
  { id: 'cinematography', label: 'Cinematography', roots: ['cinematography'] },
  { id: 'production-design', label: 'Production Design', roots: ['production-design'] },
  { id: 'casting', label: 'Casting', roots: ['casting'] },
  { id: 'sound', label: 'Sound', roots: ['sound-department'] },
  { id: 'post', label: 'Post Production', roots: ['post-production'] },
  { id: 'ai-director', label: 'AI Director', roots: ['ai-director'] },
  { id: 'minimal', label: 'Minimal', roots: ['minimal'] },
];

function resetBlankProjectWizard(): void {
  bwSlide = -1;
  bwFeatureNodes = null;
  bwFeatureOrder = null;
}

export function restoreProjectsList(): void {
  const layout = document.getElementById('projects-modal-layout');
  const wizardBody = document.getElementById('projects-modal-wizard-body');
  const footer = document.getElementById('projects-modal-footer');
  const titleEl = document.getElementById('projects-modal-title');
  if (layout) layout.style.removeProperty('display');
  if (wizardBody) wizardBody.style.display = 'none';
  if (footer) {
    footer.innerHTML = `<span class="projects-modal-footer-hint">Use the caret menu on the toolbar for a quick switch without closing the hub.</span>
<button type="button" class="toolbar-btn" data-cg-close="projects-modal">Close</button>`;
  }
  if (titleEl) titleEl.innerHTML = '<i class="fa-solid fa-folder-open"></i> Projects';
  resetBlankProjectWizard();
}

function renderBwResolutionSelect(aspectValue: string): void {
  const sel = document.getElementById('bw-resolution') as HTMLSelectElement | null;
  if (!sel) return;
  const getGroups = (window as any).getProjectResolutionOptionGroups;
  if (typeof getGroups !== 'function') return;
  const groups = getGroups(aspectValue);
  sel.replaceChildren();
  for (const group of groups) {
    const og = document.createElement('optgroup');
    og.label = group.groupLabel;
    for (const optDef of group.options) {
      const o = document.createElement('option');
      o.value = optDef.value;
      o.textContent = optDef.label;
      og.appendChild(o);
    }
    sel.appendChild(og);
  }
  const first = groups[0]?.options?.[0]?.value;
  if (first) sel.value = first;
}

function renderBlankProjectSlide0(): void {
  const name = buildNextUntitledName();
  const wb = document.getElementById('projects-modal-wizard-body');
  if (!wb) return;
  wb.innerHTML = `<div class="blank-project-wizard-form" style="padding:8px 12px;">
  <div class="cg-accordion project-settings-accordion">
    <details class="cg-accordion-section" open>
      <summary class="cg-accordion-header">Identity</summary>
      <div class="cg-accordion-body">
        <div class="cg-accordion-row">
          <label for="bw-name">Project name</label>
          <input id="bw-name" class="cg-field" type="text" maxlength="120" value="${escHtml(name)}">
        </div>
      </div>
    </details>
    <details class="cg-accordion-section" open>
      <summary class="cg-accordion-header">Picture</summary>
      <div class="cg-accordion-body">
        <div class="cg-accordion-row">
          <label for="bw-aspect">Aspect ratio</label>
          <div class="cg-nspopup-wrap">
            <select id="bw-aspect" class="cg-nspopup">
              <option value="16:9">16:9 HD / UHD</option>
              <option value="9:16">9:16 Vertical (social)</option>
              <option value="1:1">1:1 Square</option>
              <option value="21:9">21:9 Ultrawide</option>
              <option value="2.39:1" selected>2.39:1 Scope</option>
              <option value="2.00:1">2:1 Full frame (Netflix-style)</option>
              <option value="1.85:1">1.85:1 Flat</option>
              <option value="4:3">4:3 Academy / TV</option>
              <option value="1.37:1">1.37:1 Academy full</option>
            </select>
          </div>
        </div>
        <div class="cg-accordion-row">
          <label for="bw-resolution">Default resolution <small>(480p or 720p; matches aspect)</small></label>
          <div class="cg-nspopup-wrap">
            <select id="bw-resolution" class="cg-nspopup" aria-label="Default resolution by aspect"></select>
          </div>
        </div>
        <div class="cg-accordion-row">
          <label for="bw-colorspace">Working color</label>
          <div class="cg-nspopup-wrap">
            <select id="bw-colorspace" class="cg-nspopup">
              <option value="Rec.709" selected>Rec. 709</option>
              <option value="Rec.2020">Rec. 2020 / HDR pass-through</option>
              <option value="ACEScg">ACES cg (proxy)</option>
              <option value="DisplayP3">Display P3</option>
            </select>
          </div>
        </div>
      </div>
    </details>
    <details class="cg-accordion-section" open>
      <summary class="cg-accordion-header">Time base</summary>
      <div class="cg-accordion-body">
        <div class="cg-accordion-row">
          <label for="bw-fps">Frame rate</label>
          <div class="cg-nspopup-wrap">
            <select id="bw-fps" class="cg-nspopup">
              <option value="23.976">23.976 (24p NTSC)</option>
              <option value="24" selected>24.000</option>
              <option value="25">25 (PAL)</option>
              <option value="29.97">29.97 (NTSC)</option>
              <option value="30">30.000</option>
              <option value="47.95">47.95</option>
              <option value="48">48</option>
              <option value="50">50</option>
              <option value="59.94">59.94</option>
              <option value="60">60</option>
            </select>
          </div>
        </div>
        <div class="cg-accordion-row">
          <label for="bw-tc">Timecode</label>
          <div class="cg-nspopup-wrap">
            <select id="bw-tc" class="cg-nspopup">
              <option value="ndf" selected>Non-drop frame</option>
              <option value="df">Drop frame (29.97 / 59.94)</option>
            </select>
          </div>
        </div>
      </div>
    </details>
  </div>
</div>`;
  renderBwResolutionSelect('2.39:1');
  document.getElementById('bw-aspect')?.addEventListener('change', () => {
    const val = (document.getElementById('bw-aspect') as HTMLSelectElement)?.value;
    if (val) renderBwResolutionSelect(val);
  });
}

function renderBlankProjectSlide1(): void {
  const config = buildAllEnabledFeaturesConfig();
  bwFeatureNodes = buildFeatureTreeForModal(config);
  bwFeatureOrder = bwFeatureNodes.map((n) => n.id);
  const wb = document.getElementById('projects-modal-wizard-body');
  if (!wb) return;
  wb.innerHTML = `<p class="blank-project-features-lead" style="padding:8px 12px 4px;font-size:12px;color:var(--text-dim);">Enable departments and tools for this project.</p>
<div class="blank-project-preset-grid" id="bw-preset-grid"></div>
<div class="blank-project-features-tree bevel-sunken" id="bw-features-tree-wrap" style="flex:1;overflow:auto;margin:0 12px 8px;"></div>`;
  const presetGrid = document.getElementById('bw-preset-grid');
  if (presetGrid) {
    presetGrid.style.cssText = 'display:grid;grid-template-columns:repeat(5,1fr);gap:4px;padding:6px 12px;';
    for (const p of BW_PRESETS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'toolbar-btn bw-preset-btn';
      btn.textContent = p.label;
      btn.title = p.label;
      btn.style.cssText = 'font-size:11px;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
      btn.addEventListener('click', () => applyBwPreset(p.id));
      presetGrid.appendChild(btn);
    }
  }
  rebuildBwFeatureTree();
}

function rebuildBwFeatureTree(): void {
  const wrap = document.getElementById('bw-features-tree-wrap');
  if (!wrap) return;
  wrap.innerHTML = '';
  if (!bwFeatureNodes?.length) return;
  const tree = document.createElement('cg-feature-tree');
  (tree as any).nodes = bwFeatureNodes;
  tree.addEventListener('cg-change', ((e: Event) => {
    const detail = (e as CustomEvent<{ nodes: FeatureTreeNode[]; order: string[] }>).detail;
    bwFeatureNodes = detail.nodes;
    bwFeatureOrder = detail.order;
  }) as EventListener);
  wrap.appendChild(tree);
}

function applyBwPreset(presetId: string): void {
  let config: ReturnType<typeof buildBlankProjectFeaturesConfig>;
  if (presetId === 'all') {
    config = buildAllEnabledFeaturesConfig();
  } else if (presetId === 'minimal') {
    config = buildBlankProjectFeaturesConfig();
  } else {
    config = buildBlankProjectFeaturesConfig();
    const catalog = flattenCatalogIds();
    const roots = BW_PRESETS.find((p) => p.id === presetId)?.roots ?? [];
    for (const rootId of roots) {
      const prefix = rootId ? `${rootId}/` : '';
      for (const id of catalog) {
        if (id === rootId || id.startsWith(prefix)) {
          config.enabled[id] = true;
          let parent = effectiveParentId(id, config);
          while (parent) {
            config.enabled[parent] = true;
            parent = effectiveParentId(parent, config);
          }
        }
      }
    }
  }
  bwFeatureNodes = buildFeatureTreeForModal(config);
  bwFeatureOrder = bwFeatureNodes.map((n) => n.id);
  rebuildBwFeatureTree();
}

function renderBwFooter(): void {
  const footer = document.getElementById('projects-modal-footer');
  if (!footer) return;
  const total = 2;
  const current = bwSlide + 1;
  footer.innerHTML = `<button type="button" class="toolbar-btn" id="bw-prev"><i class="fa-solid fa-chevron-left"></i> Back</button>
<span id="bw-progress" class="guide-modal-progress entry-wizard-progress" style="margin-left:12px;">${current} of ${total}</span>
<button type="button" class="toolbar-btn btn-ai" id="bw-next" style="margin-left:auto;">Next <i class="fa-solid fa-chevron-right"></i></button>
<button type="button" class="toolbar-btn" id="bw-close" style="margin-left:8px;" data-cg-close="projects-modal">Close</button>`;
  document.getElementById('bw-prev')?.addEventListener('click', () => bwStep(-1));
  document.getElementById('bw-next')?.addEventListener('click', () => bwStep(1));
  document.getElementById('bw-close')?.addEventListener('click', () => {
    resetBlankProjectWizard();
  });
}

function renderBlankProjectSlide(index: number): void {
  bwSlide = index;
  const titleEl = document.getElementById('projects-modal-title');
  if (titleEl) titleEl.innerHTML = '<i class="fa-regular fa-file"></i> New Blank Project';
  if (index === 0) renderBlankProjectSlide0();
  else if (index === 1) renderBlankProjectSlide1();
  renderBwFooter();
  const prev = document.getElementById('bw-prev') as HTMLButtonElement | null;
  if (prev) prev.disabled = index <= 0;
}

function bwStep(delta: number): void {
  const next = bwSlide + delta;
  if (next < 0) {
    restoreProjectsList();
    return;
  }
  if (next > 1) {
    void finishBlankProjectWizard();
    return;
  }
  if (next > 1 || next < 0) return;
  renderBlankProjectSlide(next);
}

export function openBlankProjectWizard(): void {
  resetBlankProjectWizard();
  const layout = document.getElementById('projects-modal-layout');
  const wizardBody = document.getElementById('projects-modal-wizard-body');
  if (layout) layout.style.display = 'none';
  if (wizardBody) wizardBody.style.removeProperty('display');
  renderBlankProjectSlide(0);
}

async function finishBlankProjectWizard(): Promise<void> {
  const nameEl = document.getElementById('bw-name') as HTMLInputElement | null;
  const aspectEl = document.getElementById('bw-aspect') as HTMLSelectElement | null;
  const resEl = document.getElementById('bw-resolution') as HTMLSelectElement | null;
  const fpsEl = document.getElementById('bw-fps') as HTMLSelectElement | null;
  const tcEl = document.getElementById('bw-tc') as HTMLSelectElement | null;
  const csEl = document.getElementById('bw-colorspace') as HTMLSelectElement | null;
  const name = nameEl?.value?.trim() || buildNextUntitledName();
  const created = await createNewProject(name);
  if (!created) {
    alertCG('Failed to create blank project. Check the server is running.');
    return;
  }
  const registryEntry = projectRegistry.find((p) => p.id === created.id);
  if (registryEntry) {
    registryEntry.name = created.name || name;
    registryEntry.settings = registryEntry.settings || {};
    const norm = (window as any).normalizeProjectAspectRatio;
    registryEntry.settings.aspectRatio = aspectEl && norm ? norm(aspectEl.value) : (aspectEl?.value ?? '2.39:1');
    registryEntry.settings.defaultResolution = resEl?.value ?? '';
    registryEntry.settings.frameRate = fpsEl?.value ?? '24';
    registryEntry.settings.timecodeMode = tcEl?.value ?? 'ndf';
    registryEntry.settings.colorSpace = csEl?.value ?? 'Rec.709';
    persistActiveProjectSettings(created.id);
  }
  if (bwFeatureNodes?.length) {
    const config = configFromFeatureTreeNodes(bwFeatureNodes, bwFeatureOrder ?? []);
    setProjectFeaturesConfig(config);
  }
  appShellStore.setActiveProjectId(created.id);
  syncActiveProjectName(name);
  window.renderProjectsMenu?.();
  renderProjectsModalList();
  requestProjectTreeRefresh();
  hydrateScriptEditorFromProject();
  storageService.setItem(SCRIPT_PREVIS_MARGIN_COLLAPSED_KEY, 'true');
  window.dispatchEvent(new CustomEvent('previs-timing-changed'));
  resetBlankProjectWizard();
  closeProjectsModal();
}
