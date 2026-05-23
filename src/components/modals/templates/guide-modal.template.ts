import { html } from 'lit';

/** Guide modal — shell via cg-modal-shell; body in cinegen-guide-modal-body. */
export const guideModalTemplate = html`
  <cg-modal-shell
    id="guide-modal"
    modal-id="guide-modal"
    title="Guide"
    title-icon="fa-solid fa-book-open"
    hidden
    aria-hidden="true"
  >
    <cinegen-guide-modal-body slot="body"></cinegen-guide-modal-body>
    <div slot="footer" class="guide-modal-footer">
      <button type="button" class="toolbar-btn" id="guide-modal-prev">
        <i class="fa-solid fa-chevron-left"></i> Previous
      </button>
      <span id="guide-modal-progress" class="guide-modal-progress"></span>
      <button type="button" class="toolbar-btn" id="guide-modal-next">
        Next <i class="fa-solid fa-chevron-right"></i>
      </button>
      <button type="button" class="toolbar-btn" data-cg-close="guide-modal">Close</button>
    </div>
  </cg-modal-shell>
`;
