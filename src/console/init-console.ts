/**
 * ── NOTE ──
 * The `reset` console command below clears app state from server-backed
 * persistence and API key endpoints.
 * ─────────
 */

import { registerConsoleCommand, getAllConsoleCommands, type ConsoleCommand } from '@/console/command-registry';
import { getTerminal, sendToAppConsole } from '@/console/console-service';
import { openModal, closeModal, getOpenModalId } from '@/services/modal-manager';
import { appShellStore } from '@/stores/app-shell';
import { AI_API_PROVIDERS, PROVIDERS_BY_MODALITY } from '@/data/provider-catalog';
import {
  SETUP_COMPLETE_STORAGE_KEY,
  SETUP_PROGRESS_STORAGE_KEY,
  AI_API_SETTINGS_STORAGE_KEY,
  API_KEYS_STORAGE_KEY,
  PROVIDER_MODEL_CATALOG_STORAGE_KEY,
  PREFERENCES_STORAGE_KEY,
  LOCAL_PROJECTS_STORAGE_KEY,
} from '@/constants/storage-keys';
import { storageService } from '@/services/persistence';

let _initialized = false;

function printHelp(): string {
  const cmds = getAllConsoleCommands();
  const maxName = Math.max(...cmds.map((c: ConsoleCommand) => c.name.length), 4);
  const lines: string[] = ['Available commands:', ''];
  cmds
    .sort((a: ConsoleCommand, b: ConsoleCommand) => a.name.localeCompare(b.name))
    .forEach((c: ConsoleCommand) => {
      const pad = ' '.repeat(maxName - c.name.length);
      lines.push(`  ${c.name}${pad}  ${c.description}`);
    });
  return lines.join('\r\n');
}

function buildCommands(): void {
  registerConsoleCommand({
    name: 'help',
    description: 'List all available console commands',
    handler: () => printHelp(),
  });

  registerConsoleCommand({
    name: 'window',
    description: 'Open a modal window (SA, settings, projects, guide, ai-assist, project-settings, debug)',
    usage: 'window <name>',
    handler: (args) => {
      const name = args[0]?.toLowerCase();
      const map: Record<string, string> = {
        sa: 'setup-assistant-modal',
        'setup-assistant': 'setup-assistant-modal',
        settings: 'settings-modal',
        projects: 'projects-modal',
        guide: 'guide-modal',
        'ai-assist': 'ai-assist-modal',
        'project-settings': 'project-settings-modal',
        debug: 'debug-modal',
      };
      const modalId = map[name];
      if (!modalId) return { error: `Unknown window: ${name}. Try: SA, settings, projects, guide, ai-assist, project-settings, debug` };
      openModal(modalId);
      return { ok: true, window: name, modalId };
    },
  });

  registerConsoleCommand({
    name: 'close',
    description: 'Close the topmost open modal',
    handler: () => {
      const id = getOpenModalId();
      if (!id) return { ok: false, message: 'No modal is open' };
      closeModal(id);
      return { ok: true, closed: id };
    },
  });

  registerConsoleCommand({
    name: 'readGUIState',
    description: 'Read current GUI state (open modal, current view, active project)',
    handler: () => ({
      openModal: getOpenModalId() ?? null,
      currentView: appShellStore.currentView,
      activeProjectId: appShellStore.activeProjectId,
      projectSidebarVisible: appShellStore.preferences.projectSidebarVisible,
      inspectorVisible: appShellStore.preferences.inspectorVisible,
    }),
  });

  registerConsoleCommand({
    name: 'readGUIContents',
    description: 'Read interactive DOM elements in the current view',
    handler: () => {
      const scan = (scope: string, selector: string) =>
        Array.from(document.querySelectorAll(selector)).map((el) => ({
          tag: el.tagName.toLowerCase(),
          id: (el as HTMLElement).id || null,
          text: (el as HTMLElement).textContent?.trim().slice(0, 60) || null,
          classes: (el as HTMLElement).className || null,
          dataset: Object.fromEntries(Object.entries((el as HTMLElement).dataset)),
        }));

      return {
        toolbar: scan('toolbar', 'cg-toolbar-split, .toolbar-btn'),
        modals: scan('modals', '[role="dialog"] button, [role="dialog"] select, [role="dialog"] input'),
        sidebar: scan('sidebar', '#project-tree [data-name], #project-tree .tree-item'),
        workspace: scan('workspace', '#workspace-container button, #workspace-container select'),
        inspector: scan('inspector', '#inspector-panel button, #inspector-panel input'),
      };
    },
  });

  registerConsoleCommand({
    name: 'aiProviders',
    description: 'List configured AI providers',
    handler: () => AI_API_PROVIDERS.map((p) => ({ id: p.id, label: p.label })),
  });

  registerConsoleCommand({
    name: 'aiModels',
    description: 'List available AI models by provider and modality',
    handler: () => PROVIDERS_BY_MODALITY,
  });

  registerConsoleCommand({
    name: 'aiModalities',
    description: 'List supported AI modalities',
    handler: () => Object.keys(PROVIDERS_BY_MODALITY),
  });

  registerConsoleCommand({
    name: 'project',
    description: 'Project actions: new, open, save, close',
    usage: 'project <action>',
    handler: (args) => {
      const action = args[0]?.toLowerCase();
      if (action === 'new') {
        window.openBlankProjectWizard?.();
        return { ok: true, action };
      }
      if (action === 'open') {
        window.openProjectsModal?.();
        return { ok: true, action };
      }
      if (action === 'save') {
        window.saveProject?.();
        return { ok: true, action };
      }
      if (action === 'close') {
        appShellStore.setActiveProjectId('');
        return { ok: true, action };
      }
      return { error: `Unknown project action: ${action}. Try: new, open, save, close` };
    },
  });

  registerConsoleCommand({
    name: 'settings',
    description: 'Open settings modal',
    handler: () => {
      window.openSettingsModal?.();
      return { ok: true };
    },
  });

  registerConsoleCommand({
    name: 'prefs',
    description: 'Read or write app preferences',
    usage: 'prefs [key] [value]',
    handler: (args) => {
      if (args.length === 0) return appShellStore.preferences;
      const key = args[0];
      if (args.length === 1) {
        return { [key]: (appShellStore.preferences as Record<string, unknown>)[key] };
      }
      const value = args[1];
      const num = Number(value);
      const parsed = Number.isNaN(num) ? (value === 'true' ? true : value === 'false' ? false : value) : num;
      appShellStore.patchPreferences({ [key]: parsed } as Partial<typeof appShellStore.preferences>);
      return { ok: true, key, value: parsed };
    },
  });

  registerConsoleCommand({
    name: 'populate',
    description: 'Populate demo data (project, assets, script)',
    usage: 'populate <target>',
    handler: (args) => {
      const target = args[0]?.toLowerCase();
      if (target === 'project') {
        window.openBlankProjectWizard?.();
        return { ok: true, target };
      }
      if (target === 'script') {
        window.insertFountainSnippet?.('scene');
        return { ok: true, target };
      }
      return { error: `Unknown populate target: ${target}. Try: project, assets, script` };
    },
  });

  registerConsoleCommand({
    name: 'clear',
    description: 'Clear the console',
    handler: () => {
      getTerminal()?.clear?.();
      return undefined;
    },
  });

  registerConsoleCommand({
    name: 'evaluate',
    description: 'Evaluate a JavaScript expression in the app context and return the result',
    usage: 'evaluate <expression>',
    handler: (args) => {
      const expr = args.join(' ');
      if (!expr) return { error: 'Usage: evaluate <expression>' };
      try {
        const result = (0, eval)(expr);
        return result !== undefined ? result : null;
      } catch (e) {
        return { error: String(e) };
      }
    },
  });

  registerConsoleCommand({
    name: 'inventory',
    description: 'Scan current view for all interactive DOM elements (buttons, inputs, selects, toggles)',
    handler: () => {
      const interactiveSelectors = [
        'button', 'select', 'input:not([type="hidden"])', 'textarea',
        'details', '[role="button"]', '[role="tab"]', '[role="menuitem"]',
        '[role="radio"]', '[role="checkbox"]', '[role="switch"]',
        '[role="link"]', '[role="option"]', '[role="combobox"]',
        'a[href]', '.toolbar-btn', '.cg-nspopup', '.cg-field',
        '.sa-test-status', '.sa-model-caps',
        '[tabindex]:not([tabindex="-1"])',
      ];
      const els = document.querySelectorAll(interactiveSelectors.join(','));
      return Array.from(els)
        .filter((el) => (el as HTMLElement).offsetParent !== null || (el as HTMLElement).offsetParent === null && (el as HTMLElement).getClientRects?.()?.length > 0)
        .map((el) => {
          const rect = el.getBoundingClientRect();
          return {
            tag: el.tagName.toLowerCase(),
            id: (el as HTMLElement).id || null,
            text: (el as HTMLElement).textContent?.trim().slice(0, 120) || null,
            type: el.getAttribute('type') || null,
            name: el.getAttribute('name') || null,
            classes: (el as HTMLElement).className || null,
            value: 'value' in el ? (el as HTMLInputElement).value : undefined,
            placeholder: el.getAttribute('placeholder') || null,
            rect: rect.width > 0 && rect.height > 0
              ? { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) }
              : null,
            dataset: Object.fromEntries(
              Object.entries((el as HTMLElement).dataset).filter(([, v]) => v !== undefined)
            ),
          };
        });
    },
  });

  registerConsoleCommand({
    name: 'click',
    description: 'Click an element by CSS selector. Falls back to text matching if selector fails.',
    usage: 'click <selector> [--text]',
    handler: (args) => {
      if (!args.length) return { error: 'Usage: click <selector>' };
      const useText = args[0] === '--text' || args[0] === '-t';
      const query = useText ? args.slice(1).join(' ') : args.join(' ');
      if (!query) return { error: 'Usage: click <selector>' };

      let el = null as HTMLElement | null;
      if (!useText) {
        const all = document.querySelectorAll(query);
        if (all.length > 0) {
          el = (Array.from(all).find(
            (e) => /^(button|input|select|textarea|a)$/i.test(e.tagName)
          ) || all[all.length - 1]) as HTMLElement;
        }
      }
      if (!el) {
        // Fallback: find by text content
        const candidates = document.querySelectorAll(
          'button, a, [role="button"], [role="tab"], [role="menuitem"], .toolbar-btn, summary'
        );
        const q = query.toLowerCase();
        el = Array.from(candidates).find(
          (e) => (e.textContent?.toLowerCase().includes(q))
        ) as HTMLElement;
      }
      if (!el) return { error: `Element not found: ${query}` };
      el.click();
      return { ok: true, clicked: query, tag: el.tagName.toLowerCase(), id: el.id || null, text: el.textContent?.trim().slice(0, 80) || null };
    },
  });

  registerConsoleCommand({
    name: 'fill',
    description: 'Fill a form input/textarea/select by CSS selector and dispatch input+change events',
    usage: 'fill <selector> <value>',
    handler: (args) => {
      if (args.length < 2) return { error: 'Usage: fill <selector> <value>' };
      const selector = args[0];
      const value = args.slice(1).join(' ');
      const el = document.querySelector(selector) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
      if (!el) return { error: `Element not found: ${selector}` };
      const tag = el.tagName.toLowerCase();
      if (tag === 'select') {
        (el as HTMLSelectElement).value = value;
        el.dispatchEvent(new Event('change', { bubbles: true }));
      } else if (tag === 'input' || tag === 'textarea') {
        const input = el as HTMLInputElement;
        const proto = Object.getPrototypeOf(input);
        const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        if (nativeSetter) {
          nativeSetter.call(input, value);
        } else {
          input.value = value;
        }
        input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        return { error: `Unsupported element type: ${tag}` };
      }
      return { ok: true, selector, value, tag };
    },
  });

  registerConsoleCommand({
    name: 'reset',
    description: 'Reset all app state (server store, API keys, setup progress)',
    handler: async () => {
      const keys = [
        SETUP_COMPLETE_STORAGE_KEY,
        SETUP_PROGRESS_STORAGE_KEY,
        AI_API_SETTINGS_STORAGE_KEY,
        API_KEYS_STORAGE_KEY,
        PROVIDER_MODEL_CATALOG_STORAGE_KEY,
        PREFERENCES_STORAGE_KEY,
        LOCAL_PROJECTS_STORAGE_KEY,
      ];
      keys.forEach((k) => {
        try { storageService.removeItem(k); } catch { /* noop */ }
      });
      try {
        const resp = await fetch('/api/settings/keys');
        const data = await resp.json();
        const vendorIds = (data.vendors || []).map((v: { id: string }) => v.id).filter(Boolean);
        await Promise.all(vendorIds.map((id: string) =>
          fetch(`/api/settings/keys/${encodeURIComponent(id)}`, { method: 'DELETE' })
        ));
      } catch { /* server not available */ }
      window.location.reload();
      return { ok: true, cleared: keys.length };
    },
  });
}

/** Register console commands only (xterm loads on first drawer open). */
export function initConsoleCommands(): void {
  if (_initialized) return;
  buildCommands();
  _initialized = true;
}

/** @deprecated Use initConsoleCommands — terminal is created lazily. */
export function initConsole(): void {
  initConsoleCommands();
}
