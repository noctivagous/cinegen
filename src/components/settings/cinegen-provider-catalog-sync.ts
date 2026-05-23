import { Task } from '@lit/task';
import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';
import {
  refreshAllProviderCatalogsOnLoad,
  refreshVendorCatalog,
  type ApiKeysVendor,
} from '@/services/provider-catalog-refresh';

@customElement('cinegen-provider-catalog-sync')
export class CinegenProviderCatalogSync extends CgLightElement {
  private readonly _loadTask = new Task(this, {
    task: async () => refreshAllProviderCatalogsOnLoad(),
    autoRun: false,
  });

  private readonly _vendorTask = new Task(this, {
    task: async ([vendor]: [ApiKeysVendor]) => refreshVendorCatalog(vendor),
    autoRun: false,
  });

  connectedCallback(): void {
    super.connectedCallback();
    this.hidden = true;
    this.setAttribute('aria-hidden', 'true');
  }

  /** App bootstrap — call after `fetchProviderModelsForModality` is installed. */
  runLoad(): Promise<void> {
    return this._loadTask.run();
  }

  refreshVendor(vendor: ApiKeysVendor): Promise<void> {
    return this._vendorTask.run([vendor]);
  }

  render() {
    return html``;
  }
}

export function startProviderCatalogSync(): Promise<void> {
  const el = document.querySelector('cinegen-provider-catalog-sync');
  if (el instanceof CinegenProviderCatalogSync) {
    return el.runLoad();
  }
  return refreshAllProviderCatalogsOnLoad();
}

export function refreshSelectedVendorCatalog(vendor: ApiKeysVendor): Promise<void> {
  const el = document.querySelector('cinegen-provider-catalog-sync');
  if (el instanceof CinegenProviderCatalogSync) {
    return el.refreshVendor(vendor);
  }
  return refreshVendorCatalog(vendor);
}

declare global {
  interface HTMLElementTagNameMap {
    'cinegen-provider-catalog-sync': CinegenProviderCatalogSync;
  }
}
