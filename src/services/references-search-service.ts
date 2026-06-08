import type { ReferenceSource, SearchResultItem, SearchResponse } from '@/workspace/references-types';
import { loadImageApiKeys } from '@/services/image-api-keys';

const CACHE_SIZE = 100;
const cache = new Map<string, { data: SearchResponse; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000;

const lastRequestTime: Record<string, number> = {};

function getCacheKey(source: ReferenceSource, query: string, page: number): string {
  return `${source}:${query.toLowerCase()}:${page}`;
}

function getFromCache(key: string): SearchResponse | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: SearchResponse): void {
  if (cache.size >= CACHE_SIZE) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { data, timestamp: Date.now() });
}

async function rateLimitedFetch(url: string, source: string, headers?: Record<string, string>): Promise<Response> {
  const now = Date.now();
  const last = lastRequestTime[source] ?? 0;
  const wait = Math.max(0, 500 - (now - last));
  if (wait > 0) {
    await new Promise(r => setTimeout(r, wait));
  }
  lastRequestTime[source] = Date.now();
  return fetch(url, headers ? { headers } : undefined);
}

export function debounce<T extends (...args: unknown[]) => unknown>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: unknown[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}

function normalizeInternetArchiveResult(item: Record<string, unknown>): SearchResultItem {
  const id = String(item.identifier ?? '');
  return {
    id,
    title: String(item.title ?? id),
    source: 'internet-archive',
    sourceUrl: `https://archive.org/details/${encodeURIComponent(id)}`,
    thumbnailUrl: `https://archive.org/services/img/${encodeURIComponent(id)}`,
    imageUrl: `https://archive.org/download/${encodeURIComponent(id)}/${encodeURIComponent(id)}.jpg`,
    creator: item.creator ? String(item.creator) : undefined,
    date: item.date ? String(item.date) : undefined,
    description: item.description ? String(item.description) : undefined,
    sourcePageUrl: `https://archive.org/details/${encodeURIComponent(id)}`,
  };
}

function normalizeOpenverseResult(item: Record<string, unknown>): SearchResultItem {
  const id = String(item.id ?? '');
  return {
    id,
    title: String(item.title ?? ''),
    source: 'openverse',
    sourceUrl: String(item.url ?? ''),
    thumbnailUrl: item.thumbnail
      ? String(item.thumbnail)
      : `https://api.openverse.org/v1/images/${encodeURIComponent(id)}/thumb/`,
    imageUrl: String(item.url ?? ''),
    creator: item.creator ? String(item.creator) : undefined,
    description: item.description ? String(item.description) : undefined,
    attribution: item.attribution ? String(item.attribution) : undefined,
    license: item.license ? `${String(item.license)}${item.license_version ? ` ${item.license_version}` : ''}` : undefined,
    sourcePageUrl: item.creator_url ? String(item.creator_url) : undefined,
  };
}

function normalizeLoCResult(item: Record<string, unknown>): SearchResultItem {
  const id = String(item.id ?? '');
  const title = String(item.title ?? item.id ?? '');
  const imageUrl = item.image_url
    ? (Array.isArray(item.image_url) ? String(item.image_url[0]) : String(item.image_url))
    : undefined;
  return {
    id,
    title,
    source: 'library-of-congress',
    sourceUrl: `https://www.loc.gov/item/${encodeURIComponent(id)}/`,
    thumbnailUrl: imageUrl,
    imageUrl,
    creator: item.contributor_names
      ? (Array.isArray(item.contributor_names) ? String(item.contributor_names[0]) : String(item.contributor_names))
      : (item.contributor as Record<string, unknown>)?.display
        ? String((item.contributor as Record<string, unknown>).display)
        : undefined,
    date: item.date ? String(item.date) : undefined,
    description: item.description
      ? (Array.isArray(item.description) ? String(item.description[0]) : String(item.description))
      : undefined,
    sourcePageUrl: `https://www.loc.gov/item/${encodeURIComponent(id)}/`,
  };
}

const WIKI_TITLE_RE = /^File:(.+)$/i;

function normalizeWikimediaResult(item: Record<string, unknown>): SearchResultItem {
  const title = String(item.title ?? '');
  const pageId = String(item.pageid ?? '');
  const m = title.match(WIKI_TITLE_RE);
  const fileName = m ? m[1] : title;
  return {
    id: pageId,
    title: fileName,
    source: 'wikimedia-commons',
    sourceUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`,
    thumbnailUrl: `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}?width=300`,
    imageUrl: `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}`,
    description: item.snippet ? String(item.snippet).replace(/<[^>]*>/g, '') : undefined,
    sourcePageUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`,
  };
}

function normalizeMetMuseumResult(item: Record<string, unknown>): SearchResultItem {
  const id = String(item.objectID ?? '');
  return {
    id,
    title: String(item.title ?? ''),
    source: 'met-museum',
    sourceUrl: `https://www.metmuseum.org/art/collection/search/${encodeURIComponent(id)}`,
    thumbnailUrl: item.primaryImageSmall ? String(item.primaryImageSmall) : undefined,
    imageUrl: item.primaryImage ? String(item.primaryImage) : undefined,
    creator: item.artistDisplayName ? String(item.artistDisplayName) : undefined,
    date: item.objectDate ? String(item.objectDate) : undefined,
    description: [item.culture, item.medium, item.creditLine]
      .filter(Boolean)
      .map(String)
      .join(' — '),
    attribution: item.creditLine ? String(item.creditLine) : undefined,
    sourcePageUrl: `https://www.metmuseum.org/art/collection/search/${encodeURIComponent(id)}`,
  };
}

export async function searchInternetArchive(query: string, page = 1): Promise<SearchResponse> {
  const key = getCacheKey('internet-archive', query, page);
  const cached = getFromCache(key);
  if (cached) return cached;

  const rows = 50;
  const url = `https://archive.org/advancedsearch.php?q=subject%3A${encodeURIComponent(query)}+AND+mediatype%3Aimage&fl[]=identifier&fl[]=title&fl[]=description&fl[]=mediatype&fl[]=creator&fl[]=date&rows=${rows}&page=${page}&output=json`;

  const res = await rateLimitedFetch(url, 'internet-archive');
  if (!res.ok) throw new Error(`Internet Archive search failed: ${res.status}`);

  const json = await res.json();
  const docs: Record<string, unknown>[] = json?.response?.docs ?? [];
  const numFound = json?.response?.numFound ?? 0;

  const items = docs.map(normalizeInternetArchiveResult);

  const result: SearchResponse = { items, totalResults: numFound, page };
  setCache(key, result);
  return result;
}

export async function searchOpenverse(query: string, page = 1): Promise<SearchResponse> {
  const key = getCacheKey('openverse', query, page);
  const cached = getFromCache(key);
  if (cached) return cached;

  const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&page_size=20&page=${page}`;

  const res = await rateLimitedFetch(url, 'openverse');
  if (!res.ok) throw new Error(`Openverse search failed: ${res.status}`);

  const json = await res.json();
  const results: Record<string, unknown>[] = json?.results ?? [];
  const total = json?.result_count ?? 0;

  const items = results.map(normalizeOpenverseResult);

  const result: SearchResponse = { items, totalResults: total, page };
  setCache(key, result);
  return result;
}

export async function searchLibraryOfCongress(query: string, page = 1): Promise<SearchResponse> {
  const key = getCacheKey('library-of-congress', query, page);
  const cached = getFromCache(key);
  if (cached) return cached;

  const url = `https://www.loc.gov/search/?q=${encodeURIComponent(query)}&fo=json&c=50&sp=${page}&fa=online-format:image`;

  const res = await rateLimitedFetch(url, 'library-of-congress');
  if (!res.ok) throw new Error(`Library of Congress search failed: ${res.status}`);

  const json = await res.json();
  const results = json?.results ?? [];
  const total = json?.search?.total ?? 0;

  const items = results
    .filter((r: Record<string, unknown>) => {
      const url = String(r.url ?? '');
      return url.includes('/photos/') || url.includes('/pictures/') || url.includes('/item/');
    })
    .map(normalizeLoCResult);

  const result: SearchResponse = { items, totalResults: total, page };
  setCache(key, result);
  return result;
}

export async function searchWikimediaCommons(query: string, page = 1): Promise<SearchResponse> {
  const key = getCacheKey('wikimedia-commons', query, page);
  const cached = getFromCache(key);
  if (cached) return cached;

  const srlimit = 50;
  const sroffset = (page - 1) * srlimit;
  const url = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srnamespace=6&format=json&srlimit=${srlimit}&sroffset=${sroffset}&origin=*`;

  const res = await rateLimitedFetch(url, 'wikimedia-commons');
  if (!res.ok) throw new Error(`Wikimedia Commons search failed: ${res.status}`);

  const json = await res.json();
  const searchResults = json?.query?.search ?? [];
  const total = json?.query?.searchinfo?.totalhits ?? 0;

  const items = searchResults.map(normalizeWikimediaResult);

  const result: SearchResponse = { items, totalResults: total, page };
  setCache(key, result);
  return result;
}

export async function searchMetMuseum(query: string, _page = 1): Promise<SearchResponse> {
  const key = getCacheKey('met-museum', query, 1);
  const cached = getFromCache(key);
  if (cached) return cached;

  const searchUrl = `https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&q=${encodeURIComponent(query)}`;

  const res = await rateLimitedFetch(searchUrl, 'met-museum');
  if (!res.ok) throw new Error(`Met Museum search failed: ${res.status}`);

  const json = await res.json();
  const objectIDs: number[] | null = json?.objectIDs ?? [];
  const total = json?.total ?? 0;

  if (!objectIDs || objectIDs.length === 0) {
    const empty: SearchResponse = { items: [], totalResults: 0, page: 1 };
    setCache(key, empty);
    return empty;
  }

  const ids = objectIDs.slice(0, 20);

  const detailResponses = await Promise.allSettled(
    ids.map(id =>
      rateLimitedFetch(
        `https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`,
        'met-museum-detail',
      ).then(r => r.json()),
    ),
  );

  const items: SearchResultItem[] = [];
  for (const result of detailResponses) {
    if (result.status === 'fulfilled' && result.value?.primaryImage) {
      items.push(normalizeMetMuseumResult(result.value));
    }
  }

  const response: SearchResponse = { items, totalResults: total, page: 1 };
  setCache(key, response);
  return response;
}

function normalizeUnsplashResult(item: Record<string, unknown>): SearchResultItem {
  const id = String(item.id ?? '');
  const urls = item.urls as Record<string, unknown> | undefined;
  const user = item.user as Record<string, unknown> | undefined;
  return {
    id,
    title: item.alt_description ? String(item.alt_description) : '',
    source: 'unsplash',
    sourceUrl: urls?.raw ? String(urls.raw) : '',
    thumbnailUrl: urls?.thumb ? String(urls.thumb) : (urls?.small ? String(urls.small) : undefined),
    imageUrl: urls?.regular ? String(urls.regular) : (urls?.raw ? String(urls.raw) : ''),
    creator: user?.name ? String(user.name) : undefined,
    description: item.alt_description ? String(item.alt_description) : undefined,
    sourcePageUrl: (item.links as Record<string, unknown> | undefined)?.html ? String((item.links as Record<string, unknown>).html) : undefined,
  };
}

export async function searchUnsplash(query: string, page = 1): Promise<SearchResponse> {
  const key = getCacheKey('unsplash', query, page);
  const cached = getFromCache(key);
  if (cached) return cached;

  const keys = loadImageApiKeys();
  if (!keys.unsplash) throw new Error('Unsplash requires a Client-ID API key. Set it in the tab above.');

  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=30&page=${page}`;
  const res = await rateLimitedFetch(url, 'unsplash', { 'Authorization': `Client-ID ${keys.unsplash}` });
  if (!res.ok) throw new Error(`Unsplash search failed: ${res.status}`);

  const json = await res.json();
  const results: Record<string, unknown>[] = json?.results ?? [];
  const total = json?.total ?? 0;

  const items = results.map(normalizeUnsplashResult);
  const result: SearchResponse = { items, totalResults: total, page };
  setCache(key, result);
  return result;
}

function normalizePexelsResult(item: Record<string, unknown>): SearchResultItem {
  const id = String(item.id ?? '');
  const src = item.src as Record<string, unknown> | undefined;
  const photographer = item.photographer ? String(item.photographer) : undefined;
  return {
    id,
    title: item.alt ? String(item.alt) : '',
    source: 'pexels',
    sourceUrl: src?.original ? String(src.original) : '',
    thumbnailUrl: src?.tiny ? String(src.tiny) : (src?.small ? String(src.small) : undefined),
    imageUrl: src?.large ? String(src.large) : (src?.original ? String(src.original) : ''),
    creator: photographer,
    description: item.alt ? String(item.alt) : undefined,
    sourcePageUrl: item.url ? String(item.url) : undefined,
  };
}

export async function searchPexels(query: string, page = 1): Promise<SearchResponse> {
  const key = getCacheKey('pexels', query, page);
  const cached = getFromCache(key);
  if (cached) return cached;

  const keys = loadImageApiKeys();
  if (!keys.pexels) throw new Error('Pexels requires an Authorization API key. Set it in the tab above.');

  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=40&page=${page}`;
  const res = await rateLimitedFetch(url, 'pexels', { 'Authorization': keys.pexels });
  if (!res.ok) throw new Error(`Pexels search failed: ${res.status}`);

  const json = await res.json();
  const photos: Record<string, unknown>[] = json?.photos ?? [];
  const total = json?.total_results ?? 0;

  const items = photos.map(normalizePexelsResult);
  const result: SearchResponse = { items, totalResults: total, page };
  setCache(key, result);
  return result;
}

function normalizePixabayResult(item: Record<string, unknown>): SearchResultItem {
  const id = String(item.id ?? '');
  const user = item.user ? String(item.user) : undefined;
  return {
    id,
    title: item.tags ? String(item.tags) : '',
    source: 'pixabay',
    sourceUrl: item.webformatURL ? String(item.webformatURL) : '',
    thumbnailUrl: item.previewURL ? String(item.previewURL) : (item.webformatURL ? String(item.webformatURL) : undefined),
    imageUrl: item.largeImageURL ? String(item.largeImageURL) : (item.webformatURL ? String(item.webformatURL) : ''),
    creator: user,
    description: item.tags ? String(item.tags) : undefined,
    sourcePageUrl: item.pageURL ? String(item.pageURL) : undefined,
  };
}

export async function searchPixabay(query: string, page = 1): Promise<SearchResponse> {
  const key = getCacheKey('pixabay', query, page);
  const cached = getFromCache(key);
  if (cached) return cached;

  const keys = loadImageApiKeys();
  if (!keys.pixabay) throw new Error('Pixabay requires an API key. Set it in the tab above.');

  const perPage = 50;
  const url = `https://pixabay.com/api/?key=${keys.pixabay}&q=${encodeURIComponent(query)}&per_page=${perPage}&page=${page}&image_type=photo`;
  const res = await rateLimitedFetch(url, 'pixabay');
  if (!res.ok) throw new Error(`Pixabay search failed: ${res.status}`);

  const json = await res.json();
  const hits: Record<string, unknown>[] = json?.hits ?? [];
  const total = json?.totalHits ?? 0;

  const items = hits.map(normalizePixabayResult);
  const result: SearchResponse = { items, totalResults: total, page };
  setCache(key, result);
  return result;
}

const searchRegistry: Record<ReferenceSource, (q: string, p: number) => Promise<SearchResponse>> = {
  'internet-archive': searchInternetArchive,
  'openverse': searchOpenverse,
  'library-of-congress': searchLibraryOfCongress,
  'wikimedia-commons': searchWikimediaCommons,
  'met-museum': searchMetMuseum,
  'unsplash': searchUnsplash,
  'pexels': searchPexels,
  'pixabay': searchPixabay,
};

export async function searchAll(
  query: string,
  source: ReferenceSource,
  page = 1,
): Promise<SearchResponse> {
  const fn = searchRegistry[source];
  if (!fn) throw new Error(`Unknown search source: ${source}`);
  return fn(query, page);
}
