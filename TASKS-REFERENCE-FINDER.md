# References Finder — Phase 1 Implementation

## Goal
Public-domain image search (IA / LoC / Wikimedia Commons) + download-to-.cine + color palette extraction + management via both a dedicated References Finder panel and a bin under Global Assets.

---

## Tree Structure

```
Studio Space
├── Global Assets
│   ├── Footage (bin, asset-detail)
│   ├── Audio (bin, asset-detail)
│   ├── Graphics (bin, asset-detail)
│   ├── Library Browser (assets)
│   ├── Production References (bin, asset-detail, detailKey: production-references-bin)  ← NEW
│   └── Scrap Bin (scrap)
├── References Finder (references-finder, view: references-finder)  ← NEW
├── Mood Boards
├── ScratchPad
├── Drafts
└── Beatboard
```

---

## Execution Order

### 1. Types — `src/workspace/references-types.ts`
- `ReferenceSource` enum: `'internet-archive' | 'library-of-congress' | 'wikimedia-commons'`
- `ProductionReference` interface: `{ id, title, source, sourceUrl, sourcePageUrl, filePath, thumbnailDataUrl, mimeType, tags, colorPalette (hex string[]), metadata { creator, date, description, attribution, license }, createdAt }`
- `SearchResultItem`: normalized result across all three sources
- `SearchParams`: `{ query, source, page }`
- `SearchResponse`: `{ items: SearchResultItem[], totalResults: number, page: number }`

### 2. Search Service — `src/services/references-search-service.ts`
- `searchInternetArchive(query, page)` → `GET https://archive.org/advancedsearch.php?q=...&fl[]=identifier,title,description,mediatype,creator,date&rows=50&page=...&output=json`
- `searchLibraryOfCongress(query, page)` → `GET https://www.loc.gov/search/?q=...&fo=json&c=50&sp=...`
- `searchWikimediaCommons(query, page)` → `GET https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=...&srnamespace=6&format=json&srlimit=50`
- `getImageUrl(item, source)` → derive direct image URL per source conventions
- In-memory LRU cache (Map, max 100)
- Debounce helper (400ms) for search input

### 3. Proxy Endpoints — `server/proxy.js` + `server/lib/project-store.js`
- `POST /api/projects/:id/asset` — body: `{ dataUrl, filename }`. Decodes base64, writes to `<project>/references/<filename>`. Returns `{ path }`.
- `GET /api/projects/:id/asset/*` — reads file from `<project>/<path>`. Serves with content-type. 404 if missing.

### 4. Data Layer Registration — 6 files
- `src/data/cine-project-types.ts`: add `productionReferences` to manifest + AppliedCineProject
- `src/data/cine-project-loader.ts`: add `assertDocExtension('.cineproductionreferences')` + load into applied
- `src/data/project-snapshot-normalize.ts`: add `productionReferences: asArray(...)`
- `src/services/project-service.ts`: blank snapshot `[]`, import, capture via `structuredClone`
- `src/services/project-serializer.ts`: add to `DOC_TYPE_TO_FILENAME`
- `server/lib/proxy-utils.js`: add `.cineproductionreferences` to `CINE_DOC_RE`

### 5. Production Reference Service — `src/services/production-reference-service.ts`
- `fetchImageAsDataUrl(sourceUrl)`: fetch blob → readAsDataURL
- `downloadAndSaveReference(resultItem, source)`: full pipeline — fetch image → base64 → POST to proxy → extract palette → create entry in doc → mirror into assetDetailData
- `extractColorPalette(dataUrl, sampleCount=5000)`: canvas-based median-cut quantization → returns `string[]` of hex colors
- `getProductionReferences()`: read from application state
- `addProductionReference(ref)`: adds to array, queues save
- `removeReference(id)`: deletes file via proxy, removes from array
- `mirrorToGlobalAssets()`: sync into `assetDetailData['production-references-bin'].items`

### 6. Main Component — `src/components/panels/cinegen-references-finder.ts`
Lit component (decorators, `@state`, `@property`):
- **Search tab**: tab bar (3 sources), search input, results grid/masonry toggle, pagination
- **Library tab**: grid of downloaded refs with palette swatches, tags, remove/assign buttons
- **Detail overlay**: full image, metadata, color palette, tags, download/remove/assign actions
- Refs context menu via `@cg-ref-contextmenu` event dispatched from right-click on items

### 7. Chunk File — `src/components/panels/chunk-references.ts`
Lazy import of `cinegen-references-finder`

### 8. Tree Registration — 4 files
- `project-tree.cinetree`: add References Finder node + Production References bin under Global Assets
- `project-feature-catalog.ts`: add `references-finder` to Studio Space children
- `tree-view-contract.ts`: add `references-finder → view: references-finder` to LEGACY_NODE_VIEW_CONTRACT + TREE_VIEW_REQUIREMENTS
- `panel-loader.ts`: add to VIEW_CHUNK, VIEW_HOST_TAG, chunkLoaders

### 9. Context Menu — `cinegen-app.ts`
- Add `<cg-context-menu id="production-ref-context-menu">` with options:
  - Assign to Mood Board → `cg-assign-ref-to-moodboard` event
  - Assign to Beat Board → `cg-assign-ref-to-beatboard`
  - Assign to Character Reference → `cg-assign-ref-to-character`
  - Assign to Location → `cg-assign-ref-to-location`
  - Remove → `cg-remove-production-ref`
- Wire `@contextmenu` handler in both the Finder component and the Global Assets bin

### 10. globals.d.ts
- Register `cinegen-references-finder` as `LitElement`

### 11. Build
- `npm run build`

---

## API Details (No Auth / CORS)

| Source | Search Endpoint | Image URL Derivation |
|--------|----------------|---------------------|
| Internet Archive | `advancedsearch.php?q={q}&fl[]=identifier,title,description,mediatype,creator,date&rows=50&page={p}&output=json` | `https://archive.org/download/{id}/{id}.jpg` or `https://archive.org/services/img/{id}` |
| Library of Congress | `search/?q={q}&fo=json&c=50&sp={p}` | Check `image_url` or `iiif_service` in result; fallback `https://loc.gov/item/{id}/` |
| Wikimedia Commons | `api.php?action=query&list=search&srsearch={q}&srnamespace=6&format=json&srlimit=50` | Parse page title → use `https://commons.wikimedia.org/wiki/Special:FilePath/{title}` |

---

## Color Extraction Strategy

Pure client-side canvas:
1. Create offscreen `<canvas>`, draw image at reduced resolution (max 200px wide)
2. Sample every Nth pixel (target ~5000 samples)
3. Bucket into 64 color buckets (coarse RGB quantization)
4. Sort buckets by count, take top 6
5. Convert each bucket centroid to hex string
6. Return `string[]` (matches existing `StyleGuide.colorPalette` format)
