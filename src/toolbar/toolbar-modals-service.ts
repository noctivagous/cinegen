import { html } from 'lit';
import type { CgModalTileGrid } from '@/components/primitives/cg-modal-tile-grid';
import type { CinegenGuideModalBody } from '@/components/modals/cinegen-guide-modal-body';
import { closeAllToolbarSplitMenus, closeToolbarSplitMenu } from '@/services/toolbar-split-service';
import { appShellStore } from '@/stores/app-shell';
import { escHtml } from '@/utils/html';
import { alertCG } from '@/utils/alert-cg';
import { markProjectDirty, persistActiveProjectSnapshot } from '@/services/project-service';
import {
  AI_ASSIST_ASSISTANT_TILES,
  AI_ASSIST_TASK_TILES,
  GUIDE_SECTIONS,
  SETTINGS_MODAL_TILES,
  WIZARD_ENTRY_TILES,
} from '@/toolbar/toolbar-data';
import {
  buildNextUntitledName,
  createBlankProject,
  createNewProject,
  persistActiveProjectSettings,
} from '@/services/project-service';
import type { FeatureTreeNode } from '@/components/primitives/cg-feature-tree';
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
import { moodBoards } from '@/data/project-data';
import {
  closeAllModalsExcept,
  closeModal,
  openModal,
  openModalAsync,
  registerModal,
} from '@/services/modal-manager';
import { buildCheckboxTreeNodes, getCurrentSectionKey } from '@/services/section-visibility-service';
import { resetScriptWizardState } from '@/wizard/script-wizard-state';
import { createScriptWizardSlides } from '@/wizard/script-wizard-bundle';
import { syncFountainToProject } from '@/script/script-to-project';
import { SCRIPT_PREVIS_MARGIN_COLLAPSED_KEY } from '@/constants/storage-keys';
import { storageService } from '@/services/persistence';
import { requestProjectTreeRefresh } from '@/tree/project-tree-service';
import {
  closeDebugModal,
  openDebugModal,
  openSetupAssistantForDebug,
} from '@/toolbar/toolbar-debug-service';
import { closeAiProvidersModal, openAiProvidersModal } from '@/settings/ai-api-settings-bundle';
import { hydrateScriptEditorFromProject, scheduleFountainRender } from '@/script/fountain-bundle';
import { renderBreakdownTable } from '@/assets/assets-bundle';

export {
  clearProviderModelCacheForDebug,
  logSettingsStorageForDebug,
  openDebugGenerationForDebug,
  openSetupAssistantForDebug,
  reloadAppForDebug,
  resetAppSettingsForDebug,
  resetSetupAssistantProgressForDebug,
} from '@/toolbar/toolbar-debug-service';
import {
  closeProjectSettingsModal,
  closeProjectsModal,
  closeSettingsModal,
  initProjectSettingsAspectToResolutionSync,
  openProjectSettingsModal,
  openProjectsModal,
  openSettingsModal,
  renderProjectsModalList,
  saveProjectSettingsModal,
  syncActiveProjectName,
  wireProjectsModalList,
} from '@/toolbar/toolbar-project-modals-service';
import {
  closeAssetWizardModal as closeAssetWizardModalFromService,
  closeConceptWizardModal as closeConceptWizardModalFromService,
  closeScriptWizardModal as closeScriptWizardModalFromService,
  closeStoryboardWizardModal as closeStoryboardWizardModalFromService,
  closeVisualWizardModal as closeVisualWizardModalFromService,
  closeWizardsModal as closeWizardsModalFromService,
  launchWizardAction as launchWizardActionFromService,
  openAssetWizardModal as openAssetWizardModalFromService,
  openConceptWizardModal as openConceptWizardModalFromService,
  openScriptWizardModal as openScriptWizardModalFromService,
  openStoryboardWizardModal as openStoryboardWizardModalFromService,
  openVisualWizardModal as openVisualWizardModalFromService,
  openWizardsModal as openWizardsModalFromService,
  renderEntryWizardSlide as renderEntryWizardSlideFromService,
  type WizardSlide,
  wireWizardNavigationAndActions,
} from '@/toolbar/toolbar-wizard-modals-service';

export {
  closeProjectSettingsModal,
  closeProjectsModal,
  closeSettingsModal,
  openProjectSettingsModal,
  openProjectsModal,
  openSettingsModal,
  saveProjectSettingsModal,
  syncActiveProjectName,
  wireProjectsModalList,
};

let guideModalSectionIndex = 0;

/* ── Entry-point wizard slide data ─────────────────────────────────────────── */

const legacyGlobal = window as unknown as Record<string, unknown>;
const legacySetProjectFountainText = (text: string): void => {
  const fn = legacyGlobal.setProjectFountainText;
  if (typeof fn === 'function') (fn as (value: string) => void)(text);
};
const legacyGenerateStoryboardReferences = async (): Promise<void> => {
  const fn = legacyGlobal.generateStoryboardReferences;
  if (typeof fn === 'function') {
    await (fn as () => Promise<void>)();
  }
};
const legacyGenerateBoards = async (): Promise<void> => {
  const fn = legacyGlobal.generateBoards;
  if (typeof fn === 'function') {
    await (fn as () => Promise<void>)();
  }
};
const legacyAddItemsToLibrary = (
  bucket: string,
  values: string[],
  icon?: string,
  desc?: string
): void => {
  const fn = legacyGlobal.addItemsToLibrary;
  if (typeof fn === 'function') {
    (fn as (b: string, v: string[], i?: string, d?: string) => void)(bucket, values, icon, desc);
  }
};

const WIZARD_SLIDES: Record<string, WizardSlide[]> = {
  'script-wizard-modal': createScriptWizardSlides({
    createNewProject,
    setActiveProjectId: (projectId: string) => appShellStore.setActiveProjectId(projectId),
    syncActiveProjectName,
    setProjectFountainText: legacySetProjectFountainText,
    hydrateScriptEditorFromProject,
    renderProjectsModalList,
    renderEntryWizardSlide: (modalId: string, index: number) => renderEntryWizardSlide(modalId, index),
    generateStoryboardReferences: legacyGenerateStoryboardReferences,
    generateBoards: legacyGenerateBoards,
    closeScriptWizardModal,
    addItemsToLibrary: legacyAddItemsToLibrary,
    renderBreakdownTable,
    scheduleFountainRender,
    syncFountainToProject,
  }),
  'visual-wizard-modal': [
    /* Slide 1 — Upload Visual Anchors */
    {
      title: 'Upload Visual Anchors',
      renderFn: (host) => {
        const onFileChange = async (e: Event) => {
          const input = e.target as HTMLInputElement;
          const files = input?.files;
          if (!files?.length) return;
          const vw = (window as any).CineGen?.visualWizard;
          if (!vw) return;
          for (const file of Array.from(files)) {
            if (file.type.startsWith('image/')) {
              await vw.addImage(file, 'character');
            }
          }
          input.value = '';
          host.requestUpdate();
        };
        const onRemove = (id: string) => {
          (window as any).CineGen?.visualWizard?.removeImage(id);
          host.requestUpdate();
        };
        const onCategoryChange = (id: string, val: string) => {
          (window as any).CineGen?.visualWizard?.setCategory(id, val);
        };
        const onCreateProject = () => {
          const vw = (window as any).CineGen?.visualWizard;
          if (!vw) return;
          const state = vw.getState();
          if (!state.uploadedImages.length) {
            alertCG('Please upload at least one image first.');
            return;
          }
          const created = createBlankProject();
          appShellStore.setActiveProjectId(created.id);
          syncActiveProjectName(created.name);
          vw.setProjectId(created.id);
          const refresh = window as unknown as Record<string, (() => void) | undefined>;
          refresh.renderFullTree?.();
          refresh.renderBreakdownTable?.();
          refresh.renderStoryboard?.();
          refresh.renderTimeline?.();
          refresh.hydrateScriptEditorFromProject?.();
          window.renderProjectsMenu?.();
          renderProjectsModalList();
          const nextIndex = 1;
          const slides = WIZARD_SLIDES['visual-wizard-modal'];
          if (slides?.[nextIndex]) renderEntryWizardSlide('visual-wizard-modal', nextIndex);
        };
        return html`
          <div class="script-wizard-form">
            <p>Upload photos, mood boards, or existing character images. CineGen will auto-detect characters, settings, and props.</p>
            <div class="vw-drop-zone" style="border:2px dashed #555;border-radius:8px;padding:32px;text-align:center;margin-bottom:16px;">
              <i class="fa-solid fa-cloud-arrow-up" style="font-size:2em;display:block;margin-bottom:8px;"></i>
              <label for="vw-file-input" class="toolbar-btn" style="cursor:pointer;">Select Images</label>
              <input id="vw-file-input" type="file" multiple accept="image/*" @change=${onFileChange} style="display:none;" />
              <p style="margin-top:8px;color:#888;">or drag & drop images here</p>
            </div>
            ${(window as any).CineGen?.visualWizard?.getState().uploadedImages.length > 0 ? html`
              <div class="vw-thumbnail-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;margin-bottom:16px;">
                ${(window as any).CineGen?.visualWizard?.getState().uploadedImages.map((img: any) => html`
                  <div class="vw-thumb-item" style="position:relative;border:1px solid #444;border-radius:6px;overflow:hidden;">
                    <img src=${img.dataUrl} alt=${img.name} style="width:100%;height:100px;object-fit:cover;display:block;" />
                    <div style="padding:4px;">
                      <select class="cg-field" style="font-size:11px;width:100%;" .value=${img.category} @change=${(e: Event) => onCategoryChange(img.id, (e.target as HTMLSelectElement).value)}>
                        <option value="character">Character</option>
                        <option value="mood-board">Mood Board</option>
                        <option value="location">Location</option>
                        <option value="prop">Prop</option>
                        <option value="style-reference">Style Ref</option>
                      </select>
                    </div>
                    <button type="button" class="remove-chip-btn" @click=${() => onRemove(img.id)} style="position:absolute;top:2px;right:2px;background:rgba(0,0,0,0.6);color:#fff;border:none;border-radius:50%;width:22px;height:22px;cursor:pointer;">×</button>
                  </div>
                `)}
              </div>
              <button class="toolbar-btn btn-ai" @click=${onCreateProject}>Create Project & Analyze</button>
            ` : ''}
          </div>
        `;
      },
    },
    /* Slide 2 — Auto-Identify Elements */
    {
      title: 'Auto-Identify Elements',
      renderFn: (host) => {
        const vw = (window as any).CineGen?.visualWizard;
        const state = vw?.getState() || {};
        const onIdentify = async () => {
          const vwApi = (window as any).CineGen?.visualWizard;
          const agents = (window as any).CineGen?.agents;
          if (!vwApi || !agents?.identifyVisualElements) {
            alertCG('AI agent layer not available. Add detected elements manually.');
            return;
          }
          try {
            const projectId = vwApi.getState().projectId || 'temp';
            const images = vwApi.getIdentifyImages();
            const result = await agents.identifyVisualElements(projectId, images);
            for (const c of result.characters || []) vwApi.addCharacter(c.name);
            for (const l of result.locations || []) vwApi.addLocation(l.name, l.intExt || 'EXT');
            for (const p of result.props || []) vwApi.addProp(p.name);
            host.requestUpdate();
          } catch (err) {
            alertCG('Auto-identify failed: ' + (err instanceof Error ? err.message : String(err)));
          }
        };
        const addChar = () => {
          const input = host.querySelector<HTMLInputElement>('#vw-add-char');
          const name = input?.value.trim();
          if (name) { vw?.addCharacter(name); if (input) input.value = ''; host.requestUpdate(); }
        };
        const addLoc = () => {
          const input = host.querySelector<HTMLInputElement>('#vw-add-loc');
          const name = input?.value.trim();
          if (name) { vw?.addLocation(name, 'EXT'); if (input) input.value = ''; host.requestUpdate(); }
        };
        const onNext = () => renderEntryWizardSlide('visual-wizard-modal', 2);
        return html`
          <div class="script-wizard-form">
            <p>Review the detected elements from your uploaded images. You can add or remove items manually.</p>
            <button class="toolbar-btn btn-ai" @click=${onIdentify} style="margin-bottom:16px;">
              <i class="fa-solid fa-wand-magic-sparkles"></i> Auto-Identify Elements
            </button>
            <div class="script-wizard-section">
              <h4>Characters (${state.characters?.length || 0})</h4>
              <div class="script-wizard-chip-list">
                ${(state.characters || []).map((c: any) => html`
                  <span class="entity-chip entity-chip--character">
                    ${c.name}
                    <button type="button" class="remove-chip-btn" @click=${() => { vw?.removeCharacter(c.id); host.requestUpdate(); }}>×</button>
                  </span>
                `)}
              </div>
              <div class="script-wizard-add-row">
                <input id="vw-add-char" class="cg-field" type="text" placeholder="Add character..." @keydown=${(e: KeyboardEvent) => e.key === 'Enter' && addChar()} />
                <button class="toolbar-btn" @click=${addChar}>Add</button>
              </div>
            </div>
            <div class="script-wizard-section">
              <h4>Locations (${state.locations?.length || 0})</h4>
              <div class="script-wizard-chip-list">
                ${(state.locations || []).map((l: any) => html`
                  <span class="entity-chip entity-chip--location">
                    ${l.name} (${l.intExt})
                    <button type="button" class="remove-chip-btn" @click=${() => { vw?.removeLocation(l.id); host.requestUpdate(); }}>×</button>
                  </span>
                `)}
              </div>
              <div class="script-wizard-add-row">
                <input id="vw-add-loc" class="cg-field" type="text" placeholder="Add location..." @keydown=${(e: KeyboardEvent) => e.key === 'Enter' && addLoc()} />
                <button class="toolbar-btn" @click=${addLoc}>Add</button>
              </div>
            </div>
            <div class="script-wizard-section">
              <h4>Props (${state.props?.length || 0})</h4>
              <div class="script-wizard-chip-list">
                ${(state.props || []).map((p: any) => html`
                  <span class="entity-chip entity-chip--default">
                    ${p.name}
                    <button type="button" class="remove-chip-btn" @click=${() => { vw?.removeProp(p.id); host.requestUpdate(); }}>×</button>
                  </span>
                `)}
              </div>
            </div>
            <button class="toolbar-btn btn-ai" @click=${onNext}>Continue</button>
          </div>
        `;
      },
    },
    /* Slide 3 — Casting Refinement */
    {
      title: 'Casting Refinement',
      renderFn: (host) => {
        const vw = (window as any).CineGen?.visualWizard;
        const state = vw?.getState() || {};
        const charImages = (state.uploadedImages || []).filter((i: any) => i.category === 'character');
        const onAssign = (charId: string, imageId: string, slot: string) => {
          vw?.assignImageToChar(charId, imageId, slot);
          host.requestUpdate();
        };
        const onNext = () => renderEntryWizardSlide('visual-wizard-modal', 3);
        return html`
          <div class="script-wizard-form">
            <p>Assign uploaded character images to specific angles for each character. These will be used to build multi-view character sheets.</p>
            <div class="script-wizard-cards">
              ${(state.characters || []).map((char: any) => html`
                <fieldset class="cg-fieldset cg-fieldset--ns-secondary">
                  <legend class="cg-fieldset-legend"><i class="fa-solid fa-user" aria-hidden="true"></i> ${char.name}</legend>
                  <div class="cg-fieldset-body">
                    <div class="script-wizard-field-row">
                      <span>Name</span>
                      <input class="cg-field" type="text" .value=${char.name} @input=${(e: Event) => { vw?.updateCharacter(char.id, { name: (e.target as HTMLInputElement).value }); }} />
                    </div>
                    <div class="script-wizard-field-row">
                      <span>Age</span>
                      <input class="cg-field" type="text" .value=${char.age} @input=${(e: Event) => { vw?.updateCharacter(char.id, { age: (e.target as HTMLInputElement).value }); }} placeholder="e.g. 30s" />
                    </div>
                    <div class="script-wizard-field-row">
                      <span>Build</span>
                      <input class="cg-field" type="text" .value=${char.build} @input=${(e: Event) => { vw?.updateCharacter(char.id, { build: (e.target as HTMLInputElement).value }); }} placeholder="e.g. Athletic" />
                    </div>
                    <div class="script-wizard-field-row">
                      <span>Vibe</span>
                      <textarea class="cg-field" .value=${char.vibe} @input=${(e: Event) => { vw?.updateCharacter(char.id, { vibe: (e.target as HTMLTextAreaElement).value }); }} placeholder="Personality, energy..."></textarea>
                    </div>
                    <div class="vw-angle-assign" style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-top:8px;">
                      ${['faceImage', 'profileImage', 'threeQuarterImage', 'fullBodyImage'].map((slot) => html`
                        <div style="font-size:12px;">
                          <strong>${slot.replace('Image','')}:</strong>
                          <select class="cg-field" style="width:100%;font-size:11px;" @change=${(e: Event) => onAssign(char.id, (e.target as HTMLSelectElement).value, slot)}>
                            <option value="">— none —</option>
                            ${charImages.map((img: any) => html`<option value=${img.id}>${img.name}</option>`)}
                          </select>
                        </div>
                      `)}
                    </div>
                    ${char.faceImage ? html`<img src=${char.faceImage.dataUrl} style="width:80px;height:80px;object-fit:cover;border-radius:6px;margin-top:8px;" />` : ''}
                  </div>
                </fieldset>
              `)}
            </div>
            <button class="toolbar-btn btn-ai" @click=${onNext}>Continue</button>
          </div>
        `;
      },
    },
    /* Slide 4 — Production Design Mapping */
    {
      title: 'Production Design Mapping',
      renderFn: (host) => {
        const vw = (window as any).CineGen?.visualWizard;
        const state = vw?.getState() || {};
        const locImages = (state.uploadedImages || []).filter((i: any) => i.category === 'location');
        const onAssign = (locId: string, imageId: string, interior: boolean) => {
          vw?.assignImageToLoc(locId, imageId, interior);
          host.requestUpdate();
        };
        const onNext = () => renderEntryWizardSlide('visual-wizard-modal', 4);
        return html`
          <div class="script-wizard-form">
            <p>Define each location and assign uploaded images as background plates. Toggle interior/exterior for each.</p>
            <div class="script-wizard-cards">
              ${(state.locations || []).map((loc: any) => html`
                <fieldset class="cg-fieldset cg-fieldset--ns-secondary">
                  <legend class="cg-fieldset-legend"><i class="fa-solid fa-map-location-dot" aria-hidden="true"></i> ${loc.name}</legend>
                  <div class="cg-fieldset-body">
                    <div class="script-wizard-field-row">
                      <span>Name</span>
                      <input class="cg-field" type="text" .value=${loc.name} @input=${(e: Event) => { vw?.updateLocation(loc.id, { name: (e.target as HTMLInputElement).value }); }} />
                    </div>
                    <div class="script-wizard-field-row">
                      <span>Type</span>
                      <select class="cg-field" .value=${loc.intExt} @change=${(e: Event) => { vw?.updateLocation(loc.id, { intExt: (e.target as HTMLSelectElement).value }); }}>
                        <option value="INT">Interior</option>
                        <option value="EXT">Exterior</option>
                        <option value="INT/EXT">Interior / Exterior</option>
                      </select>
                    </div>
                    <div class="script-wizard-field-row">
                      <span>Description</span>
                      <textarea class="cg-field" .value=${loc.description} @input=${(e: Event) => { vw?.updateLocation(loc.id, { description: (e.target as HTMLTextAreaElement).value }); }} placeholder="Atmosphere, period, key notes..."></textarea>
                    </div>
                    <div style="margin-top:8px;">
                      <strong style="font-size:12px;">Assign Location Images:</strong>
                      <select class="cg-field" style="width:100%;font-size:11px;" @change=${(e: Event) => onAssign(loc.id, (e.target as HTMLSelectElement).value, loc.intExt !== 'EXT')}>
                        <option value="">— select image —</option>
                        ${locImages.map((img: any) => html`<option value=${img.id}>${img.name}</option>`)}
                      </select>
                    </div>
                    ${(loc.exteriorImages || []).map((img: any) => html`<img src=${img.dataUrl} style="width:80px;height:60px;object-fit:cover;border-radius:4px;margin-top:4px;" title="Exterior plate" />`)}
                    ${(loc.interiorImages || []).map((img: any) => html`<img src=${img.dataUrl} style="width:80px;height:60px;object-fit:cover;border-radius:4px;margin-top:4px;" title="Interior plate" />`)}
                  </div>
                </fieldset>
              `)}
            </div>
            <button class="toolbar-btn btn-ai" @click=${onNext}>Continue</button>
          </div>
        `;
      },
    },
    /* Slide 5 — Script/Outline Generation */
    {
      title: 'Script/Outline Generation',
      renderFn: (host) => {
        const vw = (window as any).CineGen?.visualWizard;
        const state = vw?.getState() || {};
        const onGenerate = async () => {
          const agents = (window as any).CineGen?.agents;
          if (!agents?.generateScriptFromVisuals) {
            alertCG('AI agent layer not available for script generation.');
            return;
          }
          try {
            const projectId = state.projectId || 'temp';
            const payload = vw?.buildOutlinePayload();
            const result = await agents.generateScriptFromVisuals(projectId, payload);
            if (result?.outline) {
              vw?.setScriptGenerated(result.outline);
              host.requestUpdate();
            }
          } catch (err) {
            alertCG('Script generation failed: ' + (err instanceof Error ? err.message : String(err)));
          }
        };
        const onSkip = () => renderEntryWizardSlide('visual-wizard-modal', 5);
        const onNext = () => renderEntryWizardSlide('visual-wizard-modal', 5);
        return html`
          <div class="script-wizard-form">
            <p>Optionally generate a script outline from your uploaded visuals and detected elements. This can serve as a starting point for your screenplay.</p>
            ${!state.scriptGenerated
              ? html`<div>
                  <button class="toolbar-btn btn-ai" @click=${onGenerate}><i class="fa-solid fa-wand-magic-sparkles"></i> Generate Script Outline</button>
                  <button class="toolbar-btn" @click=${onSkip} style="margin-left:8px;">Skip — I'll write later</button>
                </div>`
              : html`
                  <textarea class="cg-field" style="min-height:200px;font-family:monospace;font-size:13px;" .value=${state.scriptOutline} @input=${(e: Event) => { const t = (e.target as HTMLTextAreaElement).value; vw?.setScriptGenerated(t); }}></textarea>
                  <div style="margin-top:8px;display:flex;gap:8px;">
                    <button class="toolbar-btn btn-ai" @click=${onNext}>Accept & Continue</button>
                    <button class="toolbar-btn" @click=${() => { vw?.setScriptGenerated(''); host.requestUpdate(); }}>Discard</button>
                  </div>
                `}
          </div>
        `;
      },
    },
    /* Slide 6 — Style Lock */
    {
      title: 'Style Lock',
      renderFn: (host) => {
        const vw = (window as any).CineGen?.visualWizard;
        const state = vw?.getState() || {};
        const lightingPresets = ['Natural daylight', 'Warm golden hour', 'Cool moonlight', 'Dramatic noir', 'High contrast', 'Soft diffused', 'Neon cyberpunk', 'Vintage film'];
        const onExtract = async () => {
          const agents = (window as any).CineGen?.agents;
          if (!agents?.extractColorPalette) {
            alertCG('Color extraction agent not available. Add colors manually.');
            return;
          }
          try {
            const projectId = state.projectId || 'temp';
            const images = vw?.getColorImages();
            const result = await agents.extractColorPalette(projectId, images);
            if (result?.palette?.length) {
              vw?.setPalette(result.palette);
              if (result.mood) vw?.setLightingMood(result.mood);
              host.requestUpdate();
            }
          } catch (err) {
            alertCG('Color extraction failed: ' + (err instanceof Error ? err.message : String(err)));
          }
        };
        const applyPreset = (mood: string) => { vw?.setLightingMood(mood); host.requestUpdate(); };
        const onNext = () => renderEntryWizardSlide('visual-wizard-modal', 6);
        return html`
          <div class="script-wizard-form">
            <p>Define the visual style for the project. Extract a color palette from your uploaded images or set mood and lighting manually.</p>
            <button class="toolbar-btn btn-ai" @click=${onExtract} style="margin-bottom:16px;">
              <i class="fa-solid fa-palette"></i> Extract Color Palette from Images
            </button>
            <div class="script-wizard-section">
              <h4>Color Palette</h4>
              <cg-color-palette
                .palette=${state.colorPalette ?? []}
                style="display:block;"
                @cg-palette-change=${(e: any) => {
                  vw?.setPalette(e.detail.palette);
                  host.requestUpdate();
                }}
              ></cg-color-palette>
            </div>
            <div class="script-wizard-section">
              <h4>Lighting & Mood</h4>
              <div class="script-wizard-presets" style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px;">
                ${lightingPresets.map((p) => html`
                  <button class="toolbar-btn ${state.lightingMood === p ? 'btn-ai' : ''}" style="font-size:12px;padding:4px 10px;" @click=${() => applyPreset(p)}>${p}</button>
                `)}
              </div>
            </div>
            <div class="script-wizard-section">
              <h4>Style Notes</h4>
              <textarea class="cg-field" style="min-height:80px;" .value=${state.styleNotes} @input=${(e: Event) => { vw?.setStyleNotes((e.target as HTMLTextAreaElement).value); }} placeholder="Overall aesthetic direction, era, visual influences..."></textarea>
            </div>
            <button class="toolbar-btn btn-ai" @click=${onNext}>Continue</button>
          </div>
        `;
      },
    },
    /* Slide 7 — Scene Kit Assembly */
    {
      title: 'Scene Kit Assembly',
      renderFn: () => {
        const vw = (window as any).CineGen?.visualWizard;
        const state = vw?.getState() || {};
        const hasCharacters = state.characters?.length > 0;
        const hasLocations = state.locations?.length > 0;
        const hasPalette = state.colorPalette?.length > 0;
        const onBuildKit = async () => {
          const agents = (window as any).CineGen?.agents;
          const projectId = state.projectId;
          if (!projectId) { alertCG('No active project. Create a project first.'); return; }
          const payload = vw?.buildKitPayload();
          vw?.setKitBuilt();
          if (agents?.updateProductionContext) {
            try {
              await agents.updateProductionContext(projectId, {
                characterGuide: (payload.characters || []).map((c: any) => ({
                  id: c.id,
                  name: c.name,
                  role: c.role || 'supporting',
                  physicalDescription: [c.age, c.build, c.vibe].filter(Boolean).join(', '),
                  performanceNotes: c.vibe || '',
                  sceneAppearances: [],
                  references: { face: c.faceImage?.dataUrl, costume: [] },
                  voice: null,
                })),
                locationGuide: (payload.locations || []).map((l: any) => ({
                  id: l.id,
                  name: l.name,
                  intExt: l.intExt,
                  description: l.description,
                  atmosphere: '',
                  references: [...(l.exteriorImages || []), ...(l.interiorImages || [])].map((img: any) => img.dataUrl),
                  sceneAppearances: [],
                })),
                styleGuide: {
                  colorPalette: (payload.style?.palette || []).join(', '),
                  lightingMood: payload.style?.lightingMood || '',
                  visualTone: payload.style?.notes || '',
                },
              });
            } catch (err) {
              console.warn('[vw] Scene kit save warning:', err);
            }
          }
          const { applyWizardOutput } = await import('@/wizard/wizard-completion-hook');
          applyWizardOutput({
            characters: (payload.characters || []).map((c: any) => ({
              id: c.id, name: c.name, role: c.role || 'supporting', description: [c.age, c.build, c.vibe].filter(Boolean).join(', '),
            })),
            locations: (payload.locations || []).map((l: any) => ({
              id: l.id, name: l.name, intExt: l.intExt, description: l.description,
            })),
            props: (payload.props || []).map((p: any) => ({
              id: p.id, name: p.name, description: p.description,
            })),
            styleGuide: {
              colorPalette: payload.style?.palette?.length ? [...payload.style.palette] : undefined,
              lightingMood: payload.style?.lightingMood || undefined,
              visualTone: payload.style?.notes || undefined,
            },
            featureBranches: ['production-office', 'scenes', 'casting', 'production-design', 'cinematography', 'mood-boards'],
          });
          renderEntryWizardSlide('visual-wizard-modal', 7);
        };
        return html`
          <div class="script-wizard-form">
            <p>Review your assembled scene kit. This bundles all visual references, characters, and style information into a reusable package.</p>
            <fieldset class="cg-fieldset cg-fieldset--ns-secondary">
              <legend class="cg-fieldset-legend"><i class="fa-solid fa-cube" aria-hidden="true"></i> Scene Kit Summary</legend>
              <div class="cg-fieldset-body script-wizard-summary">
                <div class="script-wizard-summary-row"><strong>Characters:</strong> ${state.characters?.length || 0} — ${(state.characters || []).map((c: any) => c.name).join(', ') || 'none'}</div>
                <div class="script-wizard-summary-row"><strong>Locations:</strong> ${state.locations?.length || 0} — ${(state.locations || []).map((l: any) => l.name).join(', ') || 'none'}</div>
                <div class="script-wizard-summary-row"><strong>Props:</strong> ${state.props?.length || 0}</div>
                <div class="script-wizard-summary-row"><strong>Color Palette:</strong> ${state.colorPalette?.length || 0} colors</div>
                <div class="script-wizard-summary-row"><strong>Mood:</strong> ${state.lightingMood || 'Not set'}</div>
                <div class="script-wizard-summary-row"><strong>Script Outline:</strong> ${state.scriptGenerated ? 'Generated' : 'Not generated'}</div>
              </div>
            </fieldset>
            <div class="script-wizard-actions" style="margin-top:12px;">
              ${!state.sceneKitBuilt
                ? html`<button class="toolbar-btn btn-ai" @click=${onBuildKit}>
                    <i class="fa-solid fa-cubes"></i> Build Scene Kit
                  </button>`
                : html`<p style="color:#4ade80;"><i class="fa-solid fa-circle-check"></i> Scene kit built successfully!</p>`
              }
            </div>
            ${state.sceneKitBuilt ? html`<button class="toolbar-btn btn-ai" @click=${() => renderEntryWizardSlide('visual-wizard-modal', 7)} style="margin-top:12px;">Continue</button>` : ''}
          </div>
        `;
      },
    },
    /* Slide 8 — Storyboard or Video Preview */
    {
      title: 'Storyboard or Video Preview',
      renderFn: (host) => {
        const vw = (window as any).CineGen?.visualWizard;
        const state = vw?.getState() || {};
        const onGenerate = async () => {
          const agents = (window as any).CineGen?.agents;
          const projectId = state.projectId;
          if (!projectId) { alertCG('No active project.'); return; }
          if (!agents?.generateStoryboardFrames) {
            alertCG('Storyboard generation not available.');
            return;
          }
          try {
            const result = await agents.generateStoryboardFrames(projectId);
            const count = result?.data?.frameCount || 4;
            vw?.setBoardsGenerated(count);
            host.requestUpdate();
          } catch (err) {
            alertCG('Storyboard generation failed: ' + (err instanceof Error ? err.message : String(err)));
          }
        };
        const onFinish = () => {
          resetScriptWizardState();
          closeVisualWizardModal();
        };
        return html`
          <div class="script-wizard-form">
            <p>Generate initial storyboard frames from your scene kit. These will appear in the Pre-production workspace.</p>
            ${!state.storyboardsGenerated
              ? html`<button class="toolbar-btn btn-ai" @click=${onGenerate}><i class="fa-solid fa-image"></i> Generate Initial Storyboards</button>`
              : html`
                  <div class="script-wizard-success">
                    <p><i class="fa-solid fa-circle-check" style="color:#4ade80;"></i> <strong>${state.storyboardFrameCount}</strong> draft frame(s) created.</p>
                    <p style="color:#888;">Review and refine them in the Pre-production workspace.</p>
                  </div>
                `}
            <div style="margin-top:16px;">
              <button class="toolbar-btn btn-ai" @click=${onFinish}>Finish & Close Wizard</button>
            </div>
          </div>
        `;
      },
    },
  ],
  'concept-wizard-modal': [
    /* Slide 1 — Concept Dashboard (master-detail input) */
    {
      title: 'Concept Dashboard',
      renderFn: (host) => {
        const cw = (window as any).CineGen?.conceptWizard;
        const getState = () => cw?.getState() ?? {};
        const s = getState();
        const onMoodInput = (e: Event) => { cw?.setMoodDescription((e.target as HTMLTextAreaElement).value); };
        const onSceneInput = (e: Event) => { cw?.setSceneSettings((e.target as HTMLTextAreaElement).value); };
        const onLightingInput = (e: Event) => { cw?.setLightingDesc((e.target as HTMLTextAreaElement).value); };
        const onAtmoInput = (e: Event) => { cw?.setAtmosphereNotes((e.target as HTMLTextAreaElement).value); };
        const onTagAdd = () => {
          const el = host.querySelector('#cw-atmo-input') as HTMLInputElement;
          if (el?.value?.trim()) { cw?.addAtmosphereTag(el.value.trim()); el.value = ''; host.requestUpdate(); }
        };
        const onTagRemove = (tag: string) => { cw?.removeAtmosphereTag(tag); host.requestUpdate(); };
        const onFileChange = async (e: Event) => {
          const input = e.target as HTMLInputElement;
          if (!input?.files?.length) return;
          for (const file of Array.from(input.files)) {
            if (file.type.startsWith('image/')) await cw?.addImage(file, 'mood-board');
          }
          input.value = '';
          host.requestUpdate();
        };
        const onRemoveImage = (id: string) => { cw?.removeImage(id); host.requestUpdate(); };
        const onVibeChange = (key: string) => (e: Event) => {
          cw?.setVibe({ [key]: parseInt((e.target as HTMLInputElement).value, 10) });
        };
        const onCreateProject = () => {
          const state = cw?.getState();
          const created = createBlankProject();
          appShellStore.setActiveProjectId(created.id);
          syncActiveProjectName(created.name);
          cw?.setProjectId(created.id);
          const refresh = window as unknown as Record<string, (() => void) | undefined>;
          refresh.renderFullTree?.();
          refresh.renderBreakdownTable?.();
          refresh.renderStoryboard?.();
          refresh.renderTimeline?.();
          refresh.hydrateScriptEditorFromProject?.();
          window.renderProjectsMenu?.();
          renderProjectsModalList();
        };
        const onGenerateConcepts = async () => {
          if (!cw) return;
          const state = cw.getState();
          if (!state.projectId) {
            const created = createBlankProject();
            appShellStore.setActiveProjectId(created.id);
            syncActiveProjectName(created.name);
            cw.setProjectId(created.id);
            const refresh = window as unknown as Record<string, (() => void) | undefined>;
            refresh.renderFullTree?.();
            refresh.renderBreakdownTable?.();
            refresh.renderStoryboard?.();
            refresh.renderTimeline?.();
            refresh.hydrateScriptEditorFromProject?.();
            window.renderProjectsMenu?.();
            renderProjectsModalList();
          }
          cw.setGenerating(true);
          host.requestUpdate();
          try {
            const payload = cw.buildConceptPayload();
            const { generateConcepts } = await import('../services/ai/agents-service');
            const result = await generateConcepts(payload.projectId, {
              moodDescription: payload.moodDescription,
              vibe: payload.vibe,
              colorPalette: payload.colorPalette,
              sceneSettings: payload.sceneSettings,
              lightingDesc: payload.lightingDesc,
              atmosphereNotes: payload.atmosphereNotes,
              atmosphereTags: payload.atmosphereTags,
              imageDataUrls: payload.imageDataUrls,
            });
            cw.applyConcepts(result);
            cw.setGenerating(false);
            const nextIdx = 1;
            const slides = WIZARD_SLIDES['concept-wizard-modal'];
            if (slides?.[nextIdx]) renderEntryWizardSlide('concept-wizard-modal', nextIdx);
          } catch (err) {
            console.error('[concept-wizard] generate error:', err);
            cw.setGenerating(false);
            host.requestUpdate();
            alertCG('Failed to generate concepts. Check your API key and try again.');
          }
        };
        const vibeSlider = (label: string, key: string, min: number, max: number) => html`
          <div style="margin-bottom:8px;">
            <label style="font-size:12px;color:#aaa;">${label}: ${s.currentVibe?.[key] ?? 0}</label>
            <input type="range" min=${min} max=${max} value=${s.currentVibe?.[key] ?? 0}
              @input=${onVibeChange(key)} style="width:100%;" />
          </div>
        `;
        return html`
          <div class="script-wizard-form">
            <p style="margin-bottom:16px;">Describe the mood and atmosphere of your project. Fill in as much or as little as you want — then click <strong>Generate Concepts</strong> to create atmosphere tags, color palette, locations, and character archetypes.</p>

            <div style="margin-bottom:16px;">
              <label style="font-size:13px;font-weight:600;display:block;margin-bottom:4px;">Overall Mood / Vibe</label>
              <textarea class="cg-field" style="width:100%;min-height:80px;resize:vertical;" placeholder="E.g. A neon-drenched cyberpunk love story set in a rain-soaked Tokyo-like city..."
                .value=${s.moodDescription ?? ''} @input=${onMoodInput}></textarea>
            </div>

            <details style="margin-bottom:12px;" ?open=${s.uploadedImages?.length > 0}>
              <summary style="cursor:pointer;font-size:13px;font-weight:600;">Mood Boards / Reference Images</summary>
              <div style="margin-top:8px;border:2px dashed #555;border-radius:8px;padding:24px;text-align:center;margin-bottom:12px;">
                <label for="cw-file-input" class="toolbar-btn" style="cursor:pointer;">Upload Images</label>
                <input id="cw-file-input" type="file" multiple accept="image/*" @change=${onFileChange} style="display:none;" />
              </div>
              ${(s.uploadedImages ?? []).length > 0 ? html`
                <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:6px;margin-bottom:12px;">
                  ${s.uploadedImages.map((img: any) => html`
                    <div style="position:relative;border:1px solid #444;border-radius:6px;overflow:hidden;">
                      <img src=${img.dataUrl} alt=${img.name} style="width:100%;height:80px;object-fit:cover;display:block;" />
                      <button type="button" class="remove-chip-btn" @click=${() => onRemoveImage(img.id)} style="position:absolute;top:2px;right:2px;background:rgba(0,0,0,0.6);color:#fff;border:none;border-radius:50%;width:20px;height:20px;cursor:pointer;line-height:20px;text-align:center;font-size:14px;">×</button>
                    </div>
                  `)}
                </div>
              ` : ''}
            </details>

            <details style="margin-bottom:12px;">
              <summary style="cursor:pointer;font-size:13px;font-weight:600;">Color Palette</summary>
              <div style="margin-top:8px;">
                <cg-color-palette
                  .palette=${s.colorPalette ?? []}
                  style="display:block;"
                  @cg-palette-change=${(e: any) => {
                    s.colorPalette = e.detail.palette;
                    host.requestUpdate();
                  }}
                ></cg-color-palette>
              </div>
            </details>

            <details style="margin-bottom:12px;">
              <summary style="cursor:pointer;font-size:13px;font-weight:600;">Scene Settings & Lighting</summary>
              <div style="margin-top:8px;">
                <label style="font-size:12px;color:#aaa;">Scene / Location Settings</label>
                <textarea class="cg-field" style="width:100%;min-height:50px;resize:vertical;margin-bottom:8px;" placeholder="E.g. Neon-lit alleyways, rain-slicked streets, cramped noodle bars..."
                  .value=${s.sceneSettings ?? ''} @input=${onSceneInput}></textarea>
                <label style="font-size:12px;color:#aaa;">Lighting Description</label>
                <textarea class="cg-field" style="width:100%;min-height:50px;resize:vertical;margin-bottom:8px;" placeholder="E.g. Mixed neon and shadow, high contrast, cool blue moonlight with warm amber accents..."
                  .value=${s.lightingDesc ?? ''} @input=${onLightingInput}></textarea>
              </div>
            </details>

            <details style="margin-bottom:12px;">
              <summary style="cursor:pointer;font-size:13px;font-weight:600;">Atmosphere & Sound</summary>
              <div style="margin-top:8px;">
                <label style="font-size:12px;color:#aaa;">Atmosphere Notes</label>
                <textarea class="cg-field" style="width:100%;min-height:50px;resize:vertical;margin-bottom:8px;" placeholder="E.g. Gritty urban cyberpunk, oppressive humidity, distant neon hum..."
                  .value=${s.atmosphereNotes ?? ''} @input=${onAtmoInput}></textarea>
                <label style="font-size:12px;color:#aaa;">Atmosphere Tags</label>
                <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px;">
                  ${(s.atmosphereTags ?? []).map((tag: string) => html`
                    <span style="display:inline-flex;align-items:center;gap:3px;background:#2a4;padding:2px 8px;border-radius:12px;font-size:11px;">
                      ${tag}
                      <button type="button" class="remove-chip-btn" @click=${() => onTagRemove(tag)} style="background:none;border:none;color:#fff;cursor:pointer;font-size:12px;">×</button>
                    </span>
                  `)}
                </div>
                <div style="display:flex;gap:6px;">
                  <input id="cw-atmo-input" type="text" class="cg-field" placeholder="Wind in trees, distant traffic, synthwave..." style="flex:1;" />
                  <button class="toolbar-btn" @click=${onTagAdd}>Add Tag</button>
                </div>
              </div>
            </details>

            <details style="margin-bottom:16px;">
              <summary style="cursor:pointer;font-size:13px;font-weight:600;">Vibe Sliders</summary>
              <div style="margin-top:8px;">
                ${vibeSlider('Cool ↔ Warm', 'temperature', -5, 5)}
                ${vibeSlider('Peaceful ↔ Tense', 'tension', -5, 5)}
                ${vibeSlider('Night ↔ Day', 'lighting', -5, 5)}
                ${vibeSlider('Calm ↔ Energetic', 'energy', -5, 5)}
                <div style="margin-bottom:8px;">
                  <label style="font-size:12px;color:#aaa;">Grounded ↔ Stylized: ${s.currentVibe?.stylization ?? 50}%</label>
                  <input type="range" min="0" max="100" value=${s.currentVibe?.stylization ?? 50}
                    @input=${onVibeChange('stylization')} style="width:100%;" />
                </div>
              </div>
            </details>

            <div style="margin-top:16px;display:flex;gap:8px;justify-content:flex-end;">
              ${s.conceptsGenerating ? html`<span style="color:#888;padding:8px;">Generating concepts...</span>` : html`
                <button class="toolbar-btn btn-ai" @click=${onGenerateConcepts}>
                  <i class="fa-solid fa-wand-magic-sparkles"></i> Generate Concepts
                </button>
              `}
            </div>
          </div>
        `;
      },
    },
    /* Slide 2 — Atmosphere & Sound (pre-populated) */
    {
      title: 'Atmosphere & Sound',
      renderFn: (host) => {
        const cw = (window as any).CineGen?.conceptWizard;
        const s = cw?.getState() ?? {};
        const tags = s.generatedAtmosphereTags ?? [];
        const onToggleTag = (tag: string) => {
          const state = cw?.getState();
          const has = (state.atmosphereTags ?? []).includes(tag);
          if (has) cw?.removeAtmosphereTag(tag);
          else cw?.addAtmosphereTag(tag);
          host.requestUpdate();
        };
        return html`
          <div class="script-wizard-form">
            <p style="margin-bottom:12px;">Review the generated atmosphere and sound elements. Toggle tags to include them in your project.</p>
            <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px;">
              ${tags.map((tag: string) => {
                const active = (s.atmosphereTags ?? []).includes(tag);
                return html`
                  <span style="display:inline-flex;align-items:center;gap:4px;padding:4px 12px;border-radius:16px;font-size:12px;cursor:pointer;
                    background:${active ? '#2a4' : '#333'};border:1px solid ${active ? '#4c6' : '#555'};"
                    @click=${() => onToggleTag(tag)}>
                    ${active ? html`<i class="fa-solid fa-check" style="font-size:10px;"></i>` : ''}
                    ${tag}
                  </span>
                `;
              })}
            </div>
            <label style="font-size:12px;color:#aaa;display:block;margin-bottom:4px;">Lighting Mood</label>
            <div style="background:#222;padding:8px 12px;border-radius:6px;margin-bottom:12px;font-size:13px;">${s.lightingMood ?? '—'}</div>
            <label style="font-size:12px;color:#aaa;display:block;margin-bottom:4px;">Style Notes</label>
            <div style="background:#222;padding:8px 12px;border-radius:6px;margin-bottom:12px;font-size:13px;">${s.styleNotes ?? '—'}</div>
          </div>
        `;
      },
    },
    /* Slide 3 — Color & Style Palette (pre-populated) */
    {
      title: 'Color & Style Palette',
      renderFn: (host) => {
        const cw = (window as any).CineGen?.conceptWizard;
        const s = cw?.getState() ?? {};
        const palette = s.generatedColorPalette ?? [];
        const onGenerateImage = async () => {
          const { generateConceptImage } = await import('../services/ai/agents-service');
          const prompt = `Style reference image for: ${s.lightingMood ?? 'mood'} — palette: ${palette.join(', ')} — ${s.styleNotes ?? ''}`;
          try {
            const result = await generateConceptImage(prompt);
            cw?.addGeneratedImage(prompt, result.url, 'style-reference');
            host.requestUpdate();
          } catch (err) {
            console.error('[concept-wizard] style image error:', err);
            alertCG('Failed to generate style image. Check your image generation provider key.');
          }
        };
        return html`
          <div class="script-wizard-form">
            <p style="margin-bottom:12px;">Review the generated color palette and lighting mood. Generate a style reference image from these settings.</p>
            <cg-color-palette
              .palette=${palette}
              ?readonly=${true}
              style="display:block;margin-bottom:16px;"
            ></cg-color-palette>
            <button class="toolbar-btn btn-ai" @click=${onGenerateImage}>
              <i class="fa-solid fa-image"></i> Generate Style Image
            </button>
            ${(s.generatedImages ?? []).filter((i: any) => i.category === 'style-reference').length > 0 ? html`
              <div style="margin-top:12px;display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px;">
                ${s.generatedImages.filter((i: any) => i.category === 'style-reference').map((img: any) => html`
                  <div style="border:1px solid #444;border-radius:6px;overflow:hidden;">
                    <img src=${img.url} alt="Style ref" style="width:100%;height:120px;object-fit:cover;display:block;" />
                  </div>
                `)}
              </div>
            ` : ''}
          </div>
        `;
      },
    },
    /* Slide 4 — Core Location Sketch (pre-populated) */
    {
      title: 'Core Location Sketch',
      renderFn: (host) => {
        const cw = (window as any).CineGen?.conceptWizard;
        const s = cw?.getState() ?? {};
        const locs = s.locations ?? [];
        const onUpdateLoc = (id: string, key: string) => (e: Event) => {
          cw?.updateLocation(id, { [key]: (e.target as HTMLInputElement).value });
        };
        const onRemoveLoc = (id: string) => { cw?.removeLocation(id); host.requestUpdate(); };
        const onAddLoc = () => {
          const name = host.querySelector('#cw-new-loc-name') as HTMLInputElement;
          if (name?.value?.trim()) {
            cw?.addLocation(name.value.trim());
            name.value = '';
            host.requestUpdate();
          }
        };
        const onGeneratePlate = async (loc: any) => {
          const { generateConceptImage } = await import('../services/ai/agents-service');
          const prompt = `Background plate: ${loc.name} — ${loc.description} — ${loc.intExt} — mood: ${s.lightingMood ?? ''}`;
          try {
            const result = await generateConceptImage(prompt);
            cw?.addGeneratedImage(prompt, result.url, 'background-plate');
            const imgs = cw?.getState().generatedImages ?? [];
            const last = imgs[imgs.length - 1];
            if (last) cw?.assignPlateToLocation(loc.id, last.id);
            host.requestUpdate();
          } catch (err) {
            console.error('[concept-wizard] plate generation error:', err);
            alertCG('Failed to generate background plate.');
          }
        };
        return html`
          <div class="script-wizard-form">
            <p style="margin-bottom:12px;">Review the suggested locations. Edit details or generate background plates.</p>
            ${locs.map((loc: any) => {
              const plateImg = s.generatedImages?.find((i: any) => i.id === loc.generatedImageId);
              return html`
                <div style="border:1px solid #444;border-radius:6px;padding:10px;margin-bottom:8px;">
                  <div style="display:flex;gap:8px;margin-bottom:6px;">
                    <input class="cg-field" style="flex:2;" .value=${loc.name} @input=${onUpdateLoc(loc.id, 'name')} />
                    <select class="cg-field" style="flex:0 0 100px;" .value=${loc.intExt} @change=${onUpdateLoc(loc.id, 'intExt')}>
                      <option value="INT">INT</option>
                      <option value="EXT">EXT</option>
                      <option value="INT/EXT">INT/EXT</option>
                    </select>
                    <button class="remove-chip-btn" @click=${() => onRemoveLoc(loc.id)} style="background:none;border:none;color:#f88;cursor:pointer;">×</button>
                  </div>
                  <textarea class="cg-field" style="width:100%;min-height:40px;resize:vertical;margin-bottom:6px;" .value=${loc.description} @input=${onUpdateLoc(loc.id, 'description')}></textarea>
                  <button class="toolbar-btn" style="font-size:11px;" @click=${() => onGeneratePlate(loc)}>
                    <i class="fa-solid fa-image"></i> ${plateImg ? 'Regenerate Plate' : 'Generate Plate'}
                  </button>
                  ${plateImg ? html`<img src=${plateImg.url} alt="Plate" style="margin-top:6px;width:100%;max-height:120px;object-fit:cover;border-radius:4px;" />` : ''}
                </div>
              `;
            })}
            <div style="display:flex;gap:6px;margin-top:4px;">
              <input id="cw-new-loc-name" type="text" class="cg-field" placeholder="Add location..." style="flex:1;" />
              <button class="toolbar-btn" @click=${onAddLoc}>Add</button>
            </div>
          </div>
        `;
      },
    },
    /* Slide 5 — Character Archetypes (pre-populated) */
    {
      title: 'Character Archetypes',
      renderFn: (host) => {
        const cw = (window as any).CineGen?.conceptWizard;
        const s = cw?.getState() ?? {};
        const archs = s.archetypes ?? [];
        const onUpdateArch = (id: string, key: string) => (e: Event) => {
          cw?.updateArchetype(id, { [key]: (e.target as HTMLInputElement).value });
        };
        const onRemoveArch = (id: string) => { cw?.removeArchetype(id); host.requestUpdate(); };
        const onAddArch = () => {
          const arch = host.querySelector('#cw-new-arch-type') as HTMLInputElement;
          const name = host.querySelector('#cw-new-arch-name') as HTMLInputElement;
          if (arch?.value?.trim() && name?.value?.trim()) {
            cw?.addArchetype(arch.value.trim(), name.value.trim());
            arch.value = '';
            name.value = '';
            host.requestUpdate();
          }
        };
        return html`
          <div class="script-wizard-form">
            <p style="margin-bottom:12px;">Review the generated character archetypes. Edit names, roles, or add new archetypes.</p>
            ${archs.map((a: any) => html`
              <div style="border:1px solid #444;border-radius:6px;padding:10px;margin-bottom:8px;">
                <div style="display:flex;gap:8px;margin-bottom:6px;">
                  <input class="cg-field" style="flex:1;" .value=${a.archetype} @input=${onUpdateArch(a.id, 'archetype')} placeholder="Archetype" />
                  <input class="cg-field" style="flex:1;" .value=${a.name} @input=${onUpdateArch(a.id, 'name')} placeholder="Name" />
                  <select class="cg-field" style="flex:0 0 120px;" .value=${a.role} @change=${onUpdateArch(a.id, 'role')}>
                    <option value="protagonist">Protagonist</option>
                    <option value="antagonist">Antagonist</option>
                    <option value="supporting">Supporting</option>
                    <option value="extra">Extra</option>
                  </select>
                  <button class="remove-chip-btn" @click=${() => onRemoveArch(a.id)} style="background:none;border:none;color:#f88;cursor:pointer;">×</button>
                </div>
                <input class="cg-field" style="width:100%;margin-bottom:4px;" .value=${a.vibe} @input=${onUpdateArch(a.id, 'vibe')} placeholder="Vibe (e.g. Mysterious, Brooding)" />
                <textarea class="cg-field" style="width:100%;min-height:50px;resize:vertical;" .value=${a.description} @input=${onUpdateArch(a.id, 'description')} placeholder="Description..."></textarea>
              </div>
            `)}
            <div style="display:flex;gap:6px;margin-top:4px;">
              <input id="cw-new-arch-type" type="text" class="cg-field" placeholder="Archetype (e.g. The Hero)" style="flex:1;" />
              <input id="cw-new-arch-name" type="text" class="cg-field" placeholder="Name" style="flex:1;" />
              <button class="toolbar-btn" @click=${onAddArch}>Add</button>
            </div>
          </div>
        `;
      },
    },
    /* Slide 6 — Asset Generation Guidance */
    {
      title: 'Asset Generation Guidance',
      renderFn: (host) => {
        const cw = (window as any).CineGen?.conceptWizard;
        const s = cw?.getState() ?? {};
        const locs = s.locations ?? [];
        const archs = s.archetypes ?? [];
        const defaultPrompts = [
          ...locs.map((l: any) => `Background plate for ${l.name}: ${l.description}`),
          ...archs.map((a: any) => `Character portrait for ${a.name} (${a.archetype}): ${a.description}`),
          `Style/look reference image: ${s.styleNotes ?? ''}`,
        ];
        if (!s.generationPrompts?.length && defaultPrompts.length) {
          cw?.setGenerationPrompts(defaultPrompts);
        }
        const prompts = s.generationPrompts ?? defaultPrompts;
        const onGenerate = async (prompt: string) => {
          const { generateConceptImage } = await import('../services/ai/agents-service');
          try {
            const result = await generateConceptImage(prompt);
            cw?.addGeneratedImage(prompt, result.url, 'style-reference');
            host.requestUpdate();
          } catch (err) {
            console.error('[concept-wizard] asset gen error:', err);
            alertCG('Failed to generate asset image.');
          }
        };
        return html`
          <div class="script-wizard-form">
            <p style="margin-bottom:12px;">Review and trigger generation of foundational assets. Each prompt creates a reference image.</p>
            ${prompts.map((prompt: string) => {
              const existing = (s.generatedImages ?? []).find((i: any) => i.prompt === prompt);
              return html`
                <div style="border:1px solid #444;border-radius:6px;padding:10px;margin-bottom:8px;">
                  <p style="font-size:12px;margin-bottom:6px;">${prompt}</p>
                  <button class="toolbar-btn" style="font-size:11px;" @click=${() => onGenerate(prompt)}>
                    <i class="fa-solid fa-wand-magic-sparkles"></i> Generate
                  </button>
                  ${existing ? html`<img src=${existing.url} alt="Generated" style="margin-top:6px;width:100%;max-height:120px;object-fit:cover;border-radius:4px;" />` : ''}
                </div>
              `;
            })}
          </div>
        `;
      },
    },
    /* Slide 7 — Script Outline Suggestion */
    {
      title: 'Script Outline Suggestion',
      renderFn: (host) => {
        const cw = (window as any).CineGen?.conceptWizard;
        const s = cw?.getState() ?? {};
        const onGenerateOutline = async () => {
          const { generateScriptFromVisuals } = await import('../services/ai/agents-service');
          const payload = cw?.buildOutlinePayload();
          if (!payload || !s.projectId) {
            alertCG('Please ensure a project is created and concepts are generated first.');
            return;
          }
          try {
            const result = await generateScriptFromVisuals(s.projectId, payload);
            cw?.setScriptOutline(result.outline);
            host.requestUpdate();
          } catch (err) {
            console.error('[concept-wizard] outline error:', err);
            alertCG('Failed to generate script outline.');
          }
        };
        return html`
          <div class="script-wizard-form">
            <p style="margin-bottom:12px;">Generate a Fountain-format script outline based on your characters, locations, and style.</p>
            ${s.scriptOutline ? html`
              <div style="background:#1a1a1a;padding:12px;border-radius:6px;border:1px solid #444;margin-bottom:12px;max-height:300px;overflow-y:auto;white-space:pre-wrap;font-family:monospace;font-size:12px;">
                ${s.scriptOutline}
              </div>
              <button class="toolbar-btn" @click=${onGenerateOutline} style="margin-right:8px;">
                <i class="fa-solid fa-rotate"></i> Regenerate
              </button>
            ` : html`
              <button class="toolbar-btn btn-ai" @click=${onGenerateOutline}>
                <i class="fa-solid fa-scroll"></i> Generate Outline
              </button>
            `}
          </div>
        `;
      },
    },
    /* Slide 8 — Scene Kit Initialization */
    {
      title: 'Scene Kit Initialization',
      renderFn: (host) => {
        const cw = (window as any).CineGen?.conceptWizard;
        const s = cw?.getState() ?? {};
        const onBuildKit = async () => {
          const payload = cw?.buildConceptPayload();
          const { updateProductionContext } = (window as any).CineGen?.agents ?? {};
          if (updateProductionContext && payload) {
            updateProductionContext(s.projectId, {
              conceptMood: {
                moodDescription: s.moodDescription,
                lightingMood: s.lightingMood,
                styleNotes: s.styleNotes,
                colorPalette: s.generatedColorPalette,
                atmosphereTags: s.generatedAtmosphereTags,
              },
              characters: s.archetypes?.map((a: any) => ({
                name: a.name,
                archetype: a.archetype,
                description: a.description,
                role: a.role,
              })) ?? [],
              locations: s.locations?.map((l: any) => ({
                name: l.name,
                description: l.description,
                intExt: l.intExt,
              })) ?? [],
            });
          }
          cw?.setKitBuilt();
          const { applyConceptWizardSceneKit } = await import('@/wizard/concept-wizard-bundle');
          const kitResult = applyConceptWizardSceneKit();
          console.log('[concept-wizard] scene kit applied:', kitResult);
          host.requestUpdate();
        };
        return html`
          <div class="script-wizard-form">
            <p style="margin-bottom:12px;">Your Concept/Mood project is ready. Review what was created and build the scene kit to initialize it in the workspace.</p>
            <div style="background:#1a1a1a;padding:12px;border-radius:6px;margin-bottom:12px;">
              <p><strong>Mood:</strong> ${s.lightingMood || '—'}</p>
              <p><strong>Atmosphere Tags:</strong> ${(s.generatedAtmosphereTags ?? []).length}</p>
              <p><strong>Characters:</strong> ${(s.archetypes ?? []).length} archetypes</p>
              <p><strong>Locations:</strong> ${(s.locations ?? []).length} settings</p>
              <p><strong>Generated Images:</strong> ${(s.generatedImages ?? []).length}</p>
              <p><strong>Script Outline:</strong> ${s.scriptOutline ? 'Generated' : 'Not generated'}</p>
            </div>
            ${s.sceneKitBuilt ? html`
              <div style="color:#4c6;margin-bottom:12px;"><i class="fa-solid fa-check-circle"></i> Scene kit built successfully!</div>
            ` : html`
              <button class="toolbar-btn btn-ai" @click=${onBuildKit}>
                <i class="fa-solid fa-boxes-stacked"></i> Build Scene Kit
              </button>
            `}
            <div style="margin-top:16px;display:flex;gap:8px;justify-content:flex-end;">
              <button class="toolbar-btn btn-ai" @click=${() => closeModal('concept-wizard-modal')}>
                <i class="fa-solid fa-check"></i> Finish & Close Wizard
              </button>
            </div>
          </div>
        `;
      },
    },
  ],
  'asset-wizard-modal': [
    /* Slide 1 — Library Selection */
    {
      title: 'Library Selection',
      renderFn: (host) => {
        const aw = (window as any).CineGen?.assetWizard;
        const s = aw?.getState() ?? {};
        if (!s.sourceProjects?.length) aw?.refreshProjectList();
        const projects = aw?.getState()?.sourceProjects ?? [];
        const onSelect = (id: string) => {
          aw?.selectSource(id);
          host.requestUpdate();
          const nextIdx = 1;
          const slides = WIZARD_SLIDES['asset-wizard-modal'];
          if (slides?.[nextIdx]) renderEntryWizardSlide('asset-wizard-modal', nextIdx);
        };
        const tabs = [
          { label: 'Your Projects', filter: (p: any) => p.source === 'local' },
          { label: 'Sample Projects', filter: (p: any) => p.source === 'cine' },
        ];
        const activeTabIdx = 0;
        const filtered = tabs[activeTabIdx] ? projects.filter(tabs[activeTabIdx].filter) : projects;
        return html`
          <div class="script-wizard-form">
            <p style="margin-bottom:12px;">Choose a project to import assets from. Characters, locations, and props will be extracted and available for selection.</p>
            <div style="display:flex;gap:8px;margin-bottom:12px;">
              ${tabs.map((tab, i) => html`
                <span style="padding:4px 12px;border-radius:12px;font-size:12px;cursor:pointer;background:${i === activeTabIdx ? '#368' : '#333'};"
                  @click=${() => { /* tab switch handled by re-render */ }}>
                  ${tab.label}
                </span>
              `)}
            </div>
            ${filtered.length === 0 ? html`<p style="color:#888;">No projects found. Create a project first using another entry wizard.</p>` : ''}
            ${filtered.map((p: any) => html`
              <div style="border:1px solid #444;border-radius:6px;padding:10px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;">
                <div>
                  <strong>${p.name}</strong>
                  ${p.source === 'cine' ? html`<span style="font-size:11px;color:#888;margin-left:6px;">(sample)</span>` : ''}
                  ${p.updatedAt ? html`<span style="font-size:11px;color:#666;margin-left:6px;">${p.updatedAt}</span>` : ''}
                  <div style="font-size:12px;color:#aaa;margin-top:2px;">
                    Characters: ${p.assetCounts?.characters ?? 0} &middot;
                    Locations: ${p.assetCounts?.locations ?? 0} &middot;
                    Props: ${p.assetCounts?.props ?? 0}
                  </div>
                </div>
                <button class="toolbar-btn btn-ai" @click=${() => onSelect(p.id)}>Import</button>
              </div>
            `)}
          </div>
        `;
      },
    },
    /* Slide 2 — Asset Browser */
    {
      title: 'Asset Browser',
      renderFn: (host) => {
        const aw = (window as any).CineGen?.assetWizard;
        const s = aw?.getState() ?? {};
        const chars = s.pendingCharacters ?? [];
        const locs = s.pendingLocations ?? [];
        const props = s.pendingProps ?? [];
        const onToggleChar = (id: string) => { aw?.toggleChar(id); host.requestUpdate(); };
        const onToggleLoc = (id: string) => { aw?.toggleLoc(id); host.requestUpdate(); };
        const onToggleProp = (id: string) => { aw?.toggleProp(id); host.requestUpdate(); };
        const selectedCount = [...chars, ...locs, ...props].filter((x: any) => x.selected).length;
        return html`
          <div class="script-wizard-form">
            <p style="margin-bottom:12px;">Select which assets to import. Only checked items will be carried forward.</p>
            ${selectedCount > 0 ? html`<p style="font-size:12px;color:#6c6;margin-bottom:8px;">${selectedCount} asset(s) selected</p>` : ''}

            ${chars.length > 0 ? html`
              <h4 style="font-size:13px;margin:8px 0 4px;"><i class="fa-solid fa-user"></i> Characters (${chars.length})</h4>
              ${chars.map((c: any) => html`
                <div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid #333;">
                  <input type="checkbox" ?checked=${c.selected} @change=${() => onToggleChar(c.id)} />
                  <span style="flex:1;font-size:13px;">${c.name}</span>
                  <span style="font-size:11px;color:#888;">${c.role}</span>
                </div>
              `)}
            ` : ''}

            ${locs.length > 0 ? html`
              <h4 style="font-size:13px;margin:12px 0 4px;"><i class="fa-solid fa-location-dot"></i> Locations (${locs.length})</h4>
              ${locs.map((l: any) => html`
                <div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid #333;">
                  <input type="checkbox" ?checked=${l.selected} @change=${() => onToggleLoc(l.id)} />
                  <span style="flex:1;font-size:13px;">${l.name}</span>
                  <span style="font-size:11px;color:#888;">${l.intExt}</span>
                </div>
              `)}
            ` : ''}

            ${props.length > 0 ? html`
              <h4 style="font-size:13px;margin:12px 0 4px;"><i class="fa-solid fa-wrench"></i> Props (${props.length})</h4>
              ${props.map((p: any) => html`
                <div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid #333;">
                  <input type="checkbox" ?checked=${p.selected} @change=${() => onToggleProp(p.id)} />
                  <span style="flex:1;font-size:13px;">${p.name}</span>
                </div>
              `)}
            ` : ''}
          </div>
        `;
      },
    },
    /* Slide 3 — Alignment & Rename */
    {
      title: 'Alignment & Rename',
      renderFn: (host) => {
        const aw = (window as any).CineGen?.assetWizard;
        const s = aw?.getState() ?? {};
        const chars = (s.pendingCharacters ?? []).filter((c: any) => c.selected);
        const locs = (s.pendingLocations ?? []).filter((l: any) => l.selected);
        const props = (s.pendingProps ?? []).filter((p: any) => p.selected);
        const onCharUpdate = (id: string, key: string) => (e: Event) => {
          aw?.updateChar(id, { [key]: (e.target as HTMLInputElement).value });
        };
        const onLocUpdate = (id: string, key: string) => (e: Event) => {
          aw?.updateLoc(id, { [key]: (e.target as HTMLInputElement).value });
        };
        const onPropUpdate = (id: string, key: string) => (e: Event) => {
          aw?.updateProp(id, { [key]: (e.target as HTMLInputElement).value });
        };
        const onRemoveChar = (id: string) => { aw?.removeChar(id); host.requestUpdate(); };
        const onRemoveLoc = (id: string) => { aw?.removeLoc(id); host.requestUpdate(); };
        const onRemoveProp = (id: string) => { aw?.removeProp(id); host.requestUpdate(); };
        return html`
          <div class="script-wizard-form">
            <p style="margin-bottom:12px;">Rename and configure imported assets to fit your new project context. Remove any you don't need.</p>

            ${chars.map((c: any) => html`
              <div style="border:1px solid #444;border-radius:6px;padding:8px;margin-bottom:6px;">
                <div style="display:flex;gap:6px;margin-bottom:4px;">
                  <input class="cg-field" style="flex:2;" .value=${c.name} @input=${onCharUpdate(c.id, 'name')} placeholder="Name" />
                  <select class="cg-field" style="flex:0 0 120px;" .value=${c.role} @change=${onCharUpdate(c.id, 'role')}>
                    <option value="protagonist">Protagonist</option>
                    <option value="antagonist">Antagonist</option>
                    <option value="supporting">Supporting</option>
                    <option value="extra">Extra</option>
                  </select>
                  <button class="remove-chip-btn" @click=${() => onRemoveChar(c.id)} style="background:none;border:none;color:#f88;cursor:pointer;">×</button>
                </div>
                <input class="cg-field" style="width:100%;" .value=${c.description} @input=${onCharUpdate(c.id, 'description')} placeholder="Description" />
              </div>
            `)}

            ${locs.map((l: any) => html`
              <div style="border:1px solid #444;border-radius:6px;padding:8px;margin-bottom:6px;">
                <div style="display:flex;gap:6px;margin-bottom:4px;">
                  <input class="cg-field" style="flex:2;" .value=${l.name} @input=${onLocUpdate(l.id, 'name')} placeholder="Name" />
                  <select class="cg-field" style="flex:0 0 100px;" .value=${l.intExt} @change=${onLocUpdate(l.id, 'intExt')}>
                    <option value="INT">INT</option>
                    <option value="EXT">EXT</option>
                    <option value="INT/EXT">INT/EXT</option>
                  </select>
                  <button class="remove-chip-btn" @click=${() => onRemoveLoc(l.id)} style="background:none;border:none;color:#f88;cursor:pointer;">×</button>
                </div>
                <input class="cg-field" style="width:100%;" .value=${l.description} @input=${onLocUpdate(l.id, 'description')} placeholder="Description" />
              </div>
            `)}

            ${props.map((p: any) => html`
              <div style="border:1px solid #444;border-radius:6px;padding:8px;margin-bottom:6px;">
                <div style="display:flex;gap:6px;margin-bottom:4px;">
                  <input class="cg-field" style="flex:2;" .value=${p.name} @input=${onPropUpdate(p.id, 'name')} placeholder="Prop name" />
                  <button class="remove-chip-btn" @click=${() => onRemoveProp(p.id)} style="background:none;border:none;color:#f88;cursor:pointer;">×</button>
                </div>
                <input class="cg-field" style="width:100%;" .value=${p.description} @input=${onPropUpdate(p.id, 'description')} placeholder="Description" />
              </div>
            `)}
          </div>
        `;
      },
    },
    /* Slide 4 — Gap Analysis */
    {
      title: 'Gap Analysis',
      renderFn: (host) => {
        const aw = (window as any).CineGen?.assetWizard;
        const s = aw?.getState() ?? {};
        const onAnalyze = () => {
          const screenplay = (window as any).projectScreenplay?.text ?? '';
          if (!screenplay) { alertCG('No screenplay found. Gap analysis requires a script in the current project.'); return; }
          aw?.runGapAnalysis(screenplay);
          host.requestUpdate();
        };
        const gap = s.gapAnalysis ?? { missingChars: [], missingLocs: [] };
        return html`
          <div class="script-wizard-form">
            <p style="margin-bottom:12px;">Compare your imported assets against the current project's script. Missing characters or locations will be flagged so you can go back and include them.</p>
            <button class="toolbar-btn btn-ai" @click=${onAnalyze} style="margin-bottom:12px;">
              <i class="fa-solid fa-magnifying-glass"></i> Run Gap Analysis
            </button>
            ${gap.missingChars.length > 0 ? html`
              <h4 style="font-size:13px;color:#e88;margin:8px 0 4px;">Missing Characters</h4>
              ${gap.missingChars.map((name: string) => html`<div style="padding:2px 0;font-size:12px;color:#e88;">${name}</div>`)}
            ` : html`<p style="color:#6c6;font-size:12px;">No missing characters detected.</p>`}
            ${gap.missingLocs.length > 0 ? html`
              <h4 style="font-size:13px;color:#e88;margin:12px 0 4px;">Missing Locations</h4>
              ${gap.missingLocs.map((name: string) => html`<div style="padding:2px 0;font-size:12px;color:#e88;">${name}</div>`)}
            ` : html`<p style="color:#6c6;font-size:12px;">No missing locations detected.</p>`}
          </div>
        `;
      },
    },
    /* Slide 5 — Style Review */
    {
      title: 'Style Review',
      renderFn: (host) => {
        const aw = (window as any).CineGen?.assetWizard;
        const s = aw?.getState() ?? {};
        const onToggleAdopt = () => { aw?.setStyleAdopted(!s.styleAdopted); host.requestUpdate(); };
        return html`
          <div class="script-wizard-form">
            <p style="margin-bottom:12px;">Review the style references from the source project. Optionally carry them into your new project.</p>
            <div style="background:#1a1a1a;padding:12px;border-radius:6px;margin-bottom:12px;">
              <div style="margin-bottom:8px;">
                <label style="font-size:12px;color:#aaa;display:block;">Lighting Mood</label>
                <div style="font-size:13px;">${s.sourceLightingMood || '—'}</div>
              </div>
              <div style="margin-bottom:8px;">
                <label style="font-size:12px;color:#aaa;display:block;">Style Notes</label>
                <div style="font-size:13px;">${s.sourceStyleNotes || '—'}</div>
              </div>
              ${s.sourceColorPalette?.length > 0 ? html`
                <div>
                  <label style="font-size:12px;color:#aaa;display:block;">Color Palette</label>
                  <div style="display:flex;gap:6px;margin-top:4px;">
                    ${s.sourceColorPalette.map((c: string) => html`
                      <span style="display:inline-block;width:24px;height:24px;border-radius:4px;background:${c};border:1px solid #555;"></span>
                    `)}
                  </div>
                </div>
              ` : ''}
            </div>
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
              <input type="checkbox" ?checked=${s.styleAdopted} @change=${onToggleAdopt} />
              <span style="font-size:13px;">Adopt these style references into the new project</span>
            </label>
          </div>
        `;
      },
    },
    /* Slide 6 — Build Scene Kit */
    {
      title: 'Build Scene Kit',
      renderFn: (host) => {
        const aw = (window as any).CineGen?.assetWizard;
        const s = aw?.getState() ?? {};
        const onBuildKit = async () => {
          const payload = aw?.buildImportPayload();
          if (!payload || (!payload.characters?.length && !payload.locations?.length && !payload.props?.length)) {
            alertCG('No assets selected. Go back and select at least one asset to import.');
            return;
          }
          aw?.setKitBuilt();
          const { applyWizardOutput } = await import('@/wizard/wizard-completion-hook');
          applyWizardOutput({
            characters: (payload.characters || []).map((c: any) => ({
              id: c.id, name: c.name, role: c.role ?? 'supporting', description: c.description || '',
            })),
            locations: (payload.locations || []).map((l: any) => ({
              id: l.id, name: l.name, intExt: l.intExt, description: l.description || '',
            })),
            props: (payload.props || []).map((p: any) => ({
              id: p.id, name: p.name, description: p.description || '',
            })),
            featureBranches: ['production-office', 'casting', 'production-design', 'mood-boards'],
          });
          host.requestUpdate();
        };
        const counts = {
          chars: (s.pendingCharacters ?? []).filter((c: any) => c.selected).length,
          locs: (s.pendingLocations ?? []).filter((l: any) => l.selected).length,
          props: (s.pendingProps ?? []).filter((p: any) => p.selected).length,
        };
        return html`
          <div class="script-wizard-form">
            <p style="margin-bottom:12px;">Ready to import ${counts.chars + counts.locs + counts.props} asset(s) into the current project.</p>
            <div style="background:#1a1a1a;padding:12px;border-radius:6px;margin-bottom:12px;">
              <p><strong>Characters:</strong> ${counts.chars}</p>
              <p><strong>Locations:</strong> ${counts.locs}</p>
              <p><strong>Props:</strong> ${counts.props}</p>
            </div>
            ${s.sceneKitBuilt ? html`
              <div style="color:#4c6;margin-bottom:12px;"><i class="fa-solid fa-check-circle"></i> Assets imported successfully!</div>
            ` : html`
              <button class="toolbar-btn btn-ai" @click=${onBuildKit}>
                <i class="fa-solid fa-boxes-stacked"></i> Import Assets into Project
              </button>
            `}
          </div>
        `;
      },
    },
    /* Slide 7 — Script & Finish */
    {
      title: 'Script & Finish',
      renderFn: (host) => {
        const aw = (window as any).CineGen?.assetWizard;
        const s = aw?.getState() ?? {};
        const onGenerateOutline = async () => {
          const payload = aw?.buildOutlinePayload();
          if (!payload || (!payload.characters?.length && !payload.locations?.length)) {
            alertCG('No characters or locations available. Import at least one character or location first.');
            return;
          }
          const { generateScriptFromVisuals } = await import('../services/ai/agents-service');
          try {
            const result = await generateScriptFromVisuals(s.projectId, payload);
            aw?.setScriptGenerated();
            host.requestUpdate();
          } catch (err) {
            console.error('[asset-wizard] outline error:', err);
            alertCG('Failed to generate script outline.');
          }
        };
        return html`
          <div class="script-wizard-form">
            <p style="margin-bottom:12px;">Your imported assets are ready. Optionally generate a Fountain-format script outline based on the imported characters and locations.</p>
            <div style="margin-bottom:12px;">
              ${s.scriptGenerated ? html`
                <div style="color:#4c6;margin-bottom:8px;"><i class="fa-solid fa-check-circle"></i> Script outline generated</div>
                <button class="toolbar-btn" @click=${onGenerateOutline}><i class="fa-solid fa-rotate"></i> Regenerate</button>
              ` : html`
                <button class="toolbar-btn btn-ai" @click=${onGenerateOutline}>
                  <i class="fa-solid fa-scroll"></i> Generate Script Outline
                </button>
              `}
            </div>
            <div style="margin-top:24px;display:flex;gap:8px;justify-content:flex-end;border-top:1px solid #444;padding-top:16px;">
              <button class="toolbar-btn btn-ai" @click=${() => closeModal('asset-wizard-modal')}>
                <i class="fa-solid fa-check"></i> Finish & Close Wizard
              </button>
            </div>
          </div>
        `;
      },
    },
  ],
  'storyboard-wizard-modal': [
    /* Slide 0 — Beat/Thumbnail Input */
    {
      title: 'Beat/Thumbnail Input',
      renderFn: (host) => {
        const bb = (window as any).CineGen?.beatBoard;
        const s = bb?.getState?.() ?? {};
        const beats = s.beats ?? [];
        const totalDuration = beats.reduce((sum: number, b: any) => sum + (b.durationSeconds || 5), 0);
        const onAdd = () => {
          const input = host.querySelector('#bb-add-title') as HTMLInputElement;
          const desc = host.querySelector('#bb-add-desc') as HTMLTextAreaElement;
          const cam = host.querySelector('#bb-add-cam') as HTMLInputElement;
          if (!input?.value?.trim()) return;
          bb?.addBeat(input.value.trim(), desc?.value?.trim() || '', cam?.value?.trim() || '');
          if (input) input.value = '';
          if (desc) desc.value = '';
          if (cam) cam.value = '';
          host.requestUpdate();
        };
        return html`
          <div class="script-wizard-form">
            <div style="margin-bottom:12px;">
              <input class="cg-field" id="bb-add-title" placeholder="Beat title (e.g. Opening)" style="width:100%;margin-bottom:6px;" />
              <textarea class="cg-field" id="bb-add-desc" placeholder="Description — what happens in this beat?" style="width:100%;min-height:48px;margin-bottom:6px;"></textarea>
              <input class="cg-field" id="bb-add-cam" placeholder="Camera notes (optional)" style="width:100%;margin-bottom:6px;" />
              <button class="toolbar-btn btn-ai" @click=${onAdd} style="width:100%;">
                <i class="fa-solid fa-plus"></i> Add Beat
              </button>
            </div>
            ${beats.length === 0 ? html`<p style="color:#888;font-size:13px;text-align:center;">No beats yet. Add your first beat above.</p>` : ''}
            ${beats.map((b: any, i: number) => html`
              <div style="border:1px solid #444;border-radius:6px;padding:8px;margin-bottom:6px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                  <strong style="font-size:13px;">#${i + 1} ${b.title}</strong>
                  <div style="display:flex;gap:4px;">
                    <button class="toolbar-btn" style="font-size:11px;padding:2px 6px;" ?disabled=${i === 0} @click=${() => { bb?.reorderBeat(b.id, -1); host.requestUpdate(); }}>
                      <i class="fa-solid fa-chevron-up"></i>
                    </button>
                    <button class="toolbar-btn" style="font-size:11px;padding:2px 6px;" ?disabled=${i >= beats.length - 1} @click=${() => { bb?.reorderBeat(b.id, 1); host.requestUpdate(); }}>
                      <i class="fa-solid fa-chevron-down"></i>
                    </button>
                    <button class="toolbar-btn" style="font-size:11px;padding:2px 6px;color:#f88;" @click=${() => { bb?.removeBeat(b.id); host.requestUpdate(); }}>
                      <i class="fa-solid fa-times"></i>
                    </button>
                  </div>
                </div>
                <div style="font-size:12px;color:#aaa;">${b.description}</div>
                ${b.cameraNotes ? html`<div style="font-size:11px;color:#888;margin-top:2px;"><i class="fa-solid fa-camera"></i> ${b.cameraNotes}</div>` : ''}
                <div style="font-size:11px;color:#666;margin-top:2px;">${b.durationSeconds}s</div>
              </div>
            `)}
            ${beats.length > 0 ? html`<div style="font-size:12px;color:#888;text-align:right;">Total: ${totalDuration}s (${beats.length} beat${beats.length > 1 ? 's' : ''})</div>` : ''}
          </div>
        `;
      },
    },
    /* Slide 1 — Script Outline Creation */
    {
      title: 'Script Outline Creation',
      renderFn: (host) => {
        const bb = (window as any).CineGen?.beatBoard;
        const s = bb?.getState?.() ?? {};
        const onGenerate = async () => {
          const payload = bb?.buildOutlinePayload();
          if (!payload || !payload.beats?.length) { (window as any).alertCG?.('Add at least one beat first.'); return; }
          try {
            const { generateOutlineFromBeats } = await import('../services/ai/agents-service');
            const result = await generateOutlineFromBeats(s.projectId || 'proj', payload);
            const data = typeof result.data === 'string' ? JSON.parse(result.data) : result.data;
            bb?.setScriptOutline(data.outline || data.text || '');
            host.requestUpdate();
          } catch (err) {
            console.error('[beat-board] outline error:', err);
            (window as any).alertCG?.('Failed to generate outline.');
          }
        };
        const detectedChars = (() => { try { return JSON.parse(s.scriptOutline || '{}')?.detectedCharacters || []; } catch { return []; } })();
        const detectedLocs = (() => { try { return JSON.parse(s.scriptOutline || '{}')?.detectedLocations || []; } catch { return []; } })();
        const outlineText = (() => { try { const o = JSON.parse(s.scriptOutline || '{}'); return o.outline || o.text || ''; } catch { return ''; } })();
        return html`
          <div class="script-wizard-form">
            <p style="margin-bottom:12px;">Generate a Fountain-format script outline from your beats. Characters and locations will be automatically detected.</p>
            <button class="toolbar-btn btn-ai" @click=${onGenerate} ?disabled=${s.generationStatus === 'generating'} style="margin-bottom:12px;">
              <i class="fa-solid fa-scroll"></i> Generate Outline from Beats
            </button>
            ${s.scriptGenerated ? html`
              ${detectedChars.length > 0 ? html`
                <div style="margin-bottom:8px;">
                  <strong style="font-size:12px;">Detected Characters:</strong>
                  <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;">
                    ${detectedChars.map((n: string) => html`<span style="background:#333;padding:2px 8px;border-radius:10px;font-size:11px;">${n}</span>`)}
                  </div>
                </div>
              ` : ''}
              ${detectedLocs.length > 0 ? html`
                <div style="margin-bottom:8px;">
                  <strong style="font-size:12px;">Detected Locations:</strong>
                  <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;">
                    ${detectedLocs.map((n: string) => html`<span style="background:#333;padding:2px 8px;border-radius:10px;font-size:11px;">${n}</span>`)}
                  </div>
                </div>
              ` : ''}
              ${outlineText ? html`
                <div style="background:#1a1a1a;padding:8px;border-radius:4px;max-height:160px;overflow-y:auto;font-size:11px;font-family:monospace;white-space:pre-wrap;">${outlineText}</div>
              ` : ''}
              <button class="toolbar-btn" @click=${onGenerate} style="margin-top:8px;"><i class="fa-solid fa-rotate"></i> Regenerate</button>
            ` : ''}
          </div>
        `;
      },
    },
    /* Slide 2 — Character & Location Placeholders */
    {
      title: 'Character & Location Placeholders',
      renderFn: (host) => {
        const bb = (window as any).CineGen?.beatBoard;
        const s = bb?.getState?.() ?? {};
        const chars = s.characters ?? [];
        const locs = s.locations ?? [];
        const onAddChar = () => {
          const el = host.querySelector('#bb-char-name') as HTMLInputElement;
          if (!el?.value?.trim()) return;
          bb?.addCharacter(el.value.trim());
          el.value = '';
          host.requestUpdate();
        };
        const onAddLoc = () => {
          const el = host.querySelector('#bb-loc-name') as HTMLInputElement;
          const sel = host.querySelector('#bb-loc-ie') as HTMLSelectElement;
          if (!el?.value?.trim()) return;
          bb?.addLocation(el.value.trim(), sel?.value || 'INT/EXT');
          el.value = '';
          host.requestUpdate();
        };
        return html`
          <div class="script-wizard-form">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
              <div>
                <h4 style="font-size:13px;margin-bottom:6px;"><i class="fa-solid fa-user"></i> Characters</h4>
                <div style="display:flex;gap:4px;margin-bottom:6px;">
                  <input class="cg-field" id="bb-char-name" placeholder="Name" style="flex:1;" />
                  <button class="toolbar-btn btn-ai" @click=${onAddChar} style="padding:4px 8px;"><i class="fa-solid fa-plus"></i></button>
                </div>
                ${chars.map((c: any) => html`
                  <div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;border-bottom:1px solid #333;font-size:12px;">
                    <span>${c.name}</span>
                    <button class="toolbar-btn" style="font-size:10px;padding:1px 4px;color:#f88;" @click=${() => { bb?.removeCharacter(c.id); host.requestUpdate(); }}><i class="fa-solid fa-times"></i></button>
                  </div>
                `)}
              </div>
              <div>
                <h4 style="font-size:13px;margin-bottom:6px;"><i class="fa-solid fa-location-dot"></i> Locations</h4>
                <div style="display:flex;gap:4px;margin-bottom:6px;">
                  <input class="cg-field" id="bb-loc-name" placeholder="Name" style="flex:1;" />
                  <select class="cg-field" id="bb-loc-ie" style="width:80px;font-size:11px;">
                    <option value="INT">INT</option>
                    <option value="EXT">EXT</option>
                    <option value="INT/EXT" selected>INT/EXT</option>
                  </select>
                  <button class="toolbar-btn btn-ai" @click=${onAddLoc} style="padding:4px 8px;"><i class="fa-solid fa-plus"></i></button>
                </div>
                ${locs.map((l: any) => html`
                  <div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;border-bottom:1px solid #333;font-size:12px;">
                    <span>${l.name} <span style="color:#888;">(${l.intExt})</span></span>
                    <button class="toolbar-btn" style="font-size:10px;padding:1px 4px;color:#f88;" @click=${() => { bb?.removeLocation(l.id); host.requestUpdate(); }}><i class="fa-solid fa-times"></i></button>
                  </div>
                `)}
              </div>
            </div>
          </div>
        `;
      },
    },
    /* Slide 3 — Reference Recommendation */
    {
      title: 'Reference Recommendation',
      renderFn: (host) => {
        const bb = (window as any).CineGen?.beatBoard;
        const s = bb?.getState?.() ?? {};
        const queue = s.referenceQueue ?? [];
        const onScan = () => { bb?.runReferenceSuggestion(); host.requestUpdate(); };
        return html`
          <div class="script-wizard-form">
            <p style="margin-bottom:12px;">Scan your beats for potential missing assets that may need reference images or sheets.</p>
            <button class="toolbar-btn btn-ai" @click=${onScan} style="margin-bottom:12px;">
              <i class="fa-solid fa-magnifying-glass"></i> Scan for Missing References
            </button>
            ${queue.length === 0 ? html`<p style="color:#888;font-size:13px;">No reference suggestions yet. Click the scan button above.</p>` : ''}
            ${queue.map((item: any, i: number) => html`
              <div style="display:flex;align-items:center;gap:8px;padding:6px;border:1px solid #444;border-radius:4px;margin-bottom:4px;">
                <span style="font-size:11px;color:#888;width:24px;">#${i + 1}</span>
                <span style="flex:1;font-size:12px;">${item.label}</span>
                <span style="font-size:10px;background:#333;padding:1px 6px;border-radius:8px;color:#aaa;">${item.assetType}</span>
                <span style="font-size:10px;color:#888;">P${item.priority}</span>
              </div>
            `)}
          </div>
        `;
      },
    },
    /* Slide 4 — Style & Mood Layer */
    {
      title: 'Style & Mood Layer',
      renderFn: (host) => {
        const bb = (window as any).CineGen?.beatBoard;
        const s = bb?.getState?.() ?? {};
        const moods = ['neutral', 'warm', 'cool', 'tense', 'dreamy'];
        return html`
          <div class="script-wizard-form">
            <div style="margin-bottom:12px;">
              <label style="font-size:12px;color:#aaa;display:block;margin-bottom:4px;">Mood</label>
              <div style="display:flex;gap:6px;flex-wrap:wrap;">
                ${moods.map((m) => html`
                  <span style="padding:4px 12px;border-radius:12px;font-size:12px;cursor:pointer;background:${s.styleMood === m ? '#368' : '#333'};"
                    @click=${() => { bb?.setStyleMood(m); host.requestUpdate(); }}>
                    ${m}
                  </span>
                `)}
              </div>
            </div>
            <div style="margin-bottom:12px;">
              <label style="font-size:12px;color:#aaa;display:block;margin-bottom:4px;">Lighting</label>
              <input class="cg-field" style="width:100%;" .value=${s.lightingMood || ''} @input=${(e: any) => { bb?.setLightingMood(e.target.value); host.requestUpdate(); }} placeholder="e.g. Soft golden hour, harsh noon sun" />
            </div>
            <div style="margin-bottom:12px;">
              <label style="font-size:12px;color:#aaa;display:block;margin-bottom:4px;">Color Palette</label>
              <cg-color-palette
                .palette=${s.colorPalette ?? []}
                style="display:block;"
                @cg-palette-change=${(e: any) => {
                  bb?.setColorPalette(e.detail.palette);
                  host.requestUpdate();
                }}
              ></cg-color-palette>
            </div>
          </div>
        `;
      },
    },
    /* Slide 5 — Asset Generation Prompts */
    {
      title: 'Asset Generation Prompts',
      renderFn: (host) => {
        const bb = (window as any).CineGen?.beatBoard;
        const s = bb?.getState?.() ?? {};
        const chars = s.characters ?? [];
        const locs = s.locations ?? [];
        const onGenerate = async () => {
          (window as any).alertCG?.('Asset generation will create character sheets and background plates. This feature is coming soon.');
        };
        return html`
          <div class="script-wizard-form">
            <p style="margin-bottom:12px;">Generate reference assets for your characters and locations. These will be used when refining storyboards.</p>
            <div style="background:#1a1a1a;padding:10px;border-radius:6px;margin-bottom:12px;">
              <p style="font-size:12px;margin-bottom:4px;"><strong>Characters:</strong> ${chars.length > 0 ? chars.map((c: any) => c.name).join(', ') : 'none'}</p>
              <p style="font-size:12px;"><strong>Locations:</strong> ${locs.length > 0 ? locs.map((l: any) => `${l.name} (${l.intExt})`).join(', ') : 'none'}</p>
            </div>
            <button class="toolbar-btn btn-ai" @click=${onGenerate} ?disabled=${chars.length === 0 && locs.length === 0} style="width:100%;">
              <i class="fa-solid fa-wand-magic-sparkles"></i> Generate References
            </button>
          </div>
        `;
      },
    },
    /* Slide 6 — Refine Storyboards */
    {
      title: 'Refine Storyboards',
      renderFn: (host) => {
        const bb = (window as any).CineGen?.beatBoard;
        const s = bb?.getState?.() ?? {};
        const beats = s.beats ?? [];
        const onGenerateFrames = async () => {
          if (beats.length === 0) { (window as any).alertCG?.('Add at least one beat first.'); return; }
          try {
            const { generateStoryboardFrames } = await import('../services/ai/agents-service');
            const result = await generateStoryboardFrames(s.projectId || 'proj');
            bb?.setStoryboardsGenerated(beats.length);
            host.requestUpdate();
          } catch (err) {
            console.error('[beat-board] storyboard error:', err);
            (window as any).alertCG?.('Failed to generate storyboard frames.');
          }
        };
        return html`
          <div class="script-wizard-form">
            <p style="margin-bottom:12px;">Generate storyboard frames from your ${beats.length} beat(s). Each beat will produce a storyboard frame that can be refined later.</p>
            <div style="background:#1a1a1a;padding:10px;border-radius:6px;margin-bottom:12px;">
              <p style="font-size:12px;"><strong>Beats:</strong> ${beats.length}</p>
              <p style="font-size:12px;"><strong>Characters:</strong> ${(s.characters ?? []).length}</p>
              <p style="font-size:12px;"><strong>Locations:</strong> ${(s.locations ?? []).length}</p>
            </div>
            ${s.storyboardsGenerated ? html`
              <div style="color:#4c6;margin-bottom:8px;"><i class="fa-solid fa-check-circle"></i> ${s.storyboardFrameCount} frame(s) generated</div>
              <button class="toolbar-btn" @click=${onGenerateFrames}><i class="fa-solid fa-rotate"></i> Regenerate</button>
            ` : html`
              <button class="toolbar-btn btn-ai" @click=${onGenerateFrames} style="width:100%;">
                <i class="fa-solid fa-film"></i> Generate Storyboard Frames from Beats
              </button>
            `}
          </div>
        `;
      },
    },
    /* Slide 7 — Full Project Assembly */
    {
      title: 'Full Project Assembly',
      renderFn: (host) => {
        const bb = (window as any).CineGen?.beatBoard;
        const s = bb?.getState?.() ?? {};
        const beats = s.beats ?? [];
        const chars = s.characters ?? [];
        const locs = s.locations ?? [];
        const onBuildKit = async () => {
          if (!beats.length) {
            (window as any).alertCG?.('Add at least one beat first.');
            return;
          }
          const { applyBeatBoardSceneKit } = await import('@/wizard/beat-board-bundle');
          const kitResult = applyBeatBoardSceneKit();
          console.log('[beat-board] scene kit applied:', kitResult);
          bb?.setKitBuilt();
          host.requestUpdate();
        };
        const onGenerateStoryboards = async () => {
          if (!beats.length) { (window as any).alertCG?.('Add at least one beat first.'); return; }
          try {
            const { generateStoryboardFrames } = await import('../services/ai/agents-service');
            await generateStoryboardFrames(s.projectId || 'proj');
            bb?.setStoryboardsGenerated(beats.length);
            host.requestUpdate();
          } catch (err) {
            console.error('[beat-board] storyboard error:', err);
            (window as any).alertCG?.('Failed to generate storyboard frames.');
          }
        };
        return html`
          <div class="script-wizard-form">
            <p style="margin-bottom:12px;">Your storyboard sketch is ready for project assembly. Review the summary below then build your scene kit.</p>
            <div style="background:#1a1a1a;padding:12px;border-radius:6px;margin-bottom:12px;">
              <p style="font-size:12px;margin-bottom:4px;"><i class="fa-solid fa-list"></i> <strong>${beats.length}</strong> beats</p>
              <p style="font-size:12px;margin-bottom:4px;"><i class="fa-solid fa-user"></i> <strong>${chars.length}</strong> characters</p>
              <p style="font-size:12px;margin-bottom:4px;"><i class="fa-solid fa-location-dot"></i> <strong>${locs.length}</strong> locations</p>
              <p style="font-size:12px;margin-bottom:4px;"><i class="fa-solid fa-film"></i> <strong>${s.storyboardsGenerated ? s.storyboardFrameCount : 0}</strong> storyboard frames</p>
              <p style="font-size:12px;"><i class="fa-solid fa-palette"></i> Style: ${s.styleMood || 'none'} ${s.lightingMood ? `(${s.lightingMood})` : ''}</p>
            </div>
            ${s.sceneKitBuilt ? html`
              <div style="color:#4c6;margin-bottom:12px;"><i class="fa-solid fa-check-circle"></i> Scene kit built successfully!</div>
              ${s.storyboardsGenerated ? html`
                <div style="color:#4c6;margin-bottom:8px;"><i class="fa-solid fa-check-circle"></i> ${s.storyboardFrameCount} storyboard frame(s) generated</div>
              ` : html`
                <button class="toolbar-btn btn-ai" @click=${onGenerateStoryboards} style="width:100%;margin-bottom:8px;">
                  <i class="fa-solid fa-film"></i> Generate Storyboard Frames from Beats
                </button>
              `}
            ` : html`
              <button class="toolbar-btn btn-ai" @click=${onBuildKit} style="width:100%;margin-bottom:8px;">
                <i class="fa-solid fa-boxes-stacked"></i> Build Scene Kit
              </button>
            `}
            <div style="margin-top:12px;display:flex;gap:8px;justify-content:flex-end;border-top:1px solid #444;padding-top:12px;">
              <button class="toolbar-btn btn-ai" @click=${() => closeModal('storyboard-wizard-modal')}>
                <i class="fa-solid fa-check"></i> Finish & Close Wizard
              </button>
            </div>
          </div>
        `;
      },
    },
  ],
};

declare let currentSceneId: string | undefined;
declare const currentSceneData: Record<string, { broll?: Array<{ id: number; label: string }> }>;
declare function addItemsToLibrary(bucket: string, values: string[], icon?: string, desc?: string): void;
declare function generateBoards(): Promise<void>;
declare function generateStoryboardReferences(): Promise<void>;
declare function setProjectFountainText(text: string): void;
declare function renderGlobalAssets(tabIndex?: number): void;
declare function renderScriptInfoTables(): void;
declare function renderStoryboard(): void;
declare function refreshShotFrameTree(): void;
declare function updateInspector(kind: string, data: unknown): void;
declare function renderFullTree(): void;
declare function renderTimeline(): void;

function getGuideSectionIndex(id: string): number {
  return GUIDE_SECTIONS.findIndex((s) => s.id === id);
}

function renderGuideModalSection(index: number): void {
  const section = GUIDE_SECTIONS[index];
  const modal = document.getElementById('guide-modal');
  const titleEl = document.getElementById('guide-modal-title');
  const bodyEl = document.querySelector<CinegenGuideModalBody>('cinegen-guide-modal-body');
  const progressEl = document.getElementById('guide-modal-progress');
  const prevBtn = document.getElementById('guide-modal-prev') as HTMLButtonElement | null;
  const nextBtn = document.getElementById('guide-modal-next') as HTMLButtonElement | null;
  if (!section || !modal || !titleEl || !bodyEl) return;

  guideModalSectionIndex = index;
  titleEl.innerHTML = `<i class="fa-solid fa-book-open"></i> ${escHtml(section.title)}`;
  bodyEl.showSection(index);
  if (progressEl) {
    progressEl.textContent = `${index + 1} of ${GUIDE_SECTIONS.length}`;
  }
  if (prevBtn) prevBtn.disabled = index <= 0;
  if (nextBtn) nextBtn.disabled = index >= GUIDE_SECTIONS.length - 1;
}

export async function openGuide(sectionId: string): Promise<void> {
  closeAllToolbarSplitMenus();
  closeAllModalsExcept('guide-modal');
  closeAiProvidersModal();
  const index = getGuideSectionIndex(sectionId);
  if (index < 0) return;
  await openModalAsync('guide-modal');
  renderGuideModalSection(index);
}

export function closeGuideModal(): void {
  closeModal('guide-modal');
}

export function guideModalStep(delta: number): void {
  const next = guideModalSectionIndex + delta;
  if (next < 0 || next >= GUIDE_SECTIONS.length) return;
  renderGuideModalSection(next);
}

/* ── Entry-point wizard navigation (generic + per-modal) ───────────────────── */

function renderEntryWizardSlide(modalId: string, index: number): void {
  renderEntryWizardSlideFromService(modalId, index, WIZARD_SLIDES);
}

export function openScriptWizardModal(): void {
  openScriptWizardModalFromService(WIZARD_SLIDES);
}
export function closeScriptWizardModal(): void {
  closeScriptWizardModalFromService();
}

export function openVisualWizardModal(): void {
  openVisualWizardModalFromService(WIZARD_SLIDES);
}
export function closeVisualWizardModal(): void {
  closeVisualWizardModalFromService();
}

export function openConceptWizardModal(): void {
  openConceptWizardModalFromService(WIZARD_SLIDES);
}
export function closeConceptWizardModal(): void {
  closeConceptWizardModalFromService();
}

export function openAssetWizardModal(): void {
  openAssetWizardModalFromService(WIZARD_SLIDES);
}
export function closeAssetWizardModal(): void {
  closeAssetWizardModalFromService();
}

export function openStoryboardWizardModal(): void {
  openStoryboardWizardModalFromService(WIZARD_SLIDES);
}
export function closeStoryboardWizardModal(): void {
  closeStoryboardWizardModalFromService();
}

export function closeAiAssistModal(): void {
  closeModal('ai-assist-modal');
}

function launchSettingsAction(actionId: string): void {
  if (actionId === 'project-settings') {
    closeSettingsModal();
    openProjectSettingsModal();
    return;
  }
  if (actionId === 'ai-providers' || actionId === 'ai-api' || actionId === 'api-keys') {
    closeSettingsModal();
    void openAiProvidersModal();
    return;
  }
  const sel = SETTINGS_MODAL_TILES.find((t) => t.id === actionId) || SETTINGS_MODAL_TILES[1];
  closeSettingsModal();
  alertCG(`${sel.title}\n\nDetail panel for this section (coming soon).`);
}

export function openAiAssistModal(): void {
  closeAllToolbarSplitMenus();
  closeAllModalsExcept('ai-assist-modal');
  closeAiProvidersModal();
  openModal('ai-assist-modal');
}

export function openWizardsModal(): void {
  openWizardsModalFromService(WIZARD_SLIDES);
}

export function openMoodBoardsModal(): void {
  closeAllToolbarSplitMenus();
  window.activateProjectTreeNode?.('Mood Boards');
}

export function openMoodBoardItemDetail(boardId: string, itemId: string): void {
  const board = moodBoards.find((b) => b.id === boardId);
  if (!board) return;
  const item = board.items.find((i) => i.id === itemId);
  if (!item) return;
  openModal('moodboard-item-detail');
  queueMicrotask(() => {
    const el = document.getElementById('view-moodboard-detail');
    if (el && 'loadItem' in el && typeof (el as { loadItem: (boardId: string, itemId: string) => void }).loadItem === 'function') {
      (el as { loadItem: (boardId: string, itemId: string) => void }).loadItem(boardId, itemId);
    }
  });
}

export function closeWizardsModal(): void {
  closeWizardsModalFromService();
}

const WIZARD_ACTIONS: Record<string, () => void> = {
  'script-wizard': openScriptWizardModal,
  'visual-wizard': openVisualWizardModal,
  'concept-wizard': openConceptWizardModal,
  'asset-wizard': openAssetWizardModal,
  'storyboard-wizard': openStoryboardWizardModal,
};

export function launchWizardAction(wizardId: string): void {
  launchWizardActionFromService(wizardId, WIZARD_ACTIONS);
}

export function launchAiAssistAction(kind: string, actionId: string): void {
  if (actionId === 'app-setup-assistant') {
    closeAiAssistModal();
    void window.openSetupAssistant?.();
    return;
  }
  if (kind === 'task') {
    if (actionId === 'sync-entities' && typeof window.parseScriptToAssets === 'function') {
      closeAiAssistModal();
      window.parseScriptToAssets();
      return;
    }
    if (actionId === 'suggest-pickups') {
      closeAiAssistModal();
      const viewText = appShellStore.currentViewLabel || '';
      if (
        viewText?.includes('Scene') &&
        typeof currentSceneId !== 'undefined' &&
        currentSceneId &&
        typeof currentSceneData !== 'undefined'
      ) {
        const scene = currentSceneData[currentSceneId];
        if (scene && Array.isArray(scene.broll)) {
          scene.broll.push({ id: Date.now(), label: 'AI Suggested Cutaway', duration: '4s' } as never);
        }
        const detail = document.getElementById('view-scene-detail');
        if (detail && !detail.classList.contains('hidden') && typeof window.renderSceneDetail === 'function') {
          window.renderSceneDetail();
        }
        alertCG('Suggested pickups and a cutaway idea for this scene.');
      } else {
        alertCG('Open a scene in the hierarchy to run pickup suggestions.');
      }
      return;
    }
    if (actionId === 'board-from-scene' && typeof window.generateBoards === 'function') {
      closeAiAssistModal();
      window.generateBoards();
      return;
    }
    if (actionId === 'production-brief') {
      closeAiAssistModal();
      alertCG('Production brief — compiled PDF / share link (coming soon).');
      return;
    }
  }

  const tiles = kind === 'assistant' ? AI_ASSIST_ASSISTANT_TILES : AI_ASSIST_TASK_TILES;
  const meta = tiles.find((t) => t.id === actionId);
  closeAiAssistModal();
  if (meta) {
    alertCG(
      `${meta.title}\n\n${meta.desc}\n\nFull assistant chat is not wired yet — routing will use Settings → AI Model & API.`
    );
  } else {
    alertCG('Action unavailable.');
  }
}

function wireModalTileGrid(
  el: CgModalTileGrid | null,
  tiles: typeof SETTINGS_MODAL_TILES,
  onSelect: (id: string, kind: string) => void
): void {
  if (!el || el.dataset.cgTilesWired === '1') return;
  el.dataset.cgTilesWired = '1';
  el.tiles = tiles;
  el.addEventListener('cg-modal-tile-select', (e: Event) => {
    const { id, kind } = (e as CustomEvent<{ id: string; kind: string }>).detail;
    onSelect(id, kind);
  });
}

export function buildAiAssistModalGrids(): void {
  wireModalTileGrid(
    document.querySelector<CgModalTileGrid>('#ai-assist-assistants-grid'),
    AI_ASSIST_ASSISTANT_TILES,
    (_id, kind) => launchAiAssistAction(kind, _id)
  );
  wireModalTileGrid(
    document.querySelector<CgModalTileGrid>('#ai-assist-tasks-grid'),
    AI_ASSIST_TASK_TILES,
    (_id, kind) => launchAiAssistAction(kind, _id)
  );
}

export function buildWizardsModalGrid(): void {
  wireModalTileGrid(
    document.querySelector<CgModalTileGrid>('#wizards-modal-grid'),
    WIZARD_ENTRY_TILES,
    (id) => launchWizardAction(id)
  );
}

export function buildSettingsModalGrid(): void {
  wireModalTileGrid(
    document.querySelector<CgModalTileGrid>('#settings-modal-grid'),
    SETTINGS_MODAL_TILES,
    (id) => launchSettingsAction(id)
  );
  initProjectSettingsAspectToResolutionSync();
}

export function importScript(): void {
  closeToolbarSplitMenu('import-split');
  window.triggerFDXImport?.();
}

export function saveProject(): void {
  persistActiveProjectSnapshot();
  alertCG('Project saved.');
}

export function openSettings(action: string): void {
  if (action === 'project-settings') {
    openProjectSettingsModal();
    return;
  }
  if (action === 'app-setup-assistant') {
    openSetupAssistantForDebug();
    return;
  }
  if (action === 'ai-providers' || action === 'ai-api' || action === 'api-keys') {
    void openAiProvidersModal();
    return;
  }
  openSettingsModal();
}

export function exportScreenplay(): void {
  window.closeSaveExportMenu?.();
  window.saveFountainFile?.();
}

/* ── Blank-project wizard (2 slides inside #projects-modal) ───────────────── */

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

function restoreProjectsList(): void {
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
  const registryEntry = (window as any).projectRegistry?.find?.((p: any) => p.id === created.id);
  if (registryEntry) {
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

export function registerToolbarModals(): void {
  registerModal({ id: 'guide-modal', bodyClass: 'guide-modal-open' });
  registerModal({ id: 'projects-modal' });
  registerModal({ id: 'settings-modal' });
  registerModal({ id: 'ai-assist-modal' });
  registerModal({ id: 'wizards-modal' });
  registerModal({ id: 'project-settings-modal' });
  registerModal({ id: 'debug-modal', hostOverflowY: 'auto' });
  registerModal({ id: 'section-settings-modal' });
  registerModal({ id: 'project-features-modal' });
  registerModal({ id: 'ai-provider-info-modal' });
  registerModal({ id: 'sound-editor-modal', hostOverflowY: 'hidden' });
  registerModal({ id: 'script-wizard-modal' });
  registerModal({ id: 'visual-wizard-modal' });
  registerModal({ id: 'concept-wizard-modal' });
  registerModal({ id: 'asset-wizard-modal' });
  registerModal({ id: 'storyboard-wizard-modal' });
  registerModal({ id: 'moodboard-item-detail', elementId: 'view-moodboard-detail' });
}

export async function openSectionSettingsModal(): Promise<void> {
  closeAllToolbarSplitMenus();
  closeAllModalsExcept('section-settings-modal');
  await openModalAsync('section-settings-modal');
  const modalBody = document.querySelector('cinegen-section-settings-modal');
  if (modalBody && 'refresh' in modalBody && typeof (modalBody as { refresh?: () => void }).refresh === 'function') {
    (modalBody as { refresh: () => void }).refresh();
  }
}

export function closeSectionSettingsModal(): void {
  closeModal('section-settings-modal');
}

export async function openProjectFeaturesModal(): Promise<void> {
  closeAllToolbarSplitMenus();
  closeAllModalsExcept('project-features-modal');
  await openModalAsync('project-features-modal');
  const modalBody = document.querySelector('cinegen-project-features-modal');
  if (modalBody && 'refresh' in modalBody && typeof (modalBody as { refresh?: () => void }).refresh === 'function') {
    (modalBody as { refresh: () => void }).refresh();
  }
}

export function closeProjectFeaturesModal(): void {
  closeModal('project-features-modal');
}

export async function openAiProviderInfoModal(): Promise<void> {
  closeAllToolbarSplitMenus();
  closeAllModalsExcept('ai-provider-info-modal');
  await openModalAsync('ai-provider-info-modal');
  const body = document.querySelector('cinegen-ai-provider-info');
  if (body && 'refresh' in body && typeof (body as { refresh?: () => void }).refresh === 'function') {
    (body as { refresh: () => void }).refresh();
  }
}

export function closeAiProviderInfoModal(): void {
  closeModal('ai-provider-info-modal');
}

export function installToolbarModalGlobals(): void {
  window.openGuide = openGuide;
  window.closeGuideModal = closeGuideModal;
  window.guideModalStep = guideModalStep;
  window.openProjectsModal = openProjectsModal;
  window.closeProjectsModal = closeProjectsModal;
  window.openSettingsModal = openSettingsModal;
  window.closeSettingsModal = closeSettingsModal;
  window.openAiAssistModal = openAiAssistModal;
  window.closeAiAssistModal = closeAiAssistModal;
  window.openWizardsModal = openWizardsModal;
  window.closeWizardsModal = closeWizardsModal;
  window.openProjectSettingsModal = openProjectSettingsModal;
  window.closeProjectSettingsModal = closeProjectSettingsModal;
  window.openDebugModal = openDebugModal;
  window.closeDebugModal = closeDebugModal;
  window.openSectionSettingsModal = openSectionSettingsModal;
  window.closeSectionSettingsModal = closeSectionSettingsModal;
  window.openProjectFeaturesModal = openProjectFeaturesModal;
  window.closeProjectFeaturesModal = closeProjectFeaturesModal;
  window.openAiProviderInfoModal = openAiProviderInfoModal;
  window.closeAiProviderInfoModal = closeAiProviderInfoModal;
  window.saveProjectSettingsModal = saveProjectSettingsModal;
  window.saveProject = saveProject;
  window.openSettings = openSettings;
  window.exportScreenplay = exportScreenplay;
  window.syncActiveProjectName = syncActiveProjectName;
  window.openBlankProjectWizard = openBlankProjectWizard;
  window.importScript = importScript;
  window.openScriptWizardModal = openScriptWizardModal;
  window.closeScriptWizardModal = closeScriptWizardModal;
  window.openVisualWizardModal = openVisualWizardModal;
  window.closeVisualWizardModal = closeVisualWizardModal;
  window.openConceptWizardModal = openConceptWizardModal;
  window.closeConceptWizardModal = closeConceptWizardModal;
  window.openAssetWizardModal = openAssetWizardModal;
  window.closeAssetWizardModal = closeAssetWizardModal;
  window.openStoryboardWizardModal = openStoryboardWizardModal;
  window.closeStoryboardWizardModal = closeStoryboardWizardModal;
}

export function wireToolbarModalDismissals(): void {
  document.querySelectorAll('[data-cg-close="debug-modal"]').forEach((el) => {
    el.addEventListener('click', () => closeDebugModal());
  });

  document.querySelectorAll('[data-cg-close="section-settings-modal"]').forEach((el) => {
    el.addEventListener('click', () => closeSectionSettingsModal());
  });
  document.querySelectorAll('[data-cg-close="project-features-modal"]').forEach((el) => {
    el.addEventListener('click', () => closeProjectFeaturesModal());
  });
  document.querySelector('#project-features-modal .cg-modal-backdrop')?.addEventListener('click', () =>
    closeProjectFeaturesModal()
  );
  document.querySelectorAll('[data-cg-close="ai-provider-info-modal"]').forEach((el) => {
    el.addEventListener('click', () => closeAiProviderInfoModal());
  });
  document.querySelector('#section-settings-modal .cg-modal-backdrop')?.addEventListener('click', () =>
    closeSectionSettingsModal()
  );
  document.getElementById('guide-modal-prev')?.addEventListener('click', () => guideModalStep(-1));
  document.getElementById('guide-modal-next')?.addEventListener('click', () => guideModalStep(1));

  document.querySelectorAll('[data-cg-close="guide-modal"]').forEach((el) => {
    el.addEventListener('click', () => closeGuideModal());
  });

  document.querySelectorAll('[data-cg-close="projects-modal"]').forEach((el) => {
    el.addEventListener('click', () => closeProjectsModal());
  });
  document.querySelector('#projects-modal .projects-modal-backdrop')?.addEventListener('click', () =>
    closeProjectsModal()
  );

  document.querySelectorAll('[data-cg-close="settings-modal"]').forEach((el) => {
    el.addEventListener('click', () => closeSettingsModal());
  });
  document.querySelector('#settings-modal .settings-modal-backdrop')?.addEventListener('click', () =>
    closeSettingsModal()
  );

  document.querySelectorAll('[data-cg-close="ai-assist-modal"]').forEach((el) => {
    el.addEventListener('click', () => closeAiAssistModal());
  });
  document.querySelector('#ai-assist-modal .settings-modal-backdrop')?.addEventListener('click', () =>
    closeAiAssistModal()
  );

  document.querySelectorAll('[data-cg-close="project-settings-modal"]').forEach((el) => {
    el.addEventListener('click', () => closeProjectSettingsModal());
  });
  document
    .querySelector('#project-settings-modal .project-settings-modal-backdrop')
    ?.addEventListener('click', () => closeProjectSettingsModal());

  document
    .querySelector('#project-settings-modal .project-settings-modal-backdrop')
    ?.addEventListener('click', () => closeProjectSettingsModal());
  document.querySelectorAll('[data-cg-close="project-settings-modal"]').forEach((el) => {
    el.addEventListener('click', () => closeProjectSettingsModal());
  });
  const projectSettingsModal = document.getElementById('project-settings-modal');
  if (projectSettingsModal && projectSettingsModal.dataset.cgProjectSettingsWired !== '1') {
    projectSettingsModal.dataset.cgProjectSettingsWired = '1';
    projectSettingsModal.addEventListener('click', (e) => {
      const actionEl = (e.target as HTMLElement).closest('[data-project-settings-action]');
      if (!actionEl) return;
      const action = (actionEl as HTMLElement).dataset.projectSettingsAction;
      if (action === 'save') {
        e.preventDefault();
        saveProjectSettingsModal();
        return;
      }
      if (action === 'back') {
        closeProjectSettingsModal();
        openSettingsModal();
      }
    });
  }

  const projectActions: Record<string, () => void | Promise<void>> = {
    'blank-project': openBlankProjectWizard,
    'script-wizard': openScriptWizardModal,
    'visual-wizard': openVisualWizardModal,
    'concept-wizard': openConceptWizardModal,
    'asset-wizard': openAssetWizardModal,
    'storyboard-wizard': openStoryboardWizardModal,
  };
  wireWizardNavigationAndActions(WIZARD_SLIDES, projectActions);
}

