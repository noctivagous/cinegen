import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { projectRegistry } from '@/data/project-data';
import { flushDirtyDocuments, markProjectDirty } from '@/services/project-service';
import { setActiveProjectId } from '@/data/project-data';

vi.mock('@/services/persistence', () => ({
  storageService: {
    getItem: vi.fn(),
    setItem: vi.fn(),
  },
}));

vi.mock('@/services/status-bar-service', () => ({
  updateSaveStatus: vi.fn(),
}));

vi.mock('@/services/project-serializer', () => ({
  serializeAppliedProject: vi.fn(() => ({ documents: {} })),
}));

vi.mock('@/services/project-features-service', () => ({
  getProjectFeaturesConfig: vi.fn(() => ({ enabled: {} })),
}));

vi.mock('@/color/color-state', () => ({
  colorState: { getPalette: vi.fn(() => []) },
}));

describe('project-service', () => {
  let originalActiveProjectId: string;

  beforeEach(async () => {
    originalActiveProjectId = (await import('@/data/project-data')).activeProjectId;
    projectRegistry.length = 0;
    projectRegistry.push(
      { id: 'proj-server-1', name: 'Server Project', settings: {} },
      { id: 'proj-local-1', name: 'Local Project', settings: {} },
      { id: 'proj-bundled-1', name: 'Bundled Sample', settings: {}, file: 'sample.cine' }
    );
    vi.clearAllMocks();
  });

  afterEach(async () => {
    projectRegistry.length = 0;
    setActiveProjectId(originalActiveProjectId);
    vi.clearAllMocks();
  });

  describe('flushDirtyDocuments', () => {
    it('should save server-resident project (no file property) via API', async () => {
      setActiveProjectId('proj-server-1');
      markProjectDirty(['screenplay']);

      await flushDirtyDocuments();

      expect(window.fetch).toHaveBeenCalledWith(
        '/api/projects/proj-server-1/documents',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('should also save "local" project (no file property) via API since it is treated as server-resident', async () => {
      setActiveProjectId('proj-local-1');
      markProjectDirty(['screenplay']);

      await flushDirtyDocuments();

      expect(window.fetch).toHaveBeenCalledWith(
        '/api/projects/proj-local-1/documents',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('should NOT save bundled .cine sample (has file property)', async () => {
      setActiveProjectId('proj-bundled-1');
      markProjectDirty(['screenplay']);

      await flushDirtyDocuments();

      expect(window.fetch).not.toHaveBeenCalled();
      const { storageService } = await import('@/services/persistence');
      expect(storageService.setItem).not.toHaveBeenCalled();
      const { updateSaveStatus } = await import('@/services/status-bar-service');
      expect(updateSaveStatus).toHaveBeenCalledWith('error', 'Bundled projects are read-only');
    });
  });

  describe('markProjectDirty', () => {
    it('should add document types to dirty tracking (via flush)', async () => {
      setActiveProjectId('proj-server-1');
      markProjectDirty(['screenplay', 'storyboard']);

      await flushDirtyDocuments();

      expect(window.fetch).toHaveBeenCalled();
    });
  });
});