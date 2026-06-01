import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';
import { EditorView } from '@codemirror/view';
import {
  createScriptEditor,
  insertFountainSnippetIntoEditor,
  setEditorDocument,
  scrollEditorToPos,
  setEditorSelection,
} from '@/script/cm6-script-editor';
import {
  setAnnotations,
  getAnnotations,
  annotateSelection,
  clearSelectionAnnotations,
} from '@/script/cm6-annotations';
import { setChipsEnabled } from '@/script/cm6-chips';
import { setAnchorsEnabled } from '@/script/cm6-anchors';
import { setBoxOutlinesEnabled, refreshBoxOutlines } from '@/script/cm6-box-outlines';
import {
  setStoryboardFrameWrapsEnabled,
  refreshStoryboardFrameWraps,
} from '@/script/cm6-storyboard-frame-wraps';
import { refreshStoryboardLinks } from '@/script/cm6-storyboard-links';
import { reflowShotRangesForStoryboardFrames } from '@/script/script-box-ranges';
import {
  renderPrevisMargin,
  handlePrevisMarginClick,
  handlePrevisMarginDragStart,
  refreshPrevisMargin,
} from '@/script/previs-margin';
import { getProjectAnnotations, setProjectAnnotations } from '@/data/project-data';
import { markProjectDirty } from '@/services/project-service';
import { appShellStore } from '@/stores/app-shell-store';

/**
 * Script editor host — CodeMirror 6 Fountain editor.
 * Replaces the transparent-textarea + render-overlay approach.
 */
@customElement('cinegen-script-editor')
export class CinegenScriptEditor extends CgLightElement {
  private _editorView: EditorView | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    this.classList.add('script-editor-stack');
    this.id = 'script-editor-stack';
  }

  protected firstUpdated(): void {
    this._initEditor();
    this._wirePrevisMargin();
    this._wireVisToggles();
    this._wireGlobalEvents();
  }

  private _initEditor(): void {
    const host = this.querySelector<HTMLElement>('.cm-host');
    if (!host) return;

    this._editorView = createScriptEditor(host, {
      onMouseUp: (_view, _event) => {
        window.syncScriptSelectionToStoryboard?.();
      },
      onKeyUp: (_view, _event) => {
        window.syncScriptSelectionToStoryboard?.();
      },
      onContextMenu: (_view, event) => {
        event.preventDefault();
        window.showScriptContextMenu?.(event.clientX, event.clientY);
      },
      onScroll: (view) => {
        const marginScroll = this.querySelector<HTMLElement>('.script-previs-margin .previs-margin-scroll');
        if (marginScroll) marginScroll.scrollTop = view.scrollDOM.scrollTop;
      },
      onChange: (view) => {
        const marks = getAnnotations(view);
        setProjectAnnotations({ format: 'cine-annotations', version: 1, marks });
        markProjectDirty(['annotations']);
      },
      sceneGutter: {
        onSceneClick: (sceneNumber) => {
          const sceneId = `scene${String(sceneNumber).padStart(2, '0')}`;
          void Promise.all([
            import('@/tree/project-tree-service'),
            import('@/events/shell-events'),
          ]).then(([{ findProjectNodeBySceneId }, { emitTreeNodeSelect, treeNodeSelectDetail }]) => {
              const node = findProjectNodeBySceneId(sceneId);
              if (node) emitTreeNodeSelect(treeNodeSelectDetail(node, null));
            }
          );
        },
      },
    });

    // Hydrate annotations from project sidecar
    const ann = getProjectAnnotations();
    if (ann.marks.length) {
      setAnnotations(this._editorView, ann.marks);
    }

    // Hydrate from project if editor is empty
    if (!this._editorView.state.doc.length) {
      window.hydrateScriptEditorFromProject?.();
    }

    // Apply saved font size preference
    const fontSize = appShellStore.preferences.scriptEditorFontSizePx ?? 15;
    this.style.setProperty('--script-editor-font-size', `${fontSize}px`);
  }

  private _wirePrevisMargin(): void {
    const margin = this.querySelector<HTMLElement>('.script-previs-margin');
    if (!margin) return;
    renderPrevisMargin(margin);
    margin.addEventListener('click', (event: Event) => {
      handlePrevisMarginClick(event);
    });
    margin.addEventListener('mousedown', (event: MouseEvent) => {
      handlePrevisMarginDragStart(event);
    });
  }

  private _wireVisToggles(): void {
    if (!this._editorView) return;

    // Toolbar is a sibling component; search from parent or document
    const parent = this.closest<HTMLElement>('#script-pane-script') || this.parentElement;
    const toolbar = parent?.querySelector<HTMLElement>('.script-editor-options-toolbar');
    if (!toolbar) return;

    toolbar.addEventListener('cg-change', (e: Event) => {
      if (!this._editorView) return;
      const detail = (e as CustomEvent).detail as
        | { part?: string; checked?: boolean; value?: number }
        | undefined;
      if (!detail) return;

      if (detail.part === 'chips') {
        setChipsEnabled(this._editorView, !!detail.checked);
        appShellStore.patchPreferences({ scriptEditorChipsEnabled: !!detail.checked });
      } else if (detail.part === 'anchors') {
        setAnchorsEnabled(this._editorView, !!detail.checked);
        appShellStore.patchPreferences({ scriptEditorAnchorsEnabled: !!detail.checked });
      } else if (detail.part === 'boxOutlines') {
        setBoxOutlinesEnabled(this._editorView, !!detail.checked);
        appShellStore.patchPreferences({ scriptEditorBoxOutlinesEnabled: !!detail.checked });
      } else if (detail.part === 'storyboardFrames') {
        setStoryboardFrameWrapsEnabled(this._editorView, !!detail.checked);
        appShellStore.patchPreferences({ scriptEditorStoryboardFramesEnabled: !!detail.checked });
      } else if (typeof detail.value === 'number') {
        // Font size stepper
        const size = detail.value;
        this.style.setProperty('--script-editor-font-size', `${size}px`);
        appShellStore.patchPreferences({ scriptEditorFontSizePx: size });
        reflowShotRangesForStoryboardFrames(this._editorView);
        refreshStoryboardFrameWraps(this._editorView);
        refreshBoxOutlines(this._editorView);
      }
    });

    // Sync initial compartment states from checkbox attributes
    const chipsToggle = toolbar.querySelector('cg-vis-toggle[data-script-editor-chips]');
    const anchorsToggle = toolbar.querySelector('cg-vis-toggle[data-script-editor-anchors]');
    const boxOutlinesToggle = toolbar.querySelector('cg-vis-toggle[data-script-editor-box-outlines]');
    const storyboardFramesToggle = toolbar.querySelector('cg-vis-toggle[data-script-editor-storyboard-frames]');
    if (chipsToggle) {
      const checked = appShellStore.preferences.scriptEditorChipsEnabled ?? true;
      (chipsToggle as HTMLElement & { checked: boolean }).checked = checked;
      setChipsEnabled(this._editorView, checked);
    }
    if (anchorsToggle) {
      const checked = appShellStore.preferences.scriptEditorAnchorsEnabled ?? false;
      (anchorsToggle as HTMLElement & { checked: boolean }).checked = checked;
      setAnchorsEnabled(this._editorView, checked);
    }
    if (boxOutlinesToggle) {
      const checked = appShellStore.preferences.scriptEditorBoxOutlinesEnabled ?? true;
      (boxOutlinesToggle as HTMLElement & { checked: boolean }).checked = checked;
      setBoxOutlinesEnabled(this._editorView, checked);
    }
    if (storyboardFramesToggle) {
      const checked = appShellStore.preferences.scriptEditorStoryboardFramesEnabled ?? false;
      (storyboardFramesToggle as HTMLElement & { checked: boolean }).checked = checked;
      setStoryboardFrameWrapsEnabled(this._editorView, checked);
    }

    // Initialise stepper value from preferences
    const stepper = toolbar.querySelector('cg-stepper[input-id="script-editor-font-size-input"]');
    if (stepper) {
      const size = appShellStore.preferences.scriptEditorFontSizePx ?? 15;
      (stepper as any).value = size;
    }
  }

  private _wireGlobalEvents(): void {
    window.addEventListener('previs-selection-changed', () => {
      refreshPrevisMargin();
    });
    window.addEventListener('storyboard-frames-changed', () => {
      refreshPrevisMargin();
      if (this._editorView) {
        reflowShotRangesForStoryboardFrames(this._editorView);
        refreshBoxOutlines(this._editorView);
        refreshStoryboardFrameWraps(this._editorView);
        refreshStoryboardLinks(this._editorView);
      }
    });
    window.addEventListener('previs-timing-changed', () => {
      refreshPrevisMargin();
    });
    window.addEventListener('script-box-ranges-changed', () => {
      refreshPrevisMargin();
      if (this._editorView) {
        refreshBoxOutlines(this._editorView);
      }
    });
  }

  get editorView(): EditorView | null {
    return this._editorView;
  }

  /** Insert a Fountain snippet by kind (see FOUNTAIN_SNIPPETS in fountain-bundle). */
  insertSnippet(text: string, sel?: readonly [number, number] | null): void {
    if (!this._editorView) return;
    insertFountainSnippetIntoEditor(this._editorView, text, sel);
  }

  /** Replace the entire document (used for hydration / import). */
  setDocument(text: string): void {
    if (!this._editorView) return;
    setEditorDocument(this._editorView, text);
  }

  /** Scroll to a document position and set selection. */
  jumpToPos(pos: number, selectLength = 0): void {
    if (!this._editorView) return;
    setEditorSelection(this._editorView, pos, pos + selectLength);
    scrollEditorToPos(this._editorView, pos);
  }

  render() {
    return html`
      <div class="script-editor-layout">
        <div class="script-previs-margin"></div>
        <div class="script-editor-main">
          <div class="cm-host" style="flex:1;min-height:0;min-width:0;"></div>
        </div>
      </div>
    `;
  }
}
