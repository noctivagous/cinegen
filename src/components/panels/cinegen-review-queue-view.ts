import { html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';
import { activeProjectId } from '@/data/project-data';
import { alertCG } from '@/utils/alert-cg';
import { escHtml } from '@/utils/html';
import type { ReviewItem } from '@/services/ai/agents-service';

@customElement('cinegen-review-queue-view')
export class CinegenReviewQueueView extends CgLightElement {
  @state() private _items: ReviewItem[] = [];
  @state() private _loading = false;
  @state() private _error: string | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    this.id = 'view-review-queue';
    this.classList.add('hidden', 'flex', 'flex-col', 'h-full');
    this._loadQueue();
  }

  private async _loadQueue(): Promise<void> {
    const projectId = activeProjectId;
    if (!projectId) {
      this._error = 'No active project.';
      return;
    }
    const agents = (window as any).CineGen?.agents;
    if (!agents?.getReviewQueue) {
      this._error = 'Agent service not available.';
      return;
    }
    this._loading = true;
    this._error = null;
    try {
      const res = await agents.getReviewQueue(projectId);
      this._items = res.items || [];
    } catch (err) {
      this._error = err instanceof Error ? err.message : String(err);
    } finally {
      this._loading = false;
    }
  }

  private async _approve(item: ReviewItem): Promise<void> {
    const agents = (window as any).CineGen?.agents;
    if (!agents?.approveReviewItem) return;
    try {
      await agents.approveReviewItem(activeProjectId, item.id);
      alertCG(`Approved: ${item.title}`);
      await this._loadQueue();
    } catch (err) {
      alertCG(`Approve failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private async _reject(item: ReviewItem): Promise<void> {
    const agents = (window as any).CineGen?.agents;
    if (!agents?.rejectReviewItem) return;
    try {
      await agents.rejectReviewItem(activeProjectId, item.id, 'Rejected by filmmaker');
      alertCG(`Rejected: ${item.title}`);
      await this._loadQueue();
    } catch (err) {
      alertCG(`Reject failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private _typeIcon(type: string): string {
    switch (type) {
      case 'shot-list': return 'fa-list-check';
      case 'storyboard': return 'fa-images';
      case 'clip': return 'fa-film';
      case 'character': return 'fa-user';
      case 'location': return 'fa-map-location-dot';
      case 'audio': return 'fa-music';
      case 'rough-cut': return 'fa-scissors';
      default: return 'fa-circle-question';
    }
  }

  private _statusClass(status: string): string {
    switch (status) {
      case 'approved': return 'text-emerald-400';
      case 'rejected': return 'text-red-400';
      default: return 'text-yellow-400';
    }
  }

  render() {
    if (this._loading && !this._items.length) {
      return html`
        <div class="flex-1 flex items-center justify-center text-[var(--text-dim)] text-sm">
          <i class="fa-solid fa-circle-notch fa-spin mr-2"></i> Loading review queue…
        </div>
      `;
    }

    if (this._error) {
      return html`
        <div class="flex-1 flex flex-col items-center justify-center text-[var(--text-dim)] text-sm p-4">
          <i class="fa-solid fa-triangle-exclamation text-orange-400 mb-2"></i>
          <p>${escHtml(this._error)}</p>
          <button class="toolbar-btn mt-4 text-xs" @click=${() => this._loadQueue()}>Retry</button>
        </div>
      `;
    }

    if (!this._items.length) {
      return html`
        <div class="flex-1 flex flex-col items-center justify-center text-[var(--text-dim)] text-sm p-4">
          <i class="fa-solid fa-clipboard-check text-emerald-400 text-2xl mb-2"></i>
          <p>Review queue is empty.</p>
          <p class="text-[10px] mt-1">Agent outputs awaiting human approval will appear here.</p>
          <button class="toolbar-btn mt-4 text-xs" @click=${() => this._loadQueue()}>
            <i class="fa-solid fa-rotate mr-1"></i> Refresh
          </button>
        </div>
      `;
    }

    return html`
      <div class="flex-1 flex flex-col min-h-0">
        <div class="flex items-center justify-between px-3 py-2 border-b border-[var(--border)]">
          <h3 class="text-xs font-semibold uppercase tracking-wider text-[var(--text-dim)]">
            <i class="fa-solid fa-robot mr-1"></i> AI Director — Review Queue
          </h3>
          <button class="toolbar-btn text-xs" @click=${() => this._loadQueue()}>
            <i class="fa-solid fa-rotate mr-1"></i> Refresh
          </button>
        </div>
        <div class="flex-1 overflow-auto p-2 space-y-2">
          ${this._items.map((item) => html`
            <div class="bg-[#1f1f1f] border border-[var(--border)] rounded p-3">
              <div class="flex items-start justify-between">
                <div class="flex items-center gap-2">
                  <i class="fa-solid ${this._typeIcon(item.type)} text-[var(--text-dim)] text-xs"></i>
                  <span class="text-xs font-medium">${escHtml(item.title)}</span>
                </div>
                <span class="text-[10px] uppercase tracking-wider ${this._statusClass(item.status)}">
                  ${escHtml(item.status)}
                </span>
              </div>
              <div class="mt-1 text-[10px] text-[var(--text-dim)]">
                ${escHtml(item.department)} · ${escHtml(item.type)}
              </div>
              ${item.notes
                ? html`<p class="mt-2 text-[11px] text-[var(--text-dim)] leading-relaxed">${escHtml(item.notes)}</p>`
                : nothing}
              ${item.status === 'pending'
                ? html`
                    <div class="mt-3 flex gap-2">
                      <button
                        class="toolbar-btn btn-ai text-xs px-3 py-1"
                        @click=${() => this._approve(item)}
                      >
                        <i class="fa-solid fa-check mr-1"></i> Approve
                      </button>
                      <button
                        class="toolbar-btn text-xs px-3 py-1"
                        @click=${() => this._reject(item)}
                      >
                        <i class="fa-solid fa-xmark mr-1"></i> Reject
                      </button>
                    </div>
                  `
                : nothing}
            </div>
          `)}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'cinegen-review-queue-view': CinegenReviewQueueView;
  }
}
