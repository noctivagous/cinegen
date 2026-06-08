/**
 * @AI-GUI — TARGET FOR REPLACEMENT
 *
 * Conventions for AI GUI replacement:
 * - Lit 3 + TS decorators (experimentalDecorators: true, useDefineForClassFields: false)
 * - Extend CgLightElement (Light DOM only — NO shadowRoot)
 * - Global CSS classes only (cg-panel-header, cg-btn, flex, grid, gap-*, etc.)
 * - CSS vars: --accent-blue, --text-dim, --bg-panel, --border-light
 * - Font Awesome 6 via <i class="fa-solid fa-*"></i>
 * - @/ path alias maps to src/
 * - Event constants from events/shell-events.ts — NO raw custom-event strings
 * - Keep @customElement('cinegen-shot-designer') tag unchanged
 * - Replace ENTIRE file content; export the class
 */

import { html, nothing, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';
import '@/components/primitives/cg-codemirror-field';
import '@/components/primitives/cg-panel-header';
import {
  cameraLightingData,
  cameraLightingSelections,
  cameraLightingParams,
  selectCameraItem,
  setCameraItemParam,
  buildPromptPartsFromSelections,
  buildPromptPartsFromShot,
  syncCameraSelectionsFromActiveShot,
  type CameraItemParam,
} from '@/camera/camera-lighting-bundle';
import { getCameraLightingPreviewSrc } from '@/camera/camera-lighting-previews';
import { sfxSectionMeta, type SFXSection } from '@/camera/sfx-data';
import {
  sfxSelections,
  sfxParams,
  selectSFXItem,
  setSFXParam,
  loadSFXSelectionsFromJSON,
  sfxSelectionsToJSON,
} from '@/camera/sfx-store';
import { getSFXPreviewSrc } from '@/camera/sfx-previews';
import {
  previsSelectionState,
  setPrevisSelectionState,
  currentSceneData,
  storyboardFrames,
  breakdownData,
  assetLibrary,
  projectScreenplay,
  activeProjectId,
} from '@/data/project-data';
import {
  getShotById,
  resolveActiveSceneId,
  nextShotNumber,
  sceneIdFromStoryboardFrame,
  buildShotListRows,
  formatShotDisplayLabel,
} from '@/workspace/shot-frame-bridge';
import {
  generateStoryboardForFrame,
  generateVideoForShot,
} from '@/storyboard/storyboard-generation-service';
import {
  getStoryboardFrameForShot,
  getLatestVideoOutputForShot,
} from '@/cinematography/shot-output-resolver';
import {
  STORYBOARD_PREVIEW_STYLE_OPTIONS,
  resolvePreviewStyle,
  type StoryboardPreviewStyle,
} from '@/storyboard/storyboard-preview-styles';
import type { SceneShot } from '@/workspace/scene-types';
import type { StoryboardFrame } from '@/storyboard/storyboard-types';
import { markProjectDirty } from '@/services/project-service';
import {
  CG_PREVIS_SELECTION_CHANGED,
  CG_WORKSPACE_VIEW_CHANGE,
  CG_STORYBOARD_FRAMES_CHANGED,
} from '@/events/shell-events';
import { alertCG } from '@/utils/alert-cg';
import {
  buildShotPromptStack,
  serializePromptStackText,
  type PromptStackItem,
} from '@/cinematography/shot-prompt-stack';
import {
  convertScriptLinesForPrompt,
  scriptTextForModelPrompt,
} from '@/script/script-prompt-sanitize';

type AssetRecord = { id?: string; name?: string };
type DesignerMode = 'list' | 'compose' | 'stack' | 'generate';

@customElement('cinegen-shot-designer')
export class CinegenShotDesigner extends CgLightElement {
  @property({ type: String }) clSection = '';

  @state() private _mode: DesignerMode = 'list';
  @state() private _expandedSFX: string | null = null;
  @state() private _expandedCameraSection: string | null = 'shotTypes';
  @state() private _sceneTitle = '';
  @state() private _activeSceneId: string | null = null;
  @state() private _selectedChars: string[] = [];
  @state() private _wardrobeLabels: string[] = [];
  @state() private _scriptLines: string[] = [];
  @state() private _scriptPromptText = '';
  @state() private _agentScriptRefining = false;
  @state() private _stackItems: PromptStackItem[] = [];
  @state() private _previewStyle: StoryboardPreviewStyle = 'illustrative';
  @state() private _generatingStoryboard = false;
  @state() private _generatingVideo = false;
  @state() private _videoUrl: string | undefined;

  private _frameData: StoryboardFrame | null = null;
  private _shot: SceneShot | null = null;

  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1 1 0;
      height: 100%;
      min-height: 0;
      overflow: hidden;
      user-select: text;
    }
    .sd-shell {
      display: flex;
      flex-direction: column;
      flex: 1 1 0;
      min-height: 0;
      overflow: hidden;
    }
    .sd-toolbar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 8px;
      flex-wrap: wrap;
      flex-shrink: 0;
      border-bottom: 1px solid var(--border-dim);
    }
    .sd-toolbar cg-segmented {
      flex: 1;
      min-width: 0;
    }
    .sd-body {
      flex: 1 1 0;
      min-height: 0;
      overflow-x: hidden;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
    }
    .sd-pane {
      padding: 10px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .sd-shot-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
    }
    .sd-shot-table th {
      background: #333;
      color: var(--text-highlight);
      font-weight: 600;
      padding: 5px 8px;
      text-align: left;
      border: 1px solid #1a1a1a;
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .sd-shot-table td {
      border: 1px solid #1a1a1a;
      padding: 5px 8px;
      vertical-align: top;
    }
    .sd-scene-row td {
      background: color-mix(in srgb, var(--bg-panel) 85%, transparent);
      font-weight: 600;
      color: var(--text-highlight);
      font-size: 11px;
    }
    .sd-shot-row:hover {
      background: color-mix(in srgb, var(--accent-blue) 8%, transparent);
    }
    .sd-shot-row.is-selected {
      background: color-mix(in srgb, var(--accent-blue) 15%, transparent);
    }
    .sd-shot-num {
      font-size: 10px;
      font-weight: 700;
      color: var(--accent-blue);
      white-space: nowrap;
    }
    .sd-shot-label {
      font-size: 11px;
      font-weight: 600;
    }
    .sd-shot-frames-cell {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .sd-frame-thumb {
      width: 48px;
      height: 27px;
      object-fit: cover;
      border-radius: 2px;
      border: 1px solid var(--border-dim);
      background: var(--surface-sunken);
      cursor: pointer;
    }
    .sd-frame-thumb:hover {
      border-color: var(--accent-blue);
    }
    .sd-frame-thumb-placeholder {
      width: 48px;
      height: 27px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 2px;
      border: 1px solid var(--border-dim);
      background: var(--surface-sunken);
      color: var(--text-dim);
      font-size: 10px;
    }
    .sd-shot-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 3px;
    }
    .sd-tag {
      font-size: 9px;
      padding: 1px 5px;
      border-radius: 2px;
      background: var(--surface-sunken);
      color: var(--text-dim);
    }
    .sd-tag {
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 3px;
      background: var(--surface-sunken);
    }
    .sd-output-placeholder i {
      font-size: 36px;
      opacity: 0.35;
    }
    .sd-stack-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 8px;
      font-size: 10px;
      color: var(--text-dim);
    }
    .sd-compose-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    @media (max-width: 900px) {
      .sd-compose-grid {
        grid-template-columns: 1fr;
      }
    }
    .prompt-stack {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 8px;
    }
    .prompt-stack-card {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 6px;
      padding: 10px 12px;
      border: 1px solid var(--border-dim);
      border-radius: 4px;
      background: var(--surface-raised);
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
    }
    .prompt-stack-card--image {
      grid-template-columns: 96px minmax(0, 1fr);
      align-items: start;
    }
    .prompt-stack-thumb {
      width: 96px;
      height: 54px;
      object-fit: cover;
      border-radius: 3px;
      border: 1px solid var(--border-dim);
      background: var(--surface-sunken);
    }
    .prompt-stack-thumb-placeholder {
      width: 96px;
      height: 54px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 3px;
      border: 1px solid var(--border-dim);
      background: var(--surface-sunken);
      color: var(--text-dim);
      font-size: 18px;
    }
    .prompt-stack-meta {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }
    .prompt-stack-category {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--accent-blue);
    }
    .prompt-stack-label {
      font-size: 11px;
      font-weight: 600;
      color: var(--text-main);
    }
    .prompt-stack-source {
      font-size: 9px;
      color: var(--text-dim);
      font-family: monospace;
    }
    .prompt-stack-params {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .prompt-stack-param {
      font-size: 9px;
      padding: 2px 5px;
      border-radius: 3px;
      background: var(--surface-sunken);
      color: var(--text-dim);
    }
    .prompt-stack-param strong {
      color: var(--text-main);
      font-weight: 600;
    }
    .prompt-stack-empty {
      text-align: center;
      padding: 24px;
      color: var(--text-dim);
      font-size: 11px;
      font-style: italic;
    }
    .sd-generate-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    @media (max-width: 800px) {
      .sd-generate-grid {
        grid-template-columns: 1fr;
      }
    }
    .sd-output-slot {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-height: 0;
    }
    .sd-output-frame {
      flex: 1;
      min-height: 220px;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      border-radius: 4px;
      background: var(--surface-sunken);
    }
    .sd-output-frame img,
    .sd-output-frame video {
      max-width: 100%;
      max-height: 280px;
      border-radius: 4px;
    }
    .sd-output-placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      color: var(--text-dim);
      font-size: 11px;
      padding: 24px;
      text-align: center;
    }
    .sd-output-placeholder i {
      font-size: 36px;
      opacity: 0.35;
    }
  `;

  private get _isModal(): boolean {
    return this.id === 'shot-designer-modal';
  }

  connectedCallback(): void {
    super.connectedCallback();
    if (!this.id) this.id = 'view-shot-designer';
    this.classList.add('flex', 'flex-col', 'flex-1', 'min-h-0', 'h-full', 'overflow-hidden');
    if (!this._isModal) this.classList.add('hidden');
    window.addEventListener(CG_PREVIS_SELECTION_CHANGED, this._onSelectionChanged);
    window.addEventListener(CG_WORKSPACE_VIEW_CHANGE, this._onWorkspaceChange);
    window.addEventListener(CG_STORYBOARD_FRAMES_CHANGED, this._onFramesChanged);
    this._syncFromPrevis();
    if (this.clSection === 'sfx-atmosphere' || this.clSection === 'sfx-weather' || this.clSection === 'sfx-particle') {
      this._expandedSFX = this.clSection;
      this._mode = 'compose';
    }
  }

  disconnectedCallback(): void {
    window.removeEventListener(CG_PREVIS_SELECTION_CHANGED, this._onSelectionChanged);
    window.removeEventListener(CG_WORKSPACE_VIEW_CHANGE, this._onWorkspaceChange);
    window.removeEventListener(CG_STORYBOARD_FRAMES_CHANGED, this._onFramesChanged);
    super.disconnectedCallback();
  }

  private _onFramesChanged = (): void => {
    this._syncOutputUrls();
    this.requestUpdate();
  };

  willUpdate(changed: Map<string, unknown>): void {
    if (changed.has('clSection')) {
      if (this.clSection === 'sfx-atmosphere' || this.clSection === 'sfx-weather' || this.clSection === 'sfx-particle') {
        this._expandedSFX = this.clSection;
        this._mode = 'compose';
      }
    }
    if (
      changed.has('_scriptLines') ||
      changed.has('_shot') ||
      changed.has('_selectedChars') ||
      changed.has('_mode')
    ) {
      this._refreshDerivedState();
    }
  }

  refresh(): void {
    this._syncFromPrevis();
    this.requestUpdate();
  }

  private _onSelectionChanged = (): void => {
    this._syncFromPrevis();
    this.requestUpdate();
  };

  private _onWorkspaceChange = (e: Event): void => {
    if ((e as CustomEvent).detail?.view === 'shot-designer') {
      this._syncFromPrevis();
      this.requestUpdate();
    }
  };

  private _resolveSceneId(): string | null {
    return this._activeSceneId ?? resolveActiveSceneId();
  }

  private _syncFromPrevis(): void {
    const sceneId = resolveActiveSceneId();
    this._activeSceneId = sceneId;
    const shotId = previsSelectionState.shotId;

    if (sceneId && shotId != null) {
      this._shot = getShotById(sceneId, shotId) || null;
      this._frameData = null;
    } else if (!this._frameData) {
      this._shot = null;
    }

    if (sceneId) {
      const scene = currentSceneData[sceneId];
      this._sceneTitle = scene?.title || sceneId;
      this._loadSceneContext(sceneId);
      this._loadScriptLines(sceneId, shotId);
    } else {
      this._sceneTitle = '';
      this._selectedChars = [];
      this._wardrobeLabels = [];
      this._scriptLines = [];
    }
    this._syncOutputUrls();
    this._refreshDerivedState();
  }

  private _syncOutputUrls(): void {
    const sceneId = this._resolveSceneId();
    const shotId = this._shot?.id ?? this._frameData?.shotId;
    if (sceneId && shotId != null) {
      this._videoUrl = getLatestVideoOutputForShot(sceneId, shotId);
    } else {
      this._videoUrl = undefined;
    }
  }

  private _activeFrame(): StoryboardFrame | null {
    if (this._frameData) {
      return (storyboardFrames as StoryboardFrame[]).find((f) => f.id === this._frameData!.id) ?? this._frameData;
    }
    const sceneId = this._resolveSceneId();
    const shotId = this._shot?.id ?? previsSelectionState.shotId;
    if (!sceneId || shotId == null) return null;
    return getStoryboardFrameForShot(sceneId, shotId, previsSelectionState.frameId);
  }

  private _refreshDerivedState(): void {
    const conversion = convertScriptLinesForPrompt(this._scriptLines);
    this._scriptPromptText = conversion.promptText;
    const sceneId = this._resolveSceneId();
    const scene = sceneId ? currentSceneData[sceneId] : null;
    this._stackItems = scene && sceneId
      ? buildShotPromptStack({
          sceneId,
          scene,
          shot: this._shot,
          frame: this._frameData,
          scriptLines: this._scriptLines,
          characterLabels: this._selectedChars,
          wardrobeLabels: this._wardrobeLabels,
          locationLabel: this._getSceneLocation(),
        })
      : [];
  }

  private _resolveAssetNames(ids: string[] | undefined, category: keyof typeof assetLibrary): string[] {
    if (!ids?.length) return [];
    const lib = (assetLibrary[category] as AssetRecord[]) || [];
    return ids.map((id) => lib.find((a) => a.id === id)?.name || id);
  }

  private _loadSceneContext(sceneId: string): void {
    const scene = currentSceneData[sceneId];
    if (!scene) {
      this._selectedChars = [];
      this._wardrobeLabels = [];
      return;
    }
    const charIds = scene.characterIds as string[] | undefined;
    if (charIds?.length) {
      this._selectedChars = this._resolveAssetNames(charIds, 'characters');
    } else {
      const breakdown = breakdownData.find(
        (row: { scene?: string; characters?: string }) =>
          row.scene === sceneId || row.scene === sceneId.replace('scene', '')
      );
      this._selectedChars = breakdown?.characters
        ? typeof breakdown.characters === 'string'
          ? breakdown.characters.split(',').map((c: string) => c.trim())
          : []
        : [];
    }
    this._wardrobeLabels = this._resolveAssetNames(scene.wardrobeIds as string[] | undefined, 'wardrobe');
  }

  private _loadScriptLines(sceneId: string, shotId: number | null): void {
    const scriptText = projectScreenplay?.text || '';
    if (!scriptText) {
      this._scriptLines = [];
      return;
    }
    const frame = this._frameData;
    const shot = this._shot;
    const range = frame?.scriptRange || shot?.scriptRange;
    if (range) {
      this._scriptLines = scriptText.split('\n').slice(range.start, range.end).filter((l) => l.trim());
      return;
    }
    const scene = currentSceneData[sceneId];
    const heading = scene?.title || sceneId;
    const allLines = scriptText.split('\n');
    const headingIdx = allLines.findIndex((l) => l.includes(heading) || l.includes(sceneId.toUpperCase()));
    if (headingIdx >= 0) {
      this._scriptLines = allLines.slice(headingIdx, headingIdx + 30).filter((l) => l.trim()).slice(0, 20);
    } else {
      this._scriptLines = [];
    }
  }

  openForFrame(frame: StoryboardFrame): void {
    const sceneId = sceneIdFromStoryboardFrame(frame);
    const live = (storyboardFrames as StoryboardFrame[]).find((f) => f.id === frame.id) ?? frame;
    this._frameData = live;
    this._activeSceneId = sceneId;
    this._mode = this._isModal ? 'generate' : 'compose';
    this._expandedSFX = null;

    setPrevisSelectionState({ sceneId, shotId: frame.shotId ?? null, frameId: frame.id });

    if (frame.shotId != null) {
      const shot = getShotById(sceneId, frame.shotId);
      if (shot) {
        this._shot = shot;
        if (shot.sfxSelections) loadSFXSelectionsFromJSON(shot.sfxSelections as Record<string, unknown>);
        syncCameraSelectionsFromActiveShot();
        this._previewStyle = resolvePreviewStyle(live.previewStyle, shot.storyboardPreviewStyle);
      }
    } else {
      this._shot = null;
      this._previewStyle = resolvePreviewStyle(live.previewStyle);
    }

    this._loadSceneContext(sceneId);
    this._loadScriptLines(sceneId, frame.shotId ?? null);
    this._syncOutputUrls();
    this._refreshDerivedState();
    this.requestUpdate();
  }

  private _selectShot(shot: SceneShot): void {
    const sceneId = this._resolveSceneId();
    if (!sceneId) return;
    setPrevisSelectionState({ sceneId, shotId: shot.id, frameId: null });
    this._shot = shot;
    this._frameData = null;
    syncCameraSelectionsFromActiveShot();
    if (shot.sfxSelections) loadSFXSelectionsFromJSON(shot.sfxSelections as Record<string, unknown>);
    this._loadScriptLines(sceneId, shot.id);
    this._mode = 'compose';
    this.requestUpdate();
  }

  private _setMode(mode: DesignerMode): void {
    this._mode = mode;
    if (mode === 'compose' && this._shot) syncCameraSelectionsFromActiveShot();
    if (mode === 'stack' || mode === 'generate') this._refreshDerivedState();
    if (mode === 'generate') this._syncOutputUrls();
    this.requestUpdate();
  }

  private _onPreviewStyleChange(e: Event): void {
    const value = (e.target as HTMLSelectElement).value as StoryboardPreviewStyle;
    this._previewStyle = value;
    const frame = this._activeFrame();
    if (frame) frame.previewStyle = value;
    const sceneId = this._resolveSceneId();
    const shotId = this._shot?.id ?? frame?.shotId;
    if (sceneId && shotId != null) {
      const shot = getShotById(sceneId, shotId);
      if (shot) {
        shot.storyboardPreviewStyle = value;
        markProjectDirty(['scenes']);
      }
    }
    markProjectDirty(['storyboard']);
    this.requestUpdate();
  }

  private async _generateStoryboard(): Promise<void> {
    const sceneId = this._resolveSceneId();
    const frame = this._activeFrame();
    if (!sceneId || !frame) return;
    frame.previewStyle = this._previewStyle;
    this._generatingStoryboard = true;
    this.requestUpdate();
    try {
      await generateStoryboardForFrame(frame, sceneId);
      this._frameData = (storyboardFrames as StoryboardFrame[]).find((f) => f.id === frame.id) ?? frame;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alertCG(msg);
    } finally {
      this._generatingStoryboard = false;
      this._syncOutputUrls();
      this.requestUpdate();
    }
  }

  private async _generateVideo(): Promise<void> {
    const sceneId = this._resolveSceneId();
    const shotId = this._shot?.id ?? this._frameData?.shotId;
    if (!sceneId || shotId == null) return;
    this._generatingVideo = true;
    this.requestUpdate();
    try {
      const prompt = this._assembledPrompt();
      const url = await generateVideoForShot(sceneId, shotId, prompt);
      this._videoUrl = url;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alertCG(msg);
    } finally {
      this._generatingVideo = false;
      this.requestUpdate();
    }
  }

  private async _refineScriptWithAgent(): Promise<void> {
    if (!this._scriptLines.length) return;
    this._agentScriptRefining = true;
    this.requestUpdate();
    try {
      const refined = await scriptTextForModelPrompt(this._scriptLines, {
        useAgent: true,
        projectId: activeProjectId || undefined,
        shotId: this._shot?.id,
      });
      this._scriptPromptText = refined;
    } finally {
      this._agentScriptRefining = false;
      this._refreshDerivedState();
      this.requestUpdate();
    }
  }

  private _addShotFromPresets(): void {
    const sceneId = this._resolveSceneId();
    if (!sceneId) return;
    const scene = currentSceneData[sceneId];
    if (!scene) return;
    scene.coverage ??= [];
    const shotId = Date.now();
    const shot: SceneShot = {
      id: shotId,
      number: nextShotNumber(sceneId),
      type: 'Coverage',
      previsRole: 'coverage',
      label: this._buildPresetLabel(),
      duration: '8s',
      durationSeconds: 8,
      shotType: cameraLightingSelections.shotTypes ?? undefined,
      cameraAngle: cameraLightingSelections.angles ?? undefined,
      cameraMovement: cameraLightingSelections.movements ?? undefined,
      lightingTechnique: cameraLightingSelections.lighting ?? undefined,
      composition: cameraLightingSelections.composition ?? undefined,
      cinematographyParams: Object.keys(cameraLightingParams).length
        ? structuredClone(cameraLightingParams)
        : undefined,
      status: 'planned',
    };
    scene.coverage.push(shot);
    markProjectDirty(['scenes']);
    this._selectShot(shot);
  }

  private _buildPresetLabel(): string {
    const parts = buildPromptPartsFromSelections(cameraLightingSelections as Record<string, string | null>);
    return parts.length ? parts.slice(0, 2).join(' · ') : `Shot ${nextShotNumber(this._resolveSceneId()!)}`;
  }

  private _getSceneLocation(): string {
    const sceneId = this._resolveSceneId();
    if (!sceneId) return '';
    const scene = currentSceneData[sceneId];
    const title = scene?.title || '';
    const match = title.match(/\.\s*(.+?)\s*[-–]/);
    return match ? match[1].trim() : title;
  }

  private _assembledPrompt(): string {
    const parts: string[] = [];
    const label = this._frameData?.label || this._shot?.label || '';
    if (label) parts.push(`Shot: ${label}`);
    const location = this._getSceneLocation();
    if (location) parts.push(`Location: ${location}`);
    if (this._selectedChars.length) parts.push(`Characters: ${this._selectedChars.join(', ')}`);
    if (this._wardrobeLabels.length) parts.push(`Wardrobe: ${this._wardrobeLabels.join(', ')}`);
    const dpParts = this._shot
      ? buildPromptPartsFromShot(this._shot)
      : buildPromptPartsFromSelections(cameraLightingSelections as Record<string, string | null>);
    if (dpParts.length) parts.push(...dpParts);
    if (this._scriptPromptText) parts.push(`Action/Dialogue: ${this._scriptPromptText}`);
    return parts.length ? parts.join('\n') : 'No selections configured.';
  }

  private _writeSFXToShot(): void {
    const sceneId = this._resolveSceneId();
    const shotId = this._frameData?.shotId ?? previsSelectionState.shotId ?? this._shot?.id;
    if (!sceneId || shotId == null) return;
    const shot = getShotById(sceneId, shotId);
    if (!shot) return;
    shot.sfxSelections = sfxSelectionsToJSON() as SceneShot['sfxSelections'];
    markProjectDirty(['scenes']);
    this._refreshDerivedState();
  }

  private _onLabelChange(e: CustomEvent<{ value: string }>): void {
    const val = e.detail?.value ?? '';
    if (this._frameData) {
      this._frameData.label = val;
      const frame = storyboardFrames.find((f: StoryboardFrame) => f.id === this._frameData!.id);
      if (frame) frame.label = val;
      markProjectDirty(['storyboard']);
    }
    if (this._shot) {
      const sceneId = this._resolveSceneId();
      if (sceneId) {
        const shot = getShotById(sceneId, this._shot.id);
        if (shot) {
          shot.label = val;
          markProjectDirty(['scenes']);
        }
      }
    }
    this._refreshDerivedState();
  }

  private _renderTabs(): unknown {
    return html`
      <div class="cg-segmented cg-segmented--matte" role="tablist">
        ${!this._isModal
          ? html`
              <button class="cg-segmented-segment ${this._mode === 'list' ? 'active' : ''}" @click=${() => this._setMode('list')}>
                <i class="fa-solid fa-list"></i> Shot List
              </button>
            `
          : nothing}
        <button class="cg-segmented-segment ${this._mode === 'compose' ? 'active' : ''}" @click=${() => this._setMode('compose')}>
          <i class="fa-solid fa-sliders"></i> Compose
        </button>
        <button class="cg-segmented-segment ${this._mode === 'stack' ? 'active' : ''}" @click=${() => this._setMode('stack')}>
          <i class="fa-solid fa-layer-group"></i> Prompt Stack
        </button>
        <button class="cg-segmented-segment ${this._mode === 'generate' ? 'active' : ''}" @click=${() => this._setMode('generate')}>
          <i class="fa-solid fa-wand-magic-sparkles"></i> Generate
        </button>
      </div>
    `;
  }

  private _renderGenerateMode(): unknown {
    const frame = this._activeFrame();
    const imageUrl = frame?.imageUrl;
    const status = frame?.generatingStatus;
    const isGenerating = this._generatingStoryboard || (status && !status.startsWith('error:') && status !== 'slate');

    return html`
      <div class="sd-pane">
        <div class="bevel-sunken sd-toolbar" style="border-bottom:none;margin-bottom:4px">
          <label class="text-[10px] text-[var(--text-dim)] flex items-center gap-2">
            Preview style
            <select class="inspector-input bevel-sunken text-xs" @change=${this._onPreviewStyleChange}>
              ${STORYBOARD_PREVIEW_STYLE_OPTIONS.map(
                (opt) => html`
                  <option value=${opt.value} ?selected=${this._previewStyle === opt.value}>${opt.label}</option>
                `
              )}
            </select>
          </label>
        </div>

        <div class="sd-generate-grid">
          <div class="sd-output-slot bevel-sunken" style="padding:10px">
            <div class="sd-section-title"><i class="fa-solid fa-image"></i> Storyboard frame</div>
            <div class="sd-output-frame">
              ${imageUrl
                ? html`<img src=${imageUrl} alt="Storyboard frame" />`
                : html`
                    <div class="sd-output-placeholder">
                      <i class="fa-solid fa-pencil"></i>
                      <span>${isGenerating ? status || 'Generating…' : 'No storyboard image yet'}</span>
                    </div>
                  `}
            </div>
            <button
              class="toolbar-btn btn-ai toolbar-btn--shape-soft text-xs"
              ?disabled=${isGenerating}
              @click=${() => this._generateStoryboard()}
            >
              <i class="fa-solid fa-image"></i>
              ${isGenerating ? 'Generating…' : 'Generate Storyboard'}
            </button>
            ${frame?.generatedPrompt
              ? html`
                  <cg-codemirror-field
                    label="Generation prompt"
                    .value=${frame.generatedPrompt}
                    .readOnly=${true}
                    .minHeight=${72}
                  ></cg-codemirror-field>
                `
              : nothing}
          </div>

          <div class="sd-output-slot bevel-sunken" style="padding:10px">
            <div class="sd-section-title"><i class="fa-solid fa-film"></i> Rendered video</div>
            <div class="sd-output-frame">
              ${this._videoUrl
                ? html`<video src=${this._videoUrl} controls playsinline></video>`
                : html`
                    <div class="sd-output-placeholder">
                      <i class="fa-solid fa-clapperboard"></i>
                      <span>${this._generatingVideo ? 'Rendering video…' : 'No rendered clip yet'}</span>
                    </div>
                  `}
            </div>
            <button
              class="toolbar-btn btn-ai toolbar-btn--shape-soft text-xs"
              ?disabled=${this._generatingVideo}
              @click=${() => this._generateVideo()}
            >
              <i class="fa-solid fa-video"></i>
              ${this._generatingVideo ? 'Rendering…' : 'Generate Video'}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private _renderCameraChips(sectionKey: string): unknown {
    const sec = cameraLightingData[sectionKey];
    if (!sec) return nothing;
    const isExpanded = this._expandedCameraSection === sectionKey;
    const sel = cameraLightingSelections[sectionKey];
    const showThumbs = window.CineGen?.preferences?.cameraChipsShowThumbnails !== false;

    const renderChip = (item: { abbr: string; name: string; desc: string; params?: CameraItemParam[] }) => {
      const selected = sel === item.abbr;
      const previewSrc = showThumbs ? getCameraLightingPreviewSrc(sectionKey, item.abbr) : null;
      return html`
        <div
          class="cl-chip${selected ? ' cl-chip--selected' : ''}${previewSrc ? ' cl-chip--has-thumb' : ''}"
          @click=${() => {
            selectCameraItem(sectionKey, item.abbr);
            this._refreshDerivedState();
            this.requestUpdate();
          }}
        >
          ${previewSrc ? html`<img class="cl-chip-thumb" src=${previewSrc} alt="" width="124" height="70" loading="lazy" />` : nothing}
          <span class="cl-chip-abbr">${item.abbr}</span>
          <span class="cl-chip-name">${item.name}</span>
          <span class="cl-chip-desc">${item.desc}</span>
        </div>
        ${selected && item.params?.length
          ? html`
              <div class="cl-params-bar">
                ${item.params.map((p) => {
                  const val = cameraLightingParams[sectionKey]?.[p.key] ?? p.defaultValue;
                  if (p.type === 'select' && p.options) {
                    return html`
                      <label class="cl-param cl-param--select">
                        <span class="cl-param-label">${p.label}</span>
                        <select
                          class="cl-param-input bevel-sunken"
                          @change=${(e: Event) => {
                            setCameraItemParam(sectionKey, p.key, (e.target as HTMLSelectElement).value);
                            this._refreshDerivedState();
                            this.requestUpdate();
                          }}
                        >
                          ${p.options.map((o) => html`<option value=${o.value} ?selected=${o.value === val}>${o.label}</option>`)}
                        </select>
                      </label>
                    `;
                  }
                  return nothing;
                })}
              </div>
            `
          : nothing}
      `;
    };

    let chips;
    if (sec.subcategories?.length) {
      const byAbbr = new Map(sec.items.map((item) => [item.abbr, item]));
      chips = sec.subcategories.map(
        (sub) => html`
          <div class="cl-subcategory">
            <div class="cl-subcategory-header">${sub.title}</div>
            <div class="cl-chips-grid cl-chips-grid--nested">
              ${sub.abbrs.map((abbr) => byAbbr.get(abbr)).filter(Boolean).map((item) => renderChip(item!))}
            </div>
          </div>
        `
      );
    } else {
      chips = sec.items.map((item) => renderChip(item));
    }

    return html`
      <div class="cl-section" id="sd-section-${sectionKey}">
        <div
          class="cl-section-header"
          @click=${() => {
            this._expandedCameraSection = this._expandedCameraSection === sectionKey ? null : sectionKey;
            this.requestUpdate();
          }}
        >
          <i class="fa-solid ${sec.icon}"></i>
          <span>${sec.title}</span>
          <span class="cl-section-count">${sel ? '1 selected' : `${sec.items.length} options`}</span>
        </div>
        ${isExpanded ? html`<div class="cl-chips-grid" style="display:flex;flex-wrap:wrap;gap:6px;padding:6px 12px 10px">${chips}</div>` : nothing}
      </div>
    `;
  }

  private _renderSFXChips(sectionKey: string, section: SFXSection): unknown {
    const sel = sfxSelections[sectionKey];
    const isExpanded = this._expandedSFX === `sfx-${sectionKey}`;
    const chips = section.items.map((item) => {
      const selected = sel?.abbr === item.abbr;
      const previewSrc = getSFXPreviewSrc(sectionKey, item.abbr);
      return html`
        <div
          class="cl-chip${selected ? ' cl-chip--selected' : ''}${previewSrc ? ' cl-chip--has-thumb' : ''}"
          @click=${() => {
            selectSFXItem(sectionKey, item.abbr);
            this._writeSFXToShot();
            this.requestUpdate();
          }}
        >
          ${previewSrc ? html`<img class="cl-chip-thumb" src=${previewSrc} alt="" width="124" height="70" loading="lazy" />` : nothing}
          <span class="cl-chip-abbr">${item.abbr}</span>
          <span class="cl-chip-name">${item.name}</span>
          <span class="cl-chip-desc">${item.desc}</span>
        </div>
        ${selected && item.params?.length
          ? html`
              <div class="cl-params-bar">
                ${item.params.map((p) => {
                  const val = sfxParams[sectionKey]?.[p.key] ?? p.defaultValue;
                  if (p.type === 'select' && p.options) {
                    return html`
                      <label class="cl-param cl-param--select">
                        <span class="cl-param-label">${p.label}</span>
                        <select
                          class="cl-param-input bevel-sunken"
                          @change=${(e: Event) => {
                            setSFXParam(sectionKey, p.key, (e.target as HTMLSelectElement).value);
                            this._writeSFXToShot();
                            this.requestUpdate();
                          }}
                        >
                          ${p.options.map((o) => html`<option value=${o.value} ?selected=${o.value === val}>${o.label}</option>`)}
                        </select>
                      </label>
                    `;
                  }
                  return nothing;
                })}
              </div>
            `
          : nothing}
      `;
    });
    return html`
      <div class="cl-section">
        <div
          class="cl-section-header"
          @click=${() => {
            this._expandedSFX = this._expandedSFX === `sfx-${sectionKey}` ? null : `sfx-${sectionKey}`;
            this.requestUpdate();
          }}
        >
          <i class="fa-solid ${section.icon}"></i>
          <span>${section.title}</span>
        </div>
        ${isExpanded ? html`<div class="cl-chips-grid" style="display:flex;flex-wrap:wrap;gap:6px;padding:6px 12px 10px">${chips}</div>` : nothing}
      </div>
    `;
  }

  private _renderComposeMode(): unknown {
    const frameLabel = this._frameData?.label || this._shot?.label || '';
    const shotTitle = this._shot ? `Shot ${this._shot.number ?? ''} — ${this._shot.label}` : 'Select a shot to compose';
    const rawScript = this._scriptLines.join('\n');
    const conversion = convertScriptLinesForPrompt(this._scriptLines);
    const excluded = conversion.lines.filter((l) => l.kind === 'skipped').map((l) => l.raw).join('\n');

    return html`
      <div class="sd-pane">
        <div class="bevel-sunken" style="padding:6px 10px;font-size:11px;color:var(--text-dim)">${shotTitle}</div>

        <div class="sd-compose-grid">
          <cg-codemirror-field
            label="Shot label"
            .value=${frameLabel}
            .readOnly=${false}
            .minHeight=${40}
            @cg-change=${this._onLabelChange}
          ></cg-codemirror-field>
          <cg-codemirror-field
            label="Assembled shot prompt"
            .value=${this._assembledPrompt()}
            .readOnly=${true}
            .minHeight=${100}
            hint="Full text sent with cinematography + sanitized script"
          ></cg-codemirror-field>
        </div>

        <div class="cl-section-header">
          <i class="fa-solid fa-scroll"></i>
          <span>Script excerpt</span>
        </div>
        <div class="sd-compose-grid">
          <cg-codemirror-field
            label="Raw screenplay lines"
            .value=${rawScript}
            variant="script"
            .readOnly=${true}
            .minHeight=${120}
          ></cg-codemirror-field>
          <div>
            <cg-codemirror-field
              label="Model prompt (filtered)"
              .value=${this._scriptPromptText}
              .readOnly=${true}
              .minHeight=${120}
              hint="EXT/INT, V.O., transitions, and character cues are excluded deterministically"
            ></cg-codemirror-field>
            <div class="flex gap-2 mt-1">
              <button
                class="toolbar-btn toolbar-btn--finish-matte toolbar-btn--relief-protruded toolbar-btn--shape-soft btn-ai text-xs"
                ?disabled=${this._agentScriptRefining || !rawScript}
                @click=${() => this._refineScriptWithAgent()}
              >
                <i class="fa-solid fa-wand-magic-sparkles"></i>
                ${this._agentScriptRefining ? 'Refining…' : 'Refine with Agent'}
              </button>
            </div>
          </div>
        </div>
        ${excluded
          ? html`
              <cg-codemirror-field
                label="Withheld from model"
                .value=${excluded}
                variant="script"
                .readOnly=${true}
                .minHeight=${64}
                hint="Slug lines and screenplay markup not sent to the image/video model"
              ></cg-codemirror-field>
            `
          : nothing}

        <div class="cl-section-header">
          <i class="fa-solid fa-camera"></i>
          <span>Cinematography presets</span>
        </div>
        <div class="bevel-sunken" style="padding:4px 0">
          ${Object.keys(cameraLightingData).map((key) => this._renderCameraChips(key))}
        </div>

        <div class="cl-section-header">
          <i class="fa-solid fa-wand-magic-sparkles"></i>
          <span>Special effects</span>
        </div>
        <div class="bevel-sunken" style="padding:4px 0">
          ${Object.entries(sfxSectionMeta).map(([key, section]) => this._renderSFXChips(key, section))}
        </div>
      </div>
    `;
  }

  private _renderStackCard(item: PromptStackItem): unknown {
    const isImage = item.kind === 'image' && item.imageUrl;
    return html`
      <div class="prompt-stack-card${isImage ? ' prompt-stack-card--image' : ''}">
        ${isImage
          ? html`<img class="prompt-stack-thumb" src=${item.imageUrl} alt=${item.label} loading="lazy" />`
          : item.kind === 'image'
            ? html`<div class="prompt-stack-thumb-placeholder"><i class="fa-solid fa-image"></i></div>`
            : nothing}
        <div class="prompt-stack-meta">
          <div class="prompt-stack-category">${item.category}</div>
          <div class="prompt-stack-label">${item.label}</div>
          ${item.body && item.body !== item.label
            ? html`
                <cg-codemirror-field .value=${item.body} .readOnly=${true} .minHeight=${56}></cg-codemirror-field>
              `
            : nothing}
          ${item.params?.length
            ? html`
                <div class="prompt-stack-params">
                  ${item.params.map(
                    (p) => html`<span class="prompt-stack-param"><strong>${p.label}</strong> ${p.value}</span>`
                  )}
                </div>
              `
            : nothing}
          <div class="prompt-stack-source">${item.source}</div>
        </div>
      </div>
    `;
  }

  private _renderStackMode(): unknown {
    const items = this._stackItems;
    const serialized = serializePromptStackText(items);
    return html`
      <div class="sd-pane">
      <div class="bevel-sunken sd-toolbar sd-stack-header">
        <span class="text-[10px] text-[var(--text-dim)]">${items.length} stack items → model</span>
        <button
          class="toolbar-btn toolbar-btn--finish-matte toolbar-btn--relief-protruded toolbar-btn--shape-soft text-xs ml-auto"
          @click=${() => {
            navigator.clipboard?.writeText(serialized);
          }}
        >
          <i class="fa-solid fa-copy"></i> Copy stack text
        </button>
      </div>
        <cg-codemirror-field
          label="Serialized prompt stack"
          .value=${serialized}
          .readOnly=${true}
          .minHeight=${72}
          hint="Text-only stack summary; images listed as cards below"
        ></cg-codemirror-field>
        <div class="prompt-stack">
          ${items.length
            ? items.map((item) => this._renderStackCard(item))
            : html`<div class="prompt-stack-empty">Select a shot and configure presets to populate the prompt stack.</div>`}
        </div>
      </div>
    `;
  }

  private _renderShotFrames(shot: SceneShot): unknown {
    const sceneId = this._resolveSceneId();
    if (!sceneId) return nothing;
    const frames = (storyboardFrames as StoryboardFrame[]).filter(
      (f) => f.shotId === shot.id
    );
    if (!frames.length) return html`<span class="sd-text-dim">No frames</span>`;
    return html`
      <div class="sd-shot-frames-cell">
        ${frames.map(
          (frame) => html`
            <div
              class="sd-frame-thumb"
              @click=${() => this.openForFrame(frame)}
              title=${frame.label || `Frame ${frame.id}`}
            >
              ${frame.imageUrl
                ? html`<img src=${frame.imageUrl} alt=${frame.label || 'storyboard frame'} loading="lazy" />`
                : html`<i class="fa-solid fa-image"></i>`}
            </div>
          `
        )}
      </div>
    `;
  }

  private _renderListMode(): unknown {
    const rows = buildShotListRows();
    if (!rows.length) {
      return html`<div class="prompt-stack-empty">No shots yet. Add scene coverage to populate this list.</div>`;
    }
    return html`
      <div class="sd-pane">
        <table class="sd-shot-table breakdown-table">
          <thead>
            <tr>
              <th>Scene</th>
              <th>Shot</th>
              <th>Type</th>
              <th>Label</th>
              <th>Frames</th>
              <th>Duration</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((r) => {
              const isSelected = r.kind === 'coverage' && previsSelectionState.shotId === r.shotId;
              const shotNum = r.kind === 'coverage' && r.shotNumber != null
                ? formatShotDisplayLabel(r.sceneNumber, r.shotNumber)
                : '—';
              const frameCount = r.kind === 'coverage' ? (r.frameCount ?? 0) : 0;
              const framesCell = r.kind === 'coverage'
                ? frameCount > 0
                  ? html`${frameCount} frame${frameCount === 1 ? '' : 's'}`
                  : html`<span style="color:var(--text-dim)">0</span>`
                : '—';
              return html`
                <tr
                  class="sd-shot-row ${isSelected ? 'is-selected' : ''}"
                  @click=${r.kind === 'coverage' && r.shotId != null ? () => {
                    const shot = getShotById(r.sceneId, r.shotId!);
                    if (shot) this._selectShot(shot);
                  } : nothing}
                >
                  <td class="sd-scene-cell" style="font-weight:500;color:var(--text-highlight)">${r.sceneLabel}</td>
                  <td class="sd-shot-num">${shotNum}</td>
                  <td class="sd-text-dim">${r.type}</td>
                  <td class="sd-shot-label">${r.label || '—'}</td>
                  <td>${framesCell}</td>
                  <td class="sd-text-dim">${r.duration || '—'}</td>
                  <td class="sd-status-cell">${r.status !== '—' ? html`<span class="asset-status-dot asset-status-${r.status === 'rendered' || r.status === 'best take' ? 'approved' : r.status === 'take' ? 'in-progress' : 'pending'}"></span> ${r.status}` : '—'}</td>
                </tr>
              `;
            })}
          </tbody>
        </table>
      </div>
    `;
  }
render(): unknown {
    return html`
      <div class="bevel-flat sd-shell workspace-section-cinematography flex flex-1 flex-col min-h-0 overflow-hidden">
        ${!this._isModal
          ? html`
              <cg-panel-header>
                <span slot="title" class="workspace-panel-title">
                  <i class="fa-solid fa-pen-ruler"></i> SHOT DESIGNER${this._shot ? `: Shot ${this._shot.number ?? ''} — ${this._shot.label}` : ''}
                </span>
                <div slot="actions" class="flex gap-1">
                  ${this._shot
                    ? html`
                        <button class="toolbar-btn text-xs" @click=${() => this._setMode('stack')}>
                          <i class="fa-solid fa-layer-group"></i> Stack (${this._stackItems.length})
                        </button>
                      `
                    : nothing}
                </div>
              </cg-panel-header>
            `
          : nothing}
        <div class="bevel-sunken sd-toolbar">${this._renderTabs()}</div>
        <div class="sd-body flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
          ${this._mode === 'list'
            ? this._renderListMode()
            : this._mode === 'compose'
              ? this._renderComposeMode()
              : this._mode === 'generate'
                ? this._renderGenerateMode()
                : this._renderStackMode()}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'cinegen-shot-designer': CinegenShotDesigner;
  }
}
