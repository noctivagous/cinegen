import { html, nothing } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { CgLightElement } from '@/components/lit-base';
import type { SceneShot } from '@/workspace/scene-types';
import { markProjectDirty } from '@/services/project-service';

export interface ExpressionCategory {
  id: string;
  color: string;
  label: string;
  emotions: ExpressionEmotion[];
}

export interface ExpressionEmotion {
  id: string;
  name: string;
  promptDesc: string;
}

export const EXPRESSION_CATEGORIES: ExpressionCategory[] = [
  {
    id: 'growth',
    color: '#22c55e',
    label: 'Growth & Drive',
    emotions: [
      { id: 'determination', name: 'Determination', promptDesc: 'jaw set, focused gaze, unyielding posture' },
      { id: 'assertion', name: 'Assertion', promptDesc: 'upright stance, direct eye contact, commanding presence' },
      { id: 'frustration', name: 'Frustration', promptDesc: 'clenched fists, tight jaw, agitated movements' },
      { id: 'irritation', name: 'Irritation', promptDesc: 'narrowed eyes, pursed lips, slight head shake' },
      { id: 'motivation', name: 'Motivation', promptDesc: 'bright eyes, eager posture, forward lean' },
    ],
  },
  {
    id: 'connection',
    color: '#ef4444',
    label: 'Connection & Vitality',
    emotions: [
      { id: 'joy', name: 'Joy', promptDesc: 'radiant smile, eyes crinkling with joy, warm open expression' },
      { id: 'excitement', name: 'Excitement', promptDesc: 'bouncing energy, wide eyes, rapid gestures' },
      { id: 'laughter', name: 'Laughter', promptDesc: 'thrown-back head, open mouth, shaking shoulders' },
      { id: 'restlessness', name: 'Restlessness', promptDesc: 'shifting weight, darting eyes, fidgeting hands' },
      { id: 'mania', name: 'Mania', promptDesc: 'erratic movement, wild eyes, uncontrollable energy' },
    ],
  },
  {
    id: 'center',
    color: '#eab308',
    label: 'Center & Reflection',
    emotions: [
      { id: 'contemplation', name: 'Contemplation', promptDesc: 'furrowed brow, distant gaze, still posture' },
      { id: 'worry', name: 'Worry', promptDesc: 'nervous fidgeting, anxious glance, bitten lip' },
      { id: 'overthinking', name: 'Overthinking', promptDesc: 'fixed stare, micro-expressions flickering, tense shoulders' },
      { id: 'care', name: 'Care', promptDesc: 'gentle tilt, soft eyes, reaching hand' },
      { id: 'pensiveness', name: 'Pensiveness', promptDesc: 'slumped shoulders, unfocused gaze, slow blinking' },
    ],
  },
  {
    id: 'release',
    color: '#f8fafc',
    label: 'Release & Discernment',
    emotions: [
      { id: 'sadness', name: 'Sadness', promptDesc: 'tears streaming, hollow gaze, trembling lip' },
      { id: 'melancholy', name: 'Melancholy', promptDesc: 'quiet sorrow, distant look, slow movements' },
      { id: 'sorrow', name: 'Sorrow', promptDesc: 'heavy eyes, drooping posture, deep sighs' },
      { id: 'detachment', name: 'Detachment', promptDesc: 'blank expression, still face, unfocused eyes' },
      { id: 'grief', name: 'Grief', promptDesc: 'wracking sobs, curled posture, shaking hands' },
    ],
  },
  {
    id: 'depth',
    color: '#3b82f6',
    label: 'Depth & Wisdom',
    emotions: [
      { id: 'fear', name: 'Fear', promptDesc: 'wide eyes, shallow breathing, recoiling posture' },
      { id: 'terror', name: 'Terror', promptDesc: 'eyes wide with terror, frozen, mouth open in silent scream' },
      { id: 'stillness', name: 'Stillness', promptDesc: 'calm composure, steady breath, unshakeable calm' },
      { id: 'willpower', name: 'Willpower', promptDesc: 'determined set of jaw, blazing eyes, straight spine' },
      { id: 'paranoia', name: 'Paranoia', promptDesc: 'darting eyes, tense neck, glancing over shoulder' },
    ],
  },
];

export function findExpressionById(id: string): ExpressionEmotion | undefined {
  for (const cat of EXPRESSION_CATEGORIES) {
    const found = cat.emotions.find(e => e.id === id);
    if (found) return found;
  }
  return undefined;
}

export function findCategoryForExpression(id: string): ExpressionCategory | undefined {
  return EXPRESSION_CATEGORIES.find(cat => cat.emotions.some(e => e.id === id));
}

export function applyExpressionToShot(
  shot: SceneShot,
  expressionId: string,
  emotionId?: string,
  beatSequence?: string,
): void {
  shot.expression = expressionId;
  if (emotionId) shot.emotion = emotionId;
  if (beatSequence) shot.beatSequence = beatSequence;
  markProjectDirty(['scenes']);
}

@customElement('cinegen-expression-palette')
export class CinegenExpressionPalette extends CgLightElement {
  @property({ type: Object }) shot?: SceneShot | null;

  @state() private _selected: string | null = null;
  @state() private _activeCategory: string | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    if (this.shot?.expression) {
      this._selected = this.shot.expression;
      const cat = findCategoryForExpression(this.shot.expression);
      if (cat) this._activeCategory = cat.id;
    }
  }

  private _selectEmotion(id: string): void {
    this._selected = id;
    const cat = findCategoryForExpression(id);
    this._activeCategory = cat?.id ?? null;
    if (this.shot) {
      this.shot.expression = id;
      markProjectDirty(['scenes']);
      this.requestUpdate();
    }
  }

  private _clearSelection(): void {
    this._selected = null;
    this._activeCategory = null;
    if (this.shot) {
      this.shot.expression = undefined;
      markProjectDirty(['scenes']);
      this.requestUpdate();
    }
  }

  private _renderCategory(cat: ExpressionCategory): unknown {
    const isActive = this._activeCategory === cat.id;
    const borderColor = isActive ? cat.color : 'transparent';

    return html`
      <div
        class="expression-category"
        style="border-left: 3px solid ${borderColor}; padding-left: 8px; margin-bottom: 12px;">
        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
          <span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: ${cat.color};"></span>
          <span style="font-size: 12px; font-weight: 600; color: #ccc;">${cat.label}</span>
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 4px;">
          ${cat.emotions.map(em => {
            const isSelected = this._selected === em.id;
            return html`
              <button
                class="${classMap({ selected: isSelected })}"
                style="
                  padding: 4px 10px;
                  border-radius: 12px;
                  border: 1px solid ${isSelected ? cat.color : '#444'};
                  background: ${isSelected ? cat.color + '22' : 'transparent'};
                  color: ${isSelected ? '#fff' : '#aaa'};
                  font-size: 11px;
                  cursor: pointer;
                "
                @click=${() => this._selectEmotion(em.id)}
                title=${em.promptDesc}>
                ${em.name}
              </button>
            `;
          })}
        </div>
        ${isActive && this._selected
          ? html`
              <div style="margin-top: 4px; font-size: 11px; color: #888; font-style: italic;">
                "${findExpressionById(this._selected)?.promptDesc}"
              </div>
            `
          : nothing}
      </div>
    `;
  }

  render(): unknown {
    return html`
      <div class="cinegen-expression-palette" style="padding: 12px; border: 1px solid #333; border-radius: 8px; background: #1a1a1a;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <span style="font-weight: 600; font-size: 13px; color: #eee;">Performance Expression</span>
          <button
            style="font-size: 11px; color: #888; background: none; border: none; cursor: pointer; text-decoration: underline;"
            @click=${this._clearSelection}>
            Clear
          </button>
        </div>
        <p style="font-size: 11px; color: #666; margin-bottom: 12px;">
          Select an expression to define the character's emotional delivery. These map to element [3] PERFORMANCE in the 10-element prompt.
        </p>
        ${EXPRESSION_CATEGORIES.map(cat => this._renderCategory(cat))}
      </div>
    `;
  }
}
