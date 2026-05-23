import { nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';
import { workspaceState } from '@/workspace/workspace-state';

/** Floating overview column hover preview; content is set by `workspace-bundle`. */
@customElement('cinegen-overview-preview')
export class CinegenOverviewPreview extends CgLightElement {
  connectedCallback(): void {
    super.connectedCallback();
    this.id = 'ov-col-preview';
    this.hidden = true;
    this.setAttribute('aria-live', 'polite');
    this.addEventListener('mouseenter', this._onMouseEnter);
    this.addEventListener('mouseleave', this._onMouseLeave);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener('mouseenter', this._onMouseEnter);
    this.removeEventListener('mouseleave', this._onMouseLeave);
  }

  private _onMouseEnter = (): void => {
    if (workspaceState.ovPreviewHideTimer) {
      clearTimeout(workspaceState.ovPreviewHideTimer);
      workspaceState.ovPreviewHideTimer = null;
    }
  };

  private _onMouseLeave = (): void => {
    window.hideOvPreview?.();
  };

  protected shouldUpdate(): boolean {
    return false;
  }

  render() {
    return nothing;
  }
}
