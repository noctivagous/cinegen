import { html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';
import { loadPreferences } from '@/services/preferences';
import { appShellStore } from '@/stores/app-shell';

/** Bottom status strip: storage badge, AI ready, model splits, project + view labels. */
@customElement('cinegen-status-bar')
export class CinegenStatusBar extends CgLightElement {
  @state() private _projectName = 'Untitled';
  @state() private _sceneCount = 0;
  @state() private _takeCount = 0;
  @state() private _viewLabel = 'Script & Storyboard';
  @state() private _connectionCount = 1;

  private _unsubShell: (() => void) | null = null;
  private _storyboardFramesListener: (() => void) | null = null;
  private _projectNameChangedListener: (() => void) | null = null;
  private _connectionPollTimer: ReturnType<typeof setInterval> | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    this.classList.add('status-bar');
    this._refreshStats();
    this._unsubShell = appShellStore.subscribe(() => {
      this._refreshStats();
      this._viewLabel = appShellStore.currentViewLabel;
    });
    this._storyboardFramesListener = () => this._refreshStats();
    window.addEventListener('storyboard-frames-changed', this._storyboardFramesListener);
    this._projectNameChangedListener = () => this._refreshStats();
    window.addEventListener('cinegen:project-name-changed', this._projectNameChangedListener);
    this._pollConnections();
    this._connectionPollTimer = setInterval(() => this._pollConnections(), 3000);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._unsubShell?.();
    this._unsubShell = null;
    if (this._storyboardFramesListener) {
      window.removeEventListener('storyboard-frames-changed', this._storyboardFramesListener);
      this._storyboardFramesListener = null;
    }
    if (this._projectNameChangedListener) {
      window.removeEventListener('cinegen:project-name-changed', this._projectNameChangedListener);
      this._projectNameChangedListener = null;
    }
    if (this._connectionPollTimer) {
      clearInterval(this._connectionPollTimer);
      this._connectionPollTimer = null;
    }
  }

  private async _pollConnections(): Promise<void> {
    try {
      const res = await fetch('/api/connections');
      if (res.ok) {
        const data = await res.json();
        this._connectionCount = typeof data.count === 'number' ? data.count : 1;
      }
    } catch {
      /* server unavailable — keep current count */
    }
  }

  protected firstUpdated(): void {
    const prefs = loadPreferences();
    const scale = prefs.statusBarScale || 1;
    this.style.setProperty('--status-bar-scale', String(scale));
  }

  private _refreshStats(): void {
    const w = window as unknown as Record<string, unknown>;
    const pdata = w.projectData as Record<string, unknown> | undefined;
    this._projectName = String(pdata?.name || 'Untitled');

    const children = (pdata?.children ?? []) as Array<Record<string, unknown>>;
    const scenesFolder = children.find((n) => n.name === 'Scenes');
    const sceneChildren = (scenesFolder?.children ?? []) as unknown[];
    this._sceneCount = sceneChildren.length;

    const frames = w.storyboardFrames as unknown[] | undefined;
    this._takeCount = frames?.length ?? 0;
  }

  render() {
    return html`
      <div class="status-item" id="server-keys-status-item">

      </div>
      <div class="status-item">
        <i class="fa-solid fa-circle" style="color: #5fcf5f; font-size: 10px;"></i>
        <span>AI Ready</span>
      </div>

      <cinegen-model-status-bar></cinegen-model-status-bar>

      <div class="status-item">
        <span id="project-name">Project: ${this._projectName}</span>
      </div>
      <div class="status-item">
        <span>Scenes: ${this._sceneCount} • Takes rendered: ${this._takeCount}</span>
      </div>
      <div class="status-item" id="save-status-item" title="Autosave status for server-resident projects">
        <span id="save-status-badge" class="save-status-badge save-status-idle"></span>
      </div>
      <div class="flex-1"></div>
      <div class="status-item">
        <span id="current-view-label">${this._viewLabel}</span>
      </div>
      <div class="status-item">
        <span class="text-emerald-400">CineGen v0.2</span>
      </div>
      <div class="status-item" title="Open CineGen tabs / connections">
        <i class="fa-solid fa-users" style="font-size: 10px; margin-right: 4px; opacity: 0.7;"></i>
        <span>${this._connectionCount}</span>
      </div>
    `;
  }
}
