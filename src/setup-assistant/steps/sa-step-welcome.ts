import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';

/** Setup wizard — welcome step (static markup). */
@customElement('sa-step-welcome')
export class SaStepWelcome extends CgLightElement {
  render() {
    return html`
      <div class="sa-welcome">
        <div class="sa-welcome-logo" aria-hidden="true">
          <i class="fa-solid fa-film sa-welcome-icon"></i>
        </div>
        <h2 class="sa-welcome-title">Welcome to CineGen</h2>
        <p class="sa-welcome-lead">
          Let's connect your AI providers so you can start generating shots, writing scripts, and
          building scenes.
        </p>
        <div class="sa-modality-overview">
          <div class="sa-modality-row">
            <span class="sa-badge sa-badge--required">REQUIRED</span>
            <i class="fa-solid fa-comments sa-modality-icon" aria-hidden="true"></i>
            <div>
              <strong>Language / Text AI</strong>
              <span class="sa-modality-hint">Script writing, AI assistants, scene suggestions</span>
            </div>
          </div>
          <div class="sa-modality-row">
            <span class="sa-badge sa-badge--required">REQUIRED</span>
            <i class="fa-solid fa-film sa-modality-icon" aria-hidden="true"></i>
            <div>
              <strong>Video Generation</strong>
              <span class="sa-modality-hint">Shots, takes, and coverage clips from your scripts</span>
            </div>
          </div>
          <div class="sa-modality-row">
            <span class="sa-badge sa-badge--required">REQUIRED</span>
            <i class="fa-solid fa-image sa-modality-icon" aria-hidden="true"></i>
            <div>
              <strong>Image / Storyboards</strong>
              <span class="sa-modality-hint">Storyboard frames and reference visuals</span>
            </div>
          </div>
          <div class="sa-modality-row">
            <span class="sa-badge sa-badge--optional">OPTIONAL</span>
            <i class="fa-solid fa-headphones sa-modality-icon" aria-hidden="true"></i>
            <div>
              <strong>Audio — TTS · SFX · Music</strong>
              <span class="sa-modality-hint">Voiceover, sound effects, and music generation</span>
            </div>
          </div>
        </div>
        <p class="sa-welcome-note">
          About 3 minutes: add providers and keys, assign them to tasks, then pick models. Change
          anytime under <strong>Settings → API Keys &amp; Service Providers</strong> or
          <strong>AI Models &amp; Modalities</strong>.
        </p>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sa-step-welcome': SaStepWelcome;
  }
}
