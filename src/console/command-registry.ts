export interface ConsoleCommand {
  name: string;
  description: string;
  usage?: string;
  handler: (args: string[]) => unknown | Promise<unknown>;
}

const registry = new Map<string, ConsoleCommand>();

export function registerConsoleCommand(cmd: ConsoleCommand): void {
  registry.set(cmd.name.toLowerCase(), cmd);
}

export function unregisterConsoleCommand(name: string): void {
  registry.delete(name.toLowerCase());
}

export function getConsoleCommand(name: string): ConsoleCommand | undefined {
  return registry.get(name.toLowerCase());
}

export function getAllConsoleCommands(): ConsoleCommand[] {
  return Array.from(registry.values());
}

export function executeConsoleCommand(input: string): Promise<unknown> {
  const trimmed = input.trim();
  if (!trimmed) return Promise.resolve(undefined);

  const tokens = trimmed.match(/"[^"]*"|'[^']*'|\S+/g) ?? [];
  const parts = tokens.map((t) => {
    if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
      return t.slice(1, -1);
    }
    return t;
  });

  const name = parts[0];
  const args = parts.slice(1);
  const cmd = getConsoleCommand(name);
  if (!cmd) {
    return Promise.resolve({ error: `Unknown command: "${name}". Type "help" for available commands.` });
  }

  try {
    const result = cmd.handler(args);
    return Promise.resolve(result);
  } catch (err) {
    return Promise.resolve({ error: String(err) });
  }
}
