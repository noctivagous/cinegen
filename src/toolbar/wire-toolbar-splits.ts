import {
  openSetupAssistantForDebug,
  importScript,
  openAiAssistModal,
  openGuide,
  openProjectsModal,
  openSettingsModal,
  saveProject,
} from '@/toolbar/toolbar-modals-service';

const MAIN_ACTIONS: Record<string, () => void> = {
  'projects-split': openProjectsModal,
  'settings-split': openSettingsModal,
  'guide-split': () => openGuide('overview'),
  'save-export-split': saveProject,
  'import-split': importScript,
  'ai-assist-split': openAiAssistModal,
  'debug-split': openSetupAssistantForDebug,
};

export function wireToolbarSplitMainActions(): void {
  document.querySelectorAll('cg-toolbar-split').forEach((el) => {
    const id = el.id;
    if (!id || !MAIN_ACTIONS[id]) return;
    el.addEventListener('cg-main-action', () => {
      MAIN_ACTIONS[id]();
    });
  });

  const scriptIo = document.getElementById('script-import-export-split');
  scriptIo?.addEventListener('cg-main-action', () => {
    window.saveFountainFile?.();
  });
}
