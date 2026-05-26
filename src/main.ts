import { applyHierarchySectionCssVars } from '@/tree/hierarchy-section-theme';
import { runLayoutEarlyInit } from '@/boot/layout-early-init';

applyHierarchySectionCssVars();

void runLayoutEarlyInit().then(() => import('@/boot/app-bootstrap')).then((mod) => {
  mod.startAppBootstrap();
});
