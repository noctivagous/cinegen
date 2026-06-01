import { html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';
import type { ShotStoryboardEntry, ShotGenerationResult } from '@/storyboard/storyboard-generation-service';

type ShotStatus = 'queued' | 'generating' | 'done' | 'failed';

interface ShotProgress {
  sceneId: string;
  shotId: number;
  label: string;
  status: ShotStatus;
  error?: string;
}

@customElement('cinegen-generation-progress')
export class CinegenGenerationProgress extends CgLightElement {
  @state() private _shots: ShotProgress[] = [];
  @state() private _done = false;
  @state() private _total = 0;
  @state() private _completed = 0;
  @state() private _failed = 0;

  connectedCallback(): void {
    super.connectedCallback();
    this.classList.add(
      'modal-backdrop',
      'flex',
      'items-center',
      'justify-center',
      'fixed',
      'inset-0',
      'z-50'
    );
    this.style.background = 'rgba(0,0,0,0.6)';
  }

  show(eligible: ShotStoryboardEntry[]): void {
    this._shots = eligible.map((e) => ({
      sceneId: e.sceneId,
      shotId: e.shot.id,
      label: `Scene ${e.sceneNumber} · ${e.shot.shotType || 'Shot'} ${e.shot.label || ''}`.trim().replace(/\s+$/, ''),
      status: 'queued' as ShotStatus,
    }));
    this._total = eligible.length;
    this._completed = 0;
    this._failed = 0;
    this._done = false;
    this.requestUpdate();
  }

  setShotStatus(sceneId: string, shotId: number, status: ShotStatus, error?: string): void {
    const shot = this._shots.find((s) => s.sceneId === sceneId && s.shotId === shotId);
    if (!shot) return;
    if (shot.status === 'done' || shot.status === 'failed') {
      if (shot.status === 'done') this._completed--;
      if (shot.status === 'failed') this._failed--;
    }
    shot.status = status;
    if (status === 'done') this._completed++;
    if (status === 'failed') this._failed++;
    if (error) shot.error = error;
    this.requestUpdate();
  }

  finish(_results: ShotGenerationResult[]): void {
    this._done = true;
    this.requestUpdate();
  }

  private _close(): void {
    this.remove();
  }

  render() {
    const running = this._completed + this._failed;

    return html`
      <div
        class="bevel-flat"
        style="
          background: var(--chrome-bg);
          border: 1px solid var(--chrome-border-outer);
          min-width: 420px;
          max-width: 520px;
          max-height: 70vh;
          display: flex;
          flex-direction: column;
        "
      >
        <div
          class="flex items-center justify-between"
          style="padding: 8px 12px; border-bottom: 1px solid var(--chrome-border-outer);"
        >
          <span style="font-size: 12px; font-weight: 600; color: var(--text-main);">
            Generating Storyboard Frames
          </span>
          <span style="font-size: 11px; color: var(--text-dim);">
            ${running} / ${this._total} complete
            ${this._failed > 0 ? html`<span style="color: #e74c3c;"> (${this._failed} failed)</span>` : ''}
          </span>
        </div>

        <div style="overflow-y: auto; flex: 1; padding: 4px 0;">
          ${this._shots.map(
            (shot) => html`
              <div
                class="flex items-center justify-between"
                style="padding: 4px 12px; font-size: 11px; border-bottom: 1px solid rgba(255,255,255,0.04);"
              >
                <span style="color: var(--text-main); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                  ${shot.label}
                </span>
                <span style="margin-left: 8px; white-space: nowrap;">
                  ${shot.status === 'queued'
                    ? html`<span style="color: var(--text-dim);">⏳ Queued</span>`
                    : shot.status === 'generating'
                      ? html`<span style="color: #3498db;">⚙️ Generating</span>`
                      : shot.status === 'done'
                        ? html`<span style="color: #2ecc71;">✅ Done</span>`
                        : html`<span style="color: #e74c3c;" title=${shot.error || ''}>❌ Failed</span>`}
                </span>
              </div>
            `
          )}
        </div>

        <div
          class="flex items-center justify-end"
          style="padding: 8px 12px; border-top: 1px solid var(--chrome-border-outer);"
        >
          <button
            class="toolbar-btn"
            type="button"
            ?disabled=${!this._done}
            @click=${this._close}
            style="font-size: 11px; padding: 4px 16px;"
          >
            Close
          </button>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'cinegen-generation-progress': CinegenGenerationProgress;
  }
}
