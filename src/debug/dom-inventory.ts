export interface InteractableInfo {
  tag: string;
  id: string | null;
  text: string | null;
  classes: string | null;
  dataset: Record<string, string>;
  selector: string;
}

function buildSelector(el: HTMLElement): string {
  if (el.id) return `#${el.id}`;
  const tag = el.tagName.toLowerCase();
  const cls = Array.from(el.classList)
    .filter((c) => !c.startsWith('fa-'))
    .join('.');
  if (cls) return `${tag}.${cls}`;
  return tag;
}

function toInfo(el: Element): InteractableInfo {
  const h = el as HTMLElement;
  return {
    tag: h.tagName.toLowerCase(),
    id: h.id || null,
    text: h.textContent?.trim().slice(0, 60) || null,
    classes: h.className || null,
    dataset: Object.fromEntries(Object.entries(h.dataset).filter(([, v]) => v !== undefined)) as Record<string, string>,
    selector: buildSelector(h),
  };
}

export function scanAllInteractables(): Record<string, InteractableInfo[]> {
  return {
    toolbar: Array.from(document.querySelectorAll('cg-toolbar-split, .toolbar-btn')).map(toInfo),
    modals: Array.from(document.querySelectorAll('[role="dialog"] button, [role="dialog"] select, [role="dialog"] input')).map(toInfo),
    sidebar: Array.from(document.querySelectorAll('#project-tree [data-name], #project-tree .tree-item')).map(toInfo),
    workspace: Array.from(document.querySelectorAll('#workspace-container button, #workspace-container select, #workspace-container input')).map(toInfo),
    inspector: Array.from(document.querySelectorAll('#inspector-panel button, #inspector-panel input, #inspector-panel select')).map(toInfo),
  };
}
