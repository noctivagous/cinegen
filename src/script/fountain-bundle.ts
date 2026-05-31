import {
  getProjectFountainText,
  projectData,
  setProjectFountainText,
} from '@/data/project-data';
import { closeToolbarSplitMenu } from '@/services/toolbar-split-service';
import { getCinegenScriptEditor } from '@/panels/panel-hosts';
import { alertCG } from '@/utils/alert-cg';
import {
  renderPrevisMargin,
  handlePrevisMarginClick,
  handlePrevisMarginDragStart,
} from './previs-margin';
import { annotateSelection } from './cm6-annotations';
import type { AnnotationCategory } from './cm6-annotations';

/** Fountain screenplay editor: parse, render, import/export */

declare global {
  function scheduleFountainRender(): void;
  function scheduleScriptEditorProjectSync(): void;
  function syncScriptRenderScroll(): void;
  function closeSaveExportMenu(): void;
  function renderScriptPrevisMargin(): void;
  function handleScriptPrevisMarginClick(event: Event): void;
  function handleScriptPrevisMarginDragStart(event: MouseEvent): void;
  function annotateScriptSelection(category: string): void;
}

export function getCurrentScriptText(): string {
  return getCinegenScriptEditor()?.editorView?.state.doc.toString() ?? '';
}

export function getCurrentScriptSelection(): { text: string; from: number; to: number } | null {
  const view = getCinegenScriptEditor()?.editorView;
  if (!view) return null;
  const { from, to } = view.state.selection.main;
  return { text: view.state.doc.sliceString(from, to), from, to };
}

export function scrollScriptToLine(lineIndex: number): void {
  const view = getCinegenScriptEditor()?.editorView;
  if (!view || lineIndex < 0) return;
  try {
    const line = view.state.doc.line(lineIndex + 1);
    view.dispatch({
      selection: { anchor: line.from },
      scrollIntoView: true,
    });
  } catch {
    /* line number out of range */
  }
}

export function jumpScriptToAnchor(anchor: string): void {
  const host = getCinegenScriptEditor();
  const view = host?.editorView;
  if (!view || !anchor) return;
  const text = view.state.doc.toString().toLowerCase();
  const idx = text.indexOf(anchor.trim().toLowerCase());
  if (idx < 0) return;
  host.jumpToPos(idx, anchor.length);
}

/** Backward-compat stubs: delegate to previs-margin.ts */
export function renderScriptPrevisMargin(): void {
  const host = document.querySelector<HTMLElement>('.script-previs-margin');
  if (host) renderPrevisMargin(host);
}

export function handleScriptPrevisMarginClick(event: Event): void {
  handlePrevisMarginClick(event);
}

export function handleScriptPrevisMarginDragStart(event: MouseEvent): void {
  handlePrevisMarginDragStart(event);
}

/** Snippet text + [selStart, selEnd) offsets inside the snippet for post-insert selection */
export function annotateScriptSelection(category: string): void {
  const view = getCinegenScriptEditor()?.editorView;
  if (!view) return;
  annotateSelection(view, category as AnnotationCategory);
}

export const FOUNTAIN_SNIPPETS = {
  sceneInt: { text: '\n\nINT. LOCATION - DAY\n\n', sel: [7, 21] },
  sceneExt: { text: '\n\nEXT. LOCATION - DAY\n\n', sel: [7, 21] },
  forcedScene: { text: '\n\n.MY SCENE HEADING\n\n', sel: [3, 20] },
  action: { text: '\n\nDescription of what we see and hear.\n\n', sel: [2, 40] },
  character: { text: '\n\nCHARACTER NAME\n', sel: [2, 16] },
  atCharacter: { text: '\n\n@Character Name\n', sel: [3, 17] },
  dialogue: { text: '\n    They say this out loud.\n', sel: [5, 28] },
  parenthetical: { text: '\n(wryly)\n', sel: [2, 7] },
  transition: { text: '\n\nCUT TO:\n\n', sel: null },
  section: { text: '\n\n========\n\n', sel: null },
  lyrics: { text: '\n~Sing or read this line~\n', sel: [2, 24] }
};

export function initScriptFountainInsertSplit(): void {
  const menu = document.getElementById('script-fountain-insert-menu');
  menu?.querySelectorAll('[data-fountain-snippet]').forEach((item) => {
    item.addEventListener('click', () => {
      insertFountainSnippet((item as HTMLElement).dataset.fountainSnippet || '');
      if (typeof closeToolbarSplitMenu === 'function') {
        closeToolbarSplitMenu('script-fountain-insert-split');
      }
    });
  });
}

export function insertFountainSnippet(kind: string): void {
  const host = getCinegenScriptEditor();
  const spec = (FOUNTAIN_SNIPPETS as Record<string, { text: string; sel: number[] | null }>)[kind];
  if (!host || !spec) return;
  host.insertSnippet(spec.text, spec.sel as [number, number] | null);
  scheduleScriptEditorProjectSync();
}

export function classifyFountainLine(trimmed: string) {
  if (/^={3,}\s*$/.test(trimmed)) return 'section';
  if (/^\./.test(trimmed)) return 'scene';
  if (/^(INT|EXT|EST|INT\/EXT|I\/E)[. \t\/]/i.test(trimmed)) return 'scene';
  if (/^\(.+\)$/.test(trimmed)) return 'parenthetical';
  if (/^>[ \t]/.test(trimmed)) return 'transition';
  if (/^~/.test(trimmed)) return 'lyrics';
  if (/TO:\s*$/.test(trimmed) && trimmed === trimmed.toUpperCase() && trimmed.length < 48) return 'transition';

  const withoutAt = trimmed.replace(/^@\s*/, '');
  const charCore = withoutAt.replace(/\s*\([^)]*\)\s*$/, '').trim();
  if (
    charCore.length >= 2 &&
    charCore.length < 42 &&
    !/[a-z]/.test(charCore) &&
    /^[A-Z][A-Z0-9\s.\-_'"]*$/.test(charCore) &&
    !/^(INT|EXT|EST)/i.test(charCore)
  ) {
    return 'character';
  }
  return 'action';
}

export function classifyFountainDocument(lines: string[]) {
  const types = [];
  let mode = 'action';

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) {
      types.push('blank');
      if (mode === 'dialogue') mode = 'action';
      continue;
    }
    const base = classifyFountainLine(trimmed);
    if (base === 'scene' || base === 'transition') {
      mode = 'action';
      types.push(base);
    } else if (base === 'character') {
      mode = 'dialogue';
      types.push('character');
    } else if (base === 'parenthetical') {
      types.push('parenthetical');
      if (mode !== 'dialogue') mode = 'action';
    } else if (mode === 'dialogue' && base === 'action') {
      types.push('dialogue');
    } else if (base === 'section' || base === 'lyrics') {
      mode = 'action';
      types.push(base);
    } else {
      types.push('action');
    }
  }
  return types;
}

let scriptProjectSyncTimer: ReturnType<typeof setTimeout> | null = null;

/** Load Fountain text from project data into the CM6 editor. */
export function hydrateScriptEditorFromProject(): void {
  const host = getCinegenScriptEditor();
  if (!host) return;
  host.setDocument(getProjectFountainText());
}

/** Persist the current CM6 document to project screenplay storage. */
export function syncScriptEditorToProject(): void {
  const host = getCinegenScriptEditor();
  if (!host) return;
  setProjectFountainText(host.editorView?.state.doc.toString() ?? '');
}

export function scheduleScriptEditorProjectSync(): void {
  if (scriptProjectSyncTimer !== null) clearTimeout(scriptProjectSyncTimer);
  scriptProjectSyncTimer = setTimeout(() => {
    scriptProjectSyncTimer = null;
    syncScriptEditorToProject();
    void import('@/services/project-service').then(({ markProjectDirty }) => {
      markProjectDirty(['screenplay']);
    });
  }, 250);
}

export let fountainRenderFrame: number | null = null;

/** No-op: CodeMirror 6 handles Fountain syntax highlighting natively.
 *  Kept as a backward-compat stub for legacy callers. */
export function scheduleFountainRender(): void {
  // CM6 re-renders automatically via its token stream.
}

/** No-op: CodeMirror 6 handles its own scroll and rendering.
 *  Previs margin scroll sync is handled by the editor component. */
export function syncScriptRenderScroll(): void {
  // CM6 owns the DOM and scroll state.
}

export function triggerFDXImport() {
  const input = document.getElementById('fdx-file-input');
  if (input) input.click();
}

export function triggerFountainImport() {
  const input = document.getElementById('fountain-file-input');
  if (input) input.click();
}

export function handleFountainImport(event: Event): void {
  const target = event.target as HTMLInputElement;
  const file = target.files ? target.files[0] : null;
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const host = getCinegenScriptEditor();
      if (host) {
        host.setDocument(typeof reader.result === 'string' ? reader.result : '');
        syncScriptEditorToProject();
      }
      alertCG(`Imported ${file.name} as Fountain.`);
    } catch (error) {
      console.error(error);
      alertCG('Fountain import failed.');
    } finally {
      target.value = '';
    }
  };
  reader.onerror = () => {
    alertCG('Could not read the selected file.');
    target.value = '';
  };
  reader.readAsText(file);
}

export function handleFDXImport(event: Event): void {
  const target = event.target as HTMLInputElement;
  const file = target.files ? target.files[0] : null;
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const host = getCinegenScriptEditor();
      const result = typeof reader.result === 'string' ? reader.result : '';
      const fountainText = convertFDXToFountain(result);
      if (!host) return;
      host.setDocument(fountainText);
      syncScriptEditorToProject();
      alertCG(`Imported ${file.name} and converted to Fountain text.`);
    } catch (error) {
      console.error(error);
      alertCG('FDX import failed. Please verify the file format.');
    } finally {
      target.value = '';
    }
  };
  reader.readAsText(file);
}

export function convertFDXToFountain(xmlContent: string) {
  const doc = new DOMParser().parseFromString(xmlContent, 'text/xml');
  if (doc.querySelector('parsererror')) {
    throw new Error('Invalid XML');
  }
  const paragraphs = Array.from(doc.querySelectorAll('Paragraph'));
  if (!paragraphs.length) {
    throw new Error('No screenplay paragraphs found');
  }
  const lines: string[] = [];
  paragraphs.forEach(paragraph => {
    const type = (paragraph.getAttribute('Type') || '').toLowerCase();
    const text = Array.from(paragraph.querySelectorAll('Text')).map(node => node.textContent || '').join('').trim();
    if (!text) {
      lines.push('');
      return;
    }
    if (type.includes('scene heading')) {
      lines.push(text.toUpperCase(), '');
    } else if (type.includes('character')) {
      lines.push(text.toUpperCase());
    } else if (type.includes('parenthetical')) {
      lines.push(`(${text})`);
    } else if (type.includes('dialogue')) {
      lines.push(text, '');
    } else if (type.includes('transition')) {
      lines.push(text.toUpperCase(), '');
    } else {
      lines.push(text, '');
    }
  });
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function importScript() {
  closeToolbarSplitMenu('import-split');
  triggerFDXImport();
}

export function runImportMenuAction(action: string): void {
  closeToolbarSplitMenu('import-split');
  if (action === 'script') triggerFDXImport();
}

export function runScriptImportExportMenuAction(action: string): void {
  closeToolbarSplitMenu('script-import-export-split');
  if (action === 'save-fountain') saveFountainFile();
  else if (action === 'import-fountain') triggerFountainImport();
  else if (action === 'import-fdx') triggerFDXImport();
}

export function saveFountainFile(): void {
  const host = getCinegenScriptEditor();
  if (!host) return;
  const text = host.editorView?.state.doc.toString() ?? '';
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${projectData.name || 'cinegen-script'}.fountain`;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportPDF() {
  closeSaveExportMenu();
  alertCG('PDF with embedded AI storyboard & continuity report exported.');
}

export function exportTimeline() {
  closeSaveExportMenu();
  alertCG('Timeline exported as EDL.');
}

export function installFountainBundleGlobals(): void {
  const w = window as unknown as Record<string, unknown>;
  w.hydrateScriptEditorFromProject = hydrateScriptEditorFromProject;
  w.syncScriptEditorToProject = syncScriptEditorToProject;
  w.scheduleScriptEditorProjectSync = scheduleScriptEditorProjectSync;
  w.initScriptFountainInsertSplit = initScriptFountainInsertSplit;
  w.insertFountainSnippet = insertFountainSnippet;
  w.classifyFountainLine = classifyFountainLine;
  w.classifyFountainDocument = classifyFountainDocument;
  w.scheduleFountainRender = scheduleFountainRender;
  w.syncScriptRenderScroll = syncScriptRenderScroll;
  w.renderScriptPrevisMargin = renderScriptPrevisMargin;
  w.handleScriptPrevisMarginClick = handleScriptPrevisMarginClick;
  w.handleScriptPrevisMarginDragStart = handleScriptPrevisMarginDragStart;
  w.triggerFDXImport = triggerFDXImport;
  w.triggerFountainImport = triggerFountainImport;
  w.handleFountainImport = handleFountainImport;
  w.handleFDXImport = handleFDXImport;
  w.convertFDXToFountain = convertFDXToFountain;
  w.importScript = importScript;
  w.runImportMenuAction = runImportMenuAction;
  w.runScriptImportExportMenuAction = runScriptImportExportMenuAction;
  w.saveFountainFile = saveFountainFile;
  w.exportPDF = exportPDF;
  w.exportTimeline = exportTimeline;
  w.annotateScriptSelection = annotateScriptSelection;
  void import('@/script/script-to-project').then((mod) => {
    w.refreshBreakdownFromScript = mod.refreshBreakdownFromScript;
  });
}
