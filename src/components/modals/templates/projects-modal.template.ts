import { html } from 'lit';

/** Modal markup (IDs preserved for services). */
export const projectsModalTemplate = html`
<div id="projects-modal" class="projects-modal" hidden aria-hidden="true">
    <div class="projects-modal-backdrop" data-cg-close="projects-modal" aria-hidden="true"></div>
    <div class="projects-modal-dialog bevel-raised" role="dialog" aria-modal="true" aria-labelledby="projects-modal-title">
      <div class="projects-modal-header panel-header">
        <span id="projects-modal-title"><i class="fa-solid fa-folder-open"></i> Projects</span>
        <button type="button" class="toolbar-btn projects-modal-close" data-cg-close="projects-modal" aria-label="Close projects">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
      <div class="projects-modal-body panel-content">
        <div class="projects-modal-layout">
          <div class="projects-modal-section">
            <h2 class="projects-modal-section-title">Recent projects</h2>
            <p class="projects-modal-section-lead">Open a production you have been working on.</p>
            <cinegen-projects-modal-list></cinegen-projects-modal-list>
          </div>
          <aside class="projects-modal-section projects-modal-new" aria-labelledby="projects-modal-new-heading">
            <h2 id="projects-modal-new-heading" class="projects-modal-section-title">New project</h2>
            <p class="projects-modal-section-lead">Create a slate or seed one with guided setup.</p>
            <div class="projects-modal-new-actions">
              <button type="button" class="toolbar-btn projects-modal-new-btn" data-project-action="blank-project">
                <span class="projects-modal-new-icon" aria-hidden="true"><i class="fa-regular fa-file"></i></span>
                <span class="projects-modal-new-label">Blank project</span>
                <span class="projects-modal-new-desc">Start from an empty pipeline and hierarchy.</span>
              </button>
              <button type="button" class="toolbar-btn projects-modal-new-btn" data-project-action="import-baseline">
                <span class="projects-modal-new-icon" aria-hidden="true"><i class="fa-solid fa-file-import"></i></span>
                <span class="projects-modal-new-label">Import screenplay / bible</span>
                <span class="projects-modal-new-desc">Coming soon — Fountain, breakdowns, and references.</span>
              </button>
              <button type="button" class="toolbar-btn projects-modal-new-btn projects-modal-new-btn--ai btn-ai" data-project-action="generation-agent">
                <span class="projects-modal-new-icon" aria-hidden="true"><i class="fa-solid fa-wand-magic-sparkles"></i></span>
                <span class="projects-modal-new-label">Project Generation Agent</span>
                <span class="projects-modal-new-desc">AI walkthrough that gathers creative choices and scaffold.</span>
              </button>
            </div>
          </aside>
        </div>
      </div>
      <div class="projects-modal-footer bevel-sunken">
        <span class="projects-modal-footer-hint">Use the caret menu on the toolbar for a quick switch without closing the hub.</span>
        <button type="button" class="toolbar-btn" data-cg-close="projects-modal">Close</button>
      </div>
    </div>
  </div>
`;
