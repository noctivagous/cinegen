import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const SRC_DIR = path.resolve(process.cwd(), 'src');

/** Files that may still write window.CineGen.* globals (legacy bridge). */
const ALLOWLIST = new Set([
  'boot/app-bootstrap.ts',
  'components/panels/cinegen-treatment-panel.ts',
  'services/preferences.ts',
  'services/status-bar-service.ts',
  'workspace/treatment-form-service.ts',
  'workspace/workspace-bundle.ts',
]);

/**
 * Files that legacy-write window.* props via cast patterns.
 * These are the second wave of Phase C/E migration targets.
 */
const CAST_ALLOWLIST = new Set([
  'assets/assets-bundle.ts',
  'bridge/compat.ts',
  'storyboard/storyboard-reference-bank.ts',
  'components/panels/cinegen-inspector.ts',
  'components/panels/cinegen-storyboard.ts',
  'services/chip-bundle.ts',
  'services/section-visibility-service.ts',
  'setup-assistant/setup-assistant-bundle.ts',
  'storyboard/storyboard-bundle.ts',
  'toolbar/toolbar-menus-service.ts',
  'toolbar/toolbar-modals-service.ts',
  'toolbar/toolbar-project-modals-service.ts',
  'tree/project-tree-service.ts',
  'workspace/script-info-utils.ts',
  'workspace/shot-frame-bridge.ts',
]);

const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

// — Pattern groups —

/** Direct window.CineGen assignment (window.CineGen = / window.CineGen.xxx =) */
const CINEGEN_PATTERNS = [
  /\bwindow\.CineGen\s*=/,
  /\bwindow\.CineGen\.[A-Za-z_$][\w$]*\s*=/,
];

/** Cast-based window property writes: (window as any).xxx = / (window as unknown …).xxx =
 *  Negative lookahead (?!=) avoids matching typeof-guard reads (===, !==, ==). */
const CAST_PATTERNS = [
  /\(window\s+as\s+any\)\s*\.\s*[A-Za-z_$][\w$]*\s*=(?!=)/,
  /\(window\s+as\s+unknown\b[^)]*\)\s*\.\s*[A-Za-z_$][\w$]*\s*=(?!=)/,
];

/** All window.* = direct writes (for the allowlisted-file audit pass). */
const DIRECT_WINDOW_WRITE = /\bwindow\.([A-Za-z_$][\w$]*)\s*=/;

// — Helpers —

async function collectFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = path.join(dir, entry.name);
      if (entry.isDirectory()) return collectFiles(absolutePath);
      if (!SCAN_EXTENSIONS.has(path.extname(entry.name))) return [];
      return [absolutePath];
    })
  );
  return files.flat();
}

function normalizeRelativePath(absolutePath) {
  return path.relative(SRC_DIR, absolutePath).replaceAll(path.sep, '/');
}

function onLine(line, patterns) {
  return patterns.some((pattern) => pattern.test(line));
}

// — Main —

async function main() {
  const files = await collectFiles(SRC_DIR);
  let exitCode = 0;

  // ——— Pass 1: hard-fail on window.CineGen.* writes outside ALLOWLIST ———
  const cinegenViolations = [];

  for (const filePath of files) {
    const relativePath = normalizeRelativePath(filePath);
    if (ALLOWLIST.has(relativePath)) continue;
    const content = await readFile(filePath, 'utf8');
    const lines = content.split(/\r?\n/);

    for (let idx = 0; idx < lines.length; idx += 1) {
      if (!onLine(lines[idx], CINEGEN_PATTERNS)) continue;
      cinegenViolations.push({
        file: relativePath,
        line: idx + 1,
        snippet: lines[idx].trim(),
      });
    }
  }

  if (cinegenViolations.length) {
    exitCode = 1;
    console.error('window.CineGen write guard FAILED.\n');
    console.error('Add new writes only in the ALLOWLIST (temporary bridge files).');
    console.error('If a new file must be temporary, document why and update ALLOWLIST intentionally.\n');
    for (const v of cinegenViolations) {
      console.error(`  ${v.file}:${v.line}  ${v.snippet}`);
    }
    console.error('');
  } else {
    console.log('window.CineGen write guard — passed.');
  }

  // ——— Pass 2: hard-fail on (window as any).xxx = writes outside CAST_ALLOWLIST ———
  const castViolations = [];

  for (const filePath of files) {
    const relativePath = normalizeRelativePath(filePath);
    if (CAST_ALLOWLIST.has(relativePath)) continue;
    if (ALLOWLIST.has(relativePath)) continue;    // already allowed for CineGen writes
    const content = await readFile(filePath, 'utf8');
    const lines = content.split(/\r?\n/);

    for (let idx = 0; idx < lines.length; idx += 1) {
      if (!onLine(lines[idx], CAST_PATTERNS)) continue;
      castViolations.push({
        file: relativePath,
        line: idx + 1,
        snippet: lines[idx].trim(),
      });
    }
  }

  if (castViolations.length) {
    exitCode = 1;
    console.error('(window as any).* write guard FAILED.\n');
    console.error('Use direct imports instead of writing globals through casts.');
    console.error('If temporary, add file to CAST_ALLOWLIST with a tracker note.\n');
    for (const v of castViolations) {
      console.error(`  ${v.file}:${v.line}  ${v.snippet}`);
    }
    console.error('');
  } else {
    console.log('(window as any).* write guard — passed.');
  }

  // ——— Pass 3: audit allowlisted + cast-allowlisted files (warning only, no failure) ———
  const allowlistedCinegen = [];
  const allowlistedCast = [];

  for (const filePath of files) {
    const relativePath = normalizeRelativePath(filePath);
    if (!ALLOWLIST.has(relativePath) && !CAST_ALLOWLIST.has(relativePath)) continue;
    const content = await readFile(filePath, 'utf8');
    const lines = content.split(/\r?\n/);

    for (let idx = 0; idx < lines.length; idx += 1) {
      const line = lines[idx];
      // Don't double-count: is it already matched by CineGen or cast patterns?
      if (ALLOWLIST.has(relativePath) && onLine(line, CINEGEN_PATTERNS)) {
        allowlistedCinegen.push({ file: relativePath, line: idx + 1, snippet: line.trim() });
      } else if (onLine(line, CAST_PATTERNS)) {
        // Exclude the tree service's `window.xxx = (node) =>` which are multi-line arrow fns
        // that happen to also match the cast pattern check.
        allowlistedCast.push({ file: relativePath, line: idx + 1, snippet: line.trim() });
      } else       if (DIRECT_WINDOW_WRITE.test(line)) {
        const prop = line.match(DIRECT_WINDOW_WRITE);
        // Skip typeof reads and CineGen (already counted above)
        if (prop?.[1] === 'CineGen') continue;
        allowlistedCast.push({ file: relativePath, line: idx + 1, snippet: line.trim() });
      }
    }
  }

  console.log(`Allowlisted CineGen writes: ${allowlistedCinegen.length} across ${new Set(allowlistedCinegen.map(v => v.file)).size} file(s).`);
  console.log(`Allowlisted cast/direct writes: ${allowlistedCast.length} across ${new Set(allowlistedCast.map(v => v.file)).size} file(s).`);

  if (exitCode) process.exitCode = exitCode;
}

main().catch((error) => {
  console.error('Failed to run window write guard.');
  console.error(error);
  process.exitCode = 1;
});
