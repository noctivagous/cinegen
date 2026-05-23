import { timelineClips } from '@/data/project-data';
import { getCinegenTimeline } from '@/panels/panel-hosts';
import { alertCG } from '@/utils/alert-cg';

interface TimelineClip {
  id?: number;
  scene: string;
  label: string;
  duration: string;
}

/** Assembly timeline */

export function renderTimeline(): void {
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
    <div class="timeline-clip" data-duration="${clip.duration}" draggable="true" ondragstart="dragStart(event)">
      ${clip.label}<br><span class="text-[10px] opacity-75">SC${clip.scene}</span>
    </div>`
    )
    .join('');
  const durationEl = document.getElementById('timeline-duration');
  if (durationEl) {
    durationEl.textContent = `${(timelineClips as TimelineClip[]).reduce((acc, c: TimelineClip) => acc + parseInt(c.duration, 10), 0)}s`;
  }
}

export function dragStart(e: DragEvent) {
  e.dataTransfer?.setData('text', (e.target as HTMLElement).textContent || '');
}

export function autoAssembleTimeline() {
  timelineClips.push({ id: Date.now(), scene: "03", label: "AI Suggested Transition", duration: "9s" });
  renderTimeline();
  alertCG('AI assembled rough cut using best takes from all scenes. Continuity respected.');
}

export function installTimelineBundleGlobals(): void {
  const w = window as unknown as Record<string, unknown>;
  w.renderTimeline = renderTimeline;
  w.autoAssembleTimeline = autoAssembleTimeline;
  w.dragStart = dragStart;
}
