import { projectTreatment } from '@/data/project-data';
import {
  TREATMENT_FIELDS,
  TREATMENT_TWO_COLUMN_MIN_WIDTH,
  TREATMENT_VISUAL_EXCLUDED_KEYS,
} from '@/workspace/treatment-config';
import { workspaceState } from '@/workspace/workspace-state';
import { updateInspector } from '@/components/panels/cinegen-inspector';

export function migrateProjectTreatmentKeys(): void {
  if (!projectTreatment) return;
  const t = projectTreatment as Record<string, string | undefined>;
  if (t.comparableFilms != null && t.movieReferences == null) {
    t.movieReferences = t.comparableFilms;
  }
  delete t.comparableFilms;
}

export function syncTreatmentFromForm(root?: ParentNode | null): void {
  const host = root ?? document.getElementById('cinegen-treatment-panel') ?? document.getElementById('treatment-form');
  if (!host || !projectTreatment) return;
  const t = projectTreatment as Record<string, string>;
  TREATMENT_FIELDS.forEach(({ key }) => {
    const el = host.querySelector(`[data-treatment-field="${key}"]`);
    if (el && 'value' in el) {
      t[key] = String((el as HTMLInputElement).value).trim();
    }
  });
}

export function getTreatmentForAI(): Record<string, string> {
  migrateProjectTreatmentKeys();
  syncTreatmentFromForm();
  return { ...(projectTreatment as Record<string, string>) };
}

export function getTreatmentForStoryAI(): Record<string, string> {
  return getTreatmentForAI();
}

export function getTreatmentForVisualAI(): Record<string, string> {
  const treatment = getTreatmentForAI();
  const visual = { ...treatment };
  TREATMENT_VISUAL_EXCLUDED_KEYS.forEach((key) => delete visual[key]);
  return visual;
}

export function publishTreatmentToCineGen(): void {
  window.CineGen = window.CineGen || {
    preferences: {} as never,
    savePreferences: () => ({} as never),
    preferenceKey: '',
    loaderVersion: '',
  };
  window.CineGen.getTreatmentForStoryAI = getTreatmentForStoryAI;
  window.CineGen.getTreatmentForVisualAI = getTreatmentForVisualAI;
  window.CineGen.lastTreatmentVisualContext = getTreatmentForVisualAI();
}

export function applyTreatmentLayout(host?: HTMLElement | null): void {
  const el =
    host ??
    document.querySelector<HTMLElement>('cinegen-treatment-panel') ??
    document.getElementById('treatment-form');
  const pane = document.getElementById('script-pane-treatment');
  if (!el) return;

  const width = pane?.clientWidth ?? el.clientWidth ?? 0;
  const forcedNarrow = width > 0 && width < TREATMENT_TWO_COLUMN_MIN_WIDTH;
  const effective = forcedNarrow ? 'one-column' : workspaceState.treatmentLayoutPreference;

  el.classList.remove('layout-one-column', 'layout-two-column', 'layout-forced-narrow');
  if (effective === 'two-column') {
    el.classList.add('layout-two-column');
  } else {
    el.classList.add('layout-one-column');
  }
  if (forcedNarrow) el.classList.add('layout-forced-narrow');

  const control = document.getElementById('treatment-layout-control');
  if (control) control.classList.toggle('is-forced-narrow', forcedNarrow);
}

export function afterTreatmentPanelRender(host: HTMLElement): void {
  applyTreatmentLayout(host);
  updateInspector('treatment', getTreatmentForAI());
  publishTreatmentToCineGen();
}
