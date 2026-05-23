/** Position a fixed context menu within the viewport (from legacy utils-bundle). */
export function positionMenuWithinViewport(
  menuEl: HTMLElement,
  clientX: number,
  clientY: number,
  padding = 8
): void {
  menuEl.hidden = false;
  menuEl.style.left = `${clientX}px`;
  menuEl.style.top = `${clientY}px`;
  requestAnimationFrame(() => {
    const rect = menuEl.getBoundingClientRect();
    let x = clientX;
    let y = clientY;
    if (rect.right > window.innerWidth) x = window.innerWidth - rect.width - padding;
    if (rect.bottom > window.innerHeight) y = window.innerHeight - rect.height - padding;
    menuEl.style.left = `${Math.max(padding, x)}px`;
    menuEl.style.top = `${Math.max(padding, y)}px`;
  });
}
