import { html } from 'lit';
import { renderModalShell } from '../modal-shell';

/** Migrated to renderModalShell — body = tile grids, footer = close. */
export const renderAiAssistModal = () => {
  const body = html`
    <cinegen-ai-assist-modal-lead></cinegen-ai-assist-modal-lead>
    <h3 class="ai-assist-modal-section-title">Assistants</h3>
    <p class="ai-assist-modal-section-hint">Conversation-style helpers scoped to screenplay, boards, and continuity.</p>
    <cg-modal-tile-grid id="ai-assist-assistants-grid" class="settings-modal-grid" kind="assistant"></cg-modal-tile-grid>
    <h3 class="ai-assist-modal-section-title">Project tasks</h3>
    <p class="ai-assist-modal-section-hint">One-shot actions across the active production (uses your API keys and model routing).</p>
    <cg-modal-tile-grid id="ai-assist-tasks-grid" class="settings-modal-grid" kind="task"></cg-modal-tile-grid>
  `;

  const footer = html`
    <button type="button" class="toolbar-btn" data-cg-close="ai-assist-modal">Close</button>
  `;

  return renderModalShell({
    id: 'ai-assist-modal',
    title: 'AI Assist',
    titleIcon: 'fa-solid fa-wand-magic-sparkles',
    body,
    footer,
    dialogClass: 'bevel-raised',
  });
};
