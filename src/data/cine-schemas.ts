/**
 * Zod schemas for `.cine` document types.
 *
 * These schemas serve as the canonical structural definition for each
 * document. They are used for validation, produce inferred TypeScript types,
 * and can power automatic migrations via `.transform()`.
 *
 * Coverage is introduced opportunistically: start with the manifest
 * (small, high-traffic, version-sensitive) and grow to document schemas
 * as features touch each type.
 */

import { z } from 'zod';

/* ── Manifest ───────────────────────────────────────────────────────────── */

export const CineManifestDocumentsSchema = z.record(z.string(), z.string());

export const CineManifestSchema = z.object({
  format: z.literal('cinegen-package'),
  version: z.number().int().min(1).max(100),
  id: z.string().min(1),
  name: z.string().min(1),
  documents: CineManifestDocumentsSchema,
  settings: z.record(z.string(), z.unknown()).optional(),
});

export type CineManifestZod = z.infer<typeof CineManifestSchema>;

/**
 * Parse and validate a manifest JSON string using Zod.
 *
 * Returns the parsed object on success. On failure, throws a ZodError
 * with a structured path to the failing field (e.g. `.documents` or `.version`).
 */
export function parseManifestZod(raw: string): CineManifestZod {
  const parsed = JSON.parse(raw);
  return CineManifestSchema.parse(parsed);
}
