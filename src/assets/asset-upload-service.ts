const ACCEPTED_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);

function extensionOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i).toLowerCase() : '';
}

export function isAcceptedReferenceFile(file: File): boolean {
  if (file.type.startsWith('image/')) return true;
  const ext = extensionOf(file.name);
  return ACCEPTED_IMAGE_EXTENSIONS.has(ext) || ext === '.pdf';
}

export async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

const SLOT_LABELS = ['face', 'body', 'profile', 'threeQuarter', 'closeUp', 'costume'];

export function promptReferenceSlot(): string | null {
  const input = prompt(
    `Assign reference as:\n${SLOT_LABELS.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\nEnter number:`
  );
  if (!input) return null;
  const idx = parseInt(input, 10) - 1;
  if (idx < 0 || idx >= SLOT_LABELS.length) return null;
  return SLOT_LABELS[idx];
}

export const REFERENCE_SLOTS = SLOT_LABELS;
