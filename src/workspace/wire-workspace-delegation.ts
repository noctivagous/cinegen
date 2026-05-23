import type { CinegenAssetsPanel } from '@/components/panels/cinegen-assets-panel';
import type { CinegenWorkspace } from '@/components/panels/cinegen-workspace';
import type { OverviewViewMode } from '@/workspace/workspace-panel-bridge';

/**
 * Event delegation for workspace views (dynamic HTML + overview/scene panels).
 */
function parseIdxPair(raw: string | undefined): [number, number] | null {
  if (!raw) return null;
  const [a, b] = raw.split(':').map((n) => parseInt(n, 10));
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return [a, b];
}

function callGlobal(name: string, ...args: unknown[]): void {
  const fn = (window as unknown as Record<string, (...a: unknown[]) => void>)[name];
  if (typeof fn === 'function') fn(...args);
}

/** Ignore empty `data-ws-ov-*` attributes (Lit may emit `=""` on inactive handlers). */
function parseOverviewIdx(
  el: HTMLElement | null,
  datasetKey: 'wsOvActivate' | 'wsOvSelect'
): number | null {
  if (!el) return null;
  const raw = el.dataset[datasetKey];
  if (raw === undefined || raw === '') return null;
  const idx = parseInt(raw, 10);
  return Number.isNaN(idx) ? null : idx;
}

export function wireWorkspaceDelegation(): void {
  const root = document.getElementById('main-workspace-container');
  if (!root || root.dataset.wsDelegation === '1') return;
  root.dataset.wsDelegation = '1';

  root.addEventListener('click', (e) => {
    const el = e.target as HTMLElement;

    const sceneTab = el.closest('[data-ws-scene-tab]') as HTMLElement | null;
    if (sceneTab) {
      const tab = parseInt(sceneTab.dataset.wsSceneTab || '0', 10);
      if (!Number.isNaN(tab)) {
        const workspace = document.querySelector<CinegenWorkspace>('cinegen-workspace');
        if (workspace) workspace.switchSceneTab(tab);
        else callGlobal('switchSceneTab', tab);
      }
      return;
    }

    const assetTab = el.closest('[data-ws-asset-tab]') as HTMLElement | null;
    if (assetTab) {
      const tab = parseInt(assetTab.dataset.wsAssetTab || '0', 10);
      if (!Number.isNaN(tab)) {
        const assetsPanel = document.querySelector<CinegenAssetsPanel>('cinegen-assets-panel');
        if (assetsPanel) assetsPanel.switchTab(tab);
        else callGlobal('switchAssetTab', tab);
      }
      return;
    }

    const ovMode = el.closest('[data-ws-ov-mode]') as HTMLElement | null;
    if (ovMode?.dataset.wsOvMode) {
      const mode = ovMode.dataset.wsOvMode as OverviewViewMode;
      if (['column', 'row', 'master'].includes(mode)) {
        callGlobal('setOverviewViewMode', mode);
      }
      return;
    }

    const ovActivate = el.closest('[data-ws-ov-activate]') as HTMLElement | null;
    const activateIdx = parseOverviewIdx(ovActivate, 'wsOvActivate');
    if (activateIdx !== null) {
      callGlobal('activateOverviewCard', activateIdx);
      return;
    }

    const ovSelect = el.closest('[data-ws-ov-select]') as HTMLElement | null;
    const selectIdx = parseOverviewIdx(ovSelect, 'wsOvSelect');
    if (selectIdx !== null) {
      callGlobal('selectOverviewCard', selectIdx);
      return;
    }

    const toggleWrap = el.closest('[data-ws-ov-toggle-wrap]') as HTMLElement | null;
    if (toggleWrap) {
      e.stopPropagation();
      callGlobal('toggleOvColItem', toggleWrap.parentElement);
      return;
    }

    const goto = el.closest('[data-ws-goto-asset]') as HTMLElement | null;
    if (goto) {
      e.stopPropagation();
      const pair = parseIdxPair(goto.dataset.wsGotoAsset);
      if (pair) callGlobal('gotoAssetItem', pair[0], pair[1]);
      return;
    }

    const assetIdx = el.closest('[data-ws-asset-idx]') as HTMLElement | null;
    if (assetIdx) {
      const idx = parseInt(assetIdx.dataset.wsAssetIdx || '', 10);
      if (!Number.isNaN(idx)) callGlobal('selectAssetItem', idx);
      return;
    }

    const deleteAsset = el.closest('[data-ws-delete-asset]') as HTMLElement | null;
    if (deleteAsset) {
      const idx = parseInt(deleteAsset.dataset.wsDeleteAsset || '', 10);
      if (!Number.isNaN(idx)) callGlobal('deleteAssetItem', idx);
      return;
    }

    const continuity = el.closest('[data-ws-continuity-key]') as HTMLElement | null;
    if (continuity?.dataset.wsContinuityKey) {
      callGlobal('addContinuityRow', continuity.dataset.wsContinuityKey);
      return;
    }

    const removeEntity = el.closest('[data-ws-remove-entity]') as HTMLElement | null;
    if (removeEntity?.dataset.wsRemoveEntity) {
      const [type, enc] = removeEntity.dataset.wsRemoveEntity.split(':');
      if (type && enc) callGlobal('removeEntityFromScriptInfo', type, decodeURIComponent(enc));
      return;
    }

    const addEntity = el.closest('[data-ws-add-entity]') as HTMLElement | null;
    if (addEntity?.dataset.wsAddEntity) {
      callGlobal('addEntityFromScriptInfo', addEntity.dataset.wsAddEntity);
      return;
    }

    const action = el.closest('[data-ws-action]') as HTMLElement | null;
    if (action?.dataset.wsAction) {
      callGlobal(action.dataset.wsAction);
      return;
    }

    const inspect = el.closest('[data-ws-inspect-shot]') as HTMLElement | null;
    if (inspect) {
      const id = parseInt(inspect.dataset.wsInspectShot || '', 10);
      if (!Number.isNaN(id)) callGlobal('inspectShot', id);
    }
  });

  root.addEventListener(
    'mouseenter',
    (e) => {
      const el = (e.target as HTMLElement).closest('[data-ws-ov-preview]') as HTMLElement | null;
      if (!el) return;
      const pair = parseIdxPair(el.dataset.wsOvPreview);
      if (pair) callGlobal('showOvPreview', el, pair[0], pair[1]);
    },
    true
  );

  root.addEventListener(
    'mouseleave',
    (e) => {
      const related = e.relatedTarget as HTMLElement | null;
      if (related?.closest('[data-ws-ov-preview]') || related?.closest('#ov-col-preview')) return;
      const el = (e.target as HTMLElement).closest('[data-ws-ov-preview], [data-ws-ov-preview-hide]');
      if (el) callGlobal('hideOvPreview');
    },
    true
  );

  root.addEventListener('change', (e) => {
    const input = e.target as HTMLElement;
    if (input.matches('[data-ws-ov-hover-preview]')) {
      callGlobal('setOvHoverPreview', (input as HTMLInputElement).checked);
    }
  });

  root.addEventListener('input', (e) => {
    const input = e.target as HTMLElement;
    if (input.matches('[data-treatment-field]')) {
      callGlobal('syncTreatmentFromForm');
    }
    if (input.matches('[id^="asset-form-"]') && input.id) {
      const key = input.id.replace('asset-form-', '');
      if (key && key !== 'tags-chips') {
        callGlobal('_saveAssetItemField', key, (input as HTMLInputElement).value);
      }
    }
  });

  root.addEventListener('change', (e) => {
    const input = e.target as HTMLElement;
    if (input.matches('#asset-form-status')) {
      callGlobal('_saveAssetItemField', 'status', (input as HTMLSelectElement).value);
    }
  });
}
