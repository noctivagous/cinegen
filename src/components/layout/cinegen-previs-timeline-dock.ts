import { html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';
import '@/components/primitives/cg-split-divider';
import {
  clearPrevisFullscreenPaneLayout,
  preparePrevisFullscreenLayout,
  syncPrevisDrawerHeightFromPreferences,
  syncPrevisDrawerHeightToAccordion,
  syncPrevisFullscreenPaneLayout,
} from '@/services/layout-service';

@customElement('cinegen-previs-timeline-dock')
export class CinegenPrevisTimelineDock extends CgLightElement {
  @state() private _expanded = false;
  @state() private _fullscreen = false;
  @state() private _playbackSectionOpen = false;
  @state() private _timelineSectionOpen = true;
  @state() private _playbackTab: 'storyboard' | 'rendered' = 'storyboard';

  connectedCallback(): void {
    super.connectedCallback();
    this.id = 'previs-timeline-dock';
    this.classList.add('previs-timeline-dock');
    this._syncFromDom();
    window.addEventListener('previs-timeline-dock-toggle', this._onToggle);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('previs-timeline-dock-toggle', this._onToggle);
  }

  firstUpdated(): void {
    syncPrevisDrawerHeightFromPreferences();
  }

  private _onToggle = (event: Event): void => {
    const detail = (event as CustomEvent<{ expanded?: boolean }>).detail;
    if (typeof detail?.expanded === 'boolean') {
      this._expanded = detail.expanded;
    } else {
      this._expanded = !this._expanded;
    }
    if (!this._expanded) {
      this._exitFullscreen();
    }
    this.classList.toggle('previs-timeline-dock--expanded', this._expanded);
    if (this._expanded) {
      syncPrevisDrawerHeightFromPreferences();
    }
    this.requestUpdate();
  };

  private _exitFullscreen(): void {
    if (!this._fullscreen) return;
    this._fullscreen = false;
    clearPrevisFullscreenPaneLayout();
    syncPrevisDrawerHeightFromPreferences();
    syncPrevisDrawerHeightToAccordion();
  }

  private _enterFullscreen(): void {
    if (!this._playbackSectionOpen && !this._timelineSectionOpen) {
      this._playbackSectionOpen = true;
      this._timelineSectionOpen = true;
    }
    this._fullscreen = true;
  }

  private _toggleFullscreen = (event: Event): void => {
    event.stopPropagation();
    if (this._fullscreen) {
      this._exitFullscreen();
      return;
    }
    if (!this._expanded) return;
    this._enterFullscreen();
  };

  protected override updated(changed: Map<PropertyKey, unknown>): void {
    super.updated(changed);
    this.classList.toggle('previs-timeline-dock--fullscreen', this._fullscreen);
    if (changed.has('_fullscreen') && this._fullscreen) {
      void this.updateComplete.then(() => {
        preparePrevisFullscreenLayout();
        syncPrevisFullscreenPaneLayout();
      });
    }
  }

  private _syncFromDom(): void {
    this._expanded = this.classList.contains('previs-timeline-dock--expanded');
    window.syncPrevisTimelineToggleButton?.(this._expanded);
  }

  private _onDockHeadClick = (event: Event): void => {
    const target = event.target as HTMLElement;
    if (target.closest('.previs-drawer-head-actions')) return;
    if (target.closest('.previs-dock-height-divider') || target.closest('cg-split-divider')) return;
    window.togglePrevisTimelineDock?.();
  };

  private _stopSummaryToggle = (event: Event): void => {
    event.stopPropagation();
  };

  private _onPlaybackSectionToggle = (event: Event): void => {
    this._playbackSectionOpen = (event.target as HTMLDetailsElement).open;
    this._afterSectionToggle();
  };

  private _onTimelineSectionToggle = (event: Event): void => {
    this._timelineSectionOpen = (event.target as HTMLDetailsElement).open;
    this._afterSectionToggle();
  };

  private _afterSectionToggle(): void {
    requestAnimationFrame(() => {
      if (this._fullscreen) {
        syncPrevisFullscreenPaneLayout();
      } else {
        syncPrevisDrawerHeightToAccordion();
      }
    });
  }

  render() {
    return html`
      <div
        class="previs-drawer-unit ${this._expanded ? 'is-open' : ''} ${this._fullscreen ? 'is-fullscreen' : ''}"
      >
        <div class="previs-timeline-dock-head panel-header" @click=${this._onDockHeadClick}>
          <cg-split-divider
            class="previs-dock-height-divider"
            resize-target="previs-drawer"
            split-axis="column"
            label="Resize previs timeline drawer"
          ></cg-split-divider>
          <div class="previs-dock-head-main">
            <span class="previs-dock-title"
              ><i class="fa-solid fa-wave-square"></i> PREVIS TIMELINE (Draft Timing)</span
            >
          </div>
          <div class="previs-drawer-head-actions">
            <button
              class="toolbar-btn"
              title=${this._fullscreen ? 'Exit fullscreen' : 'Fullscreen above status bar'}
              ?hidden=${!this._expanded}
              @click=${this._toggleFullscreen}
            >
              <i class=${this._fullscreen ? 'fa-solid fa-compress' : 'fa-solid fa-expand'}></i>
            </button>
            <button class="toolbar-btn" @click=${() => window.togglePrevisTimelineDock?.()}>
              <i class=${this._expanded ? 'fa-solid fa-chevron-down' : 'fa-solid fa-chevron-up'}></i>
            </button>
          </div>
        </div>
        <div
          id="previs-drawer-overlay"
          class="previs-drawer-overlay ${this._expanded ? 'is-open' : ''}"
        >
          <div id="previs-drawer-stack" class="previs-drawer-stack">
            <div class="cg-accordion previs-drawer-accordion">
              <details
                id="previs-playback-pane"
                class="cg-accordion-section previs-playback-pane"
                ?open=${this._playbackSectionOpen}
                @toggle=${this._onPlaybackSectionToggle}
              >
                <summary class="cg-accordion-header previs-accordion-header">
                  <span class="previs-accordion-title">Playback</span>
                  <span
                    class="previs-accordion-header-tools previs-playback-tabs"
                    @click=${this._stopSummaryToggle}
                  >
                    <button
                      type="button"
                      class="toolbar-btn ${this._playbackTab === 'rendered' ? 'active' : ''}"
                      @click=${() => {
                        this._playbackTab = 'rendered';
                      }}
                    >
                      Rendered
                    </button>
                    <button
                      type="button"
                      class="toolbar-btn ${this._playbackTab === 'storyboard' ? 'active' : ''}"
                      @click=${() => {
                        this._playbackTab = 'storyboard';
                      }}
                    >
                      Storyboard
                    </button>
                  </span>
                </summary>
                <div class="cg-accordion-body previs-playback-body">
                  <div ?hidden=${this._playbackTab !== 'storyboard'} class="previs-playback-panel">
                    <cinegen-storyboard-animatic-player noScrubber></cinegen-storyboard-animatic-player>
                  </div>
                  <div
                    ?hidden=${this._playbackTab !== 'rendered'}
                    class="previs-playback-panel previs-rendered-placeholder"
                  >
                    <div class="previs-rendered-placeholder-inner">
                      <i class="fa-solid fa-film"></i>
                      <span>Rendered player will appear here when preview renders are available.</span>
                    </div>
                  </div>
                </div>
              </details>
              <details
                id="previs-timeline-pane"
                class="cg-accordion-section previs-timeline-pane"
                ?open=${this._timelineSectionOpen}
                @toggle=${this._onTimelineSectionToggle}
              >
                <summary class="cg-accordion-header previs-accordion-header">
                  <span class="previs-accordion-title">Timeline (Draft Timing)</span>
                  <span
                    class="previs-accordion-header-tools previs-timeline-zoom-control"
                    @click=${this._stopSummaryToggle}
                  >
                    <i class="fa-solid fa-magnifying-glass-minus" style="font-size:9px;opacity:0.6;"></i>
                    <input
                      class="previs-timeline-zoom-slider"
                      type="range"
                      min="0.5"
                      max="3"
                      step="0.1"
                      value="1"
                      @input=${(e: Event) => {
                        const val = parseFloat((e.target as HTMLInputElement).value);
                        const timeline = this.querySelector('cinegen-timeline') as {
                          setZoom?: (z: number) => void;
                        };
                        timeline?.setZoom?.(val);
                      }}
                    />
                    <i class="fa-solid fa-magnifying-glass-plus" style="font-size:9px;opacity:0.6;"></i>
                  </span>
                </summary>
                <div class="cg-accordion-body previs-timeline-pane-body">
                  <div class="previs-timeline-scroll">
                    <cinegen-timeline data-mode="dock"></cinegen-timeline>
                  </div>
                </div>
              </details>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}
