import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';
import { aiAssistModalTemplate } from '@/components/modals/templates/ai-assist-modal.template';
import { aiProvidersModalTemplate } from '@/components/modals/templates/ai-providers-modal.template';
import { guideModalTemplate } from '@/components/modals/templates/guide-modal.template';
import { projectSettingsModalTemplate } from '@/components/modals/templates/project-settings-modal.template';
import { projectsModalTemplate } from '@/components/modals/templates/projects-modal.template';
import { settingsModalTemplate } from '@/components/modals/templates/settings-modal.template';
import { soundEditorModalTemplate } from '@/components/modals/templates/sound-editor-modal.template';
import { storyboardFrameEditorTemplate } from '@/components/modals/templates/storyboard-frame-editor.template';
import { wizardsModalTemplate } from '@/components/modals/templates/wizards-modal.template';
import { entryWizardModalsTemplate } from '@/components/modals/templates/entry-wizard-modals.template';
import { sectionSettingsModalTemplate } from '@/components/modals/templates/section-settings-modal.template';
import { projectFeaturesModalTemplate } from '@/components/modals/templates/project-features-modal.template';
import { aiProviderInfoModalTemplate } from '@/components/modals/templates/ai-provider-info-modal.template';
import { magnificationModalTemplate } from '@/components/modals/templates/magnification-modal.template';

/** Toolbar / settings modals (markup only; open/close logic in toolbar-modals-service). */
@customElement('cinegen-app-modals')
export class CinegenAppModals extends CgLightElement {
  render() {
    return html`
      ${guideModalTemplate}
      ${projectsModalTemplate}
      ${settingsModalTemplate}
      ${magnificationModalTemplate}
      ${aiAssistModalTemplate}
      ${projectSettingsModalTemplate}
      ${aiProvidersModalTemplate}
      ${storyboardFrameEditorTemplate}
      ${sectionSettingsModalTemplate}
      ${projectFeaturesModalTemplate}
      ${aiProviderInfoModalTemplate}
      ${soundEditorModalTemplate}
      ${wizardsModalTemplate}
      ${entryWizardModalsTemplate}
      <cinegen-provider-catalog-sync></cinegen-provider-catalog-sync>
    `;
  }
}
