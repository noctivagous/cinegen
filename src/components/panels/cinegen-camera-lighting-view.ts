import { html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';
import { colorState } from '@/color/color-state';
import { styleGuide } from '@/data/project-data';

@customElement('cinegen-camera-lighting-view')
export class CinegenCameraLightingView extends CgLightElement {
  @state() private _palette: string[] = [];
  @state() private _showPalette = true;

  private _unsub: (() => void) | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    this.id = 'view-camera-lighting';
    this.classList.add('hidden', 'flex', 'flex-col', 'h-full');
    this._palette = colorState.getPalette();
    this._unsub = colorState.subscribe((palette) => {
      this._palette = palette;
      this.requestUpdate();
    });
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._unsub?.();
  }

  private _onThumbSlider(e: Event): void {
    const val = parseFloat((e.target as HTMLInputElement).value);
    document.documentElement.style.setProperty('--cl-thumb-scale', String(val));
    window.CineGen?.savePreferences?.({ cameraThumbnailScale: val });
  }

  private _resetSlider(): void {
    const prefs = window.CineGen?.preferences;
    if (!prefs) return;
    document.documentElement.style.setProperty('--cl-thumb-scale', '1');
    window.CineGen?.savePreferences?.({ cameraThumbnailScale: 1 });
    const input = this.querySelector<HTMLInputElement>('.toolbar-range');
    if (input) input.value = '1';
  }

  private _onVisToggle(e: CustomEvent): void {
    const { part, checked } = e.detail;
    if (part === 'thumbnails') {
      window.CineGen?.savePreferences?.({ cameraChipsShowThumbnails: checked });
    } else if (part === 'descriptions') {
      window.CineGen?.savePreferences?.({ cameraChipsShowDescriptions: checked });
    }
    this.requestUpdate();
    (window as any).renderCameraLighting?.();
  }

  render() {
    const prefs = window.CineGen?.preferences;
    const savedScale = prefs?.cameraThumbnailScale ?? 1;
    const showThumbs = prefs?.cameraChipsShowThumbnails ?? true;
    const showDescs = prefs?.cameraChipsShowDescriptions ?? true;
    return html`
      <cg-panel-header>
        <span slot="title" class="workspace-panel-title"
          ><i class="fa-solid fa-camera"></i> CAMERA, LIGHTING &amp; ATMOSPHERE</span
        >
        <div slot="actions" class="flex gap-1">
          <cg-vis-toggle
            label="Thumbnails"
            title="Show/hide camera chip thumbnail images"
            ?checked=${showThumbs}
            @cg-change=${this._onVisToggle}
            data-storyboard-part="thumbnails"
          ></cg-vis-toggle>
          <cg-vis-toggle
            label="Descriptions"
            title="Show/hide camera chip description text"
            ?checked=${showDescs}
            @cg-change=${this._onVisToggle}
            data-storyboard-part="descriptions"
          ></cg-vis-toggle>
          <span class="script-editor-annotation-tools-sep" aria-hidden="true"></span>
          <label class="toolbar-slider-label" title="Thumbnail size  (double-click camera icon to reset)">
            <i class="fa-solid fa-camera" @dblclick=${this._resetSlider}></i>
            <input
              type="range"
              class="toolbar-range"
              min="0.5"
              max="1.5"
              step="0.1"
              .value="${savedScale}"
              @input=${this._onThumbSlider}
            />
          </label>
          <button
            class="toolbar-btn btn-ai"
            style="padding: 2px 8px; font-size: 10px;"
            data-ws-action="buildCameraPrompt"
          >
            <i class="fa-solid fa-wand-magic-sparkles"></i> Build Shot Prompt
          </button>
          <button
            class="toolbar-btn"
            style="padding: 2px 8px; font-size: 10px;"
            data-ws-action="clearCameraSelections"
          >
            <i class="fa-solid fa-xmark"></i> Clear
          </button>
        </div>
      </cg-panel-header>
      <div id="camera-lighting-prompt-bar" class="cl-prompt-bar hidden">
        <span class="cl-prompt-label"><i class="fa-solid fa-film"></i> Shot Config:</span>
        <span id="camera-lighting-prompt-text" class="cl-prompt-text"></span>
      </div>
      ${this._renderStyleGuideIndicator()}
      <div
        id="camera-lighting-content"
        class="flex-1 overflow-auto p-3"
        style="background: var(--bg-inset);"
      ></div>
      <details style="border-top:1px solid #333;padding:4px 8px;" ?open=${this._showPalette}>
        <summary style="cursor:pointer;font-size:12px;font-weight:600;color:#aaa;padding:4px 0;" @toggle=${() => { this._showPalette = !this._showPalette; }}>
          <i class="fa-solid fa-palette"></i> Color Palette
        </summary>
        <div style="padding:4px 0;">
          <cg-color-palette
            .palette=${this._palette}
            shownIn="panel"
            style="display:block;"
            @cg-palette-change=${(e: any) => {
              colorState.setPalette(e.detail.palette);
            }}
          ></cg-color-palette>
        </div>
      </details>
    `;
  }

  private _renderStyleGuideIndicator() {
    const hasLighting = !!styleGuide.lightingMood;
    const hasTone = !!styleGuide.visualTone;
    const hasLens = !!styleGuide.lensStyle;
    const hasPalette = styleGuide.colorPalette?.length > 0;

    if (!hasLighting && !hasTone && !hasLens && !hasPalette) {
      return nothing;
    }

    const chips: string[] = [];
    if (hasPalette) chips.push(`Palette: ${styleGuide.colorPalette.join(', ')}`);
    if (hasLighting) chips.push(`Lighting: ${styleGuide.lightingMood}`);
    if (hasTone) chips.push(`Tone: ${styleGuide.visualTone}`);
    if (hasLens) chips.push(`Lens: ${styleGuide.lensStyle}`);

    return html`
      <div
        class="flex items-center gap-2 px-3 py-1.5"
        style="background: var(--bg-surface); border-bottom: 1px solid #333; font-size: 11px;"
        title="Project style guide values that flow into shot prompts"
      >
        <span style="color: #888; white-space: nowrap;"><i class="fa-solid fa-book-open"></i> Style Guide</span>
        <span style="color: #4c6;">${chips.join(' · ')}</span>
      </div>
    `;
  }
}
