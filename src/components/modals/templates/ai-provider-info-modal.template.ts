import { html } from 'lit';
import { renderModalShell } from '../modal-shell';

/** Migrated to renderModalShell — body = provider info, default footer. */
export const renderAiProviderInfoModal = () => {
  const body = html`<cinegen-ai-provider-info></cinegen-ai-provider-info>`;
  return renderModalShell({
    id: 'ai-provider-info-modal',
    title: 'AI Provider Information',
    titleIcon: 'fa-solid fa-database',
    size: 'wide',
    body,
  });
};
