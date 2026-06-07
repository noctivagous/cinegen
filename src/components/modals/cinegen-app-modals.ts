import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';
import { renderAiAssistModal } from '@/components/modals/templates/ai-assist-modal.template';
import { renderAiProvidersModal } from '@/components/modals/templates/ai-providers-modal.template';
import { renderAppearanceModal } from '@/components/modals/templates/appearance-modal.template';
import { renderGuideModal } from '@/components/modals/templates/guide-modal.template';
import { renderProjectFeaturesModal } from '@/components/modals/templates/project-features-modal.template';
import { renderProjectSettingsModal } from '@/components/modals/templates/project-settings-modal.template';
import { renderProjectsModal } from '@/components/modals/templates/projects-modal.template';
import { renderSectionSettingsModal } from '@/components/modals/templates/section-settings-modal.template';
import { renderSettingsModal } from '@/components/modals/templates/settings-modal.template';
import { renderSoundEditorModal } from '@/components/modals/templates/sound-editor-modal.template';
import { renderStoryboardFrameEditor } from '@/components/modals/templates/storyboard-frame-editor.template';
import { renderAiProviderInfoModal } from '@/components/modals/templates/ai-provider-info-modal.template';
import { renderEntryWizardModals } from '@/components/modals/templates/entry-wizard-modals.template';
import { renderWizardsModal } from '@/components/modals/templates/wizards-modal.template';

/** Toolbar / settings modals (markup only; open/close logic in toolbar-modals-service). */
@customElement('cinegen-app-modals')
export class CinegenAppModals extends CgLightElement {
  render() {
    return html`
      ${renderGuideModal()}
      ${renderProjectsModal()}
      ${renderSettingsModal()}
      ${renderAppearanceModal()}
      ${renderAiAssistModal()}
      ${renderProjectSettingsModal()}
      ${renderAiProvidersModal()}
      ${renderStoryboardFrameEditor()}
      ${renderWizardsModal()}
      ${renderEntryWizardModals()}
      ${renderSectionSettingsModal()}
      ${renderProjectFeaturesModal()}
      ${renderAiProviderInfoModal()}
      ${renderSoundEditorModal()}
      <cinegen-provider-catalog-sync></cinegen-provider-catalog-sync>
    `;
  }
}
