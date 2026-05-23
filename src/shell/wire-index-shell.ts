import { toggleProjectSidebar } from '@/components/layout/cinegen-app';
import { toggleInspectorPanel } from '@/components/panels/cinegen-inspector';

function callGlobal(name: string, ...args: unknown[]): void {
  const fn = (window as unknown as Record<string, (...a: unknown[]) => void>)[name];
  if (typeof fn === 'function') fn(...args);
}

/** Layout chrome toggles and inspector panel close (replaces onclick in index.html). */
export function wireIndexShellControls(): void {
  const sidebarToggle = document.getElementById('project-sidebar-toggle-btn');
  if (sidebarToggle && sidebarToggle.dataset.cgBound !== '1') {
    sidebarToggle.dataset.cgBound = '1';
    sidebarToggle.addEventListener('click', () => toggleProjectSidebar());
  }

  const inspectorToggle = document.getElementById('inspector-toggle-btn');
  if (inspectorToggle && inspectorToggle.dataset.cgBound !== '1') {
    inspectorToggle.dataset.cgBound = '1';
    inspectorToggle.addEventListener('click', () => toggleInspectorPanel());
  }

  const inspectorClose = document.getElementById('inspector-panel-close-btn');
  if (inspectorClose && inspectorClose.dataset.cgBound !== '1') {
    inspectorClose.dataset.cgBound = '1';
    inspectorClose.addEventListener('click', () => toggleInspectorPanel());
  }
}

/** Fountain insert toolbar/menu + script file inputs (legacy globals from gui-Fountain.js). */
export function wireScriptEditorShell(): void {
  const scriptPane = document.getElementById('script-pane-script');
  if (scriptPane && scriptPane.dataset.cgFountainBound !== '1') {
    scriptPane.dataset.cgFountainBound = '1';
    scriptPane.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-fountain-snippet]');
      if (!btn?.dataset.fountainSnippet) return;
      callGlobal('insertFountainSnippet', btn.dataset.fountainSnippet);
    });
  }

  const fdxInput = document.getElementById('fdx-file-input');
  if (fdxInput && fdxInput.dataset.cgBound !== '1') {
    fdxInput.dataset.cgBound = '1';
    fdxInput.addEventListener('change', (e) => callGlobal('handleFDXImport', e));
  }

  const fountainInput = document.getElementById('fountain-file-input');
  if (fountainInput && fountainInput.dataset.cgBound !== '1') {
    fountainInput.dataset.cgBound = '1';
    fountainInput.addEventListener('change', (e) => callGlobal('handleFountainImport', e));
  }

  for (const id of ['project-settings-form', 'ai-providers-form'] as const) {
    const form = document.getElementById(id);
    if (!form || form.dataset.cgBound === '1') continue;
    form.dataset.cgBound = '1';
    form.addEventListener('submit', (e) => e.preventDefault());
  }
}
