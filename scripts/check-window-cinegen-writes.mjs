import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const SRC_DIR = path.resolve(process.cwd(), 'src');

// Temporary bridge files that still own legacy global writes.
const ALLOWLIST = new Set([
  'boot/app-bootstrap.ts',
  'components/panels/cinegen-treatment-panel.ts',
  'services/preferences.ts',
  'services/status-bar-service.ts',
  'workspace/treatment-form-service.ts',
  'workspace/workspace-bundle.ts',
]);

const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

const WRITE_PATTERNS = [
  /\bwindow\.CineGen\s*=/,
  /\bwindow\.CineGen\.[A-Za-z_$][\w$]*\s*=/,
];

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

async function main() {
  const files = await collectFiles(SRC_DIR);
  const violations = [];

  for (const filePath of files) {
    const relativePath = normalizeRelativePath(filePath);
    const content = await readFile(filePath, 'utf8');
    const lines = content.split(/\r?\n/);

    for (let idx = 0; idx < lines.length; idx += 1) {
      const line = lines[idx];
      const isWrite = WRITE_PATTERNS.some((pattern) => pattern.test(line));
      if (!isWrite) continue;
      if (ALLOWLIST.has(relativePath)) continue;

      violations.push({
        file: relativePath,
        line: idx + 1,
        snippet: line.trim(),
      });
    }
  }

  if (!violations.length) {
    console.log('window.CineGen write guard passed.');
    return;
  }

  console.error('window.CineGen write guard failed.\n');
  console.error('Add new writes only in temporary bridge allowlist files.');
  console.error('If a new file must be temporary, document why and update allowlist intentionally.\n');
  for (const violation of violations) {
    console.error(`- ${violation.file}:${violation.line}`);
    console.error(`  ${violation.snippet}`);
  }
  process.exitCode = 1;
}

main().catch((error) => {
  console.error('Failed to run window.CineGen write guard.');
  console.error(error);
  process.exitCode = 1;
});
