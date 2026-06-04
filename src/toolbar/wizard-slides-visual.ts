import { html } from 'lit';
import { alertCG } from '@/utils/alert-cg';
import { appShellStore } from '@/stores/app-shell-store';
import { syncActiveProjectName, renderProjectsModalList } from '@/toolbar/toolbar-project-modals-service';
import {
  renderEntryWizardSlide as _renderEntryWizardSlide,
  closeVisualWizardModal,
  type WizardSlide,
} from '@/toolbar/toolbar-wizard-modals-service';
import { createBlankProject } from '@/services/project-service';
import { resetScriptWizardState } from '@/wizard/script-wizard-state';
import type { CinegenEntryWizardBody } from '@/components/modals/cinegen-entry-wizard-body';

function renderEntryWizardSlide(modalId: string, index: number) {
  _renderEntryWizardSlide(modalId, index, getVisualSlidesMap());
}

function getVisualSlidesMap(): Record<string, WizardSlide[]> {
  return { 'visual-wizard-modal': VISUAL_WIZARD_SLIDES };
}

export const VISUAL_WIZARD_SLIDES: WizardSlide[] = [
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
        const slides = getVisualSlidesMap()['visual-wizard-modal'];
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
];
