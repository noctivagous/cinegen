/** Wire static workspace toolbar buttons (replaces onclick in index.html). */
const WORKSPACE_ACTIONS: Record<string, string> = {
  'sync-script-storyboard': 'syncScriptToStoryboard',
  'generate-boards': 'generateBoards',
  'parse-script-assets': 'parseScriptToAssets',
  'refresh-script-info': 'refreshScriptInfoFromScript',
  'apply-treatment-script': 'applyTreatmentToScriptGeneration',
  'make-storyboard-frame-text': 'makeStoryboardFrameForText',
  'add-storyboard-frame': 'addStoryboardFrame',
  'link-frame-script': 'linkSelectedFrameToScript',
  'delete-selected-frame': 'deleteSelectedFrame',
  'auto-suggest-breakdown': 'autoSuggestBreakdown',
  'export-breakdown': 'exportBreakdown',
  'generate-master-shot': 'generateMasterShot',
  'lock-continuity': 'lockContinuity',
  'add-shot-coverage': 'addShotToCoverage',
  'auto-assemble-timeline': 'autoAssembleTimeline',
  'togglePrevisTimelineDock': 'togglePrevisTimelineDock',
  'export-timeline': 'exportTimeline',
  'generate-location': 'generateLocation',
  'build-camera-prompt': 'buildCameraPrompt',
  'clear-camera-selections': 'clearCameraSelections',
  'global-ai-assist': 'globalAIAssist',
  'openSectionSettings': 'openSectionSettingsModal',
  'duplicateSelectedFrame': 'duplicateSelectedFrame',
  'moveSelectedFrameUp': 'moveSelectedFrameUp',
  'moveSelectedFrameDown': 'moveSelectedFrameDown',
  'restoreLastDeletedFrame': 'restoreLastDeletedFrame',
  'generateStoryboardReferences': 'generateStoryboardReferences',
  'regenerateReferenceSlot': 'regenerateReferenceSlot',
  'lockReferenceSlot': 'lockReferenceSlot',
  'unlockReferenceSlot': 'unlockReferenceSlot',
};

export function wireWorkspaceStaticActions(): void {
  document.querySelectorAll<HTMLElement>('[data-ws-action]').forEach((el) => {
    if (el.dataset.wsBound === '1') return;
    const key = el.dataset.wsAction;
    if (!key) return;
    const fnName = WORKSPACE_ACTIONS[key] || key;
    el.dataset.wsBound = '1';
    el.addEventListener('click', () => {
      const fn = (window as unknown as Record<string, () => void>)[fnName];
      if (typeof fn === 'function') fn();
    });
  });

}
