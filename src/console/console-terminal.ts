// Developer console / xterm disabled — re-enable with main.ts, index.html, and init-keybindings.
// import type { Terminal } from '@xterm/xterm';
// import { initConsoleInput, setTerminal } from '@/console/console-service';

// let _initPromise: Promise<Terminal | null> | null = null;

/** @deprecated Console disabled — was: lazily create xterm when drawer opens. */
export function ensureConsoleTerminal(): Promise<null> {
  return Promise.resolve(null);
}

/*
export function ensureConsoleTerminal(): Promise<Terminal | null> {
  if (_initPromise) return _initPromise;
  _initPromise = (async () => {
    const el = document.querySelector('cinegen-console') as HTMLElement | null;
    if (!el) return null;

    const terminalContainer = el.querySelector('.console-terminal') as HTMLElement | null;
    if (!terminalContainer) return null;

    const [{ Terminal }, { FitAddon }] = await Promise.all([
      import('@xterm/xterm'),
      import('@xterm/addon-fit'),
    ]);
    await import('@xterm/xterm/css/xterm.css');

    const term = new Terminal({
      theme: {
        background: '#1a1a1e',
        foreground: '#e0e0e0',
        cursor: '#e0e0e0',
        selectionBackground: '#3a3a4e',
        black: '#1a1a1e',
        brightBlack: '#5a5a6e',
        red: '#e06c75',
        green: '#98c379',
        yellow: '#e5c07b',
        blue: '#61afef',
        magenta: '#c678dd',
        cyan: '#56b6c2',
        white: '#e0e0e0',
      },
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 13,
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 5000,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalContainer);
    fitAddon.fit();

    setTerminal(term);
    initConsoleInput(term);

    term.writeln('\x1b[36mCineGen Developer Console\x1b[0m — Type \x1b[33mhelp\x1b[0m for commands.');
    term.write('\x1b[32mcinegen>\x1b[0m ');

    const resizeObserver = new ResizeObserver(() => fitAddon.fit());
    resizeObserver.observe(terminalContainer);

    const breakoutBtn = el.querySelector('.console-breakout-btn') as HTMLButtonElement | null;
    if (breakoutBtn) {
      breakoutBtn.addEventListener('click', () => {
        el.classList.toggle('console--breakout');
        fitAddon.fit();
        term.focus();
      });
    }

    const closeBtn = el.querySelector('.console-close-btn') as HTMLButtonElement | null;
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        el.classList.remove('console--visible', 'console--breakout');
      });
    }

    return term;
  })();
  return _initPromise;
}
*/
