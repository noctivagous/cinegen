import type { MoodBoardItemType } from '@/data/project-data';

const TEXT_EXTENSIONS = new Set([
  '.txt',
  '.md',
  '.fountain',
  '.json',
  '.csv',
  '.xml',
  '.html',
  '.css',
  '.js',
  '.ts',
]);

function extensionOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i).toLowerCase() : '';
}

/** Infer mood board item type from a dropped or picked file. */
export function moodBoardTypeForFile(file: File): MoodBoardItemType {
  const t = file.type || '';
  if (t.startsWith('image/')) return 'image';
  if (t.startsWith('video/')) return 'video';
  if (t.startsWith('audio/')) return 'sound';
  if (t.startsWith('text/')) return 'text';
  const ext = extensionOf(file.name);
  if (TEXT_EXTENSIONS.has(ext)) return 'text';
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.avif'].includes(ext)) return 'image';
  if (['.mp4', '.webm', '.mov', '.m4v', '.ogv'].includes(ext)) return 'video';
  if (['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'].includes(ext)) return 'sound';
  return 'text';
}

export async function moodBoardSourceForFile(type: MoodBoardItemType, file: File): Promise<string> {
  if (type === 'image') {
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onerror = () => reject(new Error('Failed to read file'));
      r.onload = () => resolve(String(r.result || ''));
      r.readAsDataURL(file);
    });
  }
  if (type === 'text') {
    return await file.text();
  }
  return URL.createObjectURL(file);
}
