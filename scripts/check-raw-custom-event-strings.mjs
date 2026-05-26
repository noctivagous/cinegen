import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const SRC_DIR = path.resolve(process.cwd(), 'src');
const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

// Legacy files that still use raw custom-event string literals.
// New usage should avoid raw strings and prefer exported constants.
const ALLOWLIST = new Set([
  'components/layout/cinegen-previs-timeline-dock.ts',
  'components/layout/cinegen-status-bar.ts',
  'components/panels/cinegen-assets-view.ts',
  'components/panels/cinegen-inspector.ts',
  'components/panels/cinegen-moodboards-kanban.ts',
  'components/panels/cinegen-moodboards-panel.ts',
  'components/panels/cinegen-moodboards-view.ts',
  'components/panels/cinegen-script-editor.ts',
  'components/panels/cinegen-storyboard-animatic-player.ts',
  'components/panels/cinegen-storyboard.ts',
  'components/panels/cinegen-timeline.ts',
  'components/primitives/cg-checkbox-tree.ts',
  'components/primitives/cg-modal-tile-grid.ts',
  'components/primitives/cg-panel-modal.ts',
  'components/primitives/cg-segmented-control.ts',
  'components/primitives/cg-segmented-split.ts',
  'components/primitives/cg-toolbar-split.ts',
  'components/primitives/cg-vis-toggle.ts',
  'data/project-data.ts',
  'moodboards/moodboard-generation.ts',
  'script/fountain-bundle.ts',
  'services/layout-service.ts',
  'services/state-sync.ts',
  'services/toolbar-split-service.ts',
  'storyboard/storyboard-bundle.ts',
  'toolbar/toolbar-menus-service.ts',
  'toolbar/toolbar-modals-service.ts',
  'toolbar/toolbar-project-modals-service.ts',
  'toolbar/wire-toolbar-splits.ts',
  'workspace/workspace-bundle.ts',
]);

const EVENT_LITERAL_PATTERNS = [
  /(?:addEventListener|removeEventListener)\(\s*(['"`])([^'"`]+)\1/g,
  /new\s+CustomEvent\(\s*(['"`])([^'"`]+)\1/g,
];

function normalizeRelativePath(absolutePath) {
  return path.relative(SRC_DIR, absolutePath).replaceAll(path.sep, '/');
}

function isCustomEventName(name) {
  return (
    name.includes(':') ||
    /^(cg-|cinegen-|storyboard-|previs-|moodboard-|asset-|project-|setup-|sa-|toolbar-|view-)/.test(name)
  );
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
      for (const pattern of EVENT_LITERAL_PATTERNS) {
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(line)) !== null) {
          const eventName = match[2];
          if (!isCustomEventName(eventName)) continue;
          violations.push({
            file: relativePath,
            line: lineIndex + 1,
            eventName,
            snippet: line.trim(),
          });
        }
      }
    }
  }

  if (!violations.length) {
    console.log('raw custom-event string guard passed.');
    return;
  }

  console.error('raw custom-event string guard failed.\n');
  console.error('Use exported event constants/helpers instead of raw custom-event literals.');
  console.error('If migration is temporary, add file to allowlist with tracker note.\n');
  for (const violation of violations) {
    console.error(`- ${violation.file}:${violation.line} (${violation.eventName})`);
    console.error(`  ${violation.snippet}`);
  }
  process.exitCode = 1;
}

main().catch((error) => {
  console.error('Failed to run raw custom-event string guard.');
  console.error(error);
  process.exitCode = 1;
});
