import { html } from 'lit';
import {
  type WizardSlide,
} from '@/toolbar/toolbar-wizard-modals-service';
import { closeModal } from '@/services/modal-manager';
import type { CinegenEntryWizardBody } from '@/components/modals/cinegen-entry-wizard-body';

export const STORYBOARD_WIZARD_SLIDES: WizardSlide[] = [
  /* Slide 0 — Beat/Thumbnail Input */
  {
    title: 'Beat/Thumbnail Input',
    renderFn: (host) => {
      const bb = (window as any).CineGen?.beatBoard;
      const s = bb?.getState?.() ?? {};
      const beats = s.beats ?? [];
      const totalDuration = beats.reduce((sum: number, b: any) => sum + (b.durationSeconds || 5), 0);
      const onAdd = () => {
        const input = host.querySelector('#bb-add-title') as HTMLInputElement;
        const desc = host.querySelector('#bb-add-desc') as HTMLTextAreaElement;
        const cam = host.querySelector('#bb-add-cam') as HTMLInputElement;
        if (!input?.value?.trim()) return;
        bb?.addBeat(input.value.trim(), desc?.value?.trim() || '', cam?.value?.trim() || '');
        if (input) input.value = '';
        if (desc) desc.value = '';
        if (cam) cam.value = '';
        host.requestUpdate();
      };
      return html`
        <div class="script-wizard-form">
          <div style="margin-bottom:12px;">
            <input class="cg-field" id="bb-add-title" placeholder="Beat title (e.g. Opening)" style="width:100%;margin-bottom:6px;" />
            <textarea class="cg-field" id="bb-add-desc" placeholder="Description — what happens in this beat?" style="width:100%;min-height:48px;margin-bottom:6px;"></textarea>
            <input class="cg-field" id="bb-add-cam" placeholder="Camera notes (optional)" style="width:100%;margin-bottom:6px;" />
            <button class="toolbar-btn btn-ai" @click=${onAdd} style="width:100%;">
              <i class="fa-solid fa-plus"></i> Add Beat
            </button>
          </div>
          ${beats.length === 0 ? html`<p style="color:#888;font-size:13px;text-align:center;">No beats yet. Add your first beat above.</p>` : ''}
          ${beats.map((b: any, i: number) => html`
            <div style="border:1px solid #444;border-radius:6px;padding:8px;margin-bottom:6px;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                <strong style="font-size:13px;">#${i + 1} ${b.title}</strong>
                <div style="display:flex;gap:4px;">
                  <button class="toolbar-btn" style="font-size:11px;padding:2px 6px;" ?disabled=${i === 0} @click=${() => { bb?.reorderBeat(b.id, -1); host.requestUpdate(); }}>
                    <i class="fa-solid fa-chevron-up"></i>
                  </button>
                  <button class="toolbar-btn" style="font-size:11px;padding:2px 6px;" ?disabled=${i >= beats.length - 1} @click=${() => { bb?.reorderBeat(b.id, 1); host.requestUpdate(); }}>
                    <i class="fa-solid fa-chevron-down"></i>
                  </button>
                  <button class="toolbar-btn" style="font-size:11px;padding:2px 6px;color:#f88;" @click=${() => { bb?.removeBeat(b.id); host.requestUpdate(); }}>
                    <i class="fa-solid fa-times"></i>
                  </button>
                </div>
              </div>
              <div style="font-size:12px;color:#aaa;">${b.description}</div>
              ${b.cameraNotes ? html`<div style="font-size:11px;color:#888;margin-top:2px;"><i class="fa-solid fa-camera"></i> ${b.cameraNotes}</div>` : ''}
              <div style="font-size:11px;color:#666;margin-top:2px;">${b.durationSeconds}s</div>
            </div>
          `)}
          ${beats.length > 0 ? html`<div style="font-size:12px;color:#888;text-align:right;">Total: ${totalDuration}s (${beats.length} beat${beats.length > 1 ? 's' : ''})</div>` : ''}
        </div>
      `;
    },
  },
  /* Slide 1 — Script Outline Creation */
  {
    title: 'Script Outline Creation',
    renderFn: (host) => {
      const bb = (window as any).CineGen?.beatBoard;
      const s = bb?.getState?.() ?? {};
      const onGenerate = async () => {
        const payload = bb?.buildOutlinePayload();
        if (!payload || !payload.beats?.length) { (window as any).alertCG?.('Add at least one beat first.'); return; }
        try {
          const { generateOutlineFromBeats } = await import('../services/ai/agents-service');
          const result = await generateOutlineFromBeats(s.projectId || 'proj', payload);
          const data = typeof result.data === 'string' ? JSON.parse(result.data) : result.data;
          bb?.setScriptOutline(data.outline || data.text || '');
          host.requestUpdate();
        } catch (err) {
          console.error('[beat-board] outline error:', err);
          (window as any).alertCG?.('Failed to generate outline.');
        }
      };
      const detectedChars = (() => { try { return JSON.parse(s.scriptOutline || '{}')?.detectedCharacters || []; } catch { return []; } })();
      const detectedLocs = (() => { try { return JSON.parse(s.scriptOutline || '{}')?.detectedLocations || []; } catch { return []; } })();
      const outlineText = (() => { try { const o = JSON.parse(s.scriptOutline || '{}'); return o.outline || o.text || ''; } catch { return ''; } })();
      return html`
        <div class="script-wizard-form">
          <p style="margin-bottom:12px;">Generate a Fountain-format script outline from your beats. Characters and locations will be automatically detected.</p>
          <button class="toolbar-btn btn-ai" @click=${onGenerate} ?disabled=${s.generationStatus === 'generating'} style="margin-bottom:12px;">
            <i class="fa-solid fa-scroll"></i> Generate Outline from Beats
          </button>
          ${s.scriptGenerated ? html`
            ${detectedChars.length > 0 ? html`
              <div style="margin-bottom:8px;">
                <strong style="font-size:12px;">Detected Characters:</strong>
                <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;">
                  ${detectedChars.map((n: string) => html`<span style="background:#333;padding:2px 8px;border-radius:10px;font-size:11px;">${n}</span>`)}
                </div>
              </div>
            ` : ''}
            ${detectedLocs.length > 0 ? html`
              <div style="margin-bottom:8px;">
                <strong style="font-size:12px;">Detected Locations:</strong>
                <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;">
                  ${detectedLocs.map((n: string) => html`<span style="background:#333;padding:2px 8px;border-radius:10px;font-size:11px;">${n}</span>`)}
                </div>
              </div>
            ` : ''}
            ${outlineText ? html`
              <div style="background:#1a1a1a;padding:8px;border-radius:4px;max-height:160px;overflow-y:auto;font-size:11px;font-family:monospace;white-space:pre-wrap;">${outlineText}</div>
            ` : ''}
            <button class="toolbar-btn" @click=${onGenerate} style="margin-top:8px;"><i class="fa-solid fa-rotate"></i> Regenerate</button>
          ` : ''}
        </div>
      `;
    },
  },
  /* Slide 2 — Character & Location Placeholders */
  {
    title: 'Character & Location Placeholders',
    renderFn: (host) => {
      const bb = (window as any).CineGen?.beatBoard;
      const s = bb?.getState?.() ?? {};
      const chars = s.characters ?? [];
      const locs = s.locations ?? [];
      const onAddChar = () => {
        const el = host.querySelector('#bb-char-name') as HTMLInputElement;
        if (!el?.value?.trim()) return;
        bb?.addCharacter(el.value.trim());
        el.value = '';
        host.requestUpdate();
      };
      const onAddLoc = () => {
        const el = host.querySelector('#bb-loc-name') as HTMLInputElement;
        const sel = host.querySelector('#bb-loc-ie') as HTMLSelectElement;
        if (!el?.value?.trim()) return;
        bb?.addLocation(el.value.trim(), sel?.value || 'INT/EXT');
        el.value = '';
        host.requestUpdate();
      };
      return html`
        <div class="script-wizard-form">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
            <div>
              <h4 style="font-size:13px;margin-bottom:6px;"><i class="fa-solid fa-user"></i> Characters</h4>
              <div style="display:flex;gap:4px;margin-bottom:6px;">
                <input class="cg-field" id="bb-char-name" placeholder="Name" style="flex:1;" />
                <button class="toolbar-btn btn-ai" @click=${onAddChar} style="padding:4px 8px;"><i class="fa-solid fa-plus"></i></button>
              </div>
              ${chars.map((c: any) => html`
                <div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;border-bottom:1px solid #333;font-size:12px;">
                  <span>${c.name}</span>
                  <button class="toolbar-btn" style="font-size:10px;padding:1px 4px;color:#f88;" @click=${() => { bb?.removeCharacter(c.id); host.requestUpdate(); }}><i class="fa-solid fa-times"></i></button>
                </div>
              `)}
            </div>
            <div>
              <h4 style="font-size:13px;margin-bottom:6px;"><i class="fa-solid fa-location-dot"></i> Locations</h4>
              <div style="display:flex;gap:4px;margin-bottom:6px;">
                <input class="cg-field" id="bb-loc-name" placeholder="Name" style="flex:1;" />
                <select class="cg-field" id="bb-loc-ie" style="width:80px;font-size:11px;">
                  <option value="INT">INT</option>
                  <option value="EXT">EXT</option>
                  <option value="INT/EXT" selected>INT/EXT</option>
                </select>
                <button class="toolbar-btn btn-ai" @click=${onAddLoc} style="padding:4px 8px;"><i class="fa-solid fa-plus"></i></button>
              </div>
              ${locs.map((l: any) => html`
                <div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;border-bottom:1px solid #333;font-size:12px;">
                  <span>${l.name} <span style="color:#888;">(${l.intExt})</span></span>
                  <button class="toolbar-btn" style="font-size:10px;padding:1px 4px;color:#f88;" @click=${() => { bb?.removeLocation(l.id); host.requestUpdate(); }}><i class="fa-solid fa-times"></i></button>
                </div>
              `)}
            </div>
          </div>
        </div>
      `;
    },
  },
  /* Slide 3 — Reference Recommendation */
  {
    title: 'Reference Recommendation',
    renderFn: (host) => {
      const bb = (window as any).CineGen?.beatBoard;
      const s = bb?.getState?.() ?? {};
      const queue = s.referenceQueue ?? [];
      const onScan = () => { bb?.runReferenceSuggestion(); host.requestUpdate(); };
      return html`
        <div class="script-wizard-form">
          <p style="margin-bottom:12px;">Scan your beats for potential missing assets that may need reference images or sheets.</p>
          <button class="toolbar-btn btn-ai" @click=${onScan} style="margin-bottom:12px;">
            <i class="fa-solid fa-magnifying-glass"></i> Scan for Missing References
          </button>
          ${queue.length === 0 ? html`<p style="color:#888;font-size:13px;">No reference suggestions yet. Click the scan button above.</p>` : ''}
          ${queue.map((item: any, i: number) => html`
            <div style="display:flex;align-items:center;gap:8px;padding:6px;border:1px solid #444;border-radius:4px;margin-bottom:4px;">
              <span style="font-size:11px;color:#888;width:24px;">#${i + 1}</span>
              <span style="flex:1;font-size:12px;">${item.label}</span>
              <span style="font-size:10px;background:#333;padding:1px 6px;border-radius:8px;color:#aaa;">${item.assetType}</span>
              <span style="font-size:10px;color:#888;">P${item.priority}</span>
            </div>
          `)}
        </div>
      `;
    },
  },
  /* Slide 4 — Style & Mood Layer */
  {
    title: 'Style & Mood Layer',
    renderFn: (host) => {
      const bb = (window as any).CineGen?.beatBoard;
      const s = bb?.getState?.() ?? {};
      const moods = ['neutral', 'warm', 'cool', 'tense', 'dreamy'];
      return html`
        <div class="script-wizard-form">
          <div style="margin-bottom:12px;">
            <label style="font-size:12px;color:#aaa;display:block;margin-bottom:4px;">Mood</label>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              ${moods.map((m) => html`
                <span style="padding:4px 12px;border-radius:12px;font-size:12px;cursor:pointer;background:${s.styleMood === m ? '#368' : '#333'};"
                  @click=${() => { bb?.setStyleMood(m); host.requestUpdate(); }}>
                  ${m}
                </span>
              `)}
            </div>
          </div>
          <div style="margin-bottom:12px;">
            <label style="font-size:12px;color:#aaa;display:block;margin-bottom:4px;">Lighting</label>
            <input class="cg-field" style="width:100%;" .value=${s.lightingMood || ''} @input=${(e: any) => { bb?.setLightingMood(e.target.value); host.requestUpdate(); }} placeholder="e.g. Soft golden hour, harsh noon sun" />
          </div>
          <div style="margin-bottom:12px;">
            <label style="font-size:12px;color:#aaa;display:block;margin-bottom:4px;">Color Palette</label>
            <cg-color-palette
              .palette=${s.colorPalette ?? []}
              style="display:block;"
              @cg-palette-change=${(e: any) => {
                bb?.setColorPalette(e.detail.palette);
                host.requestUpdate();
              }}
            ></cg-color-palette>
          </div>
        </div>
      `;
    },
  },
  /* Slide 5 — Asset Generation Prompts */
  {
    title: 'Asset Generation Prompts',
    renderFn: (host) => {
      const bb = (window as any).CineGen?.beatBoard;
      const s = bb?.getState?.() ?? {};
      const chars = s.characters ?? [];
      const locs = s.locations ?? [];
      const onGenerate = async () => {
        (window as any).alertCG?.('Asset generation will create character sheets and background plates. This feature is coming soon.');
      };
      return html`
        <div class="script-wizard-form">
          <p style="margin-bottom:12px;">Generate reference assets for your characters and locations. These will be used when refining storyboards.</p>
          <div style="background:#1a1a1a;padding:10px;border-radius:6px;margin-bottom:12px;">
            <p style="font-size:12px;margin-bottom:4px;"><strong>Characters:</strong> ${chars.length > 0 ? chars.map((c: any) => c.name).join(', ') : 'none'}</p>
            <p style="font-size:12px;"><strong>Locations:</strong> ${locs.length > 0 ? locs.map((l: any) => `${l.name} (${l.intExt})`).join(', ') : 'none'}</p>
          </div>
          <button class="toolbar-btn btn-ai" @click=${onGenerate} ?disabled=${chars.length === 0 && locs.length === 0} style="width:100%;">
            <i class="fa-solid fa-wand-magic-sparkles"></i> Generate References
          </button>
        </div>
      `;
    },
  },
  /* Slide 6 — Refine Storyboards */
  {
    title: 'Refine Storyboards',
    renderFn: (host) => {
      const bb = (window as any).CineGen?.beatBoard;
      const s = bb?.getState?.() ?? {};
      const beats = s.beats ?? [];
      const onGenerateFrames = async () => {
        if (beats.length === 0) { (window as any).alertCG?.('Add at least one beat first.'); return; }
        try {
          const { generateStoryboardFrames } = await import('../services/ai/agents-service');
          const result = await generateStoryboardFrames(s.projectId || 'proj');
          bb?.setStoryboardsGenerated(beats.length);
          host.requestUpdate();
        } catch (err) {
          console.error('[beat-board] storyboard error:', err);
          (window as any).alertCG?.('Failed to generate storyboard frames.');
        }
      };
      return html`
        <div class="script-wizard-form">
          <p style="margin-bottom:12px;">Generate storyboard frames from your ${beats.length} beat(s). Each beat will produce a storyboard frame that can be refined later.</p>
          <div style="background:#1a1a1a;padding:10px;border-radius:6px;margin-bottom:12px;">
            <p style="font-size:12px;"><strong>Beats:</strong> ${beats.length}</p>
            <p style="font-size:12px;"><strong>Characters:</strong> ${(s.characters ?? []).length}</p>
            <p style="font-size:12px;"><strong>Locations:</strong> ${(s.locations ?? []).length}</p>
          </div>
          ${s.storyboardsGenerated ? html`
            <div style="color:#4c6;margin-bottom:8px;"><i class="fa-solid fa-check-circle"></i> ${s.storyboardFrameCount} frame(s) generated</div>
            <button class="toolbar-btn" @click=${onGenerateFrames}><i class="fa-solid fa-rotate"></i> Regenerate</button>
          ` : html`
            <button class="toolbar-btn btn-ai" @click=${onGenerateFrames} style="width:100%;">
              <i class="fa-solid fa-film"></i> Generate Storyboard Frames from Beats
            </button>
          `}
        </div>
      `;
    },
  },
  /* Slide 7 — Full Project Assembly */
  {
    title: 'Full Project Assembly',
    renderFn: (host) => {
      const bb = (window as any).CineGen?.beatBoard;
      const s = bb?.getState?.() ?? {};
      const beats = s.beats ?? [];
      const chars = s.characters ?? [];
      const locs = s.locations ?? [];
      const onBuildKit = async () => {
        if (!beats.length) {
          (window as any).alertCG?.('Add at least one beat first.');
          return;
        }
        const { applyBeatBoardSceneKit } = await import('@/wizard/beat-board-bundle');
        const kitResult = applyBeatBoardSceneKit();
        console.log('[beat-board] scene kit applied:', kitResult);
        bb?.setKitBuilt();
        host.requestUpdate();
      };
      const onGenerateStoryboards = async () => {
        if (!beats.length) { (window as any).alertCG?.('Add at least one beat first.'); return; }
        try {
          const { generateStoryboardFrames } = await import('../services/ai/agents-service');
          await generateStoryboardFrames(s.projectId || 'proj');
          bb?.setStoryboardsGenerated(beats.length);
          host.requestUpdate();
        } catch (err) {
          console.error('[beat-board] storyboard error:', err);
          (window as any).alertCG?.('Failed to generate storyboard frames.');
        }
      };
      return html`
        <div class="script-wizard-form">
          <p style="margin-bottom:12px;">Your storyboard sketch is ready for project assembly. Review the summary below then build your scene kit.</p>
          <div style="background:#1a1a1a;padding:12px;border-radius:6px;margin-bottom:12px;">
            <p style="font-size:12px;margin-bottom:4px;"><i class="fa-solid fa-list"></i> <strong>${beats.length}</strong> beats</p>
            <p style="font-size:12px;margin-bottom:4px;"><i class="fa-solid fa-user"></i> <strong>${chars.length}</strong> characters</p>
            <p style="font-size:12px;margin-bottom:4px;"><i class="fa-solid fa-location-dot"></i> <strong>${locs.length}</strong> locations</p>
            <p style="font-size:12px;margin-bottom:4px;"><i class="fa-solid fa-film"></i> <strong>${s.storyboardsGenerated ? s.storyboardFrameCount : 0}</strong> storyboard frames</p>
            <p style="font-size:12px;"><i class="fa-solid fa-palette"></i> Style: ${s.styleMood || 'none'} ${s.lightingMood ? `(${s.lightingMood})` : ''}</p>
          </div>
          ${s.sceneKitBuilt ? html`
            <div style="color:#4c6;margin-bottom:12px;"><i class="fa-solid fa-check-circle"></i> Scene kit built successfully!</div>
            ${s.storyboardsGenerated ? html`
              <div style="color:#4c6;margin-bottom:8px;"><i class="fa-solid fa-check-circle"></i> ${s.storyboardFrameCount} storyboard frame(s) generated</div>
            ` : html`
              <button class="toolbar-btn btn-ai" @click=${onGenerateStoryboards} style="width:100%;margin-bottom:8px;">
                <i class="fa-solid fa-film"></i> Generate Storyboard Frames from Beats
              </button>
            `}
          ` : html`
            <button class="toolbar-btn btn-ai" @click=${onBuildKit} style="width:100%;margin-bottom:8px;">
              <i class="fa-solid fa-boxes-stacked"></i> Build Scene Kit
            </button>
          `}
          <div style="margin-top:12px;display:flex;gap:8px;justify-content:flex-end;border-top:1px solid #444;padding-top:12px;">
            <button class="toolbar-btn btn-ai" @click=${() => closeModal('storyboard-wizard-modal')}>
              <i class="fa-solid fa-check"></i> Finish & Close Wizard
            </button>
          </div>
        </div>
      `;
    },
  },
];
