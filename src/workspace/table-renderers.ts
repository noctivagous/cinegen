/**
 * Pure HTML table renderers for continuity sheets and shot lists.
 */

interface ContinuityData {
  columns?: string[];
  rows?: string[][];
}

export function renderContinuityTable(data: ContinuityData): string {
  const cols = data.columns || [];
  const rows = data.rows   || [];
  if (!cols.length) return '<p class="asset-detail-empty">No continuity data.</p>';
  return `
    <div class="continuity-table-wrap">
      <table class="continuity-table">
        <thead><tr>${cols.map((c) => `<th>${escHtml(c)}</th>`).join('')}</tr></thead>
        <tbody>${rows.map((row) =>
          `<tr>${row.map((cell, i) =>
            `<td${i === 0 ? ' class="continuity-scene-col"' : ''}>${escHtml(cell || '—')}</td>`
          ).join('')}</tr>`
        ).join('')}</tbody>
      </table>
    </div>`;
}

interface ShotRow {
  scene: string;
  type: string;
  label: string;
  duration: string;
  status: string;
}

interface ShotDef {
  type: string;
  label: string;
  duration: string;
  bestTake?: boolean;
}

interface PickupDef {
  label: string;
  duration: string;
}

interface SceneData {
  title?: string;
  master?: { label: string; duration: string; status?: string };
  coverage?: ShotDef[];
  broll?: PickupDef[];
  pickups?: PickupDef[];
}

export function renderShotListTable(): string {
  const rows: ShotRow[] = [];
  const scenes = (window as unknown as Record<string, Record<string, SceneData>>).currentSceneData ?? {};
  Object.entries(scenes).forEach(([, scene]) => {
    const sceneLabel = (scene.title || '').split(' - ')[0] || '?';
    if (scene.master) {
      rows.push({ scene: sceneLabel, type: 'Master Shot', label: scene.master.label, duration: scene.master.duration, status: scene.master.status || '—' });
    }
    (scene.coverage || []).forEach((shot: ShotDef) => {
      rows.push({ scene: sceneLabel, type: shot.type, label: shot.label, duration: shot.duration, status: shot.bestTake ? 'best take' : 'take' });
    });
    (scene.broll || []).forEach((b: PickupDef) => {
      rows.push({ scene: sceneLabel, type: 'B-Roll', label: b.label, duration: b.duration, status: '—' });
    });
    (scene.pickups || []).forEach((p: PickupDef) => {
      rows.push({ scene: sceneLabel, type: 'Pickup', label: p.label, duration: p.duration, status: '—' });
    });
  });

  if (!rows.length) return '<p class="asset-detail-empty">No shots yet. Add scene coverage to populate this list.</p>';

  const statusDot = (status: string) => {
    const cls = status === 'rendered' || status === 'best take' ? 'approved'
              : status === 'take'                              ? 'in-progress'
              : 'pending';
    return `<span class="asset-status-dot asset-status-${cls}" title="${escHtml(status)}"></span>`;
  };

  return `
    <div class="continuity-table-wrap">
      <table class="continuity-table">
        <thead><tr><th>Scene</th><th>Type</th><th>Label</th><th>Duration</th><th>Status</th></tr></thead>
        <tbody>${rows.map((r) => `
          <tr>
            <td class="continuity-scene-col">${escHtml(r.scene)}</td>
            <td>${escHtml(r.type)}</td>
            <td>${escHtml(r.label)}</td>
            <td>${escHtml(r.duration)}</td>
            <td>${r.status !== '—' ? statusDot(r.status) + ' ' + escHtml(r.status) : '—'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

/* Helper — assumed available globally in the bundle context */
function escHtml(str: unknown): string {
  if (typeof str !== 'string') str = String(str ?? '');
  return (str as string)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
