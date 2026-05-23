import { wireIndexShellControls, wireScriptEditorShell } from '@/shell/wire-index-shell';

/** Wave G: wire static index.html shell controls (no inline onclick/onchange). */
export function initShell(): void {
  wireIndexShellControls();
  wireScriptEditorShell();
}
