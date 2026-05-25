import { html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { whenBootReady } from '@/app/boot-coordinator';
import { CgLightElement } from '@/components/lit-base';
import type { CineGenPreferences } from '@/services/preferences';

const STORYBOARD_LAYOUT_OPTIONS = [
  { value: 'shots' as const, label: 'By Shot', icon: 'fa-solid fa-layer-group' },
  { value: 'sequence' as const, label: 'Sequence', icon: 'fa-solid fa-film' },
];

@customElement('cinegen-storyboard-pane')
export class CinegenStoryboardPane extends CgLightElement {
  @state() private _tab: 'storyboard' | 'player' = 'storyboard';
  @state() private _layout: CineGenPreferences['storyboardViewMode'] = 'shots';
  @state() private _thumbScale = 1;

  connectedCallback(): void {
    super.connectedCallback();
    this.id = 'preprod-story-pane';
    this.classList.add('split-pane');
    if (!this.style.width) this.style.width = '50%';
    whenBootReady('preferences', () => this._applyLayoutPrefs());
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
          <button class="toolbar-btn" data-ws-action="addStoryboardFrame">
            <i class="fa-solid fa-plus"></i> Add Frame
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
