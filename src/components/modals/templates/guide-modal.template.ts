import { html } from 'lit';
import { renderModalShell } from '../modal-shell';

/** Migrated to renderModalShell — body = guide modal body, footer = prev/next/close. */
export const renderGuideModal = () => {
  const body = html`<cinegen-guide-modal-body></cinegen-guide-modal-body>`;
  const footer = html`
    <button type="button" class="toolbar-btn" id="guide-modal-prev">
      <i class="fa-solid fa-chevron-left"></i> Previous
    </button>
    <span id="guide-modal-progress" class="guide-modal-progress"></span>
    <button type="button" class="toolbar-btn" id="guide-modal-next">
      Next <i class="fa-solid fa-chevron-right"></i>
    </button>
    <button type="button" class="toolbar-btn" data-cg-close="guide-modal">Close</button>
  `;
  return renderModalShell({
    id: 'guide-modal',
    title: 'Guide',
    titleIcon: 'fa-solid fa-book-open',
    body,
    footer,
  });
};
