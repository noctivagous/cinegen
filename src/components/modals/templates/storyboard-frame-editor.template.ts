import { html } from 'lit';
import { renderModalShell } from '../modal-shell';

/** Migrated to renderModalShell — body = shot designer, footer = close. */
export const renderStoryboardFrameEditor = () => {
  const body = html`
    <div style="display:flex;flex-direction:column;overflow:hidden;padding:0;height:100%;">
      <cinegen-shot-designer id="shot-designer-modal" style="flex:1;min-height:0;"></cinegen-shot-designer>
    </div>
  `;

  const footer = html`
    <button type="button" class="toolbar-btn" data-cg-close="storyboard-frame-editor">Close</button>
  `;

  return renderModalShell({
    id: 'storyboard-frame-editor',
    title: 'Shot Designer',
    titleIcon: 'fa-solid fa-pen-ruler',
    body,
    footer,
    dialogClass: 'bevel-raised',
    modalClass: 'storyboard-frame-editor',
  });
};
