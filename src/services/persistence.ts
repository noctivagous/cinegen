/**
 * Persistence abstraction — enables migration from localStorage to a server
 * backend without touching every call site.
 *
 * VITE_PROJECT_PERSISTENCE_MODE (local | server) is read at runtime.
 * ServerPersistence uses an in-memory cache with async background flush so
 * that the synchronous Persistence interface is preserved.
 *
 * ── CRITICAL NOTE ──
 * In any collaborative or multi-user deployment, do NOT use localStorage for
 * API keys, provider settings, or any user/team configuration. localStorage
 * is single-origin, single-machine only — it does not sync across users or
 * devices. Use ServerPersistence (VITE_PROJECT_PERSISTENCE_MODE=server) or
 * the dedicated /api/settings/* endpoints instead.
 *
 * The LocalStoragePersistence class below exists for single-user/development
 * convenience only. Do NOT add new localStorage write paths for sensitive data.
 * ──────────────────
 */

export interface Persistence {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

class LocalStoragePersistence implements Persistence {
  getItem(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  setItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* noop — quota exceeded or private mode */
    }
  }

  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      /* noop */
    }
  }
}

class ServerPersistence implements Persistence {
  private _baseUrl: string;
  private _cache = new Map<string, string | null>();
  private _pending = new Map<string, string | undefined>(); // undefined means deletion
  private _flushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this._baseUrl = typeof window !== 'undefined'
      ? window.location.origin
      : 'http://localhost:5173';
  }

  /** Preload a set of known keys into the cache so sync reads work. */
  async preload(keys: string[]): Promise<void> {
    await Promise.all(
      keys.map(async (key) => {
        try {
          const res = await fetch(`${this._baseUrl}/api/settings/store/${encodeURIComponent(key)}`);
          if (res.ok) {
            const data = await res.json();
            this._cache.set(key, data.value ?? null);
          }
        } catch {
          /* ignore preload failure for individual key */
        }
      })
    );
  }

  getItem(key: string): string | null {
    if (this._cache.has(key)) return this._cache.get(key) ?? null;
    return null;
  }

  setItem(key: string, value: string): void {
    this._cache.set(key, value);
    this._pending.set(key, value);
    this._scheduleFlush();
  }

  removeItem(key: string): void {
    this._cache.set(key, null);
    this._pending.set(key, undefined);
    this._scheduleFlush();
  }

  private _scheduleFlush(): void {
    if (this._flushTimer) return;
    this._flushTimer = setTimeout(() => this._flush(), 150);
  }

  private async _flush(): Promise<void> {
    this._flushTimer = null;
    const batch = new Map(this._pending);
    this._pending.clear();
    for (const [key, value] of batch) {
      try {
        if (value === undefined) {
          await fetch(`${this._baseUrl}/api/settings/store/${encodeURIComponent(key)}`, {
            method: 'DELETE',
          });
        } else {
          await fetch(`${this._baseUrl}/api/settings/store/${encodeURIComponent(key)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value }),
          });
        }
      } catch {
        /* noop — server unavailable */
      }
    }
  }
}

function createPersistence(): Persistence {
  const mode = (import.meta.env.VITE_PROJECT_PERSISTENCE_MODE as string) || 'local';
  if (mode === 'server') {
    return new ServerPersistence();
  }
  return new LocalStoragePersistence();
}

/** Singleton persistence instance. */
export const storageService: Persistence = createPersistence();

/** Preload server-side keys into the cache when running in server mode. */
export async function preloadServerPersistence(keys: string[]): Promise<void> {
  if (storageService instanceof ServerPersistence) {
    await storageService.preload(keys);
  }
}
