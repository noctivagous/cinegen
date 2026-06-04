import { html } from 'lit';
import { alertCG } from '@/utils/alert-cg';
import {
  renderEntryWizardSlide as _renderEntryWizardSlide,
  type WizardSlide,
} from '@/toolbar/toolbar-wizard-modals-service';
import { closeModal } from '@/services/modal-manager';
import type { CinegenEntryWizardBody } from '@/components/modals/cinegen-entry-wizard-body';

function renderEntryWizardSlide(modalId: string, index: number) {
  _renderEntryWizardSlide(modalId, index, getAssetSlidesMap());
}

function getAssetSlidesMap(): Record<string, WizardSlide[]> {
  return { 'asset-wizard-modal': ASSET_WIZARD_SLIDES };
}

export const ASSET_WIZARD_SLIDES: WizardSlide[] = [
  /* Slide 1 — Library Selection */
  {
    title: 'Library Selection',
    renderFn: (host) => {
      const aw = (window as any).CineGen?.assetWizard;
      const s = aw?.getState() ?? {};
      if (!s.sourceProjects?.length) aw?.refreshProjectList();
      const projects = aw?.getState()?.sourceProjects ?? [];
      const onSelect = (id: string) => {
        aw?.selectSource(id);
        host.requestUpdate();
        const nextIdx = 1;
        const slides = getAssetSlidesMap()['asset-wizard-modal'];
        if (slides?.[nextIdx]) renderEntryWizardSlide('asset-wizard-modal', nextIdx);
      };
      const tabs = [
        { label: 'Your Projects', filter: (p: any) => p.source === 'local' },
        { label: 'Sample Projects', filter: (p: any) => p.source === 'cine' },
      ];
      const activeTabIdx = 0;
      const filtered = tabs[activeTabIdx] ? projects.filter(tabs[activeTabIdx].filter) : projects;
      return html`
        <div class="script-wizard-form">
          <p style="margin-bottom:12px;">Choose a project to import assets from. Characters, locations, and props will be extracted and available for selection.</p>
          <div style="display:flex;gap:8px;margin-bottom:12px;">
            ${tabs.map((tab, i) => html`
              <span style="padding:4px 12px;border-radius:12px;font-size:12px;cursor:pointer;background:${i === activeTabIdx ? '#368' : '#333'};"
                @click=${() => { /* tab switch handled by re-render */ }}>
                ${tab.label}
              </span>
            `)}
          </div>
          ${filtered.length === 0 ? html`<p style="color:#888;">No projects found. Create a project first using another entry wizard.</p>` : ''}
          ${filtered.map((p: any) => html`
            <div style="border:1px solid #444;border-radius:6px;padding:10px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;">
              <div>
                <strong>${p.name}</strong>
                ${p.source === 'cine' ? html`<span style="font-size:11px;color:#888;margin-left:6px;">(sample)</span>` : ''}
                ${p.updatedAt ? html`<span style="font-size:11px;color:#666;margin-left:6px;">${p.updatedAt}</span>` : ''}
                <div style="font-size:12px;color:#aaa;margin-top:2px;">
                  Characters: ${p.assetCounts?.characters ?? 0} &middot;
                  Locations: ${p.assetCounts?.locations ?? 0} &middot;
                  Props: ${p.assetCounts?.props ?? 0}
                </div>
              </div>
              <button class="toolbar-btn btn-ai" @click=${() => onSelect(p.id)}>Import</button>
            </div>
          `)}
        </div>
      `;
    },
  },
  /* Slide 2 — Asset Browser */
  {
    title: 'Asset Browser',
    renderFn: (host) => {
      const aw = (window as any).CineGen?.assetWizard;
      const s = aw?.getState() ?? {};
      const chars = s.pendingCharacters ?? [];
      const locs = s.pendingLocations ?? [];
      const props = s.pendingProps ?? [];
      const onToggleChar = (id: string) => { aw?.toggleChar(id); host.requestUpdate(); };
      const onToggleLoc = (id: string) => { aw?.toggleLoc(id); host.requestUpdate(); };
      const onToggleProp = (id: string) => { aw?.toggleProp(id); host.requestUpdate(); };
      const selectedCount = [...chars, ...locs, ...props].filter((x: any) => x.selected).length;
      return html`
        <div class="script-wizard-form">
          <p style="margin-bottom:12px;">Select which assets to import. Only checked items will be carried forward.</p>
          ${selectedCount > 0 ? html`<p style="font-size:12px;color:#6c6;margin-bottom:8px;">${selectedCount} asset(s) selected</p>` : ''}

          ${chars.length > 0 ? html`
            <h4 style="font-size:13px;margin:8px 0 4px;"><i class="fa-solid fa-user"></i> Characters (${chars.length})</h4>
            ${chars.map((c: any) => html`
              <div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid #333;">
                <input type="checkbox" ?checked=${c.selected} @change=${() => onToggleChar(c.id)} />
                <span style="flex:1;font-size:13px;">${c.name}</span>
                <span style="font-size:11px;color:#888;">${c.role}</span>
              </div>
            `)}
          ` : ''}

          ${locs.length > 0 ? html`
            <h4 style="font-size:13px;margin:12px 0 4px;"><i class="fa-solid fa-location-dot"></i> Locations (${locs.length})</h4>
            ${locs.map((l: any) => html`
              <div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid #333;">
                <input type="checkbox" ?checked=${l.selected} @change=${() => onToggleLoc(l.id)} />
                <span style="flex:1;font-size:13px;">${l.name}</span>
                <span style="font-size:11px;color:#888;">${l.intExt}</span>
              </div>
            `)}
          ` : ''}

          ${props.length > 0 ? html`
            <h4 style="font-size:13px;margin:12px 0 4px;"><i class="fa-solid fa-wrench"></i> Props (${props.length})</h4>
            ${props.map((p: any) => html`
              <div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid #333;">
                <input type="checkbox" ?checked=${p.selected} @change=${() => onToggleProp(p.id)} />
                <span style="flex:1;font-size:13px;">${p.name}</span>
              </div>
            `)}
          ` : ''}
        </div>
      `;
    },
  },
  /* Slide 3 — Alignment & Rename */
  {
    title: 'Alignment & Rename',
    renderFn: (host) => {
      const aw = (window as any).CineGen?.assetWizard;
      const s = aw?.getState() ?? {};
      const chars = (s.pendingCharacters ?? []).filter((c: any) => c.selected);
      const locs = (s.pendingLocations ?? []).filter((l: any) => l.selected);
      const props = (s.pendingProps ?? []).filter((p: any) => p.selected);
      const onCharUpdate = (id: string, key: string) => (e: Event) => {
        aw?.updateChar(id, { [key]: (e.target as HTMLInputElement).value });
      };
      const onLocUpdate = (id: string, key: string) => (e: Event) => {
        aw?.updateLoc(id, { [key]: (e.target as HTMLInputElement).value });
      };
      const onPropUpdate = (id: string, key: string) => (e: Event) => {
        aw?.updateProp(id, { [key]: (e.target as HTMLInputElement).value });
      };
      const onRemoveChar = (id: string) => { aw?.removeChar(id); host.requestUpdate(); };
      const onRemoveLoc = (id: string) => { aw?.removeLoc(id); host.requestUpdate(); };
      const onRemoveProp = (id: string) => { aw?.removeProp(id); host.requestUpdate(); };
      return html`
        <div class="script-wizard-form">
          <p style="margin-bottom:12px;">Rename and configure imported assets to fit your new project context. Remove any you don't need.</p>

          ${chars.map((c: any) => html`
            <div style="border:1px solid #444;border-radius:6px;padding:8px;margin-bottom:6px;">
              <div style="display:flex;gap:6px;margin-bottom:4px;">
                <input class="cg-field" style="flex:2;" .value=${c.name} @input=${onCharUpdate(c.id, 'name')} placeholder="Name" />
                <select class="cg-field" style="flex:0 0 120px;" .value=${c.role} @change=${onCharUpdate(c.id, 'role')}>
                  <option value="protagonist">Protagonist</option>
                  <option value="antagonist">Antagonist</option>
                  <option value="supporting">Supporting</option>
                  <option value="extra">Extra</option>
                </select>
                <button class="remove-chip-btn" @click=${() => onRemoveChar(c.id)} style="background:none;border:none;color:#f88;cursor:pointer;">×</button>
              </div>
              <input class="cg-field" style="width:100%;" .value=${c.description} @input=${onCharUpdate(c.id, 'description')} placeholder="Description" />
            </div>
          `)}

          ${locs.map((l: any) => html`
            <div style="border:1px solid #444;border-radius:6px;padding:8px;margin-bottom:6px;">
              <div style="display:flex;gap:6px;margin-bottom:4px;">
                <input class="cg-field" style="flex:2;" .value=${l.name} @input=${onLocUpdate(l.id, 'name')} placeholder="Name" />
                <select class="cg-field" style="flex:0 0 100px;" .value=${l.intExt} @change=${onLocUpdate(l.id, 'intExt')}>
                  <option value="INT">INT</option>
                  <option value="EXT">EXT</option>
                  <option value="INT/EXT">INT/EXT</option>
                </select>
                <button class="remove-chip-btn" @click=${() => onRemoveLoc(l.id)} style="background:none;border:none;color:#f88;cursor:pointer;">×</button>
              </div>
              <input class="cg-field" style="width:100%;" .value=${l.description} @input=${onLocUpdate(l.id, 'description')} placeholder="Description" />
            </div>
          `)}

          ${props.map((p: any) => html`
            <div style="border:1px solid #444;border-radius:6px;padding:8px;margin-bottom:6px;">
              <div style="display:flex;gap:6px;margin-bottom:4px;">
                <input class="cg-field" style="flex:2;" .value=${p.name} @input=${onPropUpdate(p.id, 'name')} placeholder="Prop name" />
                <button class="remove-chip-btn" @click=${() => onRemoveProp(p.id)} style="background:none;border:none;color:#f88;cursor:pointer;">×</button>
              </div>
              <input class="cg-field" style="width:100%;" .value=${p.description} @input=${onPropUpdate(p.id, 'description')} placeholder="Description" />
            </div>
          `)}
        </div>
      `;
    },
  },
  /* Slide 4 — Gap Analysis */
  {
    title: 'Gap Analysis',
    renderFn: (host) => {
      const aw = (window as any).CineGen?.assetWizard;
      const s = aw?.getState() ?? {};
      const onAnalyze = () => {
        const screenplay = (window as any).projectScreenplay?.text ?? '';
        if (!screenplay) { alertCG('No screenplay found. Gap analysis requires a script in the current project.'); return; }
        aw?.runGapAnalysis(screenplay);
        host.requestUpdate();
      };
      const gap = s.gapAnalysis ?? { missingChars: [], missingLocs: [] };
      return html`
        <div class="script-wizard-form">
          <p style="margin-bottom:12px;">Compare your imported assets against the current project's script. Missing characters or locations will be flagged so you can go back and include them.</p>
          <button class="toolbar-btn btn-ai" @click=${onAnalyze} style="margin-bottom:12px;">
            <i class="fa-solid fa-magnifying-glass"></i> Run Gap Analysis
          </button>
          ${gap.missingChars.length > 0 ? html`
            <h4 style="font-size:13px;color:#e88;margin:8px 0 4px;">Missing Characters</h4>
            ${gap.missingChars.map((name: string) => html`<div style="padding:2px 0;font-size:12px;color:#e88;">${name}</div>`)}
          ` : html`<p style="color:#6c6;font-size:12px;">No missing characters detected.</p>`}
          ${gap.missingLocs.length > 0 ? html`
            <h4 style="font-size:13px;color:#e88;margin:12px 0 4px;">Missing Locations</h4>
            ${gap.missingLocs.map((name: string) => html`<div style="padding:2px 0;font-size:12px;color:#e88;">${name}</div>`)}
          ` : html`<p style="color:#6c6;font-size:12px;">No missing locations detected.</p>`}
        </div>
      `;
    },
  },
  /* Slide 5 — Style Review */
  {
    title: 'Style Review',
    renderFn: (host) => {
      const aw = (window as any).CineGen?.assetWizard;
      const s = aw?.getState() ?? {};
      const onToggleAdopt = () => { aw?.setStyleAdopted(!s.styleAdopted); host.requestUpdate(); };
      return html`
        <div class="script-wizard-form">
          <p style="margin-bottom:12px;">Review the style references from the source project. Optionally carry them into your new project.</p>
          <div style="background:#1a1a1a;padding:12px;border-radius:6px;margin-bottom:12px;">
            <div style="margin-bottom:8px;">
              <label style="font-size:12px;color:#aaa;display:block;">Lighting Mood</label>
              <div style="font-size:13px;">${s.sourceLightingMood || '—'}</div>
            </div>
            <div style="margin-bottom:8px;">
              <label style="font-size:12px;color:#aaa;display:block;">Style Notes</label>
              <div style="font-size:13px;">${s.sourceStyleNotes || '—'}</div>
            </div>
            ${s.sourceColorPalette?.length > 0 ? html`
              <div>
                <label style="font-size:12px;color:#aaa;display:block;">Color Palette</label>
                <div style="display:flex;gap:6px;margin-top:4px;">
                  ${s.sourceColorPalette.map((c: string) => html`
                    <span style="display:inline-block;width:24px;height:24px;border-radius:4px;background:${c};border:1px solid #555;"></span>
                  `)}
                </div>
              </div>
            ` : ''}
          </div>
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
            <input type="checkbox" ?checked=${s.styleAdopted} @change=${onToggleAdopt} />
            <span style="font-size:13px;">Adopt these style references into the new project</span>
          </label>
        </div>
      `;
    },
  },
  /* Slide 6 — Build Scene Kit */
  {
    title: 'Build Scene Kit',
    renderFn: (host) => {
      const aw = (window as any).CineGen?.assetWizard;
      const s = aw?.getState() ?? {};
      const onBuildKit = async () => {
        const payload = aw?.buildImportPayload();
        if (!payload || (!payload.characters?.length && !payload.locations?.length && !payload.props?.length)) {
          alertCG('No assets selected. Go back and select at least one asset to import.');
          return;
        }
        aw?.setKitBuilt();
        const { applyWizardOutput } = await import('@/wizard/wizard-completion-hook');
        applyWizardOutput({
          characters: (payload.characters || []).map((c: any) => ({
            id: c.id, name: c.name, role: c.role ?? 'supporting', description: c.description || '',
          })),
          locations: (payload.locations || []).map((l: any) => ({
            id: l.id, name: l.name, intExt: l.intExt, description: l.description || '',
          })),
          props: (payload.props || []).map((p: any) => ({
            id: p.id, name: p.name, description: p.description || '',
          })),
          featureBranches: ['production-office', 'casting', 'production-design', 'studio-space/mood-boards'],
        });
        host.requestUpdate();
      };
      const counts = {
        chars: (s.pendingCharacters ?? []).filter((c: any) => c.selected).length,
        locs: (s.pendingLocations ?? []).filter((l: any) => l.selected).length,
        props: (s.pendingProps ?? []).filter((p: any) => p.selected).length,
      };
      return html`
        <div class="script-wizard-form">
          <p style="margin-bottom:12px;">Ready to import ${counts.chars + counts.locs + counts.props} asset(s) into the current project.</p>
          <div style="background:#1a1a1a;padding:12px;border-radius:6px;margin-bottom:12px;">
            <p><strong>Characters:</strong> ${counts.chars}</p>
            <p><strong>Locations:</strong> ${counts.locs}</p>
            <p><strong>Props:</strong> ${counts.props}</p>
          </div>
          ${s.sceneKitBuilt ? html`
            <div style="color:#4c6;margin-bottom:12px;"><i class="fa-solid fa-check-circle"></i> Assets imported successfully!</div>
          ` : html`
            <button class="toolbar-btn btn-ai" @click=${onBuildKit}>
              <i class="fa-solid fa-boxes-stacked"></i> Import Assets into Project
            </button>
          `}
        </div>
      `;
    },
  },
  /* Slide 7 — Script & Finish */
  {
    title: 'Script & Finish',
    renderFn: (host) => {
      const aw = (window as any).CineGen?.assetWizard;
      const s = aw?.getState() ?? {};
      const onGenerateOutline = async () => {
        const payload = aw?.buildOutlinePayload();
        if (!payload || (!payload.characters?.length && !payload.locations?.length)) {
          alertCG('No characters or locations available. Import at least one character or location first.');
          return;
        }
        const { generateScriptFromVisuals } = await import('../services/ai/agents-service');
        try {
          const result = await generateScriptFromVisuals(s.projectId, payload);
          aw?.setScriptGenerated();
          host.requestUpdate();
        } catch (err) {
          console.error('[asset-wizard] outline error:', err);
          alertCG('Failed to generate script outline.');
        }
      };
      return html`
        <div class="script-wizard-form">
          <p style="margin-bottom:12px;">Your imported assets are ready. Optionally generate a Fountain-format script outline based on the imported characters and locations.</p>
          <div style="margin-bottom:12px;">
            ${s.scriptGenerated ? html`
              <div style="color:#4c6;margin-bottom:8px;"><i class="fa-solid fa-check-circle"></i> Script outline generated</div>
              <button class="toolbar-btn" @click=${onGenerateOutline}><i class="fa-solid fa-rotate"></i> Regenerate</button>
            ` : html`
              <button class="toolbar-btn btn-ai" @click=${onGenerateOutline}>
                <i class="fa-solid fa-scroll"></i> Generate Script Outline
              </button>
            `}
          </div>
          <div style="margin-top:24px;display:flex;gap:8px;justify-content:flex-end;border-top:1px solid #444;padding-top:16px;">
            <button class="toolbar-btn btn-ai" @click=${() => closeModal('asset-wizard-modal')}>
              <i class="fa-solid fa-check"></i> Finish & Close Wizard
            </button>
          </div>
        </div>
      `;
    },
  },
];
