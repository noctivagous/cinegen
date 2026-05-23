/**
 * BootCoordinator — tracks which domains are ready during startup.
 *
 * Used to defer UI-hydration work until the services and DOM it depends on
 * are actually initialized.  Fixes the reload-time false-state bug where
 * status-bar indicators ran before `initModelStatusBar()` had built menus.
 */

export type BootDomain =
  | 'preferences'
  | 'store'
  | 'legacyModules'
  | 'coreServices'
  | 'projectTree'
  | 'workspace'
  | 'toolbar'
  | 'aiSettings'
  | 'setupAssistant'
  | 'shell'
  | 'keybindings'
  | 'console'
  | 'debug'
  | 'mcpBridge'
  | 'app';

const completed = new Set<BootDomain>();
const waiters = new Map<BootDomain, Array<() => void>>();

export function markBootReady(domain: BootDomain): void {
  if (completed.has(domain)) return;
  completed.add(domain);
  const callbacks = waiters.get(domain);
  if (callbacks) {
    callbacks.forEach((cb) => cb());
    waiters.delete(domain);
  }
}

export function whenBootReady(domain: BootDomain, callback: () => void): void {
  if (completed.has(domain)) {
    callback();
    return;
  }
  if (!waiters.has(domain)) {
    waiters.set(domain, []);
  }
  waiters.get(domain)!.push(callback);
}

export function isBootReady(domain: BootDomain): boolean {
  return completed.has(domain);
}

export function whenAllBootReady(domains: BootDomain[], callback: () => void): void {
  function check() {
    if (domains.every((d) => completed.has(d))) {
      callback();
    }
  }
  check();
  domains.forEach((d) => {
    if (!completed.has(d)) {
      if (!waiters.has(d)) {
        waiters.set(d, []);
      }
      waiters.get(d)!.push(check);
    }
  });
}
