import { beforeEach, vi } from 'vitest';

Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
  writable: true,
});

Object.defineProperty(window, 'fetch', {
  value: vi.fn(),
  writable: true,
});

beforeEach(() => {
  vi.clearAllMocks();
});