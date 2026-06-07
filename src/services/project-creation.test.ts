import { describe, it, expect, vi, beforeEach } from 'vitest';
import { projectRegistry } from '@/data/project-data';
import { createNewProject } from '@/services/project-service';

vi.mock('@/services/persistence', () => ({
  storageService: { getItem: vi.fn(() => '[]'), setItem: vi.fn() },
}));

vi.mock('@/services/status-bar-service', () => ({
  updateSaveStatus: vi.fn(),
}));

describe('Blank project wizard name persistence', () => {
  beforeEach(() => {
    projectRegistry.length = 0;
    vi.clearAllMocks();
  });

  it('should persist custom name to registry entry after creation', async () => {
    const customName = 'My Custom Project';
    let callCount = 0;
    
    global.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: 'proj-new-1', name: customName }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          applied: { projectScreenplay: { format: 'fountain', text: '' }, projectData: { name: customName, type: 'project', icon: 'fa-film', expanded: true, children: [] } },
          meta: { id: 'proj-new-1', name: customName, writable: true },
        }),
      });
    });

    const result = await createNewProject(customName);
    
    expect(result).not.toBeNull();
    expect(result?.name).toBe(customName);
    
    const entry = projectRegistry.find(p => p.id === result?.id);
    expect(entry).toBeDefined();
    expect(entry?.name).toBe(customName);
  });

  it('should generate untitled name when empty', async () => {
    let callCount = 0;
    
    global.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: 'proj-new-2', name: 'Untitled Production' }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          applied: { projectScreenplay: { format: 'fountain', text: '' }, projectData: { name: 'Untitled Production', type: 'project', icon: 'fa-film', expanded: true, children: [] } },
          meta: { id: 'proj-new-2', name: 'Untitled Production', writable: true },
        }),
      });
    });

    const result = await createNewProject('   ');
    
    expect(result).not.toBeNull();
    expect(result?.name).toBe('Untitled Production');
  });
});