/** Wire Setup Assistant modal static controls (replaces onclick in index.html). */

function wireSetupAssistantModalOnce(modal: HTMLElement): void {
  if (modal.dataset.cgSaWired === '1') return;
  modal.dataset.cgSaWired = '1';

  modal.querySelector('.setup-assistant-backdrop')?.addEventListener('click', () => {
    window.closeSetupAssistant?.();
  });

  modal.querySelector('.setup-assistant-close')?.addEventListener('click', (e) => {
    e.stopPropagation();
    window.closeSetupAssistant?.();
  });

  document.getElementById('sa-btn-back')?.addEventListener('click', () => window.setupBack?.());

  document.getElementById('setup-status-badge')?.addEventListener('click', () => {
    void window.openSetupAssistant?.();
  });
}

export function wireSetupAssistantModal(): void {
  const tryWire = (): void => {
    const modal = document.getElementById('setup-assistant-modal');
    if (!modal) {
      requestAnimationFrame(tryWire);
      return;
    }
    wireSetupAssistantModalOnce(modal);
  };

  void customElements.whenDefined('cinegen-setup-assistant-modal').then(() => {
    requestAnimationFrame(tryWire);
  });
}
