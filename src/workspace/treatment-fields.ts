/**
 * Treatment form field definitions and pure HTML renderer.
 */

import { escHtml } from '@/utils/html';

export interface TreatmentField {
  key: string;
  label: string;
  icon: string;
  type: 'text' | 'textarea';
  rows: number;
  hint?: string;
  inputClass?: string;
}

export interface TreatmentSection {
  title: string;
  fieldKeys: string[];
}

export const TREATMENT_FIELDS: TreatmentField[] = [
  { key: 'workingTitle', label: 'Working title', icon: 'fa-film', type: 'text', rows: 1 },
  { key: 'logline', label: 'Logline', icon: 'fa-quote-left', type: 'textarea', rows: 3, hint: 'One sentence that sells the story.', inputClass: 'treatment-input--logline' },
  { key: 'genre', label: 'Genre', icon: 'fa-masks-theater', type: 'text', rows: 1 },
  { key: 'tone', label: 'Tone & mood', icon: 'fa-cloud-moon', type: 'text', rows: 1 },
  { key: 'synopsis', label: 'Synopsis', icon: 'fa-align-left', type: 'textarea', rows: 8, inputClass: 'treatment-input--synopsis' },
  { key: 'themes', label: 'Themes', icon: 'fa-lightbulb', type: 'textarea', rows: 3 },
  { key: 'targetAudience', label: 'Target audience', icon: 'fa-users', type: 'text', rows: 1 },
  {
    key: 'movieReferences',
    label: 'Movie references',
    icon: 'fa-clapperboard',
    type: 'text',
    rows: 1,
    hint: 'Optional films for story, tone, or market context—not used for visual look (use Look Library for that).'
  },
  {
    key: 'notes',
    label: 'Notes for AI',
    icon: 'fa-robot',
    type: 'textarea',
    rows: 4,
    hint: 'Story and generation constraints. Describe visual look with properties (lighting, palette, texture)—not other films unless you choose to.',
    inputClass: 'treatment-input--notes'
  }
];

export const TREATMENT_SECTIONS = [
  { title: 'Concept', fieldKeys: ['workingTitle', 'logline', 'genre', 'tone'] },
  { title: 'Story', fieldKeys: ['synopsis', 'themes'] },
  { title: 'Audience & movie references', fieldKeys: ['targetAudience', 'movieReferences'] },
  { title: 'AI generation', fieldKeys: ['notes'] }
];

/** Treatment keys omitted when building context for image/video look generation */
export const TREATMENT_VISUAL_EXCLUDED_KEYS = ['movieReferences'];

export const TREATMENT_TWO_COLUMN_MIN_WIDTH = 480;
export const TREATMENT_FULL_WIDTH_FIELDS = new Set(['logline', 'synopsis', 'themes', 'notes']);

export function renderTreatmentFieldHtml(field: TreatmentField, projectTreatment: Record<string, string>): string {
  const value = escHtml(projectTreatment[field.key] || '');
  const hint = field.hint ? `<p class="treatment-field-hint">${escHtml(field.hint)}</p>` : '';
  const extraClass = field.inputClass ? ` ${field.inputClass}` : '';
  const fullClass = TREATMENT_FULL_WIDTH_FIELDS.has(field.key) ? ' treatment-field--full' : '';
  const input =
    field.type === 'textarea'
      ? `<textarea class="treatment-input${extraClass}" data-treatment-field="${field.key}" rows="${field.rows || 3}">${value}</textarea>`
      : `<input type="text" class="treatment-input${extraClass}" data-treatment-field="${field.key}" value="${value}">`;
  return `
    <label class="treatment-field${fullClass}">
      <span class="treatment-field-label"><i class="fa-solid ${field.icon}" aria-hidden="true"></i> ${escHtml(field.label)}</span>
      ${input}
      ${hint}
    </label>`;
}

