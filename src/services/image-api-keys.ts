import { storageService } from '@/services/persistence';
import { IMAGE_API_KEYS_STORAGE_KEY } from '@/constants/storage-keys';

export interface ImageApiKeys {
  unsplash: string;
  pexels: string;
  pixabay: string;
}

const EMPTY_KEYS: ImageApiKeys = { unsplash: '', pexels: '', pixabay: '' };

export function loadImageApiKeys(): ImageApiKeys {
  try {
    const raw = storageService.getItem(IMAGE_API_KEYS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ImageApiKeys>;
      return { ...EMPTY_KEYS, ...parsed };
    }
  } catch { /* ignore */ }
  return { ...EMPTY_KEYS };
}

export function saveImageApiKeys(keys: ImageApiKeys): void {
  try {
    storageService.setItem(IMAGE_API_KEYS_STORAGE_KEY, JSON.stringify(keys));
  } catch { /* ignore */ }
}
