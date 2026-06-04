import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { whenBootReady } from '@/app/boot-coordinator';
import { CgLightElement } from '@/components/lit-base';
import type { ModalityKey } from '@/types/globals';
import {
  buildAudioSubmodalityMenu,
  positionAudioSubmodalityMenu,
  updateAudioSubmodalityIndicators,
} from '@/services/status-bar-audio';
import {
  buildModelStatusMenu,
  positionModelStatusMenu,
  updateModelStatusIndicators,
} from '@/services/status-bar-service';

const MODALITIES: Array<{ key: ModalityKey; label: string; title: string }> = [
  { key: 'llm', label: 'Text', title: 'LLM status' },
  { key: 'video', label: 'Video', title: 'Video AI status' },
  { key: 'image', label: 'Image', title: 'Image AI status' },
];

const AUDIO_SUBS: Array<{ key: string; label: string; title: string; indicatorId: string }> = [
  { key: 'tts', label: 'TTS', title: 'Text-to-Speech status', indicatorId: 'tts-status-indicator' },
  { key: 'sfx', label: 'SFX', title: 'Sound Effects status', indicatorId: 'sfx-status-indicator' },
  { key: 'music', label: 'Music', title: 'Music Generation status', indicatorId: 'music-status-indicator' },
];

@customElement('cinegen-model-status-bar')
export class CinegenModelStatusBar extends CgLightElement {
  connectedCallback(): void {
    super.connectedCallback();
    this.classList.add('status-item');
    this.id = 'model-status-group';
  }

  protected firstUpdated(): void {
    const refresh = () => {
      updateModelStatusIndicators();
      updateAudioSubmodalityIndicators();
    };
    whenBootReady('aiSettings', refresh);
    whenBootReady('app', refresh);
  }

  render() {
    return html`
      ${MODALITIES.map(
        (mod) => html`
          <cg-toolbar-split
            id="${mod.key}-status-split"
            unified
            variant="toolbar-split--status-bar"
            menu-id="${mod.key}-status-menu"
            main-title=${mod.title}
            @cg-menu-open=${() => {
              buildModelStatusMenu(mod.key);
              updateModelStatusIndicators();
              requestAnimationFrame(() => {
                positionModelStatusMenu(mod.key);
              });
            }}
            @cg-menu-close=${() => {
              requestAnimationFrame(() => updateModelStatusIndicators());
            }}
          >
            <span slot="main">
              <span class="sa-status-indicator" id="${mod.key}-status-indicator"></span>
              <span class="sa-status-split-label">
                <span class="sa-status-split-modality" id="${mod.key}-status-modality"
                  >${mod.label}</span
                >
                <span class="sa-status-split-model" id="${mod.key}-status-model">Not set</span>
              </span>
            </span>
          </cg-toolbar-split>
        `
      )}
      <cg-segmented-split
        id="audio-subs-split"
        variant="cg-segmented-split--status-bar"
        .segments=${AUDIO_SUBS.map((s) => ({
          key: s.key,
          label: s.label,
          title: s.title,
          indicatorId: s.indicatorId,
        }))}
        @cg-segment-action=${(e: CustomEvent) => {
          const { key } = e.detail;
          buildAudioSubmodalityMenu(key);
          updateAudioSubmodalityIndicators();
          requestAnimationFrame(() => positionAudioSubmodalityMenu(key));
        }}
        @cg-menu-close=${() => {
          requestAnimationFrame(() => updateAudioSubmodalityIndicators());
        }}
      ></cg-segmented-split>
    `;
  }
}
