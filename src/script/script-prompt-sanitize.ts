import { classifyFountainDocument, classifyFountainLine } from '@/script/fountain-bundle';
import { getAgentHealth, buildGenerationPrompt } from '@/services/ai/agents-service';
import { activeProjectId } from '@/data/project-data';

export type ScriptPromptLineKind = 'action' | 'dialogue' | 'performance' | 'skipped';

export interface ScriptPromptLine {
  raw: string;
  promptText: string;
  kind: ScriptPromptLineKind;
  reason?: string;
}

export interface ScriptPromptConversion {
  rawText: string;
  promptText: string;
  lines: ScriptPromptLine[];
  excludedCount: number;
}

const SCENE_HEADING_RE = /^(INT|EXT|EST|INT\/EXT|I\/E)[. \t\/]/i;
const TRANSITION_RE = /^(CUT TO:|FADE (IN|OUT)|DISSOLVE TO:|SMASH CUT TO:)/i;
const VOICE_MARKER_RE = /\((V\.?O\.?|O\.?S\.?|O\.?C\.?|CONT'?D|FILTERED|SUBTITLE)\)/gi;

/** Strip Fountain slug lines, transitions, character cues, and V.O./O.S. markers. */
export function convertScriptLinesForPrompt(lines: string[]): ScriptPromptConversion {
  const types = classifyFountainDocument(lines);
  const promptLines: ScriptPromptLine[] = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (!trimmed) continue;

    const type = types[i] ?? classifyFountainLine(trimmed);

    if (type === 'scene' || type === 'section' || SCENE_HEADING_RE.test(trimmed)) {
      promptLines.push({ raw: trimmed, promptText: '', kind: 'skipped', reason: 'scene heading' });
      continue;
    }

    if (type === 'transition' || TRANSITION_RE.test(trimmed) || /^>\s*/.test(trimmed)) {
      promptLines.push({ raw: trimmed, promptText: '', kind: 'skipped', reason: 'transition' });
      continue;
    }

    if (type === 'character') {
      promptLines.push({ raw: trimmed, promptText: '', kind: 'skipped', reason: 'character cue' });
      continue;
    }

    if (type === 'parenthetical') {
      const inner = trimmed.replace(/^\(|\)$/g, '').trim();
      if (inner) {
        promptLines.push({ raw: trimmed, promptText: `(${inner})`, kind: 'performance' });
      }
      continue;
    }

    if (type === 'dialogue') {
      const speaker = findSpeakerBefore(lines, types, i);
      const line = stripVoiceMarkers(trimmed);
      const promptText = speaker ? `${speaker}: "${line}"` : line;
      promptLines.push({ raw: trimmed, promptText, kind: 'dialogue' });
      continue;
    }

    const action = stripVoiceMarkers(trimmed.replace(/^\.\s*/, ''));
    if (!action || SCENE_HEADING_RE.test(action)) {
      promptLines.push({ raw: trimmed, promptText: '', kind: 'skipped', reason: 'slug/markup' });
      continue;
    }

    promptLines.push({ raw: trimmed, promptText: action, kind: 'action' });
  }

  const promptText = promptLines
    .filter((l) => l.promptText)
    .map((l) => l.promptText)
    .join(' ');

  return {
    rawText: lines.join('\n'),
    promptText,
    lines: promptLines,
    excludedCount: promptLines.filter((l) => l.kind === 'skipped').length,
  };
}

export function convertScriptTextForPrompt(text: string): ScriptPromptConversion {
  return convertScriptLinesForPrompt(text.split('\n'));
}

function findSpeakerBefore(lines: string[], types: string[], dialogueIndex: number): string {
  for (let i = dialogueIndex - 1; i >= 0; i--) {
    const trimmed = lines[i]?.trim();
    if (!trimmed) continue;
    const type = types[i] ?? classifyFountainLine(trimmed);
    if (type === 'character') {
      return formatCharacterName(trimmed);
    }
    if (type === 'scene' || type === 'transition') break;
  }
  return '';
}

function formatCharacterName(line: string): string {
  const core = line.replace(/^@\s*/, '').replace(VOICE_MARKER_RE, '').trim();
  const title = core.replace(/\s*\([^)]*\)\s*$/, '').trim();
  return title
    .split(/\s+/)
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

function stripVoiceMarkers(text: string): string {
  return text.replace(VOICE_MARKER_RE, '').replace(/\b(V\.?O\.?|O\.?S\.?)\b/gi, '').replace(/\s+/g, ' ').trim();
}

/**
 * Deterministic script → prompt text (always strips slug/VO markup).
 * Optional agent polish runs when agents are configured; falls back to deterministic output.
 */
export async function scriptTextForModelPrompt(
  lines: string[],
  opts?: { useAgent?: boolean; projectId?: string; shotId?: string | number }
): Promise<string> {
  const conversion = convertScriptLinesForPrompt(lines);
  const deterministic = conversion.promptText;
  if (!opts?.useAgent || !deterministic) return deterministic;

  try {
    const health = await getAgentHealth();
    if (!health.ready) return deterministic;

    const result = await buildGenerationPrompt(
      opts.projectId || activeProjectId || 'local',
      String(opts.shotId ?? 'script-excerpt'),
      { expression: deterministic.slice(0, 500) }
    );
    if (result?.ok && result.data && !SCENE_HEADING_RE.test(result.data)) {
      return result.data;
    }
  } catch {
    /* agent optional */
  }

  return deterministic;
}
