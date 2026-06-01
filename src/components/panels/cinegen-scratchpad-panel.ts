import { html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';
import { projectScratchPad } from '@/data/project-data';
import { generateScratchPadEntry } from '@/storyboard/storyboard-generation-service';
import { alertCG } from '@/utils/alert-cg';

@customElement('cinegen-scratchpad-panel')
export class CinegenScratchpadPanel extends CgLightElement {
  @state() private _entries: any[] = [];
  @state() private _loading = false;
  @state() private _prompt = '';

  connectedCallback(): void {
    super.connectedCallback();
    this.id = 'view-scratchpad';
    this.classList.add('hidden', 'flex', 'flex-col', 'h-full');
    this._refreshEntries();
  }

  private _refreshEntries(): void {
    this._entries = [...(projectScratchPad as any)?.entries || []];
  }

  private async _generate(): Promise<void> {
    if (this._loading) return;
    this._loading = true;
    try {
      const result = await generateScratchPadEntry(this._prompt);
      if (result.ok) {
        this._refreshEntries();
        this._prompt = '';
      } else {
        alertCG(`ScratchPad generation failed: ${result.error || 'Unknown error'}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alertCG(`ScratchPad generation error: ${msg}`);
    } finally {
      this._loading = false;
    }
  }

  private _onPromptInput(e: Event): void {
    const input = e.target as HTMLTextAreaElement;
    this._prompt = input.value;
  }

  render() {
    const entries = this._entries;
    return html`
      <div class="scratchpad-shell">
        <div class="scratchpad-header">
          <h2><span class="icon"><i class="fa-solid fa-pen-fancy"></i></span> ScratchPad</h2>
        </div>
        <div class="scratchpad-actions p-3" style="border-bottom:1px solid var(--widget-border, #2a2a2a);">
          <textarea
            class="cg-input w-full mb-2"
            rows="3"
            placeholder="Describe what you want to generate..."
            .value=${this._prompt}
            @input=${this._onPromptInput}
          ></textarea>
          <button
            class="toolbar-btn btn-ai w-full"
            ?disabled=${this._loading || !this._prompt.trim()}
            @click=${() => void this._generate()}
          >
            ${this._loading
              ? html`<i class="fa-solid fa-spinner fa-spin"></i> Generating…`
              : html`<i class="fa-solid fa-wand-magic-sparkles"></i> Generate`}
          </button>
        </div>
        <div class="scratchpad-content flex-1 overflow-auto p-3">
          ${entries.length === 0
            ? html`<p class="placeholder">No drafts yet. Use the prompt above to generate.</p>`
            : html`
              <div class="grid gap-3">
                ${entries.map((entry) => html`
                  <div class="bevel-raised p-3" style="border-left:3px solid var(--accent, #4fc3f7);">
                    <div class="flex items-center justify-between mb-2">
                      <span class="font-bold text-sm">${entry.title || 'Untitled'}</span>
                      <span class="text-xs text-[var(--text-dim)]">${new Date(entry.createdAt).toLocaleTimeString()}</span>
                    </div>
                    <p class="text-xs text-[var(--text-dim)] mb-2">${entry.text?.slice(0, 120)}${entry.text?.length > 120 ? '…' : ''}</p>
                    ${entry.outputUrl
                      ? html`<img src=${entry.outputUrl} alt=${entry.title || ''} style="width:100%;border-radius:4px;margin-top:8px;" />`
                      : nothing}
                  </div>
                `)}
              </div>
            `}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'cinegen-scratchpad-panel': CinegenScratchpadPanel;
  }
}
