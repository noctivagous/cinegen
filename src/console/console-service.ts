/**
 * ── NOTE ──
 * Console command history is stored via server-backed persistence.
 * This is terminal input history only — not API keys or settings.
 * ─────────
 */

// import type { Terminal } from '@xterm/xterm';
import { executeConsoleCommand, getAllConsoleCommands } from '@/console/command-registry';
import { ensureConsoleTerminal } from '@/console/console-terminal';
import { storageService } from '@/services/persistence';

const CONSOLE_HISTORY_KEY = 'cg:console:history';
const MAX_HISTORY = 200;

/** Minimal terminal surface (xterm disabled). */
type ConsoleTerminal = {
  writeln: (data: string) => void;
  write: (data: string) => void;
  onData: (cb: (data: string) => void) => void;
  focus: () => void;
  clear?: () => void;
};

let _terminal: ConsoleTerminal | null = null;
let _drawerVisible = false;
let _isBreakout = false;
let _history: string[] = [];
let _historyIndex = -1;
let _currentInput = '';

export function getTerminal(): ConsoleTerminal | null {
  return _terminal;
}

export function setTerminal(t: ConsoleTerminal | null): void {
  _terminal = t;
}

export function isConsoleDrawerVisible(): boolean {
  return _drawerVisible;
}

export function isConsoleBreakout(): boolean {
  return _isBreakout;
}

export function toggleConsoleDrawer(): void {
  const el = document.querySelector('cinegen-console') as HTMLElement | null;
  if (!el) return;
  _drawerVisible = !_drawerVisible;
  _isBreakout = false;
  el.classList.toggle('console--visible', _drawerVisible);
  el.classList.toggle('console--breakout', false);
  if (_drawerVisible) {
    void ensureConsoleTerminal();
  }
}

export function toggleConsoleBreakout(): void {
  const el = document.querySelector('cinegen-console') as HTMLElement | null;
  if (!el) return;
  _isBreakout = !_isBreakout;
  el.classList.toggle('console--breakout', _isBreakout);
  if (_drawerVisible || _isBreakout) _terminal?.focus();
}

export function closeConsoleDrawer(): void {
  const el = document.querySelector('cinegen-console') as HTMLElement | null;
  if (!el) return;
  _drawerVisible = false;
  _isBreakout = false;
  el.classList.remove('console--visible', 'console--breakout');
}

export function sendToAppConsole(text: string, silent = false): void {
  if (!silent && _terminal) {
    _terminal.writeln(`\x1b[2m> ${text}\x1b[0m`);
  }
  void runConsoleInput(text);
}

export function readAppConsole(): string {
  return _currentInput;
}

function loadHistory(): void {
  try {
    const raw = storageService.getItem(CONSOLE_HISTORY_KEY);
    if (raw) _history = JSON.parse(raw);
  } catch {
    _history = [];
  }
}

function saveHistory(): void {
  try {
    storageService.setItem(CONSOLE_HISTORY_KEY, JSON.stringify(_history.slice(-MAX_HISTORY)));
  } catch {
    /* noop */
  }
}

function addHistory(line: string): void {
  if (!line.trim()) return;
  _history.push(line);
  if (_history.length > MAX_HISTORY) _history.shift();
  _historyIndex = _history.length;
  saveHistory();
}

export function initConsoleInput(terminal: ConsoleTerminal): void {
  loadHistory();
  _terminal = terminal;

  terminal.onData((data) => {
    if (data === '\r') {
      const line = _currentInput;
      _currentInput = '';
      terminal.writeln('');
      addHistory(line);
      void runConsoleInput(line);
    } else if (data === '\x7f') {
      if (_currentInput.length > 0) {
        _currentInput = _currentInput.slice(0, -1);
        terminal.write('\b \b');
      }
    } else if (data === '\x1b[A') {
      if (_historyIndex > 0) {
        _historyIndex--;
        const line = _history[_historyIndex] ?? '';
        clearInputLine(terminal);
        terminal.write(line);
        _currentInput = line;
      }
    } else if (data === '\x1b[B') {
      if (_historyIndex < _history.length - 1) {
        _historyIndex++;
        const line = _history[_historyIndex] ?? '';
        clearInputLine(terminal);
        terminal.write(line);
        _currentInput = line;
      } else {
        _historyIndex = _history.length;
        clearInputLine(terminal);
        _currentInput = '';
      }
    } else if (data.charCodeAt(0) >= 32 && data.charCodeAt(0) < 127) {
      _currentInput += data;
      terminal.write(data);
    }
  });
}

function clearInputLine(terminal: ConsoleTerminal): void {
  const len = _currentInput.length;
  terminal.write('\x1b[2K\r');
  terminal.write('\x1b[32mcinegen>\x1b[0m ');
}

async function runConsoleInput(line: string): Promise<void> {
  const term = _terminal;
  if (!term) return;
  const result = await executeConsoleCommand(line);
  if (result === undefined || result === null) {
    /* no output */
  } else if (typeof result === 'string') {
    term.writeln(result);
  } else {
    const json = JSON.stringify(result, null, 2);
    json.split('\n').forEach((l) => term.writeln(l));
  }
  term.write('\x1b[32mcinegen>\x1b[0m ');
}
