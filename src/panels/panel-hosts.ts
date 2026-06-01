import type { CinegenAssetsPanel } from '@/components/panels/cinegen-assets-panel';
import type { CinegenLocationScout } from '@/components/panels/cinegen-location-scout';
import type { CinegenSceneTabs } from '@/components/panels/cinegen-scene-tabs';
import type { CinegenOverviewPanel } from '@/components/panels/cinegen-overview-panel';
import type { CinegenScriptEditor } from '@/components/panels/cinegen-script-editor';
import type { CinegenStoryboard } from '@/components/panels/cinegen-storyboard';
import type { CinegenTimeline } from '@/components/panels/cinegen-timeline';
import type { CinegenTreatmentPanel } from '@/components/panels/cinegen-treatment-panel';

export function getCinegenStoryboard(): CinegenStoryboard | null {
  return (
    document.getElementById('storyboard-grid') as CinegenStoryboard | null ??
    document.querySelector<CinegenStoryboard>('cinegen-storyboard#storyboard-grid') ??
    document.querySelector<CinegenStoryboard>('cinegen-storyboard')
  );
}

export function getCinegenSceneTabs(): CinegenSceneTabs | null {
  return document.querySelector<CinegenSceneTabs>('cinegen-scene-tabs');
}

export function getCinegenAssetsPanel(): CinegenAssetsPanel | null {
  return document.querySelector<CinegenAssetsPanel>('cinegen-assets-panel');
}

export function getCinegenLocationScout(): CinegenLocationScout | null {
  return document.querySelector<CinegenLocationScout>('cinegen-location-scout');
}

export function getCinegenScriptEditor(): CinegenScriptEditor | null {
  return document.querySelector<CinegenScriptEditor>('cinegen-script-editor');
}

export function getCinegenTimeline(): CinegenTimeline | null {
  return document.querySelector<CinegenTimeline>('cinegen-timeline');
}

export function getCinegenOverviewPanel(): CinegenOverviewPanel | null {
  const projectView = document.getElementById('view-project-overview');
  if (projectView && !projectView.classList.contains('hidden')) {
    return document.getElementById('project-overview-panel-content') as CinegenOverviewPanel | null;
  }
  return document.querySelector<CinegenOverviewPanel>('#view-overview cinegen-overview-panel');
}

export function getCinegenTreatmentPanel(): CinegenTreatmentPanel | null {
  return document.querySelector<CinegenTreatmentPanel>('cinegen-treatment-panel');
}
