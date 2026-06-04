import { html } from 'lit';
import { alertCG } from '@/utils/alert-cg';
import { appShellStore } from '@/stores/app-shell-store';
import { syncActiveProjectName, renderProjectsModalList } from '@/toolbar/toolbar-project-modals-service';
import {
  renderEntryWizardSlide as _renderEntryWizardSlide,
  type WizardSlide,
} from '@/toolbar/toolbar-wizard-modals-service';
import { createBlankProject } from '@/services/project-service';
import { closeModal } from '@/services/modal-manager';
import type { CinegenEntryWizardBody } from '@/components/modals/cinegen-entry-wizard-body';

function renderEntryWizardSlide(modalId: string, index: number) {
  _renderEntryWizardSlide(modalId, index, getConceptSlidesMap());
}

function getConceptSlidesMap(): Record<string, WizardSlide[]> {
  return { 'concept-wizard-modal': CONCEPT_WIZARD_SLIDES };
}

export const CONCEPT_WIZARD_SLIDES: WizardSlide[] = [
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
          const slides = getConceptSlidesMap()['concept-wizard-modal'];
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
];
