import { installChipBundleGlobals } from '@/services/chip-bundle';
import { installUtilsBundleGlobals } from '@/services/utils-bundle';
import { installSectionVisibilityGlobals } from '@/services/section-visibility-service';

export function initCoreServices(): void {
  installUtilsBundleGlobals();
  installChipBundleGlobals();
  installSectionVisibilityGlobals();
}
