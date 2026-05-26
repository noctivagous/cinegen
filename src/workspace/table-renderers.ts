/**
 * Pure HTML table renderers for continuity sheets and shot lists.
 */

import { buildShotListRows, formatShotDisplayLabel } from '@/workspace/shot-frame-bridge';
import { escHtml } from '@/utils/html';

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

export function renderShotListTable(): string {
  const rows = buildShotListRows();

  if (!rows.length) return '<p class="asset-detail-empty">No shots yet. Add scene coverage to populate this list.</p>';

  const statusDot = (status: string) => {
    const cls = status === 'rendered' || status === 'best take' ? 'approved'
              : status === 'take'                              ? 'in-progress'
              : 'pending';
    return `<span class="asset-status-dot asset-status-${cls}" title="${escHtml(status)}"></span>`;
  };

  const framesCell = (row: ReturnType<typeof buildShotListRows>[number]) => {
    if (row.kind !== 'coverage') return '—';
    const count = row.frameCount ?? 0;
    if (!count) return '0';
    const tip = (row.frameLabels ?? []).join(' · ');
    return `<span title="${escHtml(tip)}">${count} frame${count === 1 ? '' : 's'}</span>`;
  };

  const shotNumCell = (row: ReturnType<typeof buildShotListRows>[number]) => {
    if (row.kind !== 'coverage' || row.shotNumber == null) return '—';
    return escHtml(formatShotDisplayLabel(row.sceneNumber, row.shotNumber));
  };

  return `
    <div class="continuity-table-wrap">
      <table class="continuity-table">
        <thead><tr><th>Scene</th><th>Shot</th><th>Type</th><th>Label</th><th>Frames</th><th>Duration</th><th>Status</th></tr></thead>
        <tbody>${rows.map((r) => `
          <tr${r.kind === 'coverage' && r.shotId != null ? ` class="shot-list-row" data-scene-id="${escHtml(r.sceneId)}" data-shot-id="${r.shotId}"` : ''}>
            <td class="continuity-scene-col">${escHtml(r.sceneLabel)}</td>
            <td>${shotNumCell(r)}</td>
            <td>${escHtml(r.type)}</td>
            <td>${escHtml(r.label)}</td>
            <td>${framesCell(r)}</td>
            <td>${escHtml(r.duration)}</td>
            <td>${r.status !== '—' ? statusDot(r.status) + ' ' + escHtml(r.status) : '—'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

