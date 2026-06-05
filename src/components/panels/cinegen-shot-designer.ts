import { html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';
import { cameraLightingData, cameraLightingSelections, cameraLightingParams, selectCameraItem, setCameraItemParam, buildPromptPartsFromSelections, type CameraItemParam } from '@/camera/camera-lighting-bundle';
import { sfxSectionMeta, type SFXSection } from '@/camera/sfx-data';
import { sfxSelections, sfxParams, selectSFXItem, setSFXParam, getSFXPromptParts, loadSFXSelectionsFromJSON, sfxSelectionsToJSON } from '@/camera/sfx-store';
import { getSFXPreviewSrc } from '@/camera/sfx-previews';
import { previsSelectionState, currentSceneData, storyboardFrames, breakdownData } from '@/data/project-data';
import { updateInspector } from '@/components/panels/cinegen-inspector';
import { getShotById } from '@/workspace/shot-frame-bridge';
import type { SceneShot } from '@/workspace/scene-types';
import type { StoryboardFrame } from '@/storyboard/storyboard-types';
import { markProjectDirty } from '@/services/project-service';
import { CG_PREVIS_SELECTION_CHANGED } from '@/events/shell-events';

@customElement('cinegen-shot-designer')
export class CinegenShotDesigner extends CgLightElement {
  @property({ type: String }) clSection = '';

  @state() private _mode: 'details' | 'list' = 'list';
  @state() private _expandedSFX: string | null = null;
  @state() private _sceneTitle = '';

  private _frameData: StoryboardFrame | null = null;
  private _shot: SceneShot | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    if (!this.id) {
      this.id = 'view-shot-designer';
    }
    this.classList.add('hidden', 'flex', 'flex-col', 'h-full');

    window.addEventListener(CG_PREVIS_SELECTION_CHANGED, this._onSelectionChanged);
    this._syncFromPrevis();

    // If clSection targets an SFX category, expand it
    if (this.clSection === 'sfx-atmosphere' || this.clSection === 'sfx-weather' || this.clSection === 'sfx-particle') {
      this._expandedSFX = this.clSection;
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener(CG_PREVIS_SELECTION_CHANGED, this._onSelectionChanged);
  }

  willUpdate(changed: Map<string, unknown>): void {
    if (changed.has('clSection')) {
      if (this.clSection === 'sfx-atmosphere' || this.clSection === 'sfx-weather' || this.clSection === 'sfx-particle') {
        this._expandedSFX = this.clSection;
        this._mode = 'details';
      }
    }
  }

  private _onSelectionChanged = (): void => {
    this._syncFromPrevis();
    this.requestUpdate();
  };

  private _syncFromPrevis(): void {
    const sceneId = previsSelectionState.sceneId;
    const shotId = previsSelectionState.shotId;
    if (sceneId && shotId != null) {
      this._shot = getShotById(sceneId, shotId) || null;
      this._sceneTitle = sceneId;
      this._frameData = null;
    }
    if (sceneId) {
      const scene = currentSceneData[sceneId];
      this._sceneTitle = scene?.title || sceneId;
    }
  }

  /** Called from the modal when opening for a specific storyboard frame */
  openForFrame(frame: StoryboardFrame): void {
    this._frameData = frame;
    this._shot = null;
    this._mode = 'details';
    this._expandedSFX = null;

    // Restore SFX selections from the shot if available
    if (frame.shotId != null) {
      const sceneId = previsSelectionState.sceneId;
      if (sceneId) {
        const shot = getShotById(sceneId, frame.shotId);
        if (shot?.sfxSelections) {
          loadSFXSelectionsFromJSON(shot.sfxSelections as Record<string, unknown>);
        }
      }
    }

    this.requestUpdate();
  }

  private _toggleSFXCategory(category: string): void {
    this._expandedSFX = this._expandedSFX === category ? null : category;
    this.requestUpdate();
  }

  private _selectSFX(category: string, abbr: string): void {
    selectSFXItem(category, abbr);
    this._writeSFXToShot();
    this.requestUpdate();
  }

  private _onSFXParamChange(category: string, key: string, value: string): void {
    setSFXParam(category, key, value);
    this._writeSFXToShot();
    this.requestUpdate();
  }

  private _writeSFXToShot(): void {
    const sceneId = previsSelectionState.sceneId;
    const shotId = this._frameData?.shotId ?? previsSelectionState.shotId;
    if (!sceneId || shotId == null) return;
    const shot = getShotById(sceneId, shotId);
    if (!shot) return;
    shot.sfxSelections = sfxSelectionsToJSON() as SceneShot['sfxSelections'];
    markProjectDirty(['scenes']);
  }

  private _buildPrompt(): string {
    const dpParts = buildPromptPartsFromSelections(cameraLightingSelections as Record<string, string | null>);
    const sfxParts = getSFXPromptParts();
    const allParts = [...dpParts, ...sfxParts];
    return allParts.length ? allParts.join(', ') : 'No selections configured.';
  }

  private _renderSFXChips(sectionKey: string, section: SFXSection): unknown {
    const sel = sfxSelections[sectionKey];
    const isExpanded = this._expandedSFX === `sfx-${sectionKey}`;

    const chips = section.items.map(item => {
      const selected = sel?.abbr === item.abbr;
      const params = item.params || [];
      const hasParams = selected && params.length;
      const previewSrc = getSFXPreviewSrc(sectionKey, item.abbr);
      const hasThumb = previewSrc ? ' cl-chip--has-thumb' : '';

      return html`
        <div class="cl-chip${selected ? ' cl-chip--selected' : ''}${hasThumb}"
             @click=${() => this._selectSFX(sectionKey, item.abbr)}>
          ${previewSrc ? html`
            <img class="cl-chip-thumb" src=${previewSrc} alt="${item.name} preview" width="124" height="70" loading="lazy" />
          ` : nothing}
          <span class="cl-chip-abbr">${item.abbr}</span>
          <span class="cl-chip-name">${item.name}</span>
          <span class="cl-chip-desc">${item.desc}</span>
        </div>
        ${hasParams ? html`
          <div class="cl-params-bar">
            ${params.map((p: CameraItemParam) => {
              const val = sfxParams[sectionKey]?.[p.key] ?? p.defaultValue;
              if (p.type === 'select' && p.options) {
                return html`
                  <label class="cl-param cl-param--select">
                    <span class="cl-param-label">${p.label}</span>
                    <select class="cl-param-input bevel-sunken"
                            @change=${(e: Event) => this._onSFXParamChange(sectionKey, p.key, (e.target as HTMLSelectElement).value)}>
                      ${p.options.map(o => html`
                        <option value=${o.value} ?selected=${o.value === val}>${o.label}</option>
                      `)}
                    </select>
                  </label>
                `;
              }
              return nothing;
            })}
          </div>
        ` : nothing}
      `;
    });

    return html`
      <div class="cl-section" id="cl-section-sfx-${sectionKey}">
        <div class="cl-section-header" @click=${() => this._toggleSFXCategory(`sfx-${sectionKey}`)}>
          <i class="fa-solid ${section.icon}"></i>
          <span>${section.title}</span>
          <span class="cl-section-count">${section.items.length} options</span>
        </div>
        ${isExpanded ? html`
          <div class="cl-chips-grid" style="display:flex;flex-wrap:wrap;gap:6px;padding:6px 12px 10px">
            ${chips}
          </div>
        ` : nothing}
      </div>
    `;
  }

  private _renderDetailsMode(): unknown {
    const dpParts = buildPromptPartsFromSelections(cameraLightingSelections as Record<string, string | null>);
    const sfxPartsList = getSFXPromptParts();
    const previewUrl = this._frameData?.imageUrl || '';
    const frameLabel = this._frameData?.label || this._shot?.label || '';

    return html`
      <div class="p-3 flex flex-col gap-3 overflow-auto h-full">
        ${previewUrl ? html`
          <div class="shot-designer-preview">
            <img src=${previewUrl} alt="Frame preview" style="max-width:100%;border-radius:4px" />
          </div>
        ` : nothing}

        <div class="shot-designer-fields">
          <div class="property-row">
            <span class="text-[10px]">Label</span>
            <input class="inspector-input bevel-sunken flex-1 text-xs" .value=${frameLabel} @input=${this._onLabelChange} />
          </div>
        </div>

        <div class="shot-designer-section-header">
          <i class="fa-solid fa-camera"></i> Cinematography
        </div>
        <div class="shot-designer-readouts">
          ${dpParts.length ? dpParts.map(p => html`
            <span class="shot-designer-tag">${p}</span>
          `) : html`<span class="text-[var(--text-dim)] text-xs italic">Configure in Camera & Lighting Presets panel</span>`}
        </div>

        <div class="shot-designer-section-header">
          <i class="fa-solid fa-wand-magic-sparkles"></i> Special Effects
        </div>
        ${Object.entries(sfxSectionMeta).map(([key, section]) => this._renderSFXChips(key, section))}

        ${sfxPartsList.length ? html`
          <div class="shot-designer-section-header">
            <i class="fa-solid fa-quote-right"></i> Prompt Preview
          </div>
          <div class="shot-designer-prompt">
            <pre class="text-xs text-[var(--text-main)] bg-[var(--surface-sunken)] p-2 rounded">${this._buildPrompt()}</pre>
          </div>
        ` : nothing}
      </div>
    `;
  }

  private _renderShotListMode(): unknown {
    const sceneId = previsSelectionState.sceneId;
    const scene = sceneId ? currentSceneData[sceneId] : null;
    const shots = scene?.coverage || [];

    return html`
      <div class="shot-designer-toolbar p-2 flex items-center gap-2 border-b border-[var(--border-dim)]">
        <span class="text-xs font-semibold">${this._sceneTitle || 'Scene'}</span>
        <span class="text-[10px] text-[var(--text-dim)]">${shots.length} shots</span>
        <button class="btn-ai text-xs ml-auto" @click=${() => this._buildScenePrompt()}>
          Build Scene Prompt
        </button>
      </div>
      <div class="flex-1 overflow-auto p-2">
        ${shots.length ? shots.map((shot: SceneShot, i: number) => this._renderShotCard(shot, i)) : html`
          <div class="text-[var(--text-dim)] text-xs italic p-4 text-center">No shots in this scene yet.</div>
        `}
      </div>
    `;
  }

  private _renderShotCard(shot: SceneShot, index: number): unknown {
    const dpItems: string[] = [];
    if (shot.shotType) dpItems.push(shot.shotType);
    if (shot.cameraAngle) dpItems.push(shot.cameraAngle);
    if (shot.cameraMovement) dpItems.push(shot.cameraMovement);
    if (shot.lightingTechnique) dpItems.push(shot.lightingTechnique);

    const sfx = shot.sfxSelections;
    const sfxItems: string[] = [];
    if (sfx?.atmosphere) sfxItems.push(sfx.atmosphere.abbr);
    if (sfx?.weather) sfxItems.push(sfx.weather.abbr);
    if (sfx?.particleFx) sfxItems.push(sfx.particleFx.abbr);

    return html`
      <div class="shot-designer-shot-card">
        <div class="shot-designer-shot-header">
          <span class="shot-designer-shot-num">${shot.number || index + 1}</span>
          <span class="shot-designer-shot-label">${shot.label || `Shot ${index + 1}`}</span>
          <span class="shot-designer-shot-status text-[10px] text-[var(--text-dim)]">${shot.status || ''}</span>
        </div>
        <div class="shot-designer-shot-body">
          ${dpItems.length ? html`
            <div class="shot-designer-tag-row">
              ${dpItems.map(item => html`<span class="shot-designer-tag">${item}</span>`)}
            </div>
          ` : nothing}
          ${sfxItems.length ? html`
            <div class="shot-designer-tag-row">
              ${sfxItems.map(item => html`<span class="shot-designer-tag shot-designer-tag--sfx">${item}</span>`)}
            </div>
          ` : nothing}
        </div>
      </div>
    `;
  }

  private _onLabelChange(e: Event): void {
    const val = (e.target as HTMLInputElement).value;
    if (this._frameData) {
      this._frameData.label = val;
      const frame = storyboardFrames.find((f: StoryboardFrame) => f.id === this._frameData!.id);
      if (frame) frame.label = val;
      markProjectDirty(['storyboard']);
    }
  }

  private _buildScenePrompt(): void {
    const sceneId = previsSelectionState.sceneId;
    const scene = sceneId ? currentSceneData[sceneId] : null;
    const shots = scene?.coverage || [];
    const parts = shots.map((shot: SceneShot, i: number) => {
      const items: string[] = [];
      if (shot.shotType) {
        const item = cameraLightingData.shotTypes?.items.find((s: { abbr: string }) => s.abbr === shot.shotType);
        items.push(item?.name || shot.shotType);
      }
      if (shot.cameraAngle) items.push(shot.cameraAngle);
      if (shot.cameraMovement) items.push(shot.cameraMovement);
      if (shot.lightingTechnique) items.push(shot.lightingTechnique);
      const sfx = shot.sfxSelections;
      if (sfx?.atmosphere) items.push(sfx.atmosphere.abbr);
      if (sfx?.weather) items.push(sfx.weather.abbr);
      if (sfx?.particleFx) items.push(sfx.particleFx.abbr);
      return `Shot ${shot.number || i + 1}: ${items.join(', ')}`;
    });
    const prompt = parts.join('\n→ Cut to →\n');
    const textArea = document.createElement('textarea');
    textArea.value = prompt;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    alert(`Scene prompt copied to clipboard:\n\n${prompt}`);
  }

  render(): unknown {
    return html`
      <div class="flex flex-col h-full">
        <div class="shot-designer-tabs flex border-b border-[var(--border-dim)] bg-[var(--surface-raised)]">
          <button class="shot-designer-tab ${this._mode === 'list' ? 'active' : ''}"
                  @click=${() => { this._mode = 'list'; this.requestUpdate(); }}>
            <i class="fa-solid fa-list"></i> Shot List
          </button>
          <button class="shot-designer-tab ${this._mode === 'details' ? 'active' : ''}"
                  @click=${() => { this._mode = 'details'; this.requestUpdate(); }}>
            <i class="fa-solid fa-sliders"></i> Shot Details
          </button>
        </div>
        ${this._mode === 'list' ? this._renderShotListMode() : this._renderDetailsMode()}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'cinegen-shot-designer': CinegenShotDesigner;
  }
}
