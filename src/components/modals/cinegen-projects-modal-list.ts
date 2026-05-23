import { consume } from '@lit/context';
import { classMap } from 'lit/directives/class-map.js';
import { repeat } from 'lit/directives/repeat.js';
import { html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';
import { projectRegistry } from '@/data/project-data';
import { appShellStoreContext } from '@/context/app-shell-context';
import { appShellStore, type AppShellStore } from '@/stores/app-shell-store';
import { bindAppShellToHost } from '@/stores/bind-app-shell-host';

export const CG_PROJECT_OPEN = 'cg-project-open';

export type CgProjectOpenDetail = { projectId: string };

/** Recent projects list in the projects hub modal. */
@customElement('cinegen-projects-modal-list')
export class CinegenProjectsModalList extends CgLightElement {
  @consume({ context: appShellStoreContext })
  private _shellStore?: AppShellStore;

  @state() private _projects = [...projectRegistry];

  private _shellUnsub: (() => void) | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    this.classList.add('projects-modal-project-list');
    this.id = 'projects-modal-list';
    this._shellUnsub = bindAppShellToHost(this, () => this._shellStore ?? appShellStore);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._shellUnsub?.();
    this._shellUnsub = null;
  }

  refresh(): void {
    this._projects = [...projectRegistry];
  }

  render() {
    const activeId = (this._shellStore ?? appShellStore).activeProjectId;

    return repeat(
      this._projects,
      (proj) => proj.id,
      (proj) => {
        const isActive = proj.id === activeId;
        return html`
          <button
            type="button"
            class=${classMap({
              'projects-modal-project-card': true,
              'is-active': isActive,
            })}
            aria-current=${isActive ? 'true' : 'false'}
            @click=${() => this._openProject(proj.id)}
          >
            <div class="projects-modal-thumb" aria-hidden="true"></div>
            <div class="projects-modal-project-meta">
              <span class="projects-modal-project-name">${proj.name}</span>
              <span class="projects-modal-project-hint"
                >${isActive ? 'Currently open' : 'Open this production'}</span
              >
            </div>
          </button>
        `;
      }
    );
  }

  private _openProject(projectId: string): void {
    this.dispatchEvent(
      new CustomEvent<CgProjectOpenDetail>(CG_PROJECT_OPEN, {
        bubbles: true,
        composed: true,
        detail: { projectId },
      })
    );
  }
}
