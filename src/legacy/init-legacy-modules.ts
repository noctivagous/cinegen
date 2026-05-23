/**
 * Load order for modules ported from source/js/*.js (replaces runtime script tags).
 */
import { initProjectData, installProjectDataGlobals } from '@/data/project-data';
import { installStoryboardBundleGlobals, renderStoryboard } from '@/storyboard/storyboard-bundle';
import { installCameraLightingBundleGlobals } from '@/camera/camera-lighting-bundle';
import { installAssetsBundleGlobals } from '@/assets/assets-bundle';
import { installTimelineBundleGlobals } from '@/timeline/timeline-bundle';
import { installAiStubsBundleGlobals } from '@/ai/ai-stubs-bundle';
import { installFountainBundleGlobals } from '@/script/fountain-bundle';
import { installProviderModelCatalogGlobals } from '@/services/provider-model-catalog';
export async function initLegacyModules(): Promise<void> {
  await initProjectData();
  installProjectDataGlobals();
  installStoryboardBundleGlobals();
  renderStoryboard();
  installCameraLightingBundleGlobals();
  installAssetsBundleGlobals();
  installTimelineBundleGlobals();
  installAiStubsBundleGlobals();
  installFountainBundleGlobals();
  installProviderModelCatalogGlobals();
}
