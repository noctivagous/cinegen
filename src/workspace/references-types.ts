export type ReferenceSource = 'internet-archive' | 'library-of-congress' | 'wikimedia-commons';

export interface SearchParams {
  query: string;
  source: ReferenceSource;
  page: number;
}

export interface SearchResultItem {
  id: string;
  title: string;
  source: ReferenceSource;
  sourceUrl: string;
  thumbnailUrl?: string;
  imageUrl?: string;
  creator?: string;
  date?: string;
  description?: string;
  attribution?: string;
  license?: string;
  sourcePageUrl?: string;
}

export interface SearchResponse {
  items: SearchResultItem[];
  totalResults: number;
  page: number;
}

export interface ProductionReferenceMetadata {
  creator?: string;
  date?: string;
  description?: string;
  attribution?: string;
  license?: string;
}

export interface ProductionReference {
  id: string;
  title: string;
  source: ReferenceSource;
  sourceUrl: string;
  sourcePageUrl?: string;
  filePath: string;
  thumbnailDataUrl?: string;
  mimeType: string;
  tags: string[];
  colorPalette: string[];
  metadata: ProductionReferenceMetadata;
  createdAt: string;
}

export interface ProductionReferencesDocument {
  references: ProductionReference[];
}
