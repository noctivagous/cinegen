import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const SRC_DIR = path.resolve(process.cwd(), 'src');
const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

// Legacy files that still use localStorage (should be empty — no files allowed).
const ALLOWLIST = new Set([]);

const LOCALSTORAGE_PATTERNS = [
  /\blocalStorage\s*\.\s*(getItem|setItem|removeItem|clear|key)\s*\(/,
  /\blocalStorage\s*\[/,
];

function normalizeRelativePath(absolutePath) {
  return path.relative(SRC_DIR, absolutePath).replaceAll(path.sep, '/');
}

async function collectFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = path.join(dir, entry.name);
      if (entry.isDirectory()) return collectFiles(absolutePath);
      if (!SCAN_EXTENSIONS.has(path.extname(entry.name))) return [];
      return [absolutePath];
    })
  );
  return nested.flat();
}

async function main() {
  const files = await collectFiles(SRC_DIR);
  const violations = [];

  for (const filePath of files) {
    const relativePath = normalizeRelativePath(filePath);
    if (ALLOWLIST.has(relativePath)) continue;
    const content = await readFile(filePath, 'utf8');
    const lines = content.split(/\r?\n/);

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const line = lines[lineIndex];
      for (const pattern of LOCALSTORAGE_PATTERNS) {
        pattern.lastIndex = 0;
        if (pattern.test(line)) {
          violations.push({
            file: relativePath,
            line: lineIndex + 1,
            snippet: line.trim(),
          });
        }
      }
    }
  }

  if (!violations.length) {
    console.log('localStorage usage guard — passed.');
  } else {
    console.error('localStorage usage guard FAILED.\n');
    console.error('Do not use localStorage directly. Use storageService (server-backed) instead.');
    console.error('If temporary, add file to allowlist with tracker note.\n');
    for (const violation of violations) {
      console.error(`  ${violation.file}:${violation.line}  ${violation.snippet}`);
    }
    console.error('');
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('Failed to run localStorage usage guard.');
  console.error(error);
  process.exitCode = 1;
});