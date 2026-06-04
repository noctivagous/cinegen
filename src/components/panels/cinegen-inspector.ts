import { consume } from '@lit/context';
import { choose } from 'lit/directives/choose.js';
import { html, nothing } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { when } from 'lit/directives/when.js';
import { customElement, state } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';
import { appShellStoreContext } from '@/context/app-shell-context';
import { appShellStore, type AppShellStore } from '@/stores/app-shell-store';
import { bindAppShellToHost } from '@/stores/bind-app-shell-host';
import type { InspectorType } from '@/types/globals';
import { escHtml } from '@/utils/html';
import { patchAppShellPreferences } from '@/stores/app-shell';
import { syncLayoutSplitDividers } from '@/services/layout-service';
import { getFramesForShot, getShotForFrame } from '@/workspace/shot-frame-bridge';
import { assetLibrary, currentSceneData, sceneReferenceOverrides, notifyStoryboardReferencesChanged } from '@/data/project-data';
import { markProjectDirty } from '@/services/project-service';
import { syncAssetLibraryToReferenceBank } from '@/storyboard/storyboard-reference-sync';
import { isAcceptedReferenceFile, readFileAsDataUrl, promptReferenceSlot } from '@/assets/asset-upload-service';

@customElement('cinegen-inspector')
export class CinegenInspector extends CgLightElement {
  @consume({ context: appShellStoreContext })
  private _shellStore?: AppShellStore;

  @state() private _type: InspectorType = '';
  @state() private _data: unknown = null;
  @state() private _charDropActive = false;
  @state() private _locDropActive = false;

  private _shellUnsub: (() => void) | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    this.classList.add('panel-content', 'p-3', 'flex-1', 'overflow-auto', 'text-xs');
    this.id = 'inspector-content';
    this._shellUnsub = bindAppShellToHost(this, () => this._shellStore ?? appShellStore);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._shellUnsub?.();
    this._shellUnsub = null;
  }

  showSelection(type: InspectorType, data?: unknown): void {
    this._type = type;
    this._data = data ?? null;
  }

  private _chipsSection(
    chips: Array<{ type: string; label: string }>,
    opts: { title?: string } = {}
  ) {
    if (typeof window.renderInspectorChipsSection === 'function') {
      return window.renderInspectorChipsSection(chips, opts);
    }
    return '';
  }

  private _extractChips(texts: unknown[]) {
    if (typeof window.extractChipsFromTexts === 'function') {
      return window.extractChipsFromTexts(texts);
    }
    return [];
  }

  private _escape(str: unknown): string {
    if (typeof window.escapeHtml === 'function') return window.escapeHtml(str);
    return escHtml(str);
  }

  private _renderChip(data: Record<string, unknown>) {
    return html`
      ${this._unsafeChips([{ type: String(data.type), label: String(data.label) }], {
      title: 'Selected chip',
    })}
      ${when(
      data.mentionCount != null,
      () => html`<p class="text-[10px] text-[var(--text-dim)] mt-2">
            ${data.mentionCount} mention${data.mentionCount === 1 ? '' : 's'} in project
          </p>`
    )}
      <p class="text-[10px] text-[var(--text-dim)] mt-1">
        Single-click for destinations, or double-click for the default view.
      </p>
    `;
  }

  private _renderScene(data: Record<string, unknown>) {
    const coverage = (data.coverage as Array<{ label: string }>) || [];
    const broll = (data.broll as Array<{ label: string }>) || [];
    return html`
      <div class="property-row">
        <span>Lighting Preset</span>
        <span class="text-emerald-400">${data.master ? 'Noir Rain' : 'Default'}</span>
      </div>
      <div class="property-row"><span>Camera</span><span>ARRI Alexa Mini LF</span></div>
      <div class="property-row">
        <span>Continuity Lock</span><span class="text-emerald-400">ON</span>
      </div>
      <div class="property-row">
        <span>AI Prompt Strength</span
        ><input type="range" value="75" class="w-24 accent-orange" />
      </div>
      <button type="button" class="btn-ai w-full text-xs mt-4" @click=${() => window.generateMasterShot?.()}>
        Regenerate Entire Scene
      </button>
      ${this._unsafeChips(
      this._extractChips([
        data.title,
        ...coverage.map((s) => s.label),
        ...broll.map((b) => b.label),
        data.notes,
      ]),
      { title: 'Chips in scene' }
    )}
    `;
  }

  private _renderShot(data: Record<string, unknown>) {
    const sceneId = window.currentSceneId ?? '';
    const shotId = data.id as number;
    const frames = sceneId ? getFramesForShot(sceneId, shotId) : [];
    const refSlots = data.sceneReferenceSlots as string[] | undefined;
    const refUrls = Array.isArray(refSlots) ? refSlots : [];
    return html`
      <div class="font-bold">${data.label}</div>
      <p class="text-xs">${data.type}</p>
      ${data.scriptLink
        ? html`<p class="text-[10px] text-[var(--text-dim)] mt-2">Script: ${this._escape(data.scriptLink)}</p>`
        : nothing}
      ${frames.length
        ? html`<div class="mt-3">
            <div class="text-[10px] text-[var(--text-dim)] mb-1">Storyboard frames</div>
            <ul class="space-y-1">
              ${frames.map(
          (frame, idx) => html`
                  <li>
                    <button
                      type="button"
                      class="text-[10px] underline text-emerald-400"
                      @click=${() => window.selectStoryboardFrameById?.(frame.id)}
                    >
                      ${idx + 1}. ${this._escape(frame.label)}
                    </button>
                  </li>
                `
        )}
            </ul>
          </div>`
        : nothing}
      <div class="mt-4 mb-2 text-[10px] font-bold" style="color:var(--text-dim,#888);">REFERENCE IMAGES</div>
      <div class="flex flex-wrap gap-2 mb-2">
        ${refUrls.map(
          (url, i) => html`
            <div style="position:relative;">
              <img src=${url} alt="Shot ref ${i + 1}" style="width:72px;height:72px;object-fit:cover;border-radius:4px;" />
              <button
                type="button"
                style="
                  position: absolute; top: -4px; right: -4px;
                  width: 16px; height: 16px; border-radius: 50%;
                  background: rgba(200,50,50,0.85); color: #fff;
                  border: none; font-size: 10px; line-height: 16px;
                  text-align: center; cursor: pointer; padding: 0;
                "
                @click=${() => this._onShotRefRemoved(sceneId, shotId, i)}
              >&times;</button>
            </div>
          `
        )}
        <cg-reference-upload
          label="Add"
          field="shot-ref"
          @cg-file-loaded=${(e: CustomEvent) => this._onShotRefUploaded(sceneId, shotId, e.detail.dataUrl)}
        ></cg-reference-upload>
      </div>
      <div class="mt-2 flex gap-2">
        <button
          type="button"
          class="btn-ai text-xs flex-1"
          @click=${() => window.regenerateShot?.(data.id as number)}
        >
          Regenerate Take
        </button>
      </div>
      ${this._unsafeChips(this._extractChips([data.label, data.type, data.scriptLink]), {
          title: 'Chips in shot',
        })}
    `;
  }

  private _onShotRefUploaded(sceneId: string, shotId: number, dataUrl: string): void {
    const scene = (currentSceneData as Record<string, unknown>)[sceneId] as Record<string, unknown> | undefined;
    if (!scene) return;
    const coverage = scene.coverage as Array<Record<string, unknown>> | undefined;
    if (!Array.isArray(coverage)) return;
    const shot = coverage.find((s) => s.id === shotId);
    if (!shot) return;
    if (!Array.isArray(shot.sceneReferenceSlots)) shot.sceneReferenceSlots = [];
    (shot.sceneReferenceSlots as string[]).push(dataUrl);

    if (!(sceneReferenceOverrides as Record<string, unknown>)[sceneId]) {
      (sceneReferenceOverrides as Record<string, unknown>)[sceneId] = {};
    }
    notifyStoryboardReferencesChanged();
    markProjectDirty(['scenes', 'storyboard']);
    this.requestUpdate();
  }

  private _onShotRefRemoved(sceneId: string, shotId: number, index: number): void {
    const scene = (currentSceneData as Record<string, unknown>)[sceneId] as Record<string, unknown> | undefined;
    if (!scene) return;
    const coverage = scene.coverage as Array<Record<string, unknown>> | undefined;
    if (!Array.isArray(coverage)) return;
    const shot = coverage.find((s) => s.id === shotId);
    if (!shot) return;
    if (Array.isArray(shot.sceneReferenceSlots)) {
      (shot.sceneReferenceSlots as string[]).splice(index, 1);
    }
    notifyStoryboardReferencesChanged();
    markProjectDirty(['scenes', 'storyboard']);
    this.requestUpdate();
  }

  private _renderCameraLighting(data: Record<string, unknown>) {
    const filled = Object.entries(data).filter(([, v]) => v !== null);
    const selections = window.cameraLightingSelections || {};
    const clData = window.cameraLightingData || {};
    const unsetCount = Object.keys(selections).length - filled.length;

    return html`
      <div class="text-[10px] text-[var(--text-dim)] mb-2">Active shot configuration</div>
      ${when(
      !filled.length,
      () => html`<div class="italic text-[var(--text-dim)]">
            No selections yet.<br />Click options in the workspace panels.
          </div>`,
      () =>
        repeat(
          filled,
          ([k]) => k,
          ([k, abbr]) => {
            const sec = clData[k as string];
            const item = sec?.items?.find((i: { abbr: string }) => i.abbr === abbr);
            const title = sec?.title
              ?.replace(' Techniques', '')
              .replace(' Composition', '')
              .replace(' Types & Framing', '');
            return html`
                <div class="property-row">
                  <span class="text-[10px]"
                    ><i class="fa-solid ${sec?.icon || ''}"></i> ${title}</span
                  >
                  <span class="text-emerald-400 text-right text-[10px] max-w-[110px]"
                    >${item?.name || abbr}</span
                  >
                </div>
              `;
          }
        )
    )}
      ${when(
      unsetCount > 0,
      () => html`<div class="text-[10px] text-[var(--text-dim)] mt-2">
            ${unsetCount} section${unsetCount > 1 ? 's' : ''} not set
          </div>`
    )}
      <button type="button" class="btn-ai w-full text-xs mt-4" @click=${() => window.buildCameraPrompt?.()}>
        Build Shot Prompt
      </button>
    `;
  }

  private _renderAsset(data: Record<string, unknown>) {
    const name = String(data.name || '');
    const charEntry = Array.isArray(assetLibrary.characters)
      ? (assetLibrary.characters as Record<string, unknown>[]).find(
        (c) => String(c.name || '').toLowerCase() === name.toLowerCase()
      )
      : null;
    const refs = charEntry?.references as Record<string, unknown> | undefined;
    const hasRefs = refs && typeof refs === 'object';

    return html`
      <div
        style=${this._charDropActive ? 'outline:2px dashed var(--accent,#4fc3f7);outline-offset:2px;border-radius:4px;' : ''}
        @dragover=${this._onCharDragOver}
        @dragleave=${this._onCharDragLeave}
        @drop=${(e: DragEvent) => void this._onCharDrop(e)}
      >
        <div class="text-center text-lg">${name}</div>
        <p class="text-xs mt-2">Available in 12 scenes</p>
        ${this._unsafeChips(this._extractChips([data.name, data.desc]), {
        title: 'Chips in asset',
      })}
        ${hasRefs ? this._renderCharacterRefSlots(name, refs!) : ''}
        <div class="mt-3 flex gap-2">
          <button
            type="button"
            class="text-[10px] text-[var(--text-dim)] hover:text-emerald-400"
            @click=${() => this._promoteAssetToShotRef(name, refs)}
            ?disabled=${!hasRefs}
            title=${hasRefs ? 'Assign this character as a shot reference' : 'No reference images to promote'}
          >
            <i class="fa-solid fa-crosshairs"></i> Use as Shot Reference
          </button>
        </div>
      </div>
    `;
  }

  private _promoteAssetToShotRef(name: string, refs: Record<string, unknown> | undefined): void {
    if (!refs || typeof refs !== 'object') {
      window.alertCG?.('This character has no reference images. Upload face/body/costume references first.');
      return;
    }
    const refUrls: string[] = [];
    for (const key of ['face', 'body', 'profile', 'threeQuarter', 'closeUp']) {
      const url = refs[key];
      if (typeof url === 'string' && url) refUrls.push(url);
    }
    if (Array.isArray(refs.costume)) {
      for (const url of refs.costume) {
        if (typeof url === 'string' && url) refUrls.push(url);
      }
    }
    if (!refUrls.length) {
      window.alertCG?.('No reference image URLs found on this character.');
      return;
    }

    const imageUrl = refUrls[0];
    const scenes = Object.entries(currentSceneData).sort(([a], [b]) => a.localeCompare(b));
    if (!scenes.length) {
      window.alertCG?.('No scenes found. Create scenes first.');
      return;
    }
    const sceneLabels = scenes.map(([sceneId, scene], idx) =>
      `${idx + 1}. Scene ${sceneId} — ${(scene as Record<string, unknown>).title || 'Untitled'}`
    );
    const sceneInput = prompt(`Assign "${name}" as shot reference.\nSelect a scene:\n${sceneLabels.join('\n')}\n\nEnter scene number (1–${scenes.length}):`);
    if (!sceneInput) return;
    const sceneIdx = parseInt(sceneInput, 10) - 1;
    if (sceneIdx < 0 || sceneIdx >= scenes.length) {
      window.alertCG?.('Invalid scene selection.');
      return;
    }
    const [sceneId, scene] = scenes[sceneIdx] as [string, Record<string, unknown>];
    const coverage = (scene.coverage ?? []) as Array<Record<string, unknown>>;
    if (!coverage.length) {
      window.alertCG?.('This scene has no shots. Create shots first.');
      return;
    }
    const shotLabels = coverage.map((shot, idx) =>
      `${idx + 1}. Shot ${shot.number ?? idx + 1} — ${shot.label || 'Untitled'}`
    );
    const shotInput = prompt(`Select a shot:\n${shotLabels.join('\n')}\n\nEnter shot number (1–${coverage.length}):`);
    if (!shotInput) return;
    const shotIdx = parseInt(shotInput, 10) - 1;
    if (shotIdx < 0 || shotIdx >= coverage.length) {
      window.alertCG?.('Invalid shot selection.');
      return;
    }

    const overrides = sceneReferenceOverrides as Record<string, Record<string, unknown>>;
    if (!overrides[sceneId]) overrides[sceneId] = {};
    const chars = overrides[sceneId].characters;
    if (!Array.isArray(chars)) {
      overrides[sceneId].characters = [];
    }
    const arr = overrides[sceneId].characters as Array<Record<string, unknown>>;
    const existing = arr.find(
      (s) => String(s.label || '').toLowerCase() === name.toLowerCase()
    );
    if (existing) {
      existing.imageUrl = imageUrl;
    } else {
      arr.push({
        id: `char-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        category: 'characters',
        label: name,
        prompt: name,
        imageUrl,
        source: 'user',
        enabled: true,
        updatedAt: new Date().toISOString(),
      });
    }
    markProjectDirty(['storyboard']);
    notifyStoryboardReferencesChanged();
  }

  private _renderCharacterRefSlots(name: string, refs: Record<string, unknown>) {
    const fields: Array<{ key: string; label: string }> = [
      { key: 'face', label: 'Face' },
      { key: 'body', label: 'Body' },
      { key: 'profile', label: 'Profile' },
      { key: 'threeQuarter', label: '3/4' },
      { key: 'closeUp', label: 'Close-up' },
      { key: 'costume', label: 'Costume' },
    ];
    return html`
      <div class="mt-4 mb-2 text-[10px] font-bold" style="color:var(--text-dim,#888);">REFERENCE IMAGES</div>
      <div class="grid gap-2" style="grid-template-columns: repeat(3, 1fr);">
        ${fields.map(
      (f) => html`
            <div>
              <cg-reference-upload
                label=${f.label}
                field=${f.key}
                currentUrl=${(f.key === 'costume'
          ? (Array.isArray(refs[f.key]) ? (refs[f.key] as string[])[0] : '')
          : String(refs[f.key] || '')
        )}
                @cg-file-loaded=${(e: CustomEvent) =>
          this._onCharRefUploaded(name, e.detail.field, e.detail.dataUrl)}
                @cg-file-removed=${(e: CustomEvent) =>
          this._onCharRefRemoved(name, e.detail.field)}
              ></cg-reference-upload>
            </div>
          `
    )}
      </div>
    `;
  }

  private _onCharRefUploaded(charName: string, field: string, dataUrl: string): void {
    const chars = Array.isArray(assetLibrary.characters) ? (assetLibrary.characters as Record<string, unknown>[]) : [];
    const entry = chars.find((c) => String(c.name || '').toLowerCase() === charName.toLowerCase());
    if (!entry) return;
    const refs = entry.references as Record<string, unknown> | undefined;
    if (!refs || typeof refs !== 'object') return;
    if (field === 'costume') {
      if (!Array.isArray(refs.costume)) refs.costume = [];
      (refs.costume as string[]).push(dataUrl);
    } else {
      refs[field] = dataUrl;
    }
    syncAssetLibraryToReferenceBank();
    markProjectDirty(['assetLibrary', 'storyboard']);
  }

  private _onCharRefRemoved(charName: string, field: string): void {
    const chars = Array.isArray(assetLibrary.characters) ? (assetLibrary.characters as Record<string, unknown>[]) : [];
    const entry = chars.find((c) => String(c.name || '').toLowerCase() === charName.toLowerCase());
    if (!entry) return;
    const refs = entry.references as Record<string, unknown> | undefined;
    if (!refs || typeof refs !== 'object') return;
    if (field === 'costume') {
      refs.costume = [];
    } else {
      delete refs[field];
    }
    syncAssetLibraryToReferenceBank();
    markProjectDirty(['assetLibrary', 'storyboard']);
  }

  private _renderLocation(data: Record<string, unknown>) {
    const name = String(data.name || '');
    const locEntry = Array.isArray(assetLibrary.locations)
      ? (assetLibrary.locations as Record<string, unknown>[]).find(
        (l) => String(l.name || '').toLowerCase() === name.toLowerCase()
      )
      : null;
    const refArray = locEntry?.references;
    const refUrls = Array.isArray(refArray) ? (refArray as string[]) : [];

    return html`
      <div
        style=${this._locDropActive ? 'outline:2px dashed var(--accent,#4fc3f7);outline-offset:2px;border-radius:4px;' : ''}
        @dragover=${this._onLocDragOver}
        @dragleave=${this._onLocDragLeave}
        @drop=${(e: DragEvent) => void this._onLocDrop(e)}
      >
        <div class="text-center">
          <i class="fa-solid ${data.icon} text-6xl"></i>
        </div>
        <div class="font-bold mt-2">${name}</div>
        ${this._unsafeChips(this._extractChips([data.name, data.tags]), {
        title: 'Chips in location',
      })}
        <div class="mt-4 mb-2 text-[10px] font-bold" style="color:var(--text-dim,#888);">REFERENCE IMAGES</div>
        <div class="flex flex-wrap gap-2">
          ${refUrls.map(
      (url) => html`
            <div style="position:relative;">
              <img src=${url} alt="Location ref" style="width:72px;height:72px;object-fit:cover;border-radius:4px;" />
            </div>
          `
    )}
          <cg-reference-upload
            label="Add"
            field="loc-ref"
            @cg-file-loaded=${(e: CustomEvent) => this._onLocRefUploaded(name, e.detail.dataUrl)}
          ></cg-reference-upload>
        </div>
        <div class="mt-3">
          <button
            type="button"
            class="text-[10px] text-[var(--text-dim)] hover:text-emerald-400"
            @click=${() => this._promoteLocationToShotRef(name, refUrls)}
            ?disabled=${!refUrls.length}
            title=${refUrls.length ? 'Assign this location as a shot reference' : 'No reference images to promote'}
          >
            <i class="fa-solid fa-crosshairs"></i> Use as Shot Reference
          </button>
        </div>
      </div>
    `;
  }

  private _promoteLocationToShotRef(name: string, refUrls: string[]): void {
    if (!refUrls.length) {
      window.alertCG?.('This location has no reference images. Upload location plates first.');
      return;
    }
    const imageUrl = refUrls[0];
    const scenes = Object.entries(currentSceneData).sort(([a], [b]) => a.localeCompare(b));
    if (!scenes.length) {
      window.alertCG?.('No scenes found. Create scenes first.');
      return;
    }
    const sceneLabels = scenes.map(([sceneId, scene], idx) =>
      `${idx + 1}. Scene ${sceneId} — ${(scene as Record<string, unknown>).title || 'Untitled'}`
    );
    const sceneInput = prompt(`Assign "${name}" as location plate reference.\nSelect a scene:\n${sceneLabels.join('\n')}\n\nEnter scene number (1–${scenes.length}):`);
    if (!sceneInput) return;
    const sceneIdx = parseInt(sceneInput, 10) - 1;
    if (sceneIdx < 0 || sceneIdx >= scenes.length) {
      window.alertCG?.('Invalid scene selection.');
      return;
    }
    const [sceneId] = scenes[sceneIdx] as [string, Record<string, unknown>];

    const overrides = sceneReferenceOverrides as Record<string, Record<string, unknown>>;
    if (!overrides[sceneId]) overrides[sceneId] = {};
    const locs = overrides[sceneId].locations;
    if (!Array.isArray(locs)) {
      overrides[sceneId].locations = [];
    }
    const arr = overrides[sceneId].locations as Array<Record<string, unknown>>;
    const existing = arr.find(
      (s) => String(s.label || '').toLowerCase() === name.toLowerCase()
    );
    if (existing) {
      existing.imageUrl = imageUrl;
    } else {
      arr.push({
        id: `loc-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        category: 'locations',
        label: name,
        prompt: name,
        imageUrl,
        source: 'user',
        enabled: true,
        updatedAt: new Date().toISOString(),
      });
    }
    markProjectDirty(['storyboard']);
    notifyStoryboardReferencesChanged();
  }

  private _onLocRefUploaded(locName: string, dataUrl: string): void {
    const locs = Array.isArray(assetLibrary.locations) ? (assetLibrary.locations as Record<string, unknown>[]) : [];
    const entry = locs.find((l) => String(l.name || '').toLowerCase() === locName.toLowerCase());
    if (!entry) return;
    if (!Array.isArray(entry.references)) entry.references = [];
    (entry.references as string[]).push(dataUrl);
    syncAssetLibraryToReferenceBank();
    markProjectDirty(['assetLibrary', 'storyboard']);
  }

  // ── Drag-drop handlers for character/location drop zones ──

  private _onCharDragOver(e: DragEvent): void {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    this._charDropActive = true;
  }

  private _onCharDragLeave(): void {
    this._charDropActive = false;
  }

  private async _onCharDrop(e: DragEvent): Promise<void> {
    e.preventDefault();
    this._charDropActive = false;
    const files = e.dataTransfer?.files;
    if (!files?.length) return;
    const file = files[0];
    if (!isAcceptedReferenceFile(file)) return;
    const slotKey = promptReferenceSlot();
    if (!slotKey) return;

    const dataUrl = await readFileAsDataUrl(file);
    const name = this._data ? String((this._data as Record<string, unknown>).name || '') : '';
    this._onCharRefUploaded(name, slotKey, dataUrl);
  }

  private _onLocDragOver(e: DragEvent): void {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    this._locDropActive = true;
  }

  private _onLocDragLeave(): void {
    this._locDropActive = false;
  }

  private async _onLocDrop(e: DragEvent): Promise<void> {
    e.preventDefault();
    this._locDropActive = false;
    const files = e.dataTransfer?.files;
    if (!files?.length) return;
    const file = files[0];
    if (!isAcceptedReferenceFile(file)) return;

    const dataUrl = await readFileAsDataUrl(file);
    const name = this._data ? String((this._data as Record<string, unknown>).name || '') : '';
    this._onLocRefUploaded(name, dataUrl);
  }

  private _renderStoryboardFrame(data: Record<string, unknown>) {
    const frameId = data.id as number;
    const parentShot = getShotForFrame(data as import('@/storyboard/storyboard-types').StoryboardFrame);
    const updateField = (field: string, value: string) => {
      const frames = window.storyboardFrames as Array<Record<string, unknown>>;
      const frame = frames.find((f: Record<string, unknown>) => f.id === frameId);
      if (!frame) return;
      frame[field] = value;
      window.selectedStoryboardFrameId = frameId;
      window.renderStoryboard?.();
      window.dispatchEvent(new CustomEvent('storyboard-frames-changed'));
    };
    const onInput = (field: string) => (e: Event) => {
      updateField(field, (e.target as HTMLInputElement).value);
    };
    return html`
      ${parentShot
        ? html`<div class="property-row"><span>Shot</span><span>${this._escape(parentShot.label)}</span></div>`
        : nothing}
      <div class="property-row">
        <span>Scene</span>
        <input
          type="text"
          class="inspector-input bevel-sunken"
          .value=${this._escape(data.scene)}
          @input=${onInput('scene')}
        />
      </div>
      <div class="property-row">
        <span>Label</span>
        <input
          type="text"
          class="inspector-input bevel-sunken"
          .value=${this._escape(data.label)}
          @input=${onInput('label')}
        />
      </div>
      <div class="property-row">
        <span>Script anchor</span>
        <input
          type="text"
          class="inspector-input bevel-sunken"
          .value=${this._escape(data.scriptLink || '')}
          @input=${onInput('scriptLink')}
        />
      </div>
      <div class="property-row">
        <span>Notes</span>
        <textarea
          class="inspector-input inspector-textarea bevel-sunken"
          rows="3"
          @input=${onInput('notes')}
        >${this._escape(data.notes || '')}</textarea>
      </div>
      ${this._unsafeChips(
          this._extractChips([data.label, data.notes, data.scriptLink]),
          { title: 'Chips in frame' }
        )}
      <div class="flex gap-2 mt-2">
        <button
          type="button"
          class="toolbar-btn text-[10px] flex-1"
          @click=${() => window.openStoryboardFrameEditor?.(data as any)}
        ><i class="fa-solid fa-pen-to-square"></i> Open Editor</button>
        <button
          type="button"
          class="toolbar-btn text-[10px] flex-1"
          @click=${() => window.deleteSelectedFrame?.()}
        ><i class="fa-solid fa-trash"></i> Delete</button>
      </div>
      <div class="flex gap-2 mt-2">
        <button
          type="button"
          class="toolbar-btn text-[10px] flex-1"
          @click=${() => window.duplicateSelectedFrame?.()}
        ><i class="fa-regular fa-copy"></i> Duplicate</button>
        <button
          type="button"
          class="toolbar-btn text-[10px]"
          @click=${() => window.moveSelectedFrameUp?.()}
          title="Move up"
        ><i class="fa-solid fa-arrow-up"></i></button>
        <button
          type="button"
          class="toolbar-btn text-[10px]"
          @click=${() => window.moveSelectedFrameDown?.()}
          title="Move down"
        ><i class="fa-solid fa-arrow-down"></i></button>
      </div>
      <button
        type="button"
        class="btn-ai w-full text-[10px] mt-2"
        @click=${() => window.regenerateThumbnail?.(data as any)}
      ><i class="fa-solid fa-arrows-rotate"></i> Regenerate Thumbnail</button>
      <p class="text-[10px] text-[var(--text-dim)] mt-2">
        Double-click a frame to open the full editor.
      </p>
    `;
  }

  private _renderTreatment(data: Record<string, unknown>) {
    const rows: Array<[string, unknown]> = [
      ['Logline', data.logline],
      ['Genre', data.genre],
      ['Tone', data.tone],
      ['Audience', data.targetAudience],
      ['Movie refs', data.movieReferences],
    ];
    const synopsis = data.synopsis ? String(data.synopsis) : '';

    return html`
      <p class="text-[10px] text-[var(--text-dim)] mb-2">
        Story guide — fed to AI for script and scene generation.
      </p>
      ${repeat(
      rows,
      ([label]) => label,
      ([label, value]) =>
        when(
          value,
          () => html`<div class="property-row">
              <span>${this._escape(label)}</span>
              <span class="text-[10px] text-right max-w-[140px]">${this._escape(value)}</span>
            </div>`
        )
    )}
      ${when(
      synopsis,
      () => html`<p class="text-[10px] mt-2 text-[var(--text-dim)]">Synopsis</p>
            <p class="text-[10px] mt-1">
              ${this._escape(synopsis.slice(0, 200))}${synopsis.length > 200 ? '…' : ''}
            </p>`
    )}
    `;
  }

  private _renderStoryboardReferenceCategory(data: Record<string, unknown>) {
    const key = String(data.referenceCategory || 'characters');
    const label = String(data.name || 'Storyboard References');
    const bank = (window.storyboardReferenceBank || {}) as Record<string, Array<Record<string, unknown>>>;
    const slots = Array.isArray(bank[key]) ? bank[key] : [];
    const sceneKey = (window.currentSceneId as string) || 'scene1';
    const onField =
      (slotId: string, field: 'label' | 'prompt' | 'notes') =>
        (e: Event) => {
          window.updateReferenceSlotField?.(
            slotId,
            field,
            (e.target as HTMLInputElement).value,
            sceneKey
          );
        };

    return html`
      <div class="text-[10px] text-[var(--text-dim)] mb-2">${label}</div>
      <button
        type="button"
        class="btn-ai w-full text-[10px] mb-2"
        @click=${() => window.generateStoryboardReferences?.()}
      ><i class="fa-solid fa-id-card"></i> Generate References for Scene</button>
      ${when(
      !slots.length,
      () => html`<div class="italic text-[var(--text-dim)]">No references yet. Generate references first.</div>`,
      () =>
        repeat(
          slots,
          (slot: any) => String(slot.id),
          (slot: any) => html`
              <div class="bevel-sunken p-2 mb-2">
                <div class="property-row">
                  <span>Label</span>
                  <input class="inspector-input bevel-sunken" .value=${String(slot.label || '')} @input=${onField(String(slot.id), 'label')} />
                </div>
                <div class="property-row">
                  <span>Prompt</span>
                  <input class="inspector-input bevel-sunken" .value=${String(slot.prompt || '')} @input=${onField(String(slot.id), 'prompt')} />
                </div>
                <div class="property-row">
                  <span>Notes</span>
                  <input class="inspector-input bevel-sunken" .value=${String(slot.notes || '')} @input=${onField(String(slot.id), 'notes')} />
                </div>
                <div class="flex gap-2 mt-2">
                  <button class="toolbar-btn text-[10px] flex-1" @click=${() => window.regenerateReferenceSlot?.(String(slot.id), sceneKey)}>
                    <i class="fa-solid fa-arrows-rotate"></i> Regenerate
                  </button>
                  ${slot.locked
              ? html`<button class="toolbar-btn text-[10px]" @click=${() => window.unlockReferenceSlot?.(String(slot.id), sceneKey)}>
                        <i class="fa-solid fa-lock-open"></i>
                      </button>`
              : html`<button class="toolbar-btn text-[10px]" @click=${() => window.lockReferenceSlot?.(String(slot.id), sceneKey)}>
                        <i class="fa-solid fa-lock"></i>
                      </button>`}
                </div>
              </div>
            `
        )
    )}
    `;
  }

  private _renderScrap(data: Record<string, unknown>) {
    const items = (data.items as Array<{ label: string; scene: string }>) || [];
    const preview = items.slice(0, 8);

    return html`
      <div class="text-[10px] mb-2">Deleted storyboard frames (${items.length})</div>
      ${when(
      !items.length,
      () => html`<div class="italic text-[var(--text-dim)]">Scrap Bin is empty.</div>`,
      () => html`
          ${repeat(
        preview,
        (item, i) => `${item.label}-${i}`,
        (item) => html`
              <div class="property-row">
                <span class="max-w-[110px] truncate">${item.label}</span>
                <span class="text-[10px] text-[var(--text-dim)]">SC ${item.scene}</span>
              </div>
            `
      )}
          ${when(
        items.length > 8,
        () => html`<div class="text-[10px] text-[var(--text-dim)] mt-2">
                ...and ${items.length - 8} more
              </div>`
      )}
          <button
            type="button"
            class="toolbar-btn text-[10px] mt-2 w-full"
            @click=${() => window.restoreLastDeletedFrame?.()}
          ><i class="fa-solid fa-trash-arrow-up"></i> Restore Last Deleted</button>
        `
    )}
    `;
  }

  private _renderEmpty() {
    return html`
      <div class="italic text-[var(--text-dim)]">
        Nothing selected yet.<br />Balanced structure meets fluid generation.
      </div>
    `;
  }

  private _renderBody(): unknown {
    const type = this._type;
    const data = this._data as Record<string, unknown> | null;
    if (!data) return this._renderEmpty();

    return choose(
      type,
      [
        ['chip', () => this._renderChip(data)],
        ['scene', () => this._renderScene(data)],
        ['shot', () => this._renderShot(data)],
        ['camera-lighting', () => this._renderCameraLighting(data)],
        ['asset', () => this._renderAsset(data)],
        ['location', () => this._renderLocation(data)],
        ['storyboard-frame', () => this._renderStoryboardFrame(data)],
        ['storyboard-reference-category', () => this._renderStoryboardReferenceCategory(data)],
        ['treatment', () => this._renderTreatment(data)],
        ['scrap', () => this._renderScrap(data)],
      ],
      () => this._renderEmpty()
    );
  }

  private _unsafeChips(
    chips: Array<{ type: string; label: string }>,
    opts: { title?: string }
  ) {
    const htmlStr = this._chipsSection(chips, opts);
    if (!htmlStr) return nothing;
    return html`<div>${unsafeHTML(htmlStr)}</div>`;
  }

  render() {
    void (this._shellStore ?? appShellStore).activeProjectId;
    void (this._shellStore ?? appShellStore).currentView;
    const header = this._type
      ? html`<div class="inspector-header">${this._type.toUpperCase()}</div>`
      : nothing;
    return html`${header}${this._renderBody()}`;
  }
}

export function syncInspectorToggleButton(visible: boolean): void {
  const btn = document.getElementById('inspector-toggle-btn');
  if (!btn) return;
  btn.classList.toggle('active', visible);
  btn.setAttribute('aria-pressed', visible ? 'true' : 'false');
}

export function toggleInspectorPanel(): void {
  const panel = document.getElementById('inspector-panel');
  if (!panel) return;
  const visible = panel.style.display === 'none';
  panel.style.display = visible ? 'flex' : 'none';
  if (visible && !panel.style.width) {
    panel.style.width = '288px';
  }
  syncInspectorToggleButton(visible);
  syncLayoutSplitDividers();
  patchAppShellPreferences({ inspectorVisible: visible });
}

export function updateInspector(type: InspectorType, data?: unknown): void {
  document.querySelector<CinegenInspector>('cinegen-inspector')?.showSelection(type, data);
}
