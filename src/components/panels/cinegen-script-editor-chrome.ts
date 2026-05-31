import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';

const FOUNTAIN_INSERT_MENU = [
  { snippet: 'sceneInt', label: 'INT. scene heading', title: 'Scene heading (interior). Blank lines + INT. …' },
  { snippet: 'sceneExt', label: 'EXT. scene heading', title: 'Scene heading (exterior)' },
  { snippet: 'forcedScene', label: '.Slug (forced scene)', title: 'Forced slugline (leading period)' },
  { sep: true },
  { snippet: 'action', label: 'Action', title: 'Action / description paragraph' },
  { snippet: 'character', label: 'Character', title: 'Character cue (ALL CAPS)' },
  { snippet: 'atCharacter', label: '@Character', title: 'Mixed-case character (@ removed when formatted)' },
  { snippet: 'dialogue', label: 'Dialogue', title: 'Dialogue under character' },
  { snippet: 'parenthetical', label: '( ) Parenthetical', title: 'Parenthetical' },
  { sep: true },
  { snippet: 'transition', label: 'Transition', title: 'Transition (CUT TO: style)' },
  { snippet: 'section', label: 'Act / Section', title: 'Section divider (line of equals)' },
  { snippet: 'lyrics', label: 'Lyrics', title: 'Lyrics line (leading tilde)' },
] as const;

const FOUNTAIN_TOOLBAR = [
  { snippet: 'sceneInt', icon: 'fa-door-open', label: 'INT.' },
  { snippet: 'sceneExt', icon: 'fa-tree', label: 'EXT.' },
  { snippet: 'forcedScene', icon: 'fa-heading', label: '.Slug' },
  { snippet: 'action', icon: 'fa-align-left', label: 'Action' },
  { snippet: 'character', icon: 'fa-user', label: 'Character' },
  { snippet: 'atCharacter', icon: 'fa-at', label: '@Char' },
  { snippet: 'dialogue', icon: 'fa-comment', label: 'Dialogue' },
  { snippet: 'parenthetical', icon: 'fa-comments', label: '( )' },
  { snippet: 'transition', icon: 'fa-arrow-right', label: 'Trans' },
  { snippet: 'section', icon: 'fa-bars', label: 'Act' },
  { snippet: 'lyrics', icon: 'fa-music', label: 'Lyrics' },
] as const;

const ANNOTATION_CATEGORIES = [
  { category: 'character', icon: 'fa-user', label: 'Char', color: '#ffd479' },
  { category: 'prop', icon: 'fa-hammer', label: 'Prop', color: '#d6834a' },
  { category: 'wardrobe', icon: 'fa-shirt', label: 'Ward', color: '#c9a0dc' },
  { category: 'sfx', icon: 'fa-bolt', label: 'SFX', color: '#7fb4ff' },
  { category: 'location', icon: 'fa-map-marker-alt', label: 'Loc', color: '#6fc9a8' },
  { category: 'vfx', icon: 'fa-wand-magic-sparkles', label: 'VFX', color: '#ff7f7f' },
] as const;

@customElement('cinegen-script-editor-chrome')
export class CinegenScriptEditorChrome extends CgLightElement {
  render() {
    return html`
      <div
        class="script-editor-options-toolbar bevel-sunken"
        role="toolbar"
        aria-label="Script editor options"
      >
        <cg-toolbar-split
          id="script-fountain-insert-split"
          variant="toolbar-split--compact"
          menu-id="script-fountain-insert-menu"
          main-id="script-insert-bar-toggle"
          main-title="Show or hide Fountain insert toolbar"
        >
          <span slot="main"><i class="fa-solid fa-file-lines" aria-hidden="true"></i> Insert</span>
          <div slot="menu">
            ${FOUNTAIN_INSERT_MENU.map((item) =>
              'sep' in item
                ? html`<div class="toolbar-split-menu-sep" role="separator" aria-hidden="true"></div>`
                : html`<button
                    type="button"
                    class="toolbar-split-menu-item"
                    role="menuitem"
                    data-fountain-snippet=${item.snippet}
                    title=${item.title}
                  >
                    ${item.label}
                  </button>`
            )}
          </div>
        </cg-toolbar-split>
        <span class="script-editor-options-toolbar-sep" aria-hidden="true"></span>
        <div class="script-editor-font-control">
          <span class="script-editor-options-label">Size</span>
          <cg-stepper input-id="script-editor-font-size-input" min="10" max="28" step="1"></cg-stepper>
        </div>
        <span
          class="script-editor-options-toolbar-sep script-editor-options-toolbar-sep--push"
          aria-hidden="true"
        ></span>
        <span class="script-editor-options-toolbar-sep" aria-hidden="true"></span>
        <div class="script-editor-annotation-tools">
          ${ANNOTATION_CATEGORIES.map(
            (a) => html`
              <button
                type="button"
                class="toolbar-btn script-annotation-tool"
                data-annotation-category=${a.category}
                title="Annotate as ${a.label}"
                style="color:${a.color}"
              >
                <i class="fa-solid ${a.icon}"></i> ${a.label}
              </button>
            `
          )}
          <span class="script-editor-annotation-tools-sep" aria-hidden="true"></span>
          <cg-vis-toggle
            label="Box Outlines"
            title="Show box outlines for scenes and shots; drag top/bottom edges to adjust shot spans"
            data-script-editor-box-outlines
            checked
          ></cg-vis-toggle>
          <cg-vis-toggle
            label="Storyboard Frames"
            title="Show storyboard frame thumbnails floated on the right; script text wraps around them"
            data-script-editor-storyboard-frames
          ></cg-vis-toggle>
        </div>
        <span
          class="script-editor-options-toolbar-sep script-editor-options-toolbar-sep--push"
          aria-hidden="true"
        ></span>
        <cg-toggle-group
          class="storyboard-visibility-toggles script-editor-display-toggles"
          label="Script editor display"
        >
          <cg-vis-toggle
            label="Chips"
            title="Show registry entity and slug chips in the script"
            data-script-editor-chips
            checked
          ></cg-vis-toggle>
          <cg-vis-toggle
            label="Anchors"
            title="Underline storyboard script anchors in the script"
            data-script-editor-anchors
          ></cg-vis-toggle>
        </cg-toggle-group>
      </div>
      <div
        id="script-fountain-insert-toolbar"
        class="script-fountain-toolbar bevel-sunken"
        role="toolbar"
        aria-label="Fountain screenplay inserts"
        hidden
      >
        <span class="script-fountain-toolbar-label">Insert</span>
        ${FOUNTAIN_TOOLBAR.map(
          (t, i) => html`
            ${i === 3 || i === 8
              ? html`<span class="script-fountain-toolbar-sep" aria-hidden="true"></span>`
              : null}
            <button type="button" class="toolbar-btn script-fountain-tool" data-fountain-snippet=${t.snippet}>
              <i class="fa-solid ${t.icon}"></i> ${t.label}
            </button>
          `
        )}
      </div>
    `;
  }
}
