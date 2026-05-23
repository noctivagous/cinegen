/**
 * Filesystem validation for directory-based .cine packages (no Vite glob).
 * Run: npx tsx source/scripts/validate-cine-package-fs.ts
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CINE_PROJECT_FORMAT,
  CINE_PROJECT_VERSION,
  type CineProjectManifest,
} from '../src/data/cine-project-types.ts';

function parseCineManifest(raw: string, sourceLabel: string): CineProjectManifest {
  const doc = JSON.parse(raw) as CineProjectManifest;
  if (doc.format !== CINE_PROJECT_FORMAT) {
    throw new Error(`Invalid format in ${sourceLabel}`);
  }
  if (doc.version !== CINE_PROJECT_VERSION) {
    throw new Error(`Unsupported version in ${sourceLabel}`);
  }
  if (!doc.id || !doc.name || !doc.documents?.screenplay) {
    throw new Error(`Invalid manifest in ${sourceLabel}`);
  }
  return doc;
}

const repoRoot = join(fileURLToPath(import.meta.url), '../../..');
const packageBasename = process.argv[2] ?? 'ascension-stream.cine';
const pkgRoot = join(repoRoot, 'source/src/data/project-files', packageBasename);
const manifest = parseCineManifest(
  readFileSync(join(pkgRoot, 'cine.manifest.json'), 'utf8'),
  packageBasename
);

function walk(dir: string, base = pkgRoot): Set<string> {
  const out = new Set<string>();
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const rel = relative(base, full).replace(/\\/g, '/');
    if (statSync(full).isDirectory()) {
      walk(full, base).forEach((p) => out.add(p));
    } else {
      out.add(rel);
    }
  }
  return out;
}

const files = walk(pkgRoot);
const errors: string[] = [];

function requireFile(rel: string) {
  if (!files.has(rel)) errors.push(`Missing required file: ${rel}`);
}

requireFile(manifest.documents.screenplay);
requireFile(manifest.documents.treatment);
requireFile(manifest.documents.storyboard);
if (manifest.documents.tree) requireFile(manifest.documents.tree);
if (manifest.documents.scenes) requireFile(manifest.documents.scenes);

function collectPaths(obj: unknown, out: string[] = []): string[] {
  if (!obj || typeof obj !== 'object') return out;
  if (Array.isArray(obj)) {
    obj.forEach((v) => collectPaths(v, out));
    return out;
  }
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if ((k === 'path' || k.endsWith('Path')) && typeof v === 'string' && v.includes('/')) {
      out.push(v);
    } else if (k === 'mediaRefs' || k === 'generatedRefs') {
      const refs = v as Record<string, unknown>;
      for (const bucket of Object.values(refs)) {
        if (Array.isArray(bucket)) bucket.forEach((p) => typeof p === 'string' && out.push(p));
      }
    } else {
      collectPaths(v, out);
    }
  }
  return out;
}

for (const docPath of Object.values(manifest.documents)) {
  if (!docPath || docPath.endsWith('outputs.cineoutputs')) continue;
  const full = join(pkgRoot, docPath);
  if (!existsSync(full)) {
    errors.push(`Missing document: ${docPath}`);
    continue;
  }
  const raw = readFileSync(full, 'utf8');
  if (docPath.endsWith('.cinescript')) continue;
  try {
    const json = JSON.parse(raw);
    for (const p of collectPaths(json)) {
      if (p.includes('..') || p.startsWith('/')) {
        errors.push(`Unsafe path in ${docPath}: ${p}`);
      } else if (!files.has(p)) {
        const scenes = JSON.parse(readFileSync(join(pkgRoot, 'production/scenes.cinescenes'), 'utf8'));
        const scene = Object.values(scenes).find((s: any) => s?.master?.outputPath === p);
        const status = (scene as any)?.master?.status;
        if (!(status === 'queued' || status === 'placeholder')) {
          errors.push(`Dangling path in ${docPath}: ${p}`);
        }
      }
    }
  } catch (e) {
    errors.push(`Invalid JSON ${docPath}: ${e}`);
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`OK ${manifest.name}: ${files.size} package files, all manifest paths resolve`);
