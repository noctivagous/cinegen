import type { ReactiveController, ReactiveControllerHost } from 'lit';
import {
  clamp,
  getPanelWidthPx,
  getWorkspaceRowRect,
  LAYOUT_DIVIDER_WIDTH_PX,
  LAYOUT_LIMITS,
} from '@/services/layout-metrics';
import {
  setInspectorWidthPx,
  setPreprodSplitPercent,
  setSidebarWidthPx,
} from '@/services/layout-service';

export type LayoutResizeTarget = 'sidebar' | 'inspector' | 'preprod';

/** Pointer-driven resize for a single `cg-split-divider` (Lit reactive controller). */
export class LayoutResizeController implements ReactiveController {
  private readonly host: ReactiveControllerHost & HTMLElement;
  private readonly target: LayoutResizeTarget;
  private _dragging = false;

  constructor(host: ReactiveControllerHost & HTMLElement, target: LayoutResizeTarget) {
    this.host = host;
    this.target = target;
    host.addController(this);
  }

  hostConnected(): void {
    this.host.addEventListener('mousedown', this._onMouseDown);
  }

  hostDisconnected(): void {
    this.host.removeEventListener('mousedown', this._onMouseDown);
    this._endDrag();
  }

  private _canStart(): boolean {
    if (this.target === 'preprod') {
      return document.getElementById('preprod-body')?.classList.contains('mode-both') ?? false;
    }
    if (this.target === 'sidebar') {
      const sidebar = document.getElementById('project-hierarchy-sidebar');
      return Boolean(sidebar && sidebar.style.display !== 'none');
    }
    const inspector = document.getElementById('inspector-panel');
    return Boolean(inspector && inspector.style.display !== 'none');
  }

  private _onMouseDown = (e: MouseEvent): void => {
    if (!this._canStart()) return;
    e.preventDefault();
    this._dragging = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('mouseup', this._onMouseUp, { once: true });
  };

  private _onMouseMove = (e: MouseEvent): void => {
    if (!this._dragging) return;

    if (this.target === 'preprod') {
      const preprodBody = document.getElementById('preprod-body');
      if (!preprodBody?.classList.contains('mode-both')) return;
      const rect = preprodBody.getBoundingClientRect();
      const percent = ((e.clientX - rect.left) / rect.width) * 100;
      setPreprodSplitPercent(percent, true);
      return;
    }

    const rowRect = getWorkspaceRowRect();
    if (!rowRect) return;

    const sidebarWidth = getPanelWidthPx(document.getElementById('project-hierarchy-sidebar'));
    const inspectorWidth = getPanelWidthPx(document.getElementById('inspector-panel'));

    if (this.target === 'sidebar') {
      const desiredSidebarWidth = e.clientX - rowRect.left;
      const maxSidebarWidth = Math.max(
        LAYOUT_LIMITS.minSidebarPx,
        rowRect.width -
          LAYOUT_LIMITS.minMainWorkspacePx -
          inspectorWidth -
          LAYOUT_DIVIDER_WIDTH_PX * 2
      );
      setSidebarWidthPx(
        clamp(desiredSidebarWidth, LAYOUT_LIMITS.minSidebarPx, maxSidebarWidth),
        true
      );
      return;
    }

    const desiredInspectorWidth = rowRect.right - e.clientX;
    const maxInspectorWidth = Math.max(
      LAYOUT_LIMITS.minInspectorPx,
      rowRect.width -
        LAYOUT_LIMITS.minMainWorkspacePx -
        sidebarWidth -
        LAYOUT_DIVIDER_WIDTH_PX * 2
    );
    setInspectorWidthPx(
      clamp(desiredInspectorWidth, LAYOUT_LIMITS.minInspectorPx, maxInspectorWidth),
      true
    );
  };

  private _onMouseUp = (): void => {
    this._endDrag();
  };

  private _endDrag(): void {
    if (!this._dragging) return;
    this._dragging = false;
    document.removeEventListener('mousemove', this._onMouseMove);
    document.body.style.cursor = 'default';
    document.body.style.userSelect = '';
  }
}
