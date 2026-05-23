import { LitElement } from 'lit';

/** Light DOM base — preserves global CineGen CSS (toolbar, bevel, Tailwind). */
export class CgLightElement extends LitElement {
  protected createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }
}
