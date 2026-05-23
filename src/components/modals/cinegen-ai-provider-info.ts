import { html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';
import { AI_API_PROVIDERS } from '@/data/provider-catalog';
import {
  getCachedAudioModelsByCapability,
  loadProviderModelCatalog,
  modelMatchesAudioCapability,
} from '@/services/provider-model-catalog';
import { escHtml } from '@/utils/html';

interface VendorInfo {
  vendorId: string;
  name: string;
  provider: string;
  modalities: {
    llm: string[];
    image: string[];
    video: string[];
    audio_tts: string[];
    audio_sfx: string[];
    audio_music: string[];
  };
}

type ModalityCol = 'llm' | 'image' | 'video' | 'audio_tts' | 'audio_sfx' | 'audio_music';

type CatalogVendorRec = {
  providerId?: string;
  modalities?: Record<
    string,
    {
      status?: string;
      models?: Array<{ id: string; label?: string }>;
    }
  >;
};

@customElement('cinegen-ai-provider-info')
export class CinegenAiProviderInfo extends CgLightElement {
  @state() private _showFull = false;

  /** Rebuild table when the modal opens (catalog may have refreshed). */
  refresh(): void {
    this.requestUpdate();
  }

  render() {
    const rows = this._buildTableData();

    if (!rows.length) {
      return html`<div class="panel-content" style="padding:24px;text-align:center;color:var(--text-dim)">
        No provider data yet. Add API keys in <strong>Settings → AI Providers</strong>, then test a connection
        or run the Setup Assistant to fetch live model lists.
      </div>`;
    }

    const totalModels = rows.reduce((s, r) => {
      const m = r.modalities;
      return (
        s +
        m.llm.length +
        m.image.length +
        m.video.length +
        m.audio_tts.length +
        m.audio_sfx.length +
        m.audio_music.length
      );
    }, 0);

    return html`
      <div class="panel-content" style="padding:0;overflow:auto;max-height:65vh">
        <div style="padding:8px 16px;font-size:12px;color:var(--text-dim);border-bottom:1px solid var(--border-dark)">
          ${rows.length} vendor${rows.length !== 1 ? 's' : ''} · ${totalModels} model${totalModels !== 1 ? 's' : ''}
          <label style="float:right;cursor:pointer">
            <input
              type="checkbox"
              .checked=${this._showFull}
              @change=${this._onToggleFull}
              style="margin-right:4px"
            />
            Show catalog providers without a configured vendor
          </label>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;white-space:nowrap">
          <thead style="position:sticky;top:0;background:var(--bg-panel);z-index:1">
            <tr style="border-bottom:1px solid var(--border-dark)">
              <th style="text-align:left;padding:8px 12px;font-weight:600">Provider</th>
              <th style="text-align:left;padding:8px 12px;font-weight:600">LLM</th>
              <th style="text-align:left;padding:8px 12px;font-weight:600">Image</th>
              <th style="text-align:left;padding:8px 12px;font-weight:600">Video</th>
              <th style="text-align:left;padding:8px 12px;font-weight:600">Audio TTS</th>
              <th style="text-align:left;padding:8px 12px;font-weight:600">Audio SFX</th>
              <th style="text-align:left;padding:8px 12px;font-weight:600">Audio Music</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(
              (r) => html`
                <tr style="border-bottom:1px solid var(--border-dark)">
                  <td style="padding:8px 12px;vertical-align:top;font-weight:500">
                    ${escHtml(r.name)}
                    <div style="font-size:11px;color:var(--text-dim);font-weight:400">${escHtml(r.provider)}</div>
                  </td>
                  ${this._cell(r.modalities.llm)}
                  ${this._cell(r.modalities.image)}
                  ${this._cell(r.modalities.video)}
                  ${this._cell(r.modalities.audio_tts)}
                  ${this._cell(r.modalities.audio_sfx)}
                  ${this._cell(r.modalities.audio_music)}
                </tr>
              `
            )}
          </tbody>
        </table>
      </div>
    `;
  }

  private _cell(models: string[]) {
    if (!models.length) {
      return html`<td style="padding:8px 12px;color:var(--text-dim);font-size:12px">—</td>`;
    }
    return html`<td style="padding:8px 12px;vertical-align:top">
      <div style="display:flex;flex-direction:column;gap:2px">
        ${models.map((m) => html`<span style="font-size:12px">${escHtml(m)}</span>`)}
      </div>
    </td>`;
  }

  private _onToggleFull(e: Event) {
    this._showFull = (e.target as HTMLInputElement).checked;
  }

  private _emptyModalities(): VendorInfo['modalities'] {
    return { llm: [], image: [], video: [], audio_tts: [], audio_sfx: [], audio_music: [] };
  }

  /** Collapse `together_ai/foo` vs `foo` and similar API vs static id shapes. */
  private _normalizeModelKey(id: string, label?: string): string {
    const raw = (id || label || '').trim().toLowerCase();
    if (!raw) return '';
    const tail = raw.includes('/') ? raw.split('/').pop()! : raw;
    return tail.replace(/\s+/g, ' ').trim();
  }

  private _dedupeModelLabels(entries: Array<{ id?: string; label?: string }>): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const entry of entries) {
      const id = String(entry?.id || '').trim();
      const label = String(entry?.label || id).trim();
      const key = this._normalizeModelKey(id, label);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(label || id);
    }
    return out;
  }

  private _setModalityLabels(
    info: VendorInfo,
    col: ModalityCol,
    entries: Array<{ id?: string; label?: string }>,
    mode: 'replace' | 'append' = 'replace'
  ): void {
    const fresh = this._dedupeModelLabels(entries);
    if (mode === 'replace' || !info.modalities[col].length) {
      info.modalities[col] = fresh;
      return;
    }
    const merged: Array<{ id: string; label: string }> = [];
    for (const label of info.modalities[col]) {
      merged.push({ id: label, label });
    }
    for (const entry of entries) {
      merged.push({ id: entry.id || entry.label || '', label: entry.label || entry.id || '' });
    }
    info.modalities[col] = this._dedupeModelLabels(merged);
  }

  private _voiceSuffixForModel(model: any): string {
    const voices = Array.isArray(model?.voices) ? model.voices : [];
    if (!voices.length) return '';
    const preview = voices.slice(0, 3).join(', ');
    const more = voices.length > 3 ? ` +${voices.length - 3}` : '';
    return ` [voices: ${preview}${more}]`;
  }

  private _ensureVendorRow(
    cacheMap: Record<string, VendorInfo>,
    vendorId: string,
    name: string,
    providerId: string
  ): VendorInfo {
    if (!cacheMap[vendorId]) {
      cacheMap[vendorId] = {
        vendorId,
        name,
        provider: providerId,
        modalities: this._emptyModalities(),
      };
    }
    return cacheMap[vendorId];
  }

  /** Apply live-fetched catalog only (no static routing catalog — avoids duplicate rows per vendor). */
  private _applyLiveCatalog(info: VendorInfo, rec: CatalogVendorRec): void {
    const providerId = rec.providerId || info.provider;

    for (const mod of ['llm', 'image', 'video'] as const) {
      const m = rec.modalities?.[mod];
      if (m && (m.status === 'ok' || m.status === 'ratelimit') && Array.isArray(m.models)) {
        this._setModalityLabels(info, mod, m.models, 'replace');
      }
    }

    const audioMod = rec.modalities?.audio;
    if (
      audioMod &&
      (audioMod.status === 'ok' || audioMod.status === 'ratelimit') &&
      Array.isArray(audioMod.models)
    ) {
      for (const sub of ['tts', 'sfx', 'music'] as const) {
        const col = `audio_${sub}` as ModalityCol;
        const cached = getCachedAudioModelsByCapability(info.vendorId, sub);
        if (cached.length) {
          const withVoices = sub === 'tts'
            ? cached.map((m: any) => ({ id: m.id, label: `${m.label || m.id}${this._voiceSuffixForModel(m)}` }))
            : cached;
          this._setModalityLabels(info, col, withVoices, 'replace');
          continue;
        }
        const filtered = audioMod.models.filter((m) =>
          modelMatchesAudioCapability(m, sub, providerId)
        );
        const withVoices = sub === 'tts'
          ? filtered.map((m: any) => ({ ...m, label: `${m.label || m.id}${this._voiceSuffixForModel(m)}` }))
          : filtered;
        this._setModalityLabels(info, col, withVoices, 'replace');
      }
    }
  }

  private _buildTableData(): VendorInfo[] {
    const catalog = loadProviderModelCatalog();
    const cacheMap: Record<string, VendorInfo> = {};

    const keyVendors =
      typeof window.loadApiKeys === 'function'
        ? ((window.loadApiKeys() as { vendors?: Array<{ id: string; name?: string; providerId?: string }> })
            .vendors || [])
        : [];

    for (const v of keyVendors) {
      if (!v?.id) continue;
      if (typeof window.vendorHasApiKey === 'function' && !window.vendorHasApiKey(v)) continue;

      const info = this._ensureVendorRow(
        cacheMap,
        v.id,
        (v.name || '').trim() || this._vendorName(v.id, v.providerId || ''),
        v.providerId || 'openai-compatible'
      );

      const rec = catalog.vendors?.[v.id] as CatalogVendorRec | undefined;
      if (rec) this._applyLiveCatalog(info, rec);
    }

    if (this._showFull) {
      for (const vid of Object.keys(catalog.vendors || {})) {
        if (cacheMap[vid]) continue;
        const rec = catalog.vendors[vid] as CatalogVendorRec;
        if (!rec?.modalities) continue;
        const info = this._ensureVendorRow(
          cacheMap,
          vid,
          this._vendorName(vid, rec.providerId || ''),
          rec.providerId || ''
        );
        this._applyLiveCatalog(info, rec);
      }

      for (const prov of AI_API_PROVIDERS) {
        if (Object.values(cacheMap).some((row) => row.provider === prov.id)) continue;
        const vid = `catalog:${prov.id}`;
        cacheMap[vid] = {
          vendorId: vid,
          name: prov.label.split(' (')[0],
          provider: prov.id,
          modalities: this._emptyModalities(),
        };
      }
    }

    return Object.values(cacheMap).sort((a, b) => a.name.localeCompare(b.name));
  }

  private _vendorName(vendorId: string, providerId: string): string {
    if (typeof window.loadApiKeys === 'function') {
      const keys = window.loadApiKeys() as {
        vendors?: Array<{ id: string; name?: string }>;
      };
      const match = keys.vendors?.find((v) => v.id === vendorId);
      if (match?.name?.trim()) return match.name.trim();
    }

    const prov = AI_API_PROVIDERS.find((p) => p.id === providerId);
    return prov?.label.split(' (')[0] || providerId || vendorId;
  }
}
