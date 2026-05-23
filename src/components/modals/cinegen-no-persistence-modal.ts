import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';

@customElement('cinegen-no-persistence-modal')
export class CinegenNoPersistenceModal extends CgLightElement {
  protected render() {
    return html`
      <div class="modal-overlay" style="position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;">
        <div class="modal-tile" style="max-width:480px;width:90%;padding:28px;border-radius:12px;background:var(--surface);box-shadow:0 20px 60px rgba(0,0,0,0.4);">
          <div class="modal-tile__header" style="margin-bottom:16px;">
            <h3 style="margin:0;font-size:18px;"><i class="fa-solid fa-triangle-exclamation" style="color:var(--accent-warn,#f59e0b);margin-right:8px;"></i>Server Persistence Unavailable</h3>
          </div>
          <div class="modal-tile__body" style="line-height:1.6;color:var(--text-secondary);">
            <p>The CineGen backend is not reporting persistence capability. State will not be synchronized across browser instances.</p>
            <p style="margin-top:12px;font-size:13px;opacity:0.8;">To enable server-side state persistence and multi-browser sync, ensure the dev server is running with the state API enabled.</p>
          </div>
          <div class="modal-tile__actions" style="margin-top:20px;display:flex;gap:10px;justify-content:flex-end;">
            <button type="button" class="toolbar-btn toolbar-btn--shape-soft"
              @click=${this._dismiss}
              style="background:var(--accent);color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;">
              Continue without sync
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private _dismiss(): void {
    this.hidden = true;
  }
}
