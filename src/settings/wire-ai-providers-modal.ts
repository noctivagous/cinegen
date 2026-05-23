/** Wire AI providers modal static controls (replaces onclick in index.html). */

export function wireAiProvidersModal(): void {
  const modal = document.getElementById('ai-providers-modal');
  if (!modal || modal.dataset.cgAipWired === '1') return;
  modal.dataset.cgAipWired = '1';

  modal.querySelector('.project-settings-modal-backdrop')?.addEventListener('click', () => {
    window.closeAiProvidersModal?.();
  });

  modal.querySelector('.project-settings-modal-close')?.addEventListener('click', () => {
    window.closeAiProvidersModal?.();
  });

  document.querySelectorAll('[data-cg-close="ai-providers-modal"]').forEach((el) => {
    el.addEventListener('click', () => window.closeAiProvidersModal?.());
  });

  document.querySelector('[data-aip-action="save"]')?.addEventListener('click', () => {
    window.saveAiProvidersModal?.();
  });

  document.querySelector('[data-aip-action="cancel"]')?.addEventListener('click', () => {
    window.closeAiProvidersModal?.();
  });

  document.querySelector('[data-aip-action="back-settings"]')?.addEventListener('click', () => {
    window.closeAiProvidersModal?.();
    window.openSettingsModal?.();
  });

  document.querySelector('[data-aip-action="add-vendor"]')?.addEventListener('click', () => {
    window.aiProvidersAddVendor?.();
  });

  document.querySelector('[data-aip-action="remove-vendor"]')?.addEventListener('click', () => {
    window.aiProvidersRemoveSelected?.();
  });

  document.querySelector('[data-aip-action="toggle-key-reveal"]')?.addEventListener('click', () => {
    window.toggleApiKeyReveal?.();
  });

  document.querySelector('[data-aip-action="clear-key"]')?.addEventListener('click', () => {
    window.clearApiKey?.();
  });

  const statusBadge = document.getElementById('server-keys-badge');
  statusBadge?.addEventListener('click', () => window.openAiProvidersModal?.());

}
