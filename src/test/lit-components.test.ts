import { render as litRender, html, LitElement } from 'lit';
import { fireEvent } from '@testing-library/dom';
import { customElement, property, state } from 'lit/decorators.js';

@customElement('test-counter')
class TestCounter extends LitElement {
  @property({ type: Number }) count = 0;
  @state() private _internalCount = 0;

  render() {
    return html`
      <div>
        <span data-testid="count">${this._internalCount}</span>
        <button @click=${this._increment} data-testid="increment">Increment</button>
        <button @click=${this._decrement} data-testid="decrement">Decrement</button>
        <button @click=${this._reset} data-testid="reset">Reset</button>
      </div>
    `;
  }

  _increment() { this._internalCount++; }
  _decrement() { this._internalCount--; }
  _reset() { this._internalCount = 0; }
}

function queryShadow(el: Element, selector: string): Element | null {
  return el.shadowRoot?.querySelector(selector) ?? null;
}

describe('Lit component testing setup', () => {
  let container: HTMLDivElement;
  let component: TestCounter;
  
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });
  
  afterEach(() => {
    container.remove();
  });

  it('renders and handles interactions', async () => {
    litRender(html`<test-counter></test-counter>`, container);
    component = container.querySelector('test-counter')!;
    await component.updateComplete;
    
    expect(queryShadow(component, '[data-testid="count"]')?.textContent).toBe('0');
    
    fireEvent.click(queryShadow(component, '[data-testid="increment"]')!);
    await component.updateComplete;
    expect(queryShadow(component, '[data-testid="count"]')?.textContent).toBe('1');
    
    fireEvent.click(queryShadow(component, '[data-testid="increment"]')!);
    await component.updateComplete;
    expect(queryShadow(component, '[data-testid="count"]')?.textContent).toBe('2');
    
    fireEvent.click(queryShadow(component, '[data-testid="decrement"]')!);
    await component.updateComplete;
    expect(queryShadow(component, '[data-testid="count"]')?.textContent).toBe('1');
    
    fireEvent.click(queryShadow(component, '[data-testid="reset"]')!);
    await component.updateComplete;
    expect(queryShadow(component, '[data-testid="count"]')?.textContent).toBe('0');
  });
});

@customElement('test-form')
class TestForm extends LitElement {
  @property({ type: String }) value = '';
  
  render() {
    return html`
      <form @submit=${this._onSubmit}>
        <input 
          data-testid="input"
          .value=${this.value}
          @input=${(e: Event) => this.value = (e.target as HTMLInputElement).value}
        />
        <button type="submit" data-testid="submit">Submit</button>
      </form>
    `;
  }
  
  _onSubmit(e: Event) {
    e.preventDefault();
    this.dispatchEvent(new CustomEvent('form-submit', { detail: { value: this.value } }));
  }
}

describe('Lit component with form', () => {
  let container: HTMLDivElement;
  let component: TestForm;
  
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });
  
  afterEach(() => {
    container.remove();
  });

  it('handles form submission', async () => {
    let submittedValue = '';
    
    litRender(html`<test-form @form-submit=${(e: CustomEvent) => { submittedValue = e.detail.value; }}></test-form>`, container);
    component = container.querySelector('test-form')!;
    await component.updateComplete;
    
    const input = queryShadow(component, '[data-testid="input"]') as HTMLInputElement;
    input.value = 'hello world';
    fireEvent.input(input);
    await component.updateComplete;
    expect(input.value).toBe('hello world');
    
    fireEvent.click(queryShadow(component, '[data-testid="submit"]')!);
    expect(submittedValue).toBe('hello world');
  });
});