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

@customElement('cinegen-inspector')
export class CinegenInspector extends CgLightElement {
  @consume({ context: appShellStoreContext })
  private _shellStore?: AppShellStore;

  @state() private _type: InspectorType = '';
  @state() private _data: unknown = null;

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
      <div class="mt-4 flex gap-2">
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
    return html`
      <div class="text-center text-lg">${data.name}</div>
      <p class="text-xs mt-2">Available in 12 scenes</p>
      ${this._unsafeChips(this._extractChips([data.name, data.desc]), {
        title: 'Chips in asset',
      })}
    `;
  }

  private _renderLocation(data: Record<string, unknown>) {
    return html`
      <div class="text-center">
        <i class="fa-solid ${data.icon} text-6xl"></i>
      </div>
      <div class="font-bold mt-2">${data.name}</div>
      ${this._unsafeChips(this._extractChips([data.name, data.tags]), {
        title: 'Chips in location',
      })}
    `;
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
