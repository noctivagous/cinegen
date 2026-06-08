import type { ProductionReference, ReferenceSource, SearchResultItem } from '@/workspace/references-types';
import { CG_PRODUCTION_REFERENCES_CHANGED } from '@/events/shell-events';

function getState(): {
  productionReferences: ProductionReference[];
  activeProjectId: string;
  assetDetailData: Record<string, unknown>;
} {
  const w = window as unknown as Record<string, unknown>;
  return {
    productionReferences: Array.isArray(w.productionReferences) ? w.productionReferences as ProductionReference[] : [],
    activeProjectId: typeof w.activeProjectId === 'string' ? w.activeProjectId as string : '',
    assetDetailData: w.assetDetailData && typeof w.assetDetailData === 'object' ? w.assetDetailData as Record<string, unknown> : {},
  };
}

function dirtyHook(): void {
  const w = window as unknown as Record<string, unknown>;
  if (typeof w.markProjectDirty === 'function') {
    (w.markProjectDirty as (types: string[]) => void)(['productionReferences']);
  }
}

export async function fetchImageAsDataUrl(sourceUrl: string): Promise<string> {
  const res = await fetch(sourceUrl, { mode: 'cors' });
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function extractColorPaletteFromImage(dataUrl: string, sampleCount = 5000): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const maxSize = 200;
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve([]); return; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageData.data;

        const samples: number[][] = [];
        const step = Math.max(1, Math.floor((canvas.width * canvas.height) / sampleCount));
        for (let i = 0; i < pixels.length; i += step * 4) {
          const r = pixels[i];
          const g = pixels[i + 1];
          const b = pixels[i + 2];
          const a = pixels[i + 3];
          if (a < 128) continue;
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          if (lum < 10 || lum > 245) continue;
          samples.push([r, g, b]);
        }

        if (samples.length === 0) { resolve([]); return; }

        const buckets = new Map<string, { sumR: number; sumG: number; sumB: number; count: number }>();
        const bucketSize = 32;
        for (const [r, g, b] of samples) {
          const key = `${Math.floor(r / bucketSize)},${Math.floor(g / bucketSize)},${Math.floor(b / bucketSize)}`;
          const existing = buckets.get(key);
          if (existing) {
            existing.sumR += r; existing.sumG += g; existing.sumB += b; existing.count++;
          } else {
            buckets.set(key, { sumR: r, sumG: g, sumB: b, count: 1 });
          }
        }

        const sorted = Array.from(buckets.entries())
          .sort((a, b) => b[1].count - a[1].count)
          .slice(0, 6);

        const palette: string[] = [];
        const used = new Set<string>();
        for (const [, { sumR, sumG, sumB, count }] of sorted) {
          const r = Math.round(sumR / count);
          const g = Math.round(sumG / count);
          const b = Math.round(sumB / count);
          const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
          const isDuplicate = Array.from(used).some((e) => {
            const er = parseInt(e.slice(1, 3), 16);
            const eg = parseInt(e.slice(3, 5), 16);
            const eb = parseInt(e.slice(5, 7), 16);
            return (r - er) ** 2 + (g - eg) ** 2 + (b - eb) ** 2 < 900;
          });
          if (!isDuplicate) { used.add(hex); palette.push(hex); }
        }

        resolve(palette);
      } catch (e) { reject(e); }
    };
    img.onerror = () => resolve([]);
    img.src = dataUrl;
  });
}

function generateRefId(): string {
  return `ref-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function mimeTypeFromUrl(url: string): string {
  const ext = url.split('?')[0].split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif' };
  return map[ext] || 'image/jpeg';
}

export async function downloadAndSaveReference(
  resultItem: SearchResultItem,
  source: ReferenceSource,
): Promise<ProductionReference | null> {
  const { activeProjectId } = getState();
  if (!activeProjectId) return null;
  if (!resultItem.imageUrl) return null;

  try {
    const dataUrl = await fetchImageAsDataUrl(resultItem.imageUrl);
    const colorPalette = await extractColorPaletteFromImage(dataUrl);

    const uploadRes = await fetch(`/api/projects/${encodeURIComponent(activeProjectId)}/asset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataUrl }),
    });
    if (!uploadRes.ok) return null;

    const { path: filePath } = await uploadRes.json() as { path: string };

    const ref: ProductionReference = {
      id: generateRefId(),
      title: resultItem.title,
      source,
      sourceUrl: resultItem.sourceUrl,
      sourcePageUrl: resultItem.sourcePageUrl,
      filePath,
      thumbnailDataUrl: dataUrl,
      mimeType: mimeTypeFromUrl(resultItem.imageUrl),
      tags: ['downloaded-production-reference', source],
      colorPalette,
      metadata: {
        creator: resultItem.creator,
        date: resultItem.date,
        description: resultItem.description,
        attribution: resultItem.attribution,
        license: resultItem.license,
      },
      createdAt: new Date().toISOString(),
    };

    const w = window as unknown as Record<string, unknown>;
    const refs = Array.isArray(w.productionReferences) ? [...w.productionReferences as ProductionReference[], ref] : [ref];
    w.productionReferences = refs;
    mirrorToGlobalAssets();
    dirtyHook();
    window.dispatchEvent(new CustomEvent(CG_PRODUCTION_REFERENCES_CHANGED));
    return ref;
  } catch (e) {
    return null;
  }
}

export function getProductionReferences(): ProductionReference[] {
  return getState().productionReferences;
}

export async function removeReference(id: string): Promise<boolean> {
  const { productionReferences: refs } = getState();
  const idx = refs.findIndex((r) => r.id === id);
  if (idx === -1) return false;

  refs.splice(idx, 1);
  const w = window as unknown as Record<string, unknown>;
  w.productionReferences = [...refs];
  mirrorToGlobalAssets();
  dirtyHook();
  window.dispatchEvent(new CustomEvent(CG_PRODUCTION_REFERENCES_CHANGED));
  return true;
}

export function mirrorToGlobalAssets(): void {
  const { productionReferences: refs, assetDetailData } = getState();
  const items = refs.map((ref) => ({
    name: ref.title,
    desc: ref.metadata.description || '',
    icon: 'fa-image',
    tags: [...ref.tags],
    status: 'ready',
    refId: ref.id,
    colorPalette: ref.colorPalette,
    thumbnailDataUrl: ref.thumbnailDataUrl,
  }));

  assetDetailData['production-references-bin'] = {
    layout: 'grid',
    icon: 'fa-image',
    desc: 'Downloaded production references from public archives',
    items,
  };
}
