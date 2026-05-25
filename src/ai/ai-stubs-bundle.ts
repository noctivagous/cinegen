import { workspaceState } from '@/workspace/workspace-state';
import { alertCG } from '@/utils/alert-cg';
import { nextShotNumber, reconcileShotFrameLinks } from '@/workspace/shot-frame-bridge';
import { requestProjectTreeRefresh } from '@/tree/project-tree-service';

/** AI generation stubs */

declare global {
  function triggerModelActivityBlink(mod: string): void;
  function openAiAssistModal(): void;
  function generateBoards(): void;
  function renderSceneDetail(): void;
  function switchSceneTab(tab: number): void;
  function syncDetectedScriptEntitiesToProject(opts?: { refreshGlobalAssets?: boolean }): { characters: string[]; locations: string[] };
  var currentSceneId: string | null;
  var currentSceneData: Record<string, { master: { status: string; duration: string }; coverage: unknown[]; broll: unknown[]; pickups: unknown[] }>;
}

export function globalAIAssist(): void {
  if (typeof triggerModelActivityBlink === 'function') triggerModelActivityBlink('llm');
  if (typeof openAiAssistModal === 'function') {
    openAiAssistModal();
    return;
  }

  const view = document.getElementById('current-view-label')?.textContent || '';
  if (view.includes('Scene')) {
    alertCG('AI analyzed entire project. Suggested 3 new pickups for continuity gaps and 1 B-Roll cutaway.');
    // simulate cross-view flow
    if (currentSceneId) {
      currentSceneData[currentSceneId].broll.push({ id: Date.now(), label: 'AI Suggested Cutaway', duration: '4s' });
      const detailEl = document.getElementById('view-scene-detail');
      if (detailEl && detailEl.classList.contains('hidden') === false) renderSceneDetail();
    }
  } else if (view.includes('Storyboard')) {
    generateBoards();
  } else {
    alertCG('Global AI flow activated. Hierarchy remains ordered while creative possibilities expand.');
  }
}

export function generateMasterShot(): void {
  if (typeof triggerModelActivityBlink === 'function') triggerModelActivityBlink('video');
  if (!currentSceneId) return;
  const scene = currentSceneData[currentSceneId];
  scene.master.status = 'rendered';
  scene.master.duration = '32s';
  alertCG('Master shot regenerated with perfect rain continuity.');
  renderSceneDetail();
}

export function regenerateMaster(): void {
  generateMasterShot();
}

export function regenerateShot(id: string | number): void {
  if (typeof triggerModelActivityBlink === 'function') triggerModelActivityBlink('video');
  alertCG(`Take ${id} regenerated with locked face reference.`);
}

export function addShotToCoverage(): void {
  if (!currentSceneId) return;
  const scene = currentSceneData[currentSceneId];
  const shotId = Date.now();
  scene.coverage.push({
    id: shotId,
    number: nextShotNumber(currentSceneId),
    type: 'New Angle',
    label: 'AI Suggested Dutch Tilt',
    duration: '5s',
    bestTake: false,
    frameIds: [],
  });
  reconcileShotFrameLinks(currentSceneId);
  requestProjectTreeRefresh();
  switchSceneTab(2);
  alertCG('New coverage angle added from AI understanding of script rhythm.');
}

export function lockContinuity(): void {
  alertCG('Continuity reference frame locked from master shot. All future generations will respect character appearance and wardrobe.');
}

export function addBroll(): void {
  if (!currentSceneId) return;
  const scene = currentSceneData[currentSceneId];
  scene.broll.push({ id: Date.now(), label: 'AI Generated Rain Reflection', duration: '4s' });
  switchSceneTab(3);
}

export function addPickup(): void {
  if (!currentSceneId) return;
  const scene = currentSceneData[currentSceneId];
  scene.pickups.push({ id: Date.now(), label: 'Fix continuity on wet coat', duration: '3s' });
  switchSceneTab(4);
}

export function parseScriptToAssets(): void {
  if (typeof triggerModelActivityBlink === 'function') triggerModelActivityBlink('llm');
  const entities = syncDetectedScriptEntitiesToProject({ refreshGlobalAssets: true });
  alertCG(`Script parsed. Detected ${entities.characters.length} characters and ${entities.locations.length} locations.`);
}

export function installAiStubsBundleGlobals(): void {
  const w = window as unknown as Record<string, unknown>;
  w.globalAIAssist = globalAIAssist;
  w.generateMasterShot = generateMasterShot;
  w.regenerateMaster = regenerateMaster;
  w.regenerateShot = regenerateShot;
  w.addShotToCoverage = addShotToCoverage;
  w.lockContinuity = lockContinuity;
  w.addBroll = addBroll;
  w.addPickup = addPickup;
  w.parseScriptToAssets = parseScriptToAssets;
}
