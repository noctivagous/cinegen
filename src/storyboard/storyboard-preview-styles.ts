export const STORYBOARD_STYLE_PROMPT =
  'Pencil illustration of film frame, monochrome linework, cinematic composition, clear subject blocking, practical shot intent, no photorealism.';

export type StoryboardPreviewStyle = 'illustrative' | 'render-preview';

export const STORYBOARD_PREVIEW_STYLE_OPTIONS: {
  value: StoryboardPreviewStyle;
  label: string;
  prompt: string;
}[] = [
  {
    value: 'illustrative',
    label: 'Illustrative (B&W)',
    prompt: STORYBOARD_STYLE_PROMPT,
  },
  {
    value: 'render-preview',
    label: 'Render Preview',
    prompt:
      'Photorealistic cinematic still frame, natural color grading, practical film lighting, high detail, production render preview, shallow depth of field, 4K.',
  },
];

export function resolvePreviewStyle(
  frameStyle?: StoryboardPreviewStyle,
  shotStyle?: StoryboardPreviewStyle
): StoryboardPreviewStyle {
  return frameStyle ?? shotStyle ?? 'illustrative';
}

export function previewStylePrompt(style: StoryboardPreviewStyle): string {
  return STORYBOARD_PREVIEW_STYLE_OPTIONS.find((o) => o.value === style)?.prompt ?? STORYBOARD_STYLE_PROMPT;
}
