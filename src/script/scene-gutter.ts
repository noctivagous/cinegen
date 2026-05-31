import { gutter, GutterMarker } from '@codemirror/view';
import type { EditorView } from '@codemirror/view';
import { classifyFountainLine } from './fountain-bundle';

export interface SceneGutterConfig {
  onSceneClick(sceneNumber: number): void;
}

class SceneGutterMarker extends GutterMarker {
  constructor(public sceneNumber: number) {
    super();
  }
  eq(other: GutterMarker): boolean {
    return other instanceof SceneGutterMarker && other.sceneNumber === this.sceneNumber;
  }
  toDOM(_view: EditorView): Node {
    const el = document.createElement('span');
    el.className = 'cm-scene-gutter-marker';
    el.textContent = String(this.sceneNumber);
    el.title = `Scene ${this.sceneNumber}`;
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      // Prevent editor from taking focus so the click is handled cleanly
    });
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      this._config?.onSceneClick(this.sceneNumber);
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this._config?.onSceneClick(this.sceneNumber);
      }
    });
    return el;
  }
  private _config?: SceneGutterConfig;
  setConfig(config: SceneGutterConfig): this {
    this._config = config;
    return this;
  }
}

function sceneNumberForLine(view: EditorView, lineNumber: number): number {
  let count = 0;
  for (let i = 1; i <= lineNumber; i++) {
    if (classifyFountainLine(view.state.doc.line(i).text.trim()) === 'scene') {
      count++;
    }
  }
  return count;
}

/** CM6 gutter extension that shows a clickable scene-number badge on every
 *  Fountain scene-heading line. */
export function sceneGutter(config: SceneGutterConfig) {
  return gutter({
    class: 'cm-scene-gutter',
    lineMarker(view, block) {
      const line = view.state.doc.lineAt(block.from);
      if (classifyFountainLine(line.text.trim()) !== 'scene') return null;
      const num = sceneNumberForLine(view, line.number);
      return new SceneGutterMarker(num).setConfig(config);
    },
    initialSpacer() {
      const el = document.createElement('span');
      el.className = 'cm-scene-gutter-marker cm-scene-gutter-marker--spacer';
      el.textContent = '00';
      return new (class extends GutterMarker {
        toDOM() { return el.cloneNode(true); }
      })();
    },
  });
}
