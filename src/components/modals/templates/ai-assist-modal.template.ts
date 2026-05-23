import { html } from 'lit';

/** Modal markup (IDs preserved for services). */
export const aiAssistModalTemplate = html`
<div id="ai-assist-modal" class="settings-modal" hidden aria-hidden="true">
    <div class="settings-modal-backdrop" data-cg-close="ai-assist-modal" aria-hidden="true"></div>
    <div class="settings-modal-dialog bevel-raised" role="dialog" aria-modal="true" aria-labelledby="ai-assist-modal-title">
      <div class="settings-modal-header panel-header">
        <span id="ai-assist-modal-title"><i class="fa-solid fa-wand-magic-sparkles"></i> AI Assist</span>
        <button type="button" class="toolbar-btn settings-modal-close" data-cg-close="ai-assist-modal" aria-label="Close AI Assist">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
      <div class="settings-modal-body panel-content">
        <cinegen-ai-assist-modal-lead></cinegen-ai-assist-modal-lead>
        <h3 class="ai-assist-modal-section-title">Assistants</h3>
        <p class="ai-assist-modal-section-hint">Conversation-style helpers scoped to screenplay, boards, and continuity.</p>
        <cg-modal-tile-grid id="ai-assist-assistants-grid" class="settings-modal-grid" kind="assistant"></cg-modal-tile-grid>
        <h3 class="ai-assist-modal-section-title">Project tasks</h3>
        <p class="ai-assist-modal-section-hint">One-shot actions across the active production (uses your API keys and model routing).</p>
        <cg-modal-tile-grid id="ai-assist-tasks-grid" class="settings-modal-grid" kind="task"></cg-modal-tile-grid>
      </div>
      <div class="settings-modal-footer bevel-sunken">
        <button type="button" class="toolbar-btn" data-cg-close="ai-assist-modal">Close</button>
      </div>
    </div>
  </div>
`;
