/**
 * Server-backed persistence abstraction.
 *
 * Storage reads/writes in the app should go through this module so state is
 * shared across browser instances that connect to the same server URL.
 * ServerPersistence uses an in-memory cache with async background flush so
 * the synchronous Persistence interface remains stable for existing call sites.
 */

export interface Persistence {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
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

/** Singleton persistence instance. */
const serverPersistence = new ServerPersistence();
export const storageService: Persistence = serverPersistence;

/** Preload server-side keys into the cache so sync reads work on boot. */
export async function preloadServerPersistence(keys: string[]): Promise<void> {
  await serverPersistence.preload(keys);
}
