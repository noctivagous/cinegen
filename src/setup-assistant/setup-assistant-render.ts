interface SaRenderDeps {
  setupSteps: Array<{ idx: number; id: string; label: string; icon: string }>;
  maxReachableStep: number;
  renderBody: (idx: number) => void;
  bindStepControls: (stepId: string) => void;
  escHtml: (value: unknown) => string;
}

export function renderSetupStep(
  idx: number,
  deps: SaRenderDeps,
  footerDeps: {
    setFooterHint: (stepId: string) => string;
    onLastStep: boolean;
  }
): void {
  renderRail(idx, deps);
  renderBody(idx, deps);
  renderFooter(idx, deps, footerDeps);
}

export function renderRail(currentIdx: number, deps: SaRenderDeps): void {
  const rail = document.getElementById('sa-rail');
  if (!rail) return;
  rail.innerHTML = deps.setupSteps
    .map((step, i) => {
      let cls = 'sa-rail-step';
      if (i === currentIdx) cls += ' sa-rail-step--active';
      else if (i < currentIdx) cls += ' sa-rail-step--done';
      const reachable = i <= deps.maxReachableStep;
      if (reachable) cls += ' sa-rail-step--clickable';
      else cls += ' sa-rail-step--locked';
      const label = deps.escHtml(step.label);
      const inner = `
      <span class="sa-rail-dot"><i class="${step.icon}" aria-hidden="true"></i></span>
      <span class="sa-rail-label">${label}</span>`;
      if (reachable) {
        const selected = i === currentIdx ? 'true' : 'false';
        return `<button type="button" class="${cls}" data-step-idx="${i}" role="tab" aria-selected="${selected}" aria-label="${label}">${inner}</button>`;
      }
      return `<div class="${cls}" role="presentation" aria-disabled="true" title="Complete earlier steps to unlock">${inner}</div>`;
    })
    .join('');
}

export function renderBody(idx: number, deps: SaRenderDeps): void {
  const step = deps.setupSteps[idx];
  if (!step) return;

  const host = document.getElementById('sa-body') as any;
  if (!host) return;

  if (typeof host.showWelcome !== 'function') {
    customElements.whenDefined('cinegen-sa-step-host').then(() => {
      renderBody(idx, deps);
    });
    return;
  }

  if (step.id === 'welcome') host.showWelcome();
  else host.showStep(step.id);

  host.updateComplete?.then(() => {
    const child = host.querySelector(`sa-step-${step.id}`);
    if (child && typeof child.requestUpdate === 'function') child.requestUpdate();
  });
  deps.bindStepControls(step.id);
}

export function renderFooter(
  idx: number,
  deps: SaRenderDeps,
  footerDeps: {
    setFooterHint: (stepId: string) => string;
    onLastStep: boolean;
  }
): void {
  const step = deps.setupSteps[idx];
  const backBtn = document.getElementById('sa-btn-back') as HTMLButtonElement | null;
  const nextBtn = document.getElementById('sa-btn-next') as HTMLButtonElement | null;
  const skipBtn = document.getElementById('sa-btn-skip') as HTMLButtonElement | null;
  const hintEl = document.getElementById('sa-footer-hint');

  if (!step) return;
  const isFirst = idx === 0;
  const isLast = footerDeps.onLastStep;

  if (backBtn) {
    backBtn.hidden = isFirst;
    backBtn.disabled = isFirst;
  }
  if (skipBtn) {
    skipBtn.hidden = true;
    skipBtn.disabled = true;
  }
  if (nextBtn) {
    if (isLast) {
      nextBtn.innerHTML = '<i class="fa-solid fa-check" aria-hidden="true"></i> Start CineGen';
    } else {
      nextBtn.innerHTML = 'Next <i class="fa-solid fa-caret-right" aria-hidden="true"></i>';
    }
  }
  if (hintEl) {
    hintEl.textContent = footerDeps.setFooterHint(step.id);
  }
}
