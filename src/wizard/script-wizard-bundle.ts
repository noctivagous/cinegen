import { html, type TemplateResult } from 'lit';
import type { CinegenEntryWizardBody } from '@/components/modals/cinegen-entry-wizard-body';
import { alertCG } from '@/utils/alert-cg';
import {
  extractEntitiesFromText,
  inferInteriorFromName,
  scriptWizardState,
  type ScriptWizardCharacter,
  type ScriptWizardLocation,
} from '@/wizard/script-wizard-state';
import {
  getAgentHealth,
  runScriptWizardStep2,
  buildCharacterGuides,
  buildLocationGuides,
  generateStoryboardFrames,
  getProductionContext,
} from '@/services/ai/agents-service';
import { applyProductionContext } from '@/services/agent-context-adapter';
import { runWizardCompletion } from '@/wizard/wizard-completion-hook';
import { renderScriptWizardAnalysisSummary } from '@/wizard/script-wizard-analysis-summary';

interface ScriptWizardDeps {
  createNewProject: (name: string, opts?: { screenplay?: string; entryMode?: string }) => Promise<{ id: string; name: string } | null>;
  setActiveProjectId: (projectId: string) => void;
  syncActiveProjectName: (name: string) => void;
  setProjectFountainText: (text: string) => void;
  hydrateScriptEditorFromProject: () => void;
  renderProjectsModalList: () => void;
  renderEntryWizardSlide: (modalId: string, index: number) => void;
  generateStoryboardReferences: () => Promise<void>;
  generateBoards: () => Promise<void>;
  closeScriptWizardModal: () => void;
  addItemsToLibrary: (bucket: string, values: string[], icon?: string, desc?: string) => void;
  renderBreakdownTable: () => void;
  scheduleFountainRender: () => void;
  syncFountainToProject: (text: string, projectId: string) => { characters: string[]; locations: string[] };
}

interface WizardSlide {
  title: string;
  body?: string;
  tip?: string;
  renderFn?: (host: CinegenEntryWizardBody) => TemplateResult;
}

function populateScriptWizardAssets(
  state: typeof scriptWizardState,
  addItemsToLibrary: ScriptWizardDeps['addItemsToLibrary'],
): void {
  addItemsToLibrary(
    'characters',
    state.characters.map((c) => c.name),
    'fa-user',
    'Added from script wizard',
  );
  addItemsToLibrary(
    'locations',
    state.locations.map((l) => l.name),
    'fa-map-location-dot',
    'Added from script wizard',
  );
}

export function createScriptWizardSlides(deps: ScriptWizardDeps): WizardSlide[] {
  return [
    {
      title: 'Script Import & Review',
      renderFn: () => {
        const state = scriptWizardState;
        const onCreate = async () => {
          if (!state.scriptText.trim()) {
            alertCG('Please paste or type a script first.');
            return;
          }
          const created = await deps.createNewProject('Untitled Production', {
            screenplay: state.scriptText,
            entryMode: 'script',
          });
          if (!created) {
            alertCG('Project creation failed. Check the server connection.');
            return;
          }
          deps.setActiveProjectId(created.id);
          deps.syncActiveProjectName(created.name);
          deps.setProjectFountainText(state.scriptText);
          deps.hydrateScriptEditorFromProject();

          // Run deterministic script-to-project sync (scenes, breakdown, shots, assets)
          const syncResult = deps.syncFountainToProject(state.scriptText, created.id);
          state.projectId = created.id;
          state.detectedCharacters = syncResult.characters;
          state.detectedLocations = syncResult.locations;

          runWizardCompletion({
            projectId: created.id,
            featureBranches: ['production-office', 'scenes'],
            dirtyDocs: ['screenplay', 'scenes', 'breakdown', 'characters', 'locations', 'features'],
            fountainText: state.scriptText,
            flushSnapshot: true,
          });

          deps.renderProjectsModalList();
          deps.scheduleFountainRender();
          deps.renderEntryWizardSlide('script-wizard-modal', 1);
        };
        return html`
          <div class="script-wizard-form">
            <p>Paste your Fountain screenplay below. CineGen will automatically detect scene headings, characters, and locations.</p>
            <textarea
              class="cg-field"
              style="min-height:160px;"
              placeholder="Paste your script here..."
              .value=${state.scriptText}
              @input=${(e: Event) => { state.scriptText = (e.target as HTMLTextAreaElement).value; }}
            ></textarea>
            <button class="toolbar-btn btn-ai" @click=${onCreate}>Create Project & Analyze Script</button>
          </div>
        `;
      },
    },
    {
      title: 'Core Elements Extraction',
      renderFn: (host) => {
        const state = scriptWizardState;
        const removeChar = (name: string) => {
          state.detectedCharacters = state.detectedCharacters.filter((n) => n !== name);
          host.requestUpdate();
        };
        const removeLoc = (name: string) => {
          state.detectedLocations = state.detectedLocations.filter((n) => n !== name);
          host.requestUpdate();
        };
        const addChar = () => {
          const input = host.querySelector<HTMLInputElement>('#sw-add-char');
          const name = input?.value.trim();
          if (name && !state.detectedCharacters.includes(name)) {
            state.detectedCharacters.push(name);
            if (input) input.value = '';
            host.requestUpdate();
          }
        };
        const addLoc = () => {
          const input = host.querySelector<HTMLInputElement>('#sw-add-loc');
          const name = input?.value.trim();
          if (name && !state.detectedLocations.includes(name)) {
            state.detectedLocations.push(name);
            if (input) input.value = '';
            host.requestUpdate();
          }
        };
        const onConfirm = async () => {
          state.characters = state.detectedCharacters.map((name) => ({
            name,
            age: '',
            build: '',
            vibe: '',
          }));
          state.locations = state.detectedLocations.map((name) => ({
            name,
            description: '',
            isInterior: inferInteriorFromName(name, state.scriptText),
          }));

          if (state.projectId) {
            try {
              const health = await getAgentHealth();
              if (health.ready) {
                await runScriptWizardStep2(state.projectId, state.scriptText);
                const ctx = await getProductionContext(state.projectId);
                if (ctx) applyProductionContext(ctx);
              } else {
                alertCG('AI Director agents not configured. Using deterministic fallback.');
              }
            } catch (e) {
              const msg = e instanceof Error ? e.message : String(e);
              console.warn('[script-wizard] Agent enrichment failed, using deterministic fallback:', msg);
              alertCG(`Agent enrichment unavailable (${msg}). Proceeding with local analysis.`);
            }
          }

          deps.renderEntryWizardSlide('script-wizard-modal', 2);
        };
        return html`
          <div class="script-wizard-form">
            <p>Review the characters and locations detected from your script. Remove false positives or add missing ones.</p>
            ${renderScriptWizardAnalysisSummary()}
            <div class="script-wizard-section">
              <h4>Characters (${state.detectedCharacters.length})</h4>
              <div class="script-wizard-chip-list">
                ${state.detectedCharacters.map((name) => html`
                  <span class="entity-chip entity-chip--character">
                    ${name}
                    <button type="button" class="remove-chip-btn" @click=${() => removeChar(name)} aria-label="Remove ${name}">×</button>
                  </span>
                `)}
              </div>
              <div class="script-wizard-add-row">
                <input id="sw-add-char" class="cg-field" type="text" placeholder="Add character..." @keydown=${(e: KeyboardEvent) => e.key === 'Enter' && addChar()} />
                <button class="toolbar-btn" @click=${addChar}>Add</button>
              </div>
            </div>
            <div class="script-wizard-section">
              <h4>Locations (${state.detectedLocations.length})</h4>
              <div class="script-wizard-chip-list">
                ${state.detectedLocations.map((name) => html`
                  <span class="entity-chip entity-chip--location">
                    ${name}
                    <button type="button" class="remove-chip-btn" @click=${() => removeLoc(name)} aria-label="Remove ${name}">×</button>
                  </span>
                `)}
              </div>
              <div class="script-wizard-add-row">
                <input id="sw-add-loc" class="cg-field" type="text" placeholder="Add location..." @keydown=${(e: KeyboardEvent) => e.key === 'Enter' && addLoc()} />
                <button class="toolbar-btn" @click=${addLoc}>Add</button>
              </div>
            </div>
            <button class="toolbar-btn btn-ai" @click=${onConfirm}>Confirm & Continue</button>
          </div>
        `;
      },
    },
    {
      title: 'Casting Setup',
      renderFn: () => {
        const state = scriptWizardState;
        const onNext = async () => {
          if (state.projectId) {
            try {
              const health = await getAgentHealth();
              if (health.ready) {
                const chars = state.characters.map((c) => ({
                  name: c.name,
                  role: '',
                  description: `${c.age || ''} · ${c.build || ''} · ${c.vibe || ''}`.replace(/^ · | · $/g, ''),
                }));
                await buildCharacterGuides(state.projectId, chars);
                alertCG('Character guides sent to AI Director for review.');
              }
            } catch (e) {
              console.warn('[script-wizard] buildCharacterGuides failed:', e);
            }
          }
          deps.renderEntryWizardSlide('script-wizard-modal', 3);
        };
        return html`
          <div class="script-wizard-form">
            <p>Add basic details for each character. These become casting notes and reference prompts.</p>
            <div class="script-wizard-cards">
              ${state.characters.map((char: ScriptWizardCharacter, i: number) => html`
                <fieldset class="cg-fieldset cg-fieldset--ns-secondary">
                  <legend class="cg-fieldset-legend"><i class="fa-solid fa-user" aria-hidden="true"></i> ${char.name}</legend>
                  <div class="cg-fieldset-body">
                    <div class="script-wizard-field-row">
                      <span>Age</span>
                      <input class="cg-field" type="text" .value=${char.age} @input=${(e: Event) => { state.characters[i].age = (e.target as HTMLInputElement).value; }} placeholder="e.g. 30s" />
                    </div>
                    <div class="script-wizard-field-row">
                      <span>Build</span>
                      <input class="cg-field" type="text" .value=${char.build} @input=${(e: Event) => { state.characters[i].build = (e.target as HTMLInputElement).value; }} placeholder="e.g. Athletic, slender" />
                    </div>
                    <div class="script-wizard-field-row">
                      <span>Vibe</span>
                      <textarea class="cg-field" .value=${char.vibe} @input=${(e: Event) => { state.characters[i].vibe = (e.target as HTMLTextAreaElement).value; }} placeholder="General personality, energy, archetype..."></textarea>
                    </div>
                  </div>
                </fieldset>
              `)}
            </div>
            <button class="toolbar-btn btn-ai" @click=${onNext}>Continue</button>
          </div>
        `;
      },
    },
    {
      title: 'Production Design Setup',
      renderFn: () => {
        const state = scriptWizardState;
        const onNext = async () => {
          populateScriptWizardAssets(state, deps.addItemsToLibrary);
          deps.renderBreakdownTable();
          deps.scheduleFountainRender();

          if (state.projectId) {
            try {
              const health = await getAgentHealth();
              if (health.ready) {
                const locs = state.locations.map((l) => ({
                  name: l.name,
                  intExt: l.isInterior ? 'INT' : 'EXT',
                  description: l.description,
                }));
                await buildLocationGuides(state.projectId, locs);
                alertCG('Location guides sent to AI Director for review.');
              }
            } catch (e) {
              console.warn('[script-wizard] buildLocationGuides failed:', e);
            }
          }

          deps.renderEntryWizardSlide('script-wizard-modal', 4);
        };
        return html`
          <div class="script-wizard-form">
            <p>Define each primary location. Descriptions help keep generated references consistent.</p>
            <div class="script-wizard-cards">
              ${state.locations.map((loc: ScriptWizardLocation, i: number) => html`
                <fieldset class="cg-fieldset cg-fieldset--ns-secondary">
                  <legend class="cg-fieldset-legend"><i class="fa-solid fa-map-location-dot" aria-hidden="true"></i> ${loc.name}</legend>
                  <div class="cg-fieldset-body">
                    <div class="script-wizard-field-row">
                      <span>Type</span>
                      <select class="cg-field" .value=${loc.isInterior ? 'int' : 'ext'} @change=${(e: Event) => { state.locations[i].isInterior = (e.target as HTMLSelectElement).value === 'int'; }}>
                        <option value="int">Interior</option>
                        <option value="ext">Exterior</option>
                      </select>
                    </div>
                    <div class="script-wizard-field-row">
                      <span>Description</span>
                      <textarea class="cg-field" .value=${loc.description} @input=${(e: Event) => { state.locations[i].description = (e.target as HTMLTextAreaElement).value; }} placeholder="Atmosphere, period, key architectural notes..."></textarea>
                    </div>
                  </div>
                </fieldset>
              `)}
            </div>
            <button class="toolbar-btn btn-ai" @click=${onNext}>Continue</button>
          </div>
        `;
      },
    },
    {
      title: 'Style Foundation',
      renderFn: (host) => {
        const state = scriptWizardState;
        const presets = ['Cinematic noir', 'Warm naturalistic', 'High-contrast sci-fi', 'Muted period drama', 'Vibrant comedy'];
        const applyPreset = (p: string) => {
          state.styleNotes = p;
          host.requestUpdate();
        };
        const onNext = () => {
          deps.renderEntryWizardSlide('script-wizard-modal', 5);
        };
        return html`
          <div class="script-wizard-form">
            <p>Set the overall aesthetic for the project. This influences storyboard and reference generation.</p>
            <textarea
              class="cg-field"
              style="min-height:100px;"
              .value=${state.styleNotes}
              @input=${(e: Event) => { state.styleNotes = (e.target as HTMLTextAreaElement).value; }}
              placeholder="Describe the overall look: lighting style, color palette, mood, era..."
            ></textarea>
            <div class="script-wizard-presets">
              ${presets.map((p) => html`
                <button class="toolbar-btn script-wizard-preset" @click=${() => applyPreset(p)}>${p}</button>
              `)}
            </div>
            <button class="toolbar-btn btn-ai" @click=${onNext}>Continue</button>
          </div>
        `;
      },
    },
    {
      title: 'Minimal References',
      renderFn: (host) => {
        const state = scriptWizardState;
        const onGenerate = async () => {
          try {
            await deps.generateStoryboardReferences();
            const bank = (window as any).storyboardReferenceBank as Record<string, Array<{ label: string; imageUrl?: string }>>;
            state.references = [];
            for (const [category, slots] of Object.entries(bank)) {
              for (const slot of slots) {
                state.references.push({ label: slot.label, imageUrl: slot.imageUrl, category });
              }
            }
            state.referencesGenerated = true;
            host.requestUpdate();
          } catch (err) {
            alertCG('Reference generation failed: ' + (err instanceof Error ? err.message : String(err)));
          }
        };
        const onNext = () => {
          deps.renderEntryWizardSlide('script-wizard-modal', 6);
        };
        return html`
          <div class="script-wizard-form">
            <p>Generate starter reference images for the first scene using the characters and locations you defined.</p>
            ${!state.referencesGenerated
              ? html`<button class="toolbar-btn btn-ai" @click=${onGenerate}>Generate Starter References</button>`
              : html`
                  <div class="script-wizard-ref-grid">
                    ${state.references.map((ref) => html`
                      <div class="script-wizard-ref-item">
                        ${ref.imageUrl ? html`<img src=${ref.imageUrl} alt=${ref.label} />` : html`<div class="script-wizard-ref-placeholder">Generating...</div>`}
                        <span class="script-wizard-ref-label">${ref.label}</span>
                        <span class="script-wizard-ref-cat">${ref.category}</span>
                      </div>
                    `)}
                  </div>
                  <button class="toolbar-btn btn-ai" @click=${onNext}>Continue</button>
                `}
          </div>
        `;
      },
    },
    {
      title: 'Scene Kit Preview & Confirmation',
      renderFn: () => {
        const state = scriptWizardState;
        const onBack = () => deps.renderEntryWizardSlide('script-wizard-modal', 4);
        const onNext = () => deps.renderEntryWizardSlide('script-wizard-modal', 7);
        return html`
          <div class="script-wizard-form">
            <p>Here is what CineGen has assembled for your first scene kit.</p>
            <fieldset class="cg-fieldset cg-fieldset--ns-secondary">
              <legend class="cg-fieldset-legend"><i class="fa-solid fa-cube" aria-hidden="true"></i> Scene Kit Summary</legend>
              <div class="cg-fieldset-body script-wizard-summary">
                <div class="script-wizard-summary-row">
                  <strong>Characters:</strong> ${state.characters.length} — ${state.characters.map((c) => c.name).join(', ')}
                </div>
                <div class="script-wizard-summary-row">
                  <strong>Locations:</strong> ${state.locations.length} — ${state.locations.map((l) => l.name).join(', ')}
                </div>
                <div class="script-wizard-summary-row">
                  <strong>References:</strong> ${state.references.length} generated
                </div>
                <div class="script-wizard-summary-row">
                  <strong>Style:</strong> ${state.styleNotes || 'Not specified'}
                </div>
              </div>
            </fieldset>
            <div class="script-wizard-actions">
              <button class="toolbar-btn" @click=${onBack}>Go Back</button>
              <button class="toolbar-btn btn-ai" @click=${onNext}>Looks Good — Continue</button>
            </div>
          </div>
        `;
      },
    },
    {
      title: 'Generate Initial Storyboards',
      renderFn: (host) => {
        const state = scriptWizardState;
        const onGenerate = async () => {
          try {
            if (state.projectId) {
              const health = await getAgentHealth();
              if (health.ready) {
                await generateStoryboardFrames(state.projectId);
                state.storyboardsGenerated = true;
                state.storyboardFrameCount = 0; // Agent frames go to review queue
                alertCG('Storyboard frames queued in AI Director for review.');
                host.requestUpdate();
                return;
              }
            }
            // Fallback: legacy local generation
            const before = ((window as any).storyboardFrames as unknown[] | undefined)?.length ?? 0;
            await deps.generateBoards();
            const after = ((window as any).storyboardFrames as unknown[] | undefined)?.length ?? 0;
            state.storyboardFrameCount = after - before;
            state.storyboardsGenerated = true;
            host.requestUpdate();
          } catch (err) {
            alertCG('Storyboard generation failed: ' + (err instanceof Error ? err.message : String(err)));
          }
        };
        const onFinish = () => {
          deps.closeScriptWizardModal();
        };
        return html`
          <div class="script-wizard-form">
            <p>Create the first set of storyboard frames from the scene kit and style foundation.</p>
            ${!state.storyboardsGenerated
              ? html`<button class="toolbar-btn btn-ai" @click=${onGenerate}>Generate Storyboards</button>`
              : html`
                  <div class="script-wizard-success">
                    <p><strong>${state.storyboardFrameCount}</strong> draft frame(s) created.</p>
                    <p>You can review and generate thumbnails in the Pre-production workspace.</p>
                  </div>
                  <button class="toolbar-btn btn-ai" @click=${onFinish}>Finish & Close Wizard</button>
                `}
          </div>
        `;
      },
    },
  ];
}
