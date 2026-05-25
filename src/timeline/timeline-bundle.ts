import { timelineClips } from '@/data/project-data';
import { getCinegenTimeline } from '@/panels/panel-hosts';
import { alertCG } from '@/utils/alert-cg';
import { buildPrevisTimelineTracks, formatPrevisDuration } from '@/workspace/shot-frame-bridge';

interface TimelineClip {
  id?: number;
  scene: string;
  label: string;
  duration: string;
  durationSeconds?: number;
}

/** Assembly timeline */

export function renderTimeline(): void {
  const tracks = buildPrevisTimelineTracks();
  const panel = getCinegenTimeline();
  if (panel) {
    panel.refresh();
    return;
  }
  const track = document.getElementById('timeline-track');
  if (!track) return;
  track.innerHTML = (timelineClips as TimelineClip[])
    .map(
      (clip: TimelineClip) => `
    <div class="timeline-clip" data-duration="${clip.duration}" style="--clip-seconds:${clip.durationSeconds ?? 3}" draggable="true" ondragstart="dragStart(event)">
      ${clip.label}
    </div>`
    )
    .join('');
  const durationEl = document.getElementById('timeline-duration');
  if (durationEl) {
    durationEl.textContent = formatPrevisDuration(tracks.totalRuntimeSeconds || 1);
  }
}

export function dragStart(e: DragEvent) {
  e.dataTransfer?.setData('text', (e.target as HTMLElement).textContent || '');
}

export function autoAssembleTimeline() {
  buildPrevisTimelineTracks();
  renderTimeline();
  alertCG('Previs timeline assembled from Scene/Shot/Frame durations.');
}

export function installTimelineBundleGlobals(): void {
  const w = window as unknown as Record<string, unknown>;
  w.renderTimeline = renderTimeline;
  w.autoAssembleTimeline = autoAssembleTimeline;
  w.dragStart = dragStart;
}
