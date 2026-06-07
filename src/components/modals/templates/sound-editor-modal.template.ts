import { html } from 'lit';
import { renderModalShell } from '../modal-shell';

/** Migrated to renderModalShell — body = sound editor, default footer. */
export const renderSoundEditorModal = () => {
  const body = html`<cinegen-sound-editor-modal></cinegen-sound-editor-modal>`;
  return renderModalShell({
    id: 'sound-editor-modal',
    title: 'Sound Editor',
    titleIcon: 'fa-solid fa-wave-square',
    size: 'wide',
    body,
  });
};
