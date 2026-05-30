/**
 * Filesystem validation for directory-based .cine packages (no Vite glob).
 * Run: npm run validate:cine
 * Optional: npm run validate:cine -- ascension-stream.cine
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CINE_PROJECT_FORMAT,
  CINE_PROJECT_VERSION,
  type CineProjectManifest,
} from '../src/data/cine-project-types.ts';
import { validateCrossFileIntegrity } from '../src/data/cine-project-validator.ts';

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

function walk(dir: string, base: string): Set<string> {
  const out = new Set<string>();
  if (!existsSync(dir)) return out;
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

function loadJsonDoc(pkgRoot: string, relPath: string | undefined): unknown {
  if (!relPath) return undefined;
  const full = join(pkgRoot, relPath);
  if (!existsSync(full)) return undefined;
  return JSON.parse(readFileSync(full, 'utf8'));
}

function validatePackage(pkgRoot: string, label: string): string[] {
  const errors: string[] = [];
  const manifestPath = join(pkgRoot, 'cine.manifest.json');
  if (!existsSync(manifestPath)) {
    errors.push(`[${label}] Missing cine.manifest.json`);
    return errors;
  }

  let manifest: CineProjectManifest;
  try {
    manifest = parseCineManifest(readFileSync(manifestPath, 'utf8'), label);
  } catch (e) {
    errors.push(`[${label}] ${e instanceof Error ? e.message : String(e)}`);
    return errors;
  }

  const files = walk(pkgRoot, pkgRoot);

  function requireFile(rel: string) {
    if (!files.has(rel)) errors.push(`[${label}] Missing required file: ${rel}`);
  }

  requireFile(manifest.documents.screenplay);

  const isServerScaffold = label.startsWith('server/');
  if (!isServerScaffold) {
    requireFile(manifest.documents.treatment);
    requireFile(manifest.documents.storyboard);
    if (manifest.documents.tree) requireFile(manifest.documents.tree);
    if (manifest.documents.scenes) requireFile(manifest.documents.scenes);
  }

  const scenesPath = manifest.documents.scenes;
  let scenesDoc: Record<string, unknown> | undefined;

  for (const docPath of Object.values(manifest.documents)) {
    if (!docPath || docPath.endsWith('outputs.cineoutputs')) continue;
    const full = join(pkgRoot, docPath);
    if (!existsSync(full)) {
      if (!isServerScaffold) {
        errors.push(`[${label}] Missing document: ${docPath}`);
      }
      continue;
    }
    const raw = readFileSync(full, 'utf8');
    if (docPath.endsWith('.cinescript')) continue;
    try {
      const json = JSON.parse(raw);
      if (docPath === scenesPath) {
        scenesDoc =
          json && typeof json === 'object' && !Array.isArray(json)
            ? (json as Record<string, unknown>)
            : undefined;
      }
      for (const p of collectPaths(json)) {
        if (p.includes('..') || p.startsWith('/')) {
          errors.push(`[${label}] Unsafe path in ${docPath}: ${p}`);
        } else if (!files.has(p)) {
          const optionalMedia =
            p.startsWith('sound/') || p.startsWith('media/') || p.startsWith('assets/');
          if (optionalMedia) continue;
          if (scenesDoc) {
            const scene = Object.values(scenesDoc).find(
              (s: unknown) =>
                s &&
                typeof s === 'object' &&
                (s as { master?: { outputPath?: string } }).master?.outputPath === p
            );
            const status = (scene as { master?: { status?: string } })?.master?.status;
            if (status === 'queued' || status === 'placeholder') continue;
          }
          errors.push(`[${label}] Dangling path in ${docPath}: ${p}`);
        }
      }
    } catch (e) {
      errors.push(`[${label}] Invalid JSON ${docPath}: ${e}`);
    }
  }

  const hasCoreDocs =
    files.has(manifest.documents.treatment) &&
    files.has(manifest.documents.storyboard) &&
    Boolean(scenesPath && files.has(scenesPath));

  const runCrossFile =
    process.argv.includes('--cross-file') &&
    hasCoreDocs &&
    scenesDoc &&
    manifest.documents.storyboard;

  if (runCrossFile) {
    try {
      const storyboardRaw = loadJsonDoc(pkgRoot, manifest.documents.storyboard);
      const storyboard =
        storyboardRaw && typeof storyboardRaw === 'object'
          ? (storyboardRaw as { frames?: unknown[] })
          : undefined;
      validateCrossFileIntegrity({
        packageBasename: label,
        scenePath: manifest.documents.scenes,
        storyboardPath: manifest.documents.storyboard,
        locationsPath: manifest.documents.locations,
        charactersPath: manifest.documents.characters,
        scenes: scenesDoc,
        storyboard,
        locations: loadJsonDoc(pkgRoot, manifest.documents.locations) as Record<string, unknown>[] | undefined,
        characters: loadJsonDoc(pkgRoot, manifest.documents.characters) as Record<string, unknown>[] | undefined,
        packageFileSet: label.startsWith('server/') ? undefined : files,
      });
    } catch (e) {
      errors.push(`[${label}] Cross-file integrity: ${e instanceof Error ? e.message : String(e)}`);
    }
  } else if (label.startsWith('server/') && !hasCoreDocs) {
    console.warn(`[${label}] Skipping deep validation — incomplete scaffold (missing core documents).`);
  }

  return errors;
}

function listServerProjectDirs(serverProjectsRoot: string): string[] {
  if (!existsSync(serverProjectsRoot)) return [];
  return readdirSync(serverProjectsRoot)
    .filter((name) => name.endsWith('.cine'))
    .map((name) => join(serverProjectsRoot, name))
    .filter((full) => existsSync(join(full, 'cine.manifest.json')));
}

const repoRoot = join(fileURLToPath(import.meta.url), '../../..');
const bundledRoot = join(repoRoot, 'source/src/data/project-files');
const serverRoot = join(repoRoot, 'source/server/projects');

const targets: Array<{ root: string; label: string }> = [];

const cliPackage = process.argv[2];
if (cliPackage) {
  const inBundled = join(bundledRoot, cliPackage);
  const inServer = join(serverRoot, cliPackage);
  if (existsSync(join(inBundled, 'cine.manifest.json'))) {
    targets.push({ root: inBundled, label: cliPackage });
  } else if (existsSync(join(inServer, 'cine.manifest.json'))) {
    targets.push({ root: inServer, label: `server/${cliPackage}` });
  } else {
    console.error(`Package not found: ${cliPackage}`);
    process.exit(1);
  }
} else {
  targets.push({ root: join(bundledRoot, 'ascension-stream.cine'), label: 'ascension-stream.cine' });
  for (const dir of listServerProjectDirs(serverRoot)) {
    targets.push({ root: dir, label: `server/${relative(serverRoot, dir)}` });
  }
}

const allErrors: string[] = [];
for (const { root, label } of targets) {
  allErrors.push(...validatePackage(root, label));
}

if (allErrors.length) {
  console.error(allErrors.join('\n'));
  process.exit(1);
}

console.log(`OK validated ${targets.length} package(s): ${targets.map((t) => t.label).join(', ')}`);
