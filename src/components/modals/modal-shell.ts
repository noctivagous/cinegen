import { html, nothing, type TemplateResult } from 'lit';
import type { CgModalShellSize } from '@/components/primitives/cg-modal-shell';

export type { CgModalShellSize };

export interface ModalShellOptions {
  /** Element id for modal-manager and data-cg-close. */
  id: string;
  title: string;
  titleIcon?: string;
  size?: CgModalShellSize;
  closeLabel?: string;
  body: TemplateResult;
  /** Custom footer; omit to use default Close button. */
  footer?: TemplateResult;
  /** When false, footer slot has no default Close button. */
  defaultClose?: boolean;
  /** Extra class on <cg-modal-shell> host. */
  modalClass?: string;
  /** Extra class on .cg-modal-dialog inner div. */
  dialogClass?: string;
}

/** Lit template factory for modals using &lt;cg-modal-shell&gt;. */
export function renderModalShell(opts: ModalShellOptions): TemplateResult {
  const size = opts.size ?? 'default';
  const footerSlot = opts.footer
    ? html`<div slot="footer">${opts.footer}</div>`
    : opts.defaultClose === false
      ? nothing
      : html`
          <div slot="footer">
            <button type="button" class="toolbar-btn" data-cg-close=${opts.id}>
              ${opts.closeLabel ?? 'Close'}
            </button>
          </div>
        `;

  return html`
    <cg-modal-shell
      id=${opts.id}
      modal-id=${opts.id}
      title=${opts.title}
      title-icon=${opts.titleIcon ?? ''}
      size=${size}
      class=${opts.modalClass ?? ''}
      dialog-class=${opts.dialogClass ?? ''}
      hidden
      aria-hidden="true"
    >
      <div slot="body">${opts.body}</div>
      ${footerSlot}
    </cg-modal-shell>
  `;
}
