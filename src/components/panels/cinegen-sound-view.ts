/**
 * @AI-GUI — TARGET FOR REPLACEMENT
 *
 * Conventions for AI GUI replacement:
 * - Lit 3 + TS decorators (experimentalDecorators: true, useDefineForClassFields: false)
 * - Extend CgLightElement (Light DOM only — NO shadowRoot)
 * - Global CSS classes only (cg-panel-header, cg-btn, flex, grid, gap-*, etc.)
 * - CSS vars: --accent-blue, --text-dim, --bg-panel, --border-light
 * - Font Awesome 6 via <i class="fa-solid fa-*"></i>
 * - @/ path alias maps to src/
 * - Event constants from events/shell-events.ts — NO raw custom-event strings
 * - Keep @customElement('cinegen-sound-view') tag unchanged
 * - Replace ENTIRE file content; export the class
 *
 * ── AI GUI SPEC: Sound Department / Foley (Prompt #9) ──
 *
 * Goal: A waveform-based sound editing workstation.
 *
 * Requirements:
 * - Waveform Display (top ~50%): using Wavesurfer.js — interactive waveform with:
 *   Playhead/transport (Play, Pause, Stop, Skip), time ruler, region markers
 *   (dialogue/foley/music/SFX — color-coded), zoom slider.
 *
 * - Track List (left ~30%): multi-track inspired by Waveform Playlist:
 *   Dialogue, Foley, Music, SFX tracks + per-track mute/solo, volume slider,
 *   pan knob, "+ Add Track" button.
 *
 * - Effects Chain (right column): per-track audio effects using Tone.js:
 *   Reverb (wet/dry + decay), Delay (time/feedback/mix), EQ (high/mid/low),
 *   Compressor (threshold/ratio/attack/release), bypass toggle per effect.
 *
 * - Clip Library (bottom): grid of uploaded audio files + AI-generated foley
 *   placeholders. Each clip: name, duration, waveform mini-preview.
 *   Drag clip onto track to place it.
 *
 * - Export button → "Bounce to WAV" with selected track(s).
 */

import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';

@customElement('cinegen-sound-view')
export class CinegenSoundView extends CgLightElement {
  connectedCallback(): void {
    super.connectedCallback();
    this.id = 'view-sound-design';
    this.classList.add('hidden', 'flex', 'flex-col', 'h-full');
  }

  render() {
    return html`
      <cg-panel-header>
        <span slot="title" class="workspace-panel-title"
          ><i class="fa-solid fa-headphones"></i> SOUND DESIGN</span
        >
      </cg-panel-header>
      <div class="flex-1 flex items-center justify-center text-[var(--text-dim)] text-sm p-8">
        <i class="fa-solid fa-headphones text-4xl mb-4 opacity-30"></i>
        <p>Sound Design panel — ready for AI GUI replacement.</p>
      </div>
    `;
  }
}
