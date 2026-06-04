import { html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { CgLightElement } from '@/components/lit-base';
import {
  getProjectDrafts,
  appendProjectDraft,
  patchProjectDraft,
  storyboardFrames,
  currentSceneData,
  assetLibrary,
  type CineProjectDraft,
} from '@/data/project-data';
import { markProjectDirty } from '@/services/project-service';
import { syncAssetLibraryToReferenceBank } from '@/storyboard/storyboard-reference-sync';
import { resolveModalityVendorRoute } from '@/services/ai/resolve-modality-vendor';
import { alertCG } from '@/utils/alert-cg';
import { CG_DRAFTS_CHANGED, CG_STORYBOARD_FRAMES_CHANGED } from '@/events/shell-events';
import { generateDraftEntry } from '@/storyboard/draft-generation-service';

type DraftFilter = 'all' | 'unpromoted' | 'promoted';

@customElement('cinegen-drafts-panel')
export class CinegenDraftsPanel extends CgLightElement {
  @state() private _entries: CineProjectDraft[] = [];
  @state() private _loading = false;
  @state() private _prompt = '';
  @state() private _filter: DraftFilter = 'all';
  @state() private _injectStyleGuide = true;

  connectedCallback(): void {
    super.connectedCallback();
    this.id = 'view-drafts';
    this.classList.add('hidden', 'flex', 'flex-col', 'h-full');
    this._refreshEntries();
    window.addEventListener(CG_DRAFTS_CHANGED, this._onDraftsChanged);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener(CG_DRAFTS_CHANGED, this._onDraftsChanged);
  }

  private _onDraftsChanged = (): void => {
    this._refreshEntries();
  };

  private _refreshEntries(): void {
    this._entries = [...getProjectDrafts().entries];
  }

  private get _filteredEntries(): CineProjectDraft[] {
    switch (this._filter) {
      case 'unpromoted':
        return this._entries.filter((e) => !e.promotedTo);
      case 'promoted':
        return this._entries.filter((e) => !!e.promotedTo);
      default:
        return this._entries;
    }
  }

  private async _generate(): Promise<void> {
    if (this._loading) return;
    const prompt = this._prompt.trim();
    if (!prompt) return;
    this._loading = true;

    try {
      const result = await generateDraftEntry(prompt, this._injectStyleGuide);
      if (!result.ok) {
        alertCG(`Draft generation failed: ${result.error || 'Unknown error'}`);
        return;
      }
      window.dispatchEvent(new CustomEvent(CG_DRAFTS_CHANGED));
      this._prompt = '';
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alertCG(`Draft generation error: ${msg}`);
    } finally {
      this._loading = false;
    }
  }

  private _promoteToMoodBoard(draft: CineProjectDraft): void {
    if (!draft.outputUrl) {
      alertCG('This draft has no output image to promote.');
      return;
    }
    // Import lazily to keep chunk small
    import('@/data/project-data').then(({ activeMoodBoardId, moodBoards, addMoodBoardItem }) => {
      const boardId = activeMoodBoardId || (moodBoards[0] as any)?.id;
      if (!boardId) {
        alertCG('No mood board found. Create one first in the Mood Boards section.');
        return;
      }
      const item = addMoodBoardItem(boardId, {
        type: 'image',
        source: draft.outputUrl!,
        label: draft.prompt.slice(0, 80) || 'Draft',
        active: true,
        notes: draft.prompt,
        order: 0,
        metadata: { fromDraftId: draft.id, createdAt: Date.now() },
      });
      if (!item) {
        alertCG('Could not add to mood board.');
        return;
      }
      patchProjectDraft(draft.id, { promotedTo: { type: 'moodboard', targetId: boardId } });
      markProjectDirty(['drafts']);
      window.dispatchEvent(new CustomEvent(CG_DRAFTS_CHANGED));
    });
  }

  private _promoteToCharacterReference(draft: CineProjectDraft): void {
    if (!draft.outputUrl) {
      alertCG('This draft has no output image to promote.');
      return;
    }
    const chars = Array.isArray(assetLibrary.characters) ? assetLibrary.characters : [];
    if (!chars.length) {
      alertCG('No characters found in the asset library. Create characters first.');
      return;
    }
    const charLabels = chars.map((c: any, i: number) =>
      `${i + 1}. ${c.name || c.label || 'Unnamed'}`);
    const input = prompt(`Select a character:\n${charLabels.join('\n')}\n\nEnter number:`);
    if (!input) return;
    const idx = parseInt(input, 10) - 1;
    if (idx < 0 || idx >= chars.length) { alertCG('Invalid character selection.'); return; }
    const character = chars[idx] as Record<string, unknown>;

    const slotLabels = ['face', 'body', 'profile', 'threeQuarter', 'closeUp', 'costume'];
    const slotInput = prompt(
      `Assign reference as:\n${slotLabels.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\nEnter number:`
    );
    if (!slotInput) return;
    const slotIdx = parseInt(slotInput, 10) - 1;
    if (slotIdx < 0 || slotIdx >= slotLabels.length) { alertCG('Invalid reference slot.'); return; }
    const slotKey = slotLabels[slotIdx];

    if (!character.references || typeof character.references !== 'object') character.references = {};
    const refs = character.references as Record<string, unknown>;
    if (slotKey === 'costume') {
      if (!Array.isArray(refs.costume)) refs.costume = [];
      (refs.costume as string[]).push(draft.outputUrl!);
    } else {
      refs[slotKey] = draft.outputUrl;
    }

    patchProjectDraft(draft.id, {
      promotedTo: { type: 'reference', targetId: `${character.name || String(character.id) || 'char'}:${slotKey}` },
    });
    syncAssetLibraryToReferenceBank();
    markProjectDirty(['drafts']);
    window.dispatchEvent(new CustomEvent(CG_DRAFTS_CHANGED));
  }

  private _promoteToLocationPlate(draft: CineProjectDraft): void {
    if (!draft.outputUrl) {
      alertCG('This draft has no output image to promote.');
      return;
    }
    const locs = Array.isArray(assetLibrary.locations) ? assetLibrary.locations : [];
    if (!locs.length) {
      alertCG('No locations found in the asset library. Create locations first.');
      return;
    }
    const locLabels = locs.map((l: any, i: number) =>
      `${i + 1}. ${l.name || 'Unnamed'}`);
    const input = prompt(`Select a location:\n${locLabels.join('\n')}\n\nEnter number:`);
    if (!input) return;
    const idx = parseInt(input, 10) - 1;
    if (idx < 0 || idx >= locs.length) { alertCG('Invalid location selection.'); return; }
    const location = locs[idx] as Record<string, unknown>;

    if (!Array.isArray(location.references)) location.references = [];
    (location.references as string[]).push(draft.outputUrl!);

    patchProjectDraft(draft.id, {
      promotedTo: { type: 'reference', targetId: `${location.name || String(location.id) || 'loc'}:plate` },
    });
    syncAssetLibraryToReferenceBank();
    markProjectDirty(['drafts']);
    window.dispatchEvent(new CustomEvent(CG_DRAFTS_CHANGED));
  }

  private async _promoteToStoryboardFrame(draft: CineProjectDraft): Promise<void> {
    if (!draft.outputUrl) {
      alertCG('This draft has no output image to promote.');
      return;
    }

    const scenes = Object.entries(currentSceneData).sort(([a], [b]) => a.localeCompare(b));
    if (!scenes.length) {
      alertCG('No scenes found. Create scenes first.');
      return;
    }

    const sceneLabels = scenes.map(([sceneId, scene]: [string, any], idx) => `${idx + 1}. Scene ${sceneId} — ${scene.title || 'Untitled'}`);
    const sceneInput = prompt(`Select a scene:\n${sceneLabels.join('\n')}\n\nEnter scene number (1–${scenes.length}):`);
    if (!sceneInput) return;
    const sceneIdx = parseInt(sceneInput, 10) - 1;
    if (sceneIdx < 0 || sceneIdx >= scenes.length) {
      alertCG('Invalid scene selection.');
      return;
    }
    const [sceneId, scene] = scenes[sceneIdx];
    const sceneNumber = sceneIdx + 1;

    const coverage = (scene as any).coverage ?? [];
    const shotLabels = coverage.map((shot: any, idx: number) => `${idx + 1}. Shot ${shot.number ?? idx + 1} — ${shot.label || 'Untitled'}`);
    const shotInput = prompt(
      `Select a shot:\n${shotLabels.join('\n')}\n\nEnter shot number (1–${coverage.length}) or type "new" to create a shot:`
    );
    if (!shotInput) return;

    let shotId: number;
    if (shotInput.trim().toLowerCase() === 'new') {
      const { nextShotNumber, createCoverageShotForFrame } = await import('@/workspace/shot-frame-bridge');
      const frameId = Date.now();
      const frame = {
        id: frameId,
        label: draft.prompt.slice(0, 60) || 'Draft frame',
        scene: String(sceneNumber),
      };
      const shot = createCoverageShotForFrame(frame);
      if (!shot) {
        alertCG('Failed to create new shot.');
        return;
      }
      shotId = shot.id;
      // Now we'll replace the auto-created frame with our draft image below
    } else {
      const shotIdx = parseInt(shotInput, 10) - 1;
      if (shotIdx < 0 || shotIdx >= coverage.length) {
        alertCG('Invalid shot selection.');
        return;
      }
      shotId = coverage[shotIdx].id;
    }

    const frameId = Date.now() + Math.floor(Math.random() * 1000);
    const { assignFrameToShot } = await import('@/workspace/shot-frame-bridge');
    const { maybeAdvanceShotToStoryboarded } = await import('@/workspace/shot-lifecycle');

    const frame: import('@/storyboard/storyboard-types').StoryboardFrame = {
      id: frameId,
      scene: String(sceneNumber),
      shotId,
      label: draft.prompt.slice(0, 60) || 'Draft frame',
      durationSeconds: 3,
      imageUrl: draft.outputUrl,
    };

    storyboardFrames.push(frame);
    assignFrameToShot(sceneId, frameId, shotId);
    const shot = coverage.find((s: any) => s.id === shotId);
    if (shot) maybeAdvanceShotToStoryboarded(shot);

    markProjectDirty(['storyboard', 'scenes']);
    window.dispatchEvent(new CustomEvent(CG_STORYBOARD_FRAMES_CHANGED));

    patchProjectDraft(draft.id, { promotedTo: { type: 'frame', targetId: `${sceneId}:${shotId}:${frameId}` } });
    markProjectDirty(['drafts']);
    window.dispatchEvent(new CustomEvent(CG_DRAFTS_CHANGED));
  }

  private _onPromptInput(e: Event): void {
    const input = e.target as HTMLTextAreaElement;
    this._prompt = input.value;
  }

  private _onFilterChange(filter: DraftFilter): void {
    this._filter = filter;
  }

  render() {
    const filtered = this._filteredEntries;
    const hasProvider = !!resolveModalityVendorRoute('image');

    return html`
      <div class="drafts-shell" style="display:flex;flex-direction:column;height:100%;">
        <div class="drafts-header" style="padding:12px 16px;border-bottom:1px solid var(--widget-border,#2a2a2a);">
          <h2 style="margin:0 0 4px;font-size:14px;font-weight:600;">
            <i class="fa-solid fa-flask" aria-hidden="true"></i> Drafts
          </h2>
          <p style="margin:0;font-size:11px;color:var(--text-dim);">
            Generative sketchbook — experiment freely, promote results into production.
          </p>
        </div>

        <div class="drafts-generate" style="padding:12px;border-bottom:1px solid var(--widget-border,#2a2a2a);">
          <textarea
            class="cg-input w-full mb-2"
            rows="3"
            placeholder=${hasProvider
              ? 'Describe your visual experiment…'
              : 'Describe your idea — a text slate will be created (no image provider configured)'}
            .value=${this._prompt}
            @input=${this._onPromptInput}
            ?disabled=${this._loading}
          ></textarea>
          <label style="display:flex;align-items:center;gap:4px;font-size:10px;margin:0 0 6px;color:var(--text-dim);">
            <input type="checkbox" .checked=${this._injectStyleGuide}
              @change=${(e: Event) => { this._injectStyleGuide = (e.target as HTMLInputElement).checked; }} />
            Inject project style guide into prompt
          </label>
          <button
            class="toolbar-btn btn-ai w-full"
            ?disabled=${this._loading || !this._prompt.trim()}
            @click=${() => void this._generate()}
          >
            ${this._loading
              ? html`<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Generating…`
              : html`<i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i> Generate Draft`}
          </button>
          ${!hasProvider
            ? html`<p style="margin:6px 0 0;font-size:10px;color:var(--text-dim);text-align:center;">
                No image provider configured — drafts will be saved as text slates.
              </p>`
            : nothing}
        </div>

        <div class="drafts-filter" style="display:flex;gap:4px;padding:8px 12px;border-bottom:1px solid var(--widget-border,#2a2a2a);">
          ${(['all', 'unpromoted', 'promoted'] as DraftFilter[]).map((f) => html`
            <button
              type="button"
              class=${`toolbar-btn text-xs ${this._filter === f ? 'active' : ''}`}
              @click=${() => this._onFilterChange(f)}
            >${f === 'all' ? 'All' : f === 'unpromoted' ? 'Unpromoted' : 'Promoted'}</button>
          `)}
          <span style="margin-left:auto;font-size:10px;color:var(--text-dim);line-height:2em;">
            ${filtered.length} draft${filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div class="drafts-content" style="flex:1;overflow-y:auto;padding:12px;">
          ${filtered.length === 0
            ? html`
                <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:12px;color:var(--text-dim);">
                  <i class="fa-solid fa-flask" style="font-size:2em;opacity:0.3;" aria-hidden="true"></i>
                  <p style="margin:0;font-size:12px;text-align:center;">
                    ${this._filter === 'all'
                      ? 'No drafts yet. Use the prompt above to generate your first experiment.'
                      : `No ${this._filter} drafts.`}
                  </p>
                </div>
              `
            : html`
                <div style="display:grid;gap:12px;">
                  ${repeat(filtered, (d) => d.id, (draft) => this._renderDraftCard(draft))}
                </div>
              `}
        </div>
      </div>
    `;
  }

  private _renderDraftCard(draft: CineProjectDraft) {
    const isPromoted = !!draft.promotedTo;
    const promotionLabel = isPromoted
      ? `Promoted → ${draft.promotedTo!.type.charAt(0).toUpperCase() + draft.promotedTo!.type.slice(1)}`
      : null;

    return html`
      <div class="bevel-raised" style="border-left:3px solid ${isPromoted ? 'var(--success,#66bb6a)' : 'var(--accent,#4fc3f7)'};padding:10px;">
        ${draft.outputUrl
          ? html`<img
              src=${draft.outputUrl}
              alt=${draft.prompt.slice(0, 60)}
              style="width:100%;border-radius:4px;margin-bottom:8px;display:block;"
            />`
          : html`
              <div style="background:var(--bg-raised,#1a1a1a);border-radius:4px;padding:8px;margin-bottom:8px;font-size:10px;color:var(--text-dim);font-family:monospace;">
                <i class="fa-solid fa-file-lines" aria-hidden="true"></i> Text slate
              </div>
            `}

        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
          <p style="margin:0;font-size:11px;flex:1;color:var(--text-secondary,#ccc);">
            ${draft.prompt.slice(0, 100)}${draft.prompt.length > 100 ? '…' : ''}
          </p>
          <span style="font-size:10px;color:var(--text-dim);white-space:nowrap;">
            ${new Date(draft.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        ${draft.provider
          ? html`<span style="font-size:9px;color:var(--text-dim);margin-top:4px;display:block;">
              ${draft.provider}${draft.modelId ? ` / ${draft.modelId}` : ''}
            </span>`
          : nothing}

        ${promotionLabel
          ? html`<div style="margin-top:8px;font-size:10px;color:var(--success,#66bb6a);">
              <i class="fa-solid fa-circle-check" aria-hidden="true"></i> ${promotionLabel}
            </div>`
          : html`
              <div style="margin-top:8px;display:flex;gap:4px;flex-wrap:wrap;">
                ${draft.outputUrl
                  ? html`
                      <button
                        type="button"
                        class="toolbar-btn text-xs"
                        title="Use as Storyboard Frame"
                        @click=${() => void this._promoteToStoryboardFrame(draft)}
                      >
                        <i class="fa-solid fa-film" aria-hidden="true"></i> Frame
                      </button>
                      <button
                        type="button"
                        class="toolbar-btn text-xs"
                        title="Add to Mood Board"
                        @click=${() => this._promoteToMoodBoard(draft)}
                      >
                        <i class="fa-solid fa-images" aria-hidden="true"></i> Mood Board
                      </button>
                      <button
                        type="button"
                        class="toolbar-btn text-xs"
                        title="Use as Character Reference"
                        @click=${() => this._promoteToCharacterReference(draft)}
                      >
                        <i class="fa-solid fa-user" aria-hidden="true"></i> Reference
                      </button>
                      <button
                        type="button"
                        class="toolbar-btn text-xs"
                        title="Use as Location Plate"
                        @click=${() => this._promoteToLocationPlate(draft)}
                      >
                        <i class="fa-solid fa-location-dot" aria-hidden="true"></i> Plate
                      </button>
                    `
                  : nothing}
              </div>
            `}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'cinegen-drafts-panel': CinegenDraftsPanel;
  }
}
