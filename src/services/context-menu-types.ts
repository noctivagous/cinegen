export type ContextMenuItem = {
  id: string;
  label: string;
  icon: string;
};

export type ContextMenuHeader = {
  label: string;
  caption: string;
};

export type ContextMenuOpenOptions = {
  x: number;
  y: number;
  items: ContextMenuItem[];
  header?: ContextMenuHeader;
  /** e.g. `character` → `chip-context-menu--character` on host */
  typeModifier?: string;
  onSelect: (actionId: string) => void;
};
