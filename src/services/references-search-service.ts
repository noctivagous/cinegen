import type { ReferenceSource, SearchResultItem, SearchResponse } from '@/workspace/references-types';

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

async function rateLimitedFetch(url: string, source: string): Promise<Response> {
  const now = Date.now();
  const last = lastRequestTime[source] ?? 0;
  const wait = Math.max(0, 500 - (now - last));
  if (wait > 0) {
    await new Promise(r => setTimeout(r, wait));
  }
  lastRequestTime[source] = Date.now();
  return fetch(url);
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

export async function searchInternetArchive(query: string, page = 1): Promise<SearchResponse> {
  const key = getCacheKey('internet-archive', query, page);
  const cached = getFromCache(key);
  if (cached) return cached;

  const rows = 50;
  const offset = (page - 1) * rows;
  const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(query)}&fl[]=identifier&fl[]=title&fl[]=description&fl[]=mediatype&fl[]=creator&fl[]=date&sort[]=&sort[]=&sort[]=&rows=${rows}&page=${page}&output=json`;

  const res = await rateLimitedFetch(url, 'internet-archive');
  if (!res.ok) throw new Error(`Internet Archive search failed: ${res.status}`);

  const json = await res.json();
  const docs: Record<string, unknown>[] = json?.response?.docs ?? [];
  const numFound = json?.response?.numFound ?? 0;

  const items = docs
    .filter(d => String(d.mediatype ?? '') === 'image' || String(d.mediatype ?? '') === 'texts')
    .map(normalizeInternetArchiveResult);

  const result: SearchResponse = { items, totalResults: numFound, page };
  setCache(key, result);
  return result;
}

export async function searchLibraryOfCongress(query: string, page = 1): Promise<SearchResponse> {
  const key = getCacheKey('library-of-congress', query, page);
  const cached = getFromCache(key);
  if (cached) return cached;

  const url = `https://www.loc.gov/search/?q=${encodeURIComponent(query)}&fo=json&c=50&sp=${page}`;

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

export async function searchAll(
  query: string,
  source: ReferenceSource,
  page = 1,
): Promise<SearchResponse> {
  switch (source) {
    case 'internet-archive':
      return searchInternetArchive(query, page);
    case 'library-of-congress':
      return searchLibraryOfCongress(query, page);
    case 'wikimedia-commons':
      return searchWikimediaCommons(query, page);
  }
}
