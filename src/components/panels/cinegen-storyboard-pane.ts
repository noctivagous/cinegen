import { html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { whenBootReady } from '@/app/boot-coordinator';
import { CgLightElement } from '@/components/lit-base';
import type { CineGenPreferences } from '@/services/preferences';
import { CG_STORYBOARD_REFERENCES_CHANGED } from '@/events/shell-events';

const STORYBOARD_LAYOUT_OPTIONS = [
  { value: 'shots' as const, label: 'By Shot', icon: 'fa-solid fa-layer-group' },
  { value: 'sequence' as const, label: 'Sequence', icon: 'fa-solid fa-film' },
];

@customElement('cinegen-storyboard-pane')
export class CinegenStoryboardPane extends CgLightElement {
  @state() private _tab: 'storyboard' | 'player' = 'storyboard';
  @state() private _layout: CineGenPreferences['storyboardViewMode'] = 'shots';
  @state() private _thumbScale = 1;
  @state() private _showRefBank = false;

  connectedCallback(): void {
    super.connectedCallback();
    this.id = 'preprod-story-pane';
    this.setAttribute('data-cg-testid', 'storyboard-pane');
    this.classList.add('split-pane');
    if (!this.style.width) this.style.width = '50%';
    whenBootReady('preferences', () => this._applyLayoutPrefs());
    document.addEventListener(CG_STORYBOARD_REFERENCES_CHANGED, () => this.requestUpdate());
  }

  private _applyLayoutPrefs(): void {
    const prefs = window.CineGen?.preferences;
    if (!prefs) return;
    this._layout = prefs.storyboardViewMode ?? 'shots';
    this._thumbScale = prefs.storyboardThumbnailScale ?? 1;
  }

  private _persistLayoutPrefs(): void {
    window.CineGen?.savePreferences?.({
      storyboardViewMode: this._layout,
      storyboardThumbnailScale: this._thumbScale,
    });
  }

  private _setLayout(mode: CineGenPreferences['storyboardViewMode']): void {
    if (this._layout === mode) return;
    this._layout = mode;
    this._persistLayoutPrefs();
  }

  private _onThumbScaleInput(e: Event): void {
    const val = parseFloat((e.target as HTMLInputElement).value);
    if (!Number.isFinite(val)) return;
    this._thumbScale = val;
    this._persistLayoutPrefs();
  }

  private _renderRefBank() {
    const bank = (window as any).storyboardReferenceBank as Record<string, Array<Record<string, unknown>>> | undefined;
    if (!bank) return nothing;
    const categories = ['characters', 'locations', 'interiors', 'exteriors'] as const;
    const labels: Record<string, string> = { characters: 'Characters', locations: 'Locations', interiors: 'Interiors', exteriors: 'Exteriors' };
    return html`
      <div style="padding:4px 8px;border-bottom:1px solid #1a1a1a;background:#252525;">
        <div class="flex flex-wrap gap-3">
          ${categories.map((cat) => {
            const slots = Array.isArray(bank[cat]) ? bank[cat] : [];
            const enabled = slots.filter((s) => s.enabled !== false);
            return html`
              <div style="min-width:140px;">
                <div class="text-[10px] font-bold text-[var(--text-dim)] mb-1">
                  ${labels[cat]} (${enabled.length}/${slots.length})
                </div>
                ${slots.length
                  ? html`<div class="space-y-1">
                      ${slots.map((slot) => {
                        const id = String(slot.id ?? '');
                        const label = String(slot.label ?? '');
                        const imageUrl = String(slot.imageUrl ?? '');
                        const isEnabled = slot.enabled !== false;
                        return html`
                          <div class="flex items-center gap-1 text-[10px]">
                            <button
                              type="button"
                              class="${isEnabled ? 'text-emerald-400' : 'text-gray-500'}"
                              style="background:none;border:none;cursor:pointer;padding:0;font-size:10px;"
                              title=${isEnabled ? 'Disable reference' : 'Enable reference'}
                              @click=${() => {
                                (window as any).enableReferenceSlot?.(id, !isEnabled);
                                this.requestUpdate();
                              }}
                            >
                              <i class="fa-solid ${isEnabled ? 'fa-toggle-on' : 'fa-toggle-off'}"></i>
                            </button>
                            ${imageUrl
                              ? html`<img src=${imageUrl} alt="" style="width:20px;height:20px;object-fit:cover;border-radius:2px;" />`
                              : nothing}
                            <span class="text-[var(--text-dim)] truncate" style="max-width:100px;" title=${label}>${label}</span>
                          </div>
                        `;
                      })}
                    </div>`
                  : html`<span class="text-[10px] text-gray-600">Empty</span>`}
              </div>
            `;
          })}
        </div>
      </div>
    `;
  }

  render() {
    return html`
      <div
        class="bevel-sunken flex items-center justify-between gap-2"
        style="padding: 4px 8px; background: #2a2a2a; border-bottom: 1px solid #1a1a1a;"
      >
        <div class="storyboard-pane-tabs tab-strip-classic" role="tablist">
          <button
            type="button"
            class="tab-btn-classic ${this._tab === 'storyboard' ? 'active' : ''}"
            role="tab"
            aria-selected=${this._tab === 'storyboard' ? 'true' : 'false'}
            @click=${() => {
        this._tab = 'storyboard';
      }}
          >
            Storyboard Frames
          </button>
          <button
            type="button"
            class="tab-btn-classic ${this._tab === 'player' ? 'active' : ''}"
            role="tab"
            aria-selected=${this._tab === 'player' ? 'true' : 'false'}
            @click=${() => {
        this._tab = 'player';
      }}
          >
            Storyboard Video Player
          </button>
        </div>
        <div class="flex items-center gap-2 storyboard-toolbar-actions">
          <label class="flex items-center gap-1 text-[10px]" style="white-space:nowrap;">
            Mode
            <input type="radio" name="storyboard-generation-mode" value="review" checked />
            Review
            <input type="radio" name="storyboard-generation-mode" value="auto" />
            Auto
          </label>
          <label class="flex items-center gap-1 text-[10px]" style="cursor:pointer; white-space:nowrap;">
            <input type="checkbox" id="autogen-boards-cb" /> autogenerate images
          </label>
          <span class="storyboard-toolbar-sep" aria-hidden="true"></span>
          <button class="toolbar-btn btn-ai" data-ws-action="generateStoryboardReferences">
            <i class="fa-solid fa-id-card"></i> References
          </button>
          <button
            type="button"
            class="toolbar-btn ${this._showRefBank ? 'active' : ''}"
            @click=${() => { this._showRefBank = !this._showRefBank; }}
            title="Toggle reference bank"
          >
            <i class="fa-solid fa-layer-group"></i> Ref Bank
          </button>
          <button class="toolbar-btn btn-ai" data-ws-action="draftShotStoryboards"
                  title="Generate 1 frame per shot with cinematography set">
            <i class="fa-solid fa-images"></i> Draft Shot Storyboards
          </button>
          <button class="toolbar-btn" data-ws-action="addStoryboardFrame">
            <i class="fa-solid fa-plus"></i> Add Frame
          </button>
          <button class="toolbar-btn" data-ws-action="addStoryboardSlate" title="Text slate without AI">
            <i class="fa-solid fa-clapperboard"></i> Slate
          </button>
          <button class="toolbar-btn" data-ws-action="uploadStoryboardImage" title="Upload image to selected frame">
            <i class="fa-solid fa-image"></i> Upload
          </button>
          <button class="toolbar-btn" data-ws-action="duplicateSelectedFrame">
            <i class="fa-regular fa-copy"></i> Duplicate
          </button>
          <button class="toolbar-btn" data-ws-action="moveSelectedFrameUp" title="Move frame up">
            <i class="fa-solid fa-arrow-up"></i>
          </button>
          <button class="toolbar-btn" data-ws-action="moveSelectedFrameDown" title="Move frame down">
            <i class="fa-solid fa-arrow-down"></i>
          </button>
          <button class="toolbar-btn" data-ws-action="linkSelectedFrameToScript">
            <i class="fa-solid fa-link"></i> Link to Cursor
          </button>
          <button class="toolbar-btn" data-ws-action="deleteSelectedFrame">
            <i class="fa-solid fa-trash"></i> Delete
          </button>
          <button class="toolbar-btn" data-ws-action="restoreLastDeletedFrame">
            <i class="fa-solid fa-trash-arrow-up"></i> Restore Last
          </button>
          <span
            id="storyboard-reference-gate-status-inline"
            class="text-[10px]"
            style="padding:1px 5px;border:1px solid var(--border-dark);border-radius:4px;color:var(--text-dim)"
          >References required</span>
        </div>
      </div>
      ${this._showRefBank ? this._renderRefBank() : nothing}
      <div
        ?hidden=${this._tab !== 'storyboard'}
        class="tab-page-classic storyboard-pane-view"
        role="tabpanel"
      >
        <div class="storyboard-view-bar sidebar-view-bar">
          <div class="sidebar-view-group" role="group" aria-label="Storyboard layout">
            ${STORYBOARD_LAYOUT_OPTIONS.map(
        (opt) => html`
                <button
                  type="button"
                  class="sidebar-view-btn ${this._layout === opt.value ? 'active' : ''}"
                  data-view=${opt.value}
                  title=${opt.label}
                  @click=${() => this._setLayout(opt.value)}
                >
                  <i class="${opt.icon}" aria-hidden="true"></i>
                  <span>${opt.label}</span>
                </button>
              `
      )}
          </div>
          <label class="storyboard-thumb-size-control">
            <span class="storyboard-thumb-size-label">Thumbnail size</span>
            <i class="fa-solid fa-image" aria-hidden="true" style="font-size:9px;opacity:0.55;"></i>
            <input
              class="storyboard-thumb-size-slider"
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              .value=${String(this._thumbScale)}
              aria-valuemin="0.5"
              aria-valuemax="2"
              aria-valuenow=${String(this._thumbScale)}
              @input=${this._onThumbScaleInput}
            />
          </label>
        </div>
        <cinegen-storyboard
          view-mode=${this._layout}
          thumbnail-scale=${String(this._thumbScale)}
        ></cinegen-storyboard>
      </div>
      <div
        ?hidden=${this._tab !== 'player'}
        class="tab-page-classic storyboard-pane-view storyboard-pane-view--player"
        role="tabpanel"
      >
        <cinegen-storyboard-animatic-player></cinegen-storyboard-animatic-player>
      </div>
    `;
  }
}
