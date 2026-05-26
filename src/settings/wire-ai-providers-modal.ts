/** Wire AI providers modal static controls (replaces onclick in index.html). */
import {
  closeAiProvidersModal,
  openAiProvidersModal,
  saveAiProvidersModal,
} from '@/settings/ai-api-settings-bundle';
import {
  aiProvidersAddVendor,
  aiProvidersRemoveSelected,
  clearApiKey,
  toggleApiKeyReveal,
} from '@/settings/api-keys-settings-bundle';
import { openSettingsModal } from '@/toolbar/toolbar-project-modals-service';

export function wireAiProvidersModal(): void {
  const modal = document.getElementById('ai-providers-modal');
  if (!modal || modal.dataset.cgAipWired === '1') return;
  modal.dataset.cgAipWired = '1';

  modal.querySelector('.project-settings-modal-backdrop')?.addEventListener('click', () => {
    closeAiProvidersModal();
  });

  modal.querySelector('.project-settings-modal-close')?.addEventListener('click', () => {
    closeAiProvidersModal();
  });

  document.querySelectorAll('[data-cg-close="ai-providers-modal"]').forEach((el) => {
    el.addEventListener('click', () => closeAiProvidersModal());
  });

  document.querySelector('[data-aip-action="save"]')?.addEventListener('click', () => {
    void saveAiProvidersModal();
  });

  document.querySelector('[data-aip-action="cancel"]')?.addEventListener('click', () => {
    closeAiProvidersModal();
  });

  document.querySelector('[data-aip-action="back-settings"]')?.addEventListener('click', () => {
    closeAiProvidersModal();
    openSettingsModal();
  });

  document.querySelector('[data-aip-action="add-vendor"]')?.addEventListener('click', () => {
    aiProvidersAddVendor();
  });

  document.querySelector('[data-aip-action="remove-vendor"]')?.addEventListener('click', () => {
    aiProvidersRemoveSelected();
  });

  document.querySelector('[data-aip-action="toggle-key-reveal"]')?.addEventListener('click', () => {
    toggleApiKeyReveal();
  });

  document.querySelector('[data-aip-action="clear-key"]')?.addEventListener('click', () => {
    clearApiKey();
  });

  const statusBadge = document.getElementById('server-keys-badge');
  statusBadge?.addEventListener('click', () => {
    void openAiProvidersModal();
  });

}
