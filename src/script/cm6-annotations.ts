import { StateEffect, StateField, RangeSet, RangeSetBuilder } from '@codemirror/state';
import { Decoration, EditorView } from '@codemirror/view';
import type { AnnotationMark } from '@/data/project-data';

/** Annotation category = breakdown column key */
export type AnnotationCategory =
  | 'character'
  | 'prop'
  | 'wardrobe'
  | 'sfx'
  | 'location'
  | 'note'
  | 'vfx'
  | 'stunt';

export const addAnnotations = StateEffect.define<AnnotationMark[]>();
export const removeAnnotations = StateEffect.define<AnnotationMark[]>();
export const clearAnnotations = StateEffect.define<null>();

const annotationDecoration = Decoration.mark({
  class: 'cm-annotation',
  attributes: { 'data-annotation': 'true' },
});

function buildDecorations(marks: AnnotationMark[]): RangeSet<Decoration> {
  const builder = new RangeSetBuilder<Decoration>();
  for (const m of marks) {
    builder.add(
      m.from,
      m.to,
      Decoration.mark({
        class: `cm-annotation cm-annotation--${m.category}`,
        attributes: {
          'data-annotation-category': m.category,
          ...(m.note ? { 'data-annotation-note': m.note } : {}),
        },
      })
    );
  }
  return builder.finish();
}

/** CM6 StateField storing all annotation marks and producing decorations. */
export const annotationField = StateField.define<{
  marks: AnnotationMark[];
  decorations: RangeSet<Decoration>;
}>({
  create() {
    return { marks: [], decorations: RangeSet.empty };
  },
  update(value, tr) {
    let marks = value.marks;
    for (const e of tr.effects) {
      if (e.is(addAnnotations)) {
        marks = [...marks, ...e.value];
      } else if (e.is(removeAnnotations)) {
        const toRemove = new Set(e.value.map((m) => `${m.from}:${m.to}:${m.category}`));
        marks = marks.filter((m) => !toRemove.has(`${m.from}:${m.to}:${m.category}`));
      } else if (e.is(clearAnnotations)) {
        marks = [];
      }
    }
    // Rebuild decorations if marks changed
    if (marks === value.marks) return value;
    return { marks, decorations: buildDecorations(marks) };
  },
  provide: (field) => EditorView.decorations.from(field, (s) => s.decorations),
});

/** Apply an annotation to the current editor selection. */
export function annotateSelection(
  view: EditorView,
  category: AnnotationCategory,
  note?: string
): void {
  const { from, to } = view.state.selection.main;
  if (from === to) return;
  view.dispatch({
    effects: addAnnotations.of([{ from, to, category, note }]),
  });
}

/** Remove annotations that overlap the current selection (all categories or a specific one). */
export function clearSelectionAnnotations(view: EditorView, category?: AnnotationCategory): void {
  const { from, to } = view.state.selection.main;
  const field = view.state.field(annotationField);
  const toRemove = field.marks.filter(
    (m) => m.from < to && m.to > from && (category == null || m.category === category)
  );
  if (toRemove.length) {
    view.dispatch({ effects: removeAnnotations.of(toRemove) });
  }
}

/** Replace all annotations (used on project load / import). */
export function setAnnotations(view: EditorView, marks: AnnotationMark[]): void {
  view.dispatch({ effects: [clearAnnotations.of(null), addAnnotations.of(marks)] });
}

/** Export current annotations as a serializable array. */
export function getAnnotations(view: EditorView): AnnotationMark[] {
  return view.state.field(annotationField).marks;
}

/** Color palette mapping for each category (matches breakdown table palette). */
export const ANNOTATION_CATEGORY_CONFIG: Record<
  AnnotationCategory,
  { label: string; color: string; icon: string }
> = {
  character: { label: 'Character', color: '#ffd479', icon: 'fa-user' },
  prop: { label: 'Prop', color: '#d6834a', icon: 'fa-hammer' },
  wardrobe: { label: 'Wardrobe', color: '#c9a0dc', icon: 'fa-shirt' },
  sfx: { label: 'SFX', color: '#7fb4ff', icon: 'fa-bolt' },
  location: { label: 'Location', color: '#6fc9a8', icon: 'fa-map-marker-alt' },
  note: { label: 'Note', color: '#e8e8e8', icon: 'fa-sticky-note' },
  vfx: { label: 'VFX', color: '#ff7f7f', icon: 'fa-wand-magic-sparkles' },
  stunt: { label: 'Stunt', color: '#ffaa55', icon: 'fa-person-falling' },
};
