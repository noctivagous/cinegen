/**
 * CineGen .cine format version migration registry.
 *
 * Each migration module exports a function that receives the raw document
 * strings (filename → content) and returns updated strings. Migrations are
 * additive only: they may rename or add keys but never delete data.
 *
 * The registry maps source version numbers to migration functions.
 * A migration from v2 → v4 would run v2→v3 then v3→v4 sequentially.
 */

export type CineDocumentMap = Record<string, string>;

export type CineMigrationFn = (docs: CineDocumentMap) => CineDocumentMap;

export interface CineMigration {
  fromVersion: number;
  toVersion: number;
  migrate: CineMigrationFn;
}

const registry = new Map<number, CineMigration>();

export function registerMigration(m: CineMigration): void {
  registry.set(m.fromVersion, m);
}

export function getMigration(fromVersion: number): CineMigration | undefined {
  return registry.get(fromVersion);
}

/**
 * Run migrations sequentially from `fromVersion` up to `targetVersion`.
 *
 * Each step looks up the migration for the current version, applies it,
 * and increments the version. If a required step is missing, throws.
 *
 * Returns the migrated document map. The manifest JSON inside the map
 * has its `version` field updated by the migration function.
 */
export function runMigrations(
  docs: CineDocumentMap,
  fromVersion: number,
  targetVersion: number
): CineDocumentMap {
  let current = docs;
  let version = fromVersion;

  while (version < targetVersion) {
    const migration = getMigration(version);
    if (!migration) {
      throw new Error(
        `No migration registered from .cine format version ${version} to ${version + 1}. ` +
        `Cannot upgrade package to target version ${targetVersion}.`
      );
    }
    current = migration.migrate(current);
    version = migration.toVersion;
  }

  return current;
}
