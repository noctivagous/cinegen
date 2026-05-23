import { consume } from '@lit/context';
import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';
import { projectData, projectRegistry } from '@/data/project-data';
import { appShellStoreContext } from '@/context/app-shell-context';
import { appShellStore, type AppShellStore } from '@/stores/app-shell-store';
import { bindAppShellToHost } from '@/stores/bind-app-shell-host';

/** AI Assist modal intro line (active project name from shell store). */
@customElement('cinegen-ai-assist-modal-lead')
export class CinegenAiAssistModalLead extends CgLightElement {
  @consume({ context: appShellStoreContext })
  private _shellStore?: AppShellStore;

  private _shellUnsub: (() => void) | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    this.classList.add('settings-modal-lead');
    this.id = 'ai-assist-modal-lead';
    this._shellUnsub = bindAppShellToHost(this, () => this._shellStore ?? appShellStore);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._shellUnsub?.();
    this._shellUnsub = null;
  }

  render() {
    const activeId = (this._shellStore ?? appShellStore).activeProjectId;
    const active = projectRegistry.find((p) => p.id === activeId);
    const name = active?.name || projectData.name || 'this project';

    return html`Assistants and tasks apply to <strong>${name}</strong>. Configure models under
      Settings → AI Providers & Models.`;
  }
}
