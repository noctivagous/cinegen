import { html, nothing, type TemplateResult } from 'lit';
import { breakdownData, currentSceneData } from '@/data/project-data';
import type { SceneDetail, SceneShot } from '@/workspace/scene-types';
import { escHtml } from '@/utils/html';

export type ScriptWizardAnalysisSummary = {
  sceneCount: number;
  shotCount: number;
  breakdownRows: Array<Record<string, string>>;
  shotsByScene: Array<{ sceneId: string; title: string; shots: SceneShot[] }>;
};

export function readScriptWizardAnalysisSummary(): ScriptWizardAnalysisSummary {
  const scenes = currentSceneData as Record<string, SceneDetail>;
  const breakdownRows = (breakdownData as Array<Record<string, string>>).slice();
  const shotsByScene: ScriptWizardAnalysisSummary['shotsByScene'] = [];
  let shotCount = 0;

  for (const [sceneId, scene] of Object.entries(scenes)) {
    const coverage = Array.isArray(scene?.coverage) ? scene.coverage : [];
    shotCount += coverage.length + (scene?.master ? 1 : 0);
    if (coverage.length) {
      shotsByScene.push({
        sceneId,
        title: scene.title || sceneId,
        shots: coverage,
      });
    }
  }

  return {
    sceneCount: Object.keys(scenes).length,
    shotCount,
    breakdownRows,
    shotsByScene,
  };
}

export function renderScriptWizardAnalysisSummary(): TemplateResult {
  const summary = readScriptWizardAnalysisSummary();
  if (!summary.sceneCount && !summary.breakdownRows.length) {
    return html`
      <p class="script-wizard-analysis-empty text-[var(--text-dim)] text-xs">
        Run “Create Project & Analyze Script” on the previous step to populate breakdown and shots.
      </p>
    `;
  }

  return html`
    <div class="script-wizard-analysis">
      <p class="script-wizard-analysis-stats">
        <strong>${summary.sceneCount}</strong> scene(s) ·
        <strong>${summary.shotCount}</strong> coverage shot(s) ·
        <strong>${summary.breakdownRows.length}</strong> breakdown row(s)
      </p>
      ${summary.breakdownRows.length
        ? html`
            <div class="script-wizard-section">
              <h4>Breakdown</h4>
              <table class="script-wizard-table">
                <thead>
                  <tr>
                    <th>Scene</th>
                    <th>INT/EXT</th>
                    <th>Location</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  ${summary.breakdownRows.map(
                    (row) => html`
                      <tr>
                        <td>${escHtml(row.scene ?? '')}</td>
                        <td>${escHtml(row.int_ext ?? '')}</td>
                        <td>${escHtml(row.location ?? '')}</td>
                        <td>${escHtml(row.time ?? '')}</td>
                      </tr>
                    `
                  )}
                </tbody>
              </table>
            </div>
          `
        : nothing}
      ${summary.shotsByScene.length
        ? html`
            <div class="script-wizard-section">
              <h4>Starter shots</h4>
              ${summary.shotsByScene.map(
                (block) => html`
                  <div class="script-wizard-shot-block">
                    <div class="script-wizard-shot-block-title">${escHtml(block.title)}</div>
                    <ul class="script-wizard-shot-list">
                      ${block.shots.map(
                        (shot) => html`
                          <li>
                            <span class="script-wizard-shot-type">${escHtml(shot.shotType || shot.type || 'Shot')}</span>
                            ${shot.label ? html` — ${escHtml(shot.label)}` : nothing}
                            ${shot.status
                              ? html`<span class="script-wizard-shot-status">${escHtml(shot.status)}</span>`
                              : nothing}
                          </li>
                        `
                      )}
                    </ul>
                  </div>
                `
              )}
            </div>
          `
        : nothing}
    </div>
  `;
}
