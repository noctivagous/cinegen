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
import { duplicateBundledProject, exportProject, deleteServerProject } from '@/services/project-service';
import { getChipContextMenu } from '@/services/context-menu-host';
import type { ContextMenuItem } from '@/services/context-menu-types';

export const CG_PROJECT_OPEN = 'cg-project-open';

export type CgProjectOpenDetail = { projectId: string };

export type ProjectListItem = {
  id: string;
  name: string;
  file?: string;
  writable?: boolean;
  lastModified?: string;
  lastOpened?: string;
};

function formatTimestamp(iso?: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

/** Recent projects list in the projects hub modal. */
@customElement('cinegen-projects-modal-list')
export class CinegenProjectsModalList extends CgLightElement {
  @consume({ context: appShellStoreContext })
  private _shellStore?: AppShellStore;

  @state() private _projects: ProjectListItem[] = [];

  private _shellUnsub: (() => void) | null = null;
  private _loading = false;

  connectedCallback(): void {
    super.connectedCallback();
    this.classList.add('projects-modal-project-list');
    this.id = 'projects-modal-list';
    this._shellUnsub = bindAppShellToHost(this, () => this._shellStore ?? appShellStore);
    this.addEventListener('click', this._onOutsideClick);
    this.refresh();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._shellUnsub?.();
    this._shellUnsub = null;
    this.removeEventListener('click', this._onOutsideClick);
  }

  async refresh(): Promise<void> {
    const registryItems: ProjectListItem[] = projectRegistry.map((p) => ({
      id: p.id,
      name: p.name,
      file: p.file,
      writable: !p.file,
      lastOpened: p.lastOpened,
    }));

    let server: ProjectListItem[] = [];
    try {
      this._loading = true;
      const res = await fetch('/api/projects');
      if (res.ok) {
        const data = await res.json();
        server = (data.projects || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          writable: true,
          lastModified: p.lastModified,
        }));
      }
    } catch {
    } finally {
      this._loading = false;
    }

    const byId = new Map<string, ProjectListItem>();
    for (const p of [...server, ...registryItems]) {
      if (!byId.has(p.id)) byId.set(p.id, p);
    }
    this._projects = Array.from(byId.values());
  }

  private _importInput: HTMLInputElement | null = null;

  private _triggerImport(): void {
    if (!this._importInput) {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.zip,application/zip';
      input.style.display = 'none';
      input.addEventListener('change', (e) => this._onImportFile(e));
      this.appendChild(input);
      this._importInput = input;
    }
    this._importInput.value = '';
    this._importInput.click();
  }

  private async _onImportFile(e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const { importProject } = await import('@/services/project-service');
      const result = await importProject(file);
      if (result.ok && result.project) {
        await this.refresh();
        this.dispatchEvent(
          new CustomEvent<CgProjectOpenDetail>(CG_PROJECT_OPEN, {
            bubbles: true,
            composed: true,
            detail: { projectId: result.project.id },
          })
        );
      } else {
        const { alertCG } = await import('@/utils/alert-cg');
        const msg = result.error || 'Import failed';
        const detail = result.missing?.length ? `\nMissing files: ${result.missing.join(', ')}` : '';
        alertCG(`Import failed: ${msg}${detail}`);
      }
    } catch (err: unknown) {
      const { alertCG } = await import('@/utils/alert-cg');
      alertCG(`Import error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      input.value = '';
    }
  }

  private _onProjectContextMenu(e: MouseEvent, proj: ProjectListItem): void {
    e.preventDefault();
    if (!proj.writable) return;
    const menu = getChipContextMenu();
    if (!menu) return;

    const items: ContextMenuItem[] = [
      { id: 'delete', label: 'Delete', icon: 'fa-trash-can' },
    ];

    menu.open({
      x: e.clientX,
      y: e.clientY,
      items,
      header: { label: proj.name, caption: 'Project' },
      onSelect: (actionId) => {
        if (actionId === 'delete') void this._deleteProject(proj);
      },
    });
  }

  private async _deleteProject(proj: ProjectListItem): Promise<void> {
    if (!proj.writable) return;
    const confirmed = confirm(`Delete "${proj.name}"?\n\nThis cannot be undone.`);
    if (!confirmed) return;
    const result = await deleteServerProject(proj.id);
    if (!result.ok) {
      const { alertCG } = await import('@/utils/alert-cg');
      alertCG(`Delete failed: ${result.error || 'Unknown error'}`);
      return;
    }
    const idx = projectRegistry.findIndex((p) => p.id === proj.id);
    if (idx !== -1) projectRegistry.splice(idx, 1);
    await this.refresh();
  }

  private _onOutsideClick(): void {
    getChipContextMenu()?.close();
  }

  render() {
    const activeId = (this._shellStore ?? appShellStore).activeProjectId;

    return html`
      <div class="projects-modal-import-bar" style="display:flex;gap:8px;margin-bottom:8px;">
        <button
          type="button"
          class="toolbar-btn text-xs"
          data-cg-testid="import-project"
          @click=${() => this._triggerImport()}
        >
          <i class="fa-solid fa-file-import"></i> Import Project…
        </button>
      </div>
      ${repeat(
      this._projects,
      (proj) => proj.id,
      (proj) => {
        const isActive = proj.id === activeId;
        const isWritable = !!proj.writable;
        const statusLabel = isWritable ? 'Local' : 'Sample';
        const lastModifiedLabel = proj.lastModified ? formatTimestamp(proj.lastModified) : '';
        const lastOpenedLabel = proj.lastOpened ? formatTimestamp(proj.lastOpened) : '';
        const showLastModified = isWritable && lastModifiedLabel && !isActive;
        const showLastOpened = lastOpenedLabel && !isActive;
        return html`
            <div
              class=${classMap({
          'projects-modal-project-card': true,
          'is-active': isActive,
          'writable': isWritable,
        })}
              aria-current=${isActive ? 'true' : 'false'}
              data-cg-testid="project-card-${proj.id}"
              @contextmenu=${(e: MouseEvent) => this._onProjectContextMenu(e, proj)}
            >
              <button
                type="button"
                class="projects-modal-project-card-main"
                data-cg-testid="open-project-${proj.id}"
                @click=${() => this._openProject(proj.id)}
              >
                <div class="projects-modal-thumb" aria-hidden="true"></div>
                <div class="projects-modal-project-meta">
                  <span class="projects-modal-project-name" data-cg-testid="project-list-name">${proj.name}</span>
                  <span class="projects-modal-project-hint"
                    >${isActive ? 'Currently open' : 'Open this production'}</span
                  >
                  <span
                    class=${classMap({
          'project-status-badge': true,
          'project-status-badge--local': isWritable,
          'project-status-badge--sample': !isWritable,
        })}
                    title=${isWritable ? 'Writable local project' : 'Read-only bundled sample'}
                  >${statusLabel}</span>
                  ${showLastModified || showLastOpened
            ? html`
                      <span class="projects-modal-project-time">
                        ${showLastModified ? html`<span class="projects-modal-project-time-modified">Modified ${lastModifiedLabel}</span>` : ''}
                        ${showLastOpened ? html`<span class="projects-modal-project-time-opened">Opened ${lastOpenedLabel}</span>` : ''}
                      </span>
                    `
            : ''}
                </div>
              </button>
              ${!isWritable
            ? html`
                    <button
                      type="button"
                      class="projects-modal-project-duplicate-btn"
                      data-cg-testid="duplicate-project-${proj.id}"
                      title="Duplicate as writable local project"
                      @click=${() => this._duplicateProject(proj.id)}
                    >
                      <i class="fa-solid fa-copy" aria-hidden="true"></i> Duplicate
                    </button>
                  `
            : html`
                    <button
                      type="button"
                      class="projects-modal-project-download-btn"
                      data-cg-testid="download-project-${proj.id}"
                      title="Download project as .cine.zip"
                      @click=${(e: Event) => { e.stopPropagation(); void this._downloadProject(proj.id); }}
                    >
                      <i class="fa-solid fa-download" aria-hidden="true"></i>
                    </button>
                  `}
            </div>
          `;
      }
    )}
    `;
  }

  private _openProject(projectId: string): void {
    const entry = projectRegistry.find((p) => p.id === projectId);
    if (entry) {
      entry.lastOpened = new Date().toISOString();
    }
    this.dispatchEvent(
      new CustomEvent<CgProjectOpenDetail>(CG_PROJECT_OPEN, {
        bubbles: true,
        composed: true,
        detail: { projectId },
      })
    );
  }

  private async _downloadProject(projectId: string): Promise<void> {
    try {
      await exportProject(projectId);
    } catch (err: unknown) {
      const { alertCG } = await import('@/utils/alert-cg');
      alertCG(`Download failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private async _duplicateProject(projectId: string): Promise<void> {
    const entry = projectRegistry.find((p) => p.id === projectId);
    if (!entry?.file) return;
    const newName = `${entry.name} (Copy)`;
    const result = await duplicateBundledProject(entry.file, newName);
    if (result) {
      await this.refresh();
      this.dispatchEvent(
        new CustomEvent<CgProjectOpenDetail>(CG_PROJECT_OPEN, {
          bubbles: true,
          composed: true,
          detail: { projectId: result.id },
        })
      );
    }
  }
}
