type GenerateIdOptions = {
  randomLength?: number;
  suffix?: string;
};

export function generateId(prefix = 'id', options?: GenerateIdOptions): string {
  const stamp = Date.now().toString(36);
  const randomLength = Math.max(3, options?.randomLength ?? 7);
  const rand = Math.random().toString(36).slice(2, 2 + randomLength);
  const suffix = options?.suffix ? `_${options.suffix}` : '';
  return `${prefix}_${stamp}_${rand}${suffix}`;
}
