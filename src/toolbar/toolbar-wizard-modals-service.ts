import type { TemplateResult } from 'lit';
import type { CinegenEntryWizardBody } from '@/components/modals/cinegen-entry-wizard-body';
import { closeAllModalsExcept, closeModal, openModalAsync } from '@/services/modal-manager';
import { closeAllToolbarSplitMenus } from '@/services/toolbar-split-service';
import { escHtml } from '@/utils/html';
import { resetScriptWizardState } from '@/wizard/script-wizard-state';

export type WizardSlide = {
  title: string;
  body?: string;
  tip?: string;
  renderFn?: (host: CinegenEntryWizardBody) => TemplateResult;
};

type WizardSlidesByModal = Record<string, WizardSlide[]>;

const wizardIndices: Record<string, number> = {};

function getWizardIcon(modalId: string): string {
  const map: Record<string, string> = {
    'script-wizard-modal': 'fa-solid fa-scroll',
    'visual-wizard-modal': 'fa-solid fa-image',
    'concept-wizard-modal': 'fa-solid fa-palette',
    'asset-wizard-modal': 'fa-solid fa-boxes-stacked',
    'storyboard-wizard-modal': 'fa-solid fa-pen-ruler',
  };
  return map[modalId] ?? 'fa-solid fa-wand-magic-sparkles';
}

export function renderEntryWizardSlide(
  modalId: string,
  index: number,
  wizardSlides: WizardSlidesByModal
): void {
  const slides = wizardSlides[modalId];
  const slide = slides?.[index];
  const modal = document.getElementById(modalId);
  const titleEl = document.getElementById(`${modalId}-title`);
  const bodyEl = document.querySelector<CinegenEntryWizardBody>(`#${modalId} cinegen-entry-wizard-body`);
  const progressEl = document.getElementById(`${modalId}-progress`);
  const prevBtn = document.getElementById(`${modalId}-prev`) as HTMLButtonElement | null;
  const nextBtn = document.getElementById(`${modalId}-next`) as HTMLButtonElement | null;
  if (!slide || !modal || !titleEl || !bodyEl) return;

  wizardIndices[modalId] = index;
  bodyEl.slides = slides;
  bodyEl.showSlide(index);
  titleEl.innerHTML = `<i class="${escHtml(getWizardIcon(modalId))}" aria-hidden="true"></i> ${escHtml(slide.title)}`;
  if (progressEl) progressEl.textContent = `${index + 1} of ${slides.length}`;
  if (prevBtn) prevBtn.disabled = index <= 0;
  if (nextBtn) nextBtn.disabled = index >= slides.length - 1;
}

export function entryWizardStep(
  modalId: string,
  delta: number,
  wizardSlides: WizardSlidesByModal
): void {
  const current = wizardIndices[modalId] ?? 0;
  const next = current + delta;
  const slides = wizardSlides[modalId];
  if (!slides || next < 0 || next >= slides.length) return;
  renderEntryWizardSlide(modalId, next, wizardSlides);
}

export async function openEntryWizardModal(
  modalId: string,
  wizardSlides: WizardSlidesByModal
): Promise<void> {
  closeAllToolbarSplitMenus();
  closeAllModalsExcept(modalId);
  await openModalAsync(modalId);
  renderEntryWizardSlide(modalId, 0, wizardSlides);
}

export function openScriptWizardModal(wizardSlides: WizardSlidesByModal): void {
  resetScriptWizardState();
  void openEntryWizardModal('script-wizard-modal', wizardSlides);
}

export function closeScriptWizardModal(): void {
  closeModal('script-wizard-modal');
}

export function openVisualWizardModal(wizardSlides: WizardSlidesByModal): void {
  void openEntryWizardModal('visual-wizard-modal', wizardSlides);
}

export function closeVisualWizardModal(): void {
  closeModal('visual-wizard-modal');
}

export function openConceptWizardModal(wizardSlides: WizardSlidesByModal): void {
  void openEntryWizardModal('concept-wizard-modal', wizardSlides);
}

export function closeConceptWizardModal(): void {
  closeModal('concept-wizard-modal');
}

export function openAssetWizardModal(wizardSlides: WizardSlidesByModal): void {
  void openEntryWizardModal('asset-wizard-modal', wizardSlides);
}

export function closeAssetWizardModal(): void {
  closeModal('asset-wizard-modal');
}

export function openStoryboardWizardModal(wizardSlides: WizardSlidesByModal): void {
  (window as any).CineGen?.beatBoard?.reset();
  void openEntryWizardModal('storyboard-wizard-modal', wizardSlides);
}

export function closeStoryboardWizardModal(): void {
  closeModal('storyboard-wizard-modal');
}

export function openWizardsModal(wizardSlides: WizardSlidesByModal): void {
  void openEntryWizardModal('wizards-modal', wizardSlides);
}

export function closeWizardsModal(): void {
  closeModal('wizards-modal');
}

type WizardActions = Record<string, () => void>;

export function launchWizardAction(wizardId: string, actions: WizardActions): void {
  closeWizardsModal();
  const action = actions[wizardId];
  if (action) action();
}

export function wireWizardNavigationAndActions(
  wizardSlides: WizardSlidesByModal,
  projectActions: Record<string, () => void | Promise<void>>
): void {
  document.querySelectorAll('[data-cg-close="wizards-modal"]').forEach((el) => {
    el.addEventListener('click', () => closeWizardsModal());
  });
  document.querySelector('#wizards-modal .settings-modal-backdrop')?.addEventListener('click', () =>
    closeWizardsModal()
  );

  document.querySelectorAll('[data-project-action]').forEach((el) => {
    const action = (el as HTMLElement).dataset.projectAction;
    if (!action || !projectActions[action]) return;
    el.addEventListener('click', projectActions[action]);
  });

  for (const modalId of Object.keys(wizardSlides)) {
    document.getElementById(`${modalId}-prev`)?.addEventListener('click', () =>
      entryWizardStep(modalId, -1, wizardSlides)
    );
    document.getElementById(`${modalId}-next`)?.addEventListener('click', () =>
      entryWizardStep(modalId, 1, wizardSlides)
    );
  }
}
