export type TreatmentFieldDef = {
  key: string;
  label: string;
  icon: string;
  type: 'text' | 'textarea';
  rows?: number;
  hint?: string;
  inputClass?: string;
};

export const TREATMENT_FIELDS: TreatmentFieldDef[] = [
  { key: 'workingTitle', label: 'Working title', icon: 'fa-film', type: 'text', rows: 1 },
  {
    key: 'logline',
    label: 'Logline',
    icon: 'fa-quote-left',
    type: 'textarea',
    rows: 3,
    hint: 'One sentence that sells the story.',
    inputClass: 'treatment-input--logline',
  },
  { key: 'genre', label: 'Genre', icon: 'fa-masks-theater', type: 'text', rows: 1 },
  { key: 'tone', label: 'Tone & mood', icon: 'fa-cloud-moon', type: 'text', rows: 1 },
  {
    key: 'synopsis',
    label: 'Synopsis',
    icon: 'fa-align-left',
    type: 'textarea',
    rows: 8,
    inputClass: 'treatment-input--synopsis',
  },
  { key: 'themes', label: 'Themes', icon: 'fa-lightbulb', type: 'textarea', rows: 3 },
  { key: 'targetAudience', label: 'Target audience', icon: 'fa-users', type: 'text', rows: 1 },
  {
    key: 'movieReferences',
    label: 'Movie references',
    icon: 'fa-clapperboard',
    type: 'text',
    rows: 1,
    hint: 'Optional films for story, tone, or market context—not used for visual look (use Look Library for that).',
  },
  {
    key: 'notes',
    label: 'Notes for AI',
    icon: 'fa-robot',
    type: 'textarea',
    rows: 4,
    hint: 'Story and generation constraints. Describe visual look with properties (lighting, palette, texture)—not other films unless you choose to.',
    inputClass: 'treatment-input--notes',
  },
];

export const TREATMENT_SECTIONS = [
  { title: 'Concept', fieldKeys: ['workingTitle', 'logline', 'genre', 'tone'] },
  { title: 'Story', fieldKeys: ['synopsis', 'themes'] },
  { title: 'Audience & movie references', fieldKeys: ['targetAudience', 'movieReferences'] },
  { title: 'AI generation', fieldKeys: ['notes'] },
] as const;

export const TREATMENT_VISUAL_EXCLUDED_KEYS = ['movieReferences'] as const;

export const TREATMENT_TWO_COLUMN_MIN_WIDTH = 480;

export const TREATMENT_FULL_WIDTH_FIELDS = new Set([
  'logline',
  'synopsis',
  'themes',
  'notes',
]);

export function treatmentSectionId(title: string): string {
  return `treatment-section-${title.replace(/\s+/g, '-').toLowerCase()}`;
}
