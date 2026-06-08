import { html } from 'lit';
import { renderModalShell } from '../modal-shell';

/** Migrated to renderModalShell — body = project layout, footer = close. */
export const renderProjectsModal = () => {
  const body = html`
    <div class="projects-modal-layout" id="projects-modal-layout">
      <div class="projects-modal-section">
        <h2 class="projects-modal-section-title">Recent projects</h2>
        <p class="projects-modal-section-lead">Open a production you have been working on.</p>
        <cinegen-projects-modal-list></cinegen-projects-modal-list>
      </div>
      <aside class="projects-modal-section projects-modal-new" aria-labelledby="projects-modal-new-heading">
        <h2 id="projects-modal-new-heading" class="projects-modal-section-title">New project</h2>
        <p class="projects-modal-section-lead">Create a slate or seed one with guided setup.</p>
        <div class="projects-modal-new-actions">
        <button type="button" class="toolbar-btn projects-modal-new-btn" data-project-action="blank-project" data-cg-testid="new-blank-project">
          <span class="projects-modal-new-icon" aria-hidden="true"><i class="fa-regular fa-file"></i></span>
          <span class="projects-modal-new-label">Blank project</span>
          <span class="projects-modal-new-desc">Empty script, tree, storyboard, and assets — add structure as you go.</span>
        </button>
        <button type="button" class="toolbar-btn projects-modal-new-btn projects-modal-new-btn--ai btn-ai" data-project-action="script-wizard" data-cg-testid="new-script-wizard">
          <span class="projects-modal-new-icon" aria-hidden="true"><i class="fa-solid fa-scroll"></i></span>
          <span class="projects-modal-new-label">Start from script</span>
          <span class="projects-modal-new-desc">Paste or write a screenplay, then build characters, locations, and references.</span>
        </button>
        <button type="button" class="toolbar-btn projects-modal-new-btn projects-modal-new-btn--ai btn-ai" data-project-action="visual-wizard" data-cg-testid="new-visual-wizard">
          <span class="projects-modal-new-icon" aria-hidden="true"><i class="fa-solid fa-image"></i></span>
          <span class="projects-modal-new-label">Visual-first entry</span>
          <span class="projects-modal-new-desc">Upload photos, mood boards, or character images to seed the project.</span>
        </button>
        <button type="button" class="toolbar-btn projects-modal-new-btn projects-modal-new-btn--ai btn-ai" data-project-action="concept-wizard" data-cg-testid="new-concept-wizard">
          <span class="projects-modal-new-icon" aria-hidden="true"><i class="fa-solid fa-palette"></i></span>
          <span class="projects-modal-new-label">Concept / Mood first</span>
          <span class="projects-modal-new-desc">Begin with style references and background plates to establish the look.</span>
        </button>
        <button type="button" class="toolbar-btn projects-modal-new-btn projects-modal-new-btn--ai btn-ai" data-project-action="asset-wizard" data-cg-testid="new-asset-wizard">
          <span class="projects-modal-new-icon" aria-hidden="true"><i class="fa-solid fa-boxes-stacked"></i></span>
          <span class="projects-modal-new-label">Asset library import</span>
          <span class="projects-modal-new-desc">Load a saved scene kit from a previous project as the foundation.</span>
        </button>
        <button type="button" class="toolbar-btn projects-modal-new-btn projects-modal-new-btn--ai btn-ai" data-project-action="storyboard-wizard" data-cg-testid="new-storyboard-wizard">
          <span class="projects-modal-new-icon" aria-hidden="true"><i class="fa-solid fa-pen-ruler"></i></span>
          <span class="projects-modal-new-label">Storyboard sketch mode</span>
          <span class="projects-modal-new-desc">Rough thumbnail sketching or text-based beats to frame your story.</span>
        </button>
        </div>
      </aside>
    </div>
    <div id="projects-modal-wizard-body" class="projects-modal-wizard-body" style="display:none;"></div>
  `;

  const footer = html`
    <div id="projects-modal-footer">
      <span class="projects-modal-footer-hint">Use the caret menu on the toolbar for a quick switch without closing the hub.</span>
      <button type="button" class="toolbar-btn" data-cg-close="projects-modal" data-cg-testid="close-projects-modal">Close</button>
    </div>
  `;

  return renderModalShell({
    id: 'projects-modal',
    title: 'Projects',
    titleIcon: 'fa-solid fa-folder-open',
    body,
    footer,
    dialogClass: 'bevel-raised',
  });
};
