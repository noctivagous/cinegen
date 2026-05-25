import { render } from 'lit';
import { debugModalTemplate } from '@/components/modals/templates/debug-modal.template';
import './cinegen-debug-modal';

let mounted = false;

/** Inject debug modal DOM + register custom element on first open. */
export function mountDebugModalIfNeeded(): void {
  if (mounted || document.getElementById('debug-modal')) {
    mounted = true;
    return;
  }
  const host = document.querySelector('cinegen-app-modals');
  if (!host) return;
  const wrap = document.createElement('div');
  render(debugModalTemplate, wrap);
  while (wrap.firstChild) {
    host.appendChild(wrap.firstChild);
  }
  document.querySelectorAll('[data-cg-close="debug-modal"]').forEach((el) => {
    el.addEventListener('click', () => (window as any).closeDebugModal?.());
  });
  mounted = true;
}

// Side effect for dynamic import()
mountDebugModalIfNeeded();
