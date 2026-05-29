/**
 * v2 baseline migration — identity function.
 *
 * This is the canonical starting point for the migration chain.
 * Every .cine package at version 2 passes through here before
 * any later migration is applied. It performs no transformations.
 */

import { registerMigration } from './migration-registry';

import type { CineDocumentMap } from './migration-registry';

function migrateV2(docs: CineDocumentMap): CineDocumentMap {
  // v2 is the current format baseline — no transformations needed.
  return docs;
}

registerMigration({
  fromVersion: 2,
  toVersion: 2,
  migrate: migrateV2,
});
