import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';
import { getPrevisTimelineShortcutChip } from '@/keybindings/previs-keybindings';

/** Main application toolbar (projects, settings, layout toggles). */
@customElement('cinegen-toolbar')
export class CinegenToolbar extends CgLightElement {
  connectedCallback(): void {
    super.connectedCallback();
    this.classList.add('bevel-raised');
    this.style.padding = '4px';
  }

  render() {
    return html`
      <div class="flex items-center gap-1">
        <div id="setup-status-item" hidden>
          <button
            type="button"
            id="setup-status-badge"
            class="toolbar-btn toolbar-btn--setup-incomplete toolbar-btn--shape-soft"
            title="Complete app setup — opens Setup Assistant"
          >
            <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> Complete App
            Setup...
          </button>
        </div>
        <cg-toolbar-split
          id="projects-split"
          menu-id="projects-menu"
          main-title="Open projects hub"
        >
          <span slot="main"><i class="fa-solid fa-folder-open"></i> Projects</span>
        </cg-toolbar-split>
        <cg-toolbar-split
          id="settings-split"
          menu-id="settings-menu"
          menu-wide
          main-title="Open settings hub"
        >
          <span slot="main"><i class="fa-solid fa-gear"></i> Settings</span>
          <div slot="menu">
            <button
              type="button"
              class="toolbar-split-menu-item"
              role="menuitem"
              data-settings-action="project-settings"
            >
              Project Settings…
            </button>
            <button
              type="button"
              class="toolbar-split-menu-item"
              role="menuitem"
              data-settings-action="preferences"
            >
              Preferences…
            </button>
            <div class="toolbar-split-menu-sep" role="separator" aria-hidden="true"></div>
            <button
              type="button"
              class="toolbar-split-menu-item"
              role="menuitem"
              data-settings-action="app-setup-assistant"
            >
              App Setup Assistant…
            </button>
            <button
              type="button"
              class="toolbar-split-menu-item"
              role="menuitem"
              data-settings-action="ai-providers"
            >
              AI Settings (keys &amp; models)…
            </button>
            <button
              type="button"
              class="toolbar-split-menu-item"
              role="menuitem"
              data-settings-action="generation-defaults"
            >
              Generation Defaults…
            </button>
            <button
              type="button"
              class="toolbar-split-menu-item"
              role="menuitem"
              data-settings-action="compute"
            >
              Compute &amp; GPU Resources…
            </button>
          </div>
        </cg-toolbar-split>
        <cg-toolbar-split
          id="guide-split"
          menu-id="guide-menu"
          menu-wide
          main-title="Guide sections"
        >
          <span slot="main"><i class="fa-solid fa-book-open"></i> Guide</span>
          <div slot="menu">
            <button
              type="button"
              class="toolbar-split-menu-item guide-menu-item"
              role="menuitem"
              data-guide-section="overview"
              data-guide-theme="accent"
            >
              Overview — Pipeline &amp; CineGen
            </button>
            <button
              type="button"
              class="toolbar-split-menu-item guide-menu-item"
              role="menuitem"
              data-guide-section="getting-started"
              data-guide-theme="global"
            >
              Getting Started — Project &amp; Hierarchy
            </button>
            <button
              type="button"
              class="toolbar-split-menu-item guide-menu-item"
              role="menuitem"
              data-guide-section="preprod"
              data-guide-theme="preprod"
            >
              Pre-Production — Script &amp; Breakdown
            </button>
            <button
              type="button"
              class="toolbar-split-menu-item guide-menu-item"
              role="menuitem"
              data-guide-section="storyboard"
              data-guide-theme="preprod"
            >
              Storyboards — Visual Planning
            </button>
            <button
              type="button"
              class="toolbar-split-menu-item guide-menu-item"
              role="menuitem"
              data-guide-section="scenes"
              data-guide-theme="scenes"
            >
              Scenes, Coverage &amp; Takes
            </button>
            <button
              type="button"
              class="toolbar-split-menu-item guide-menu-item"
              role="menuitem"
              data-guide-section="design"
              data-guide-theme="design"
            >
              Production Design &amp; Assets
            </button>
            <button
              type="button"
              class="toolbar-split-menu-item guide-menu-item"
              role="menuitem"
              data-guide-section="sound"
              data-guide-theme="sound"
            >
              Sound Department
            </button>
            <button
              type="button"
              class="toolbar-split-menu-item guide-menu-item"
              role="menuitem"
              data-guide-section="assembly"
              data-guide-theme="assembly"
            >
              Assembly &amp; Timeline
            </button>
            <button
              type="button"
              class="toolbar-split-menu-item guide-menu-item"
              role="menuitem"
              data-guide-section="vocabulary"
              data-guide-theme="global"
            >
              Traditional Vocabulary
            </button>
          </div>
        </cg-toolbar-split>
        <cg-toolbar-split id="save-export-split" menu-id="save-export-menu" main-title="Save project">
          <span slot="main"><i class="fa-solid fa-floppy-disk"></i> Save</span>
          <div slot="menu">
            <button type="button" class="toolbar-split-menu-item" role="menuitem" data-export-action="screenplay">
              Export Screenplay…
            </button>
            <button type="button" class="toolbar-split-menu-item" role="menuitem" data-export-action="pdf">
              Export PDF…
            </button>
            <button
              type="button"
              class="toolbar-split-menu-item"
              role="menuitem"
              data-ws-action="exportBreakdown"
            >
              Export Breakdown Sheet
            </button>
            <button
              type="button"
              class="toolbar-split-menu-item"
              role="menuitem"
              data-ws-action="exportTimeline"
            >
              Export EDL
            </button>
          </div>
        </cg-toolbar-split>
        <cg-toolbar-split id="import-split" menu-id="import-menu" main-title="Import script">
          <span slot="main"><i class="fa-solid fa-file-import"></i> Import</span>
          <div slot="menu">
            <button type="button" class="toolbar-split-menu-item" role="menuitem" data-import-action="script">
              Import Script
            </button>
          </div>
        </cg-toolbar-split>
        <cg-toolbar-split
          id="wizards-split"
          menu-id="wizards-menu"
          menu-wide
          variant="btn-ai"
          main-title="Wizards — guided project setup"
        >
          <span slot="main"><i class="fa-solid fa-wand-magic-sparkles"></i> Wizards</span>
          <div slot="menu"></div>
        </cg-toolbar-split>
        <cg-toolbar-split
          id="ai-assist-split"
          menu-id="ai-assist-menu"
          menu-wide
          variant="btn-ai"
          main-title="AI Assist"
        >
          <span slot="main"><i class="fa-solid fa-wand-magic-sparkles"></i> AI Assist</span>
        </cg-toolbar-split>

        <div class="flex-1"></div>
        <cg-toolbar-split
          id="debug-split"
          menu-id="debug-menu"
          main-title="Open App Setup Assistant"
        >
          <span slot="main"><i class="fa-solid fa-bug"></i> Debug</span>
          <div slot="menu">
            <button
              type="button"
              class="toolbar-split-menu-item"
              role="menuitem"
              data-debug-action="open-setup-assistant"
            >
              Open App Setup Assistant…
            </button>
            <button
              type="button"
              class="toolbar-split-menu-item"
              role="menuitem"
              data-debug-action="open-debug-generation"
            >
              <i class="fa-solid fa-wand-magic-sparkles" style="margin-right:6px"></i> AI Generation Debug…
            </button>
            <button
              type="button"
              class="toolbar-split-menu-item"
              role="menuitem"
              data-debug-action="reset-setup-assistant"
            >
              Reset Setup Assistant Progress
            </button>
            <button
              type="button"
              class="toolbar-split-menu-item"
              role="menuitem"
              data-debug-action="reset-app-settings"
            >
              Reset App Settings
            </button>
            <div class="toolbar-split-menu-sep" role="separator" aria-hidden="true"></div>
            <button
              type="button"
              class="toolbar-split-menu-item"
              role="menuitem"
              data-debug-action="clear-provider-cache"
            >
              Clear Provider Model Cache
            </button>
            <div class="toolbar-split-menu-sep" role="separator" aria-hidden="true"></div>
            <button
              type="button"
              class="toolbar-split-menu-item"
              role="menuitem"
              data-debug-action="open-ai-provider-info"
            >
              <i class="fa-solid fa-database" style="margin-right:6px"></i> All AI Provider Information…
            </button>
            <button
              type="button"
              class="toolbar-split-menu-item"
              role="menuitem"
              data-debug-action="log-settings-storage"
            >
              Log Stored Settings to Console
            </button>
            <button
              type="button"
              class="toolbar-split-menu-item"
              role="menuitem"
              data-debug-action="reload-app"
            >
              Reload App
            </button>
          </div>
        </cg-toolbar-split>
        <button
          type="button"
          id="previs-timeline-toggle-btn"
          class="toolbar-btn"
          title=${`Expand or collapse Previs timeline drawer (${getPrevisTimelineShortcutChip()})`}
          aria-pressed="false"
        >
          <i class="fa-solid fa-wave-square"></i> Previs
        </button>
        <button
          type="button"
          id="project-sidebar-toggle-btn"
          class="toolbar-btn active"
          title="Show or hide project sidebar"
          aria-pressed="true"
        >
          <i class="fa-solid fa-sitemap"></i> Project
        </button>
        <button
          type="button"
          id="inspector-toggle-btn"
          class="toolbar-btn active"
          title="Show or hide inspector"
          aria-pressed="true"
        >
          <i class="fa-solid fa-info-circle"></i> Inspector
        </button>
      </div>
    `;
  }
}
