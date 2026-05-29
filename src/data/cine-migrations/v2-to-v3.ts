/**
 * v2 → v3 migration stub.
 *
 * This module is a placeholder. When a v3 format is designed, implement
 * the actual transformation here and register it. Until then, attempting
 * to load a v3 package will fail gracefully with the "no migration" error
 * from the registry.
 *
 * The migration function receives the full document map (including the
 * manifest) and returns updated document strings. It must:
 * - Parse each document it intends to modify
 * - Apply additive changes (new keys, renamed keys with backward aliases)
 * - Re-serialize to JSON strings
 * - Update the manifest's `version` field to 3
 */

import { registerMigration } from './migration-registry';
import type { CineDocumentMap } from './migration-registry';

function migrateV2ToV3(docs: CineDocumentMap): CineDocumentMap {
  // Placeholder — no v3 format definition exists yet.
  // When implemented:
  //   1. Parse manifest from docs['cine.manifest.json']
  //   2. Parse and transform each affected document
  //   3. Update manifest.version = 3
  //   4. Return updated docs map
  throw new Error(
    '.cine format v3 has not been defined yet. ' +
    'Please upgrade CineGen to a version that supports this package format.'
  );
}

registerMigration({
  fromVersion: 2,
  toVersion: 3,
  migrate: migrateV2ToV3,
});
