/** Synchronous DOM-only workspace visibility for boot (before panel chunks load). */
export function applyBootWorkspaceVisibility(viewName: string): void {
  document.querySelectorAll('[id^="view-"]').forEach((el) => el.classList.add('hidden'));
  const view = document.getElementById(`view-${viewName}`);
  if (view) view.classList.remove('hidden');
}
