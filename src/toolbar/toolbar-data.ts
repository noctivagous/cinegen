export interface GuideSection {
  id: string;
  title: string;
  body: string;
  tip?: string;
}

export const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: 'overview',
    title: 'How a Film Is Made (and How CineGen Fits)',
    body: `<p>Feature films move from words on a page to images on screen through development, pre-production, production, and post-production. Almost every project—large or small—follows that chain. Terms like <em>scene</em>, <em>location</em>, <em>coverage</em>, and <em>take</em> exist because each step has a distinct job on a real set.</p>
<p>CineGen uses the same vocabulary and workflow shape so planning feels like planning a film, not tuning anonymous sliders. The left <strong>Project Hierarchy</strong> mirrors how departments think on a shoot; the center workspace is where you write, board, break down, and assemble.</p>`,
    tip: 'Start in <strong>Pre-Production</strong> for script and storyboard, expand <strong>Scenes</strong> when you are ready to plan coverage, and use <strong>Assembly</strong> for timeline work.',
  },
  {
    id: 'getting-started',
    title: 'Getting Started — Project & Hierarchy',
    body: `<p>On a physical production, the producer opens a project folder: script, schedules, contacts, and department guides. Here, <strong>Load Project</strong> restores your full AI generation history, references, and locks; <strong>Save</strong> commits the same.</p>
<p>The hierarchy header shows your project title. Top-level sections—Pre-Production, Production Design, Sound, Scenes, Assembly—are color-coded so you can scan the pipeline at a glance. Expand a section to open its tools; the inspector on the right shows details for whatever you select.</p>`,
    tip: 'Use the tree to switch views. Try <strong>Script + Storyboard</strong> under Pre-Production for the combined writing and boarding layout.',
  },
  {
    id: 'preprod',
    title: 'Pre-Production — Script & Breakdown',
    body: `<p>After the screenplay locks, the AD and production team break it into characters, props, wardrobe, locations, and effects—one breakdown sheet per scene. Those scenes are then ordered on a production board (stripboard) for shooting efficiency, not story order.</p>
<p>The <strong>Script Editor</strong> accepts Fountain (.fountain) and can import Final Draft (.fdx). Scene headings, character cues, and dialogue use standard screenplay conventions. <strong>Breakdown Sheets</strong> tabulate what each scene needs; <strong>Virtual Location Scout</strong> and <strong>Shot List</strong> support location and angle planning before generation.</p>`,
    tip: 'Import or write in Fountain, then use <strong>Parse to Assets</strong> or breakdown tools to pull characters and props into <strong>Global Assets</strong>. Export the screenplay from the Save menu when you need a .fountain file outside the app.',
  },
  {
    id: 'storyboard',
    title: 'Storyboards — Visual Planning',
    body: `<p>Storyboards translate the script into frames—often labeled by scene and shot (e.g. 20.3 for scene 20, shot 3)—so crew and editors share a visual plan. Animatics add timing when action or VFX must be pre-visualized.</p>
<p>In the storyboard pane, each card can show scene number, thumbnail, shot title, and <strong>notes</strong> (continuity, lighting, performance). Use the <strong>Scene</strong>, <strong>Frame</strong>, and <strong>Notes</strong> toggles to hide layers while reviewing. <strong>Link to Cursor</strong> ties a frame to the selected script line; <strong>Sync</strong> keeps script and board aligned.</p>`,
    tip: 'Turn off <strong>Frame</strong> to read shot labels and notes in a compact list; turn off <strong>Scene</strong> when scene order is obvious from context.',
  },
  {
    id: 'scenes',
    title: 'Scenes, Coverage & Takes',
    body: `<p>A screenplay <em>scene</em> is continuous action in one place and time. On set, <em>coverage</em> is the set of angles recorded so the editor can build pace—masters, two-shots, over-the-shoulders, close-ups, inserts. Each time the director calls action and cut for a setup, that recording is a <em>take</em>; circled takes are the preferred ones.</p>
<p>Open any item under <strong>Scenes</strong> for <strong>Master Shot</strong>, <strong>Coverage</strong>, <strong>B-Roll</strong>, <strong>Pickups</strong>, and <strong>Notes</strong>. Pickups are targeted re-generations for continuity fixes— the same idea as reshoots or additional shots after editorial feedback.</p>`,
    tip: 'Select a scene in the hierarchy, then use the scene tabs to plan masters before coverage. AI Assist can regenerate a master or individual shots.',
  },
  {
    id: 'design',
    title: 'Production Design & Assets',
    body: `<p>Production design shapes everything in frame: sets, props, color, texture, and the visual world. Hair, makeup, and costume maintain continuity across shots and days. Casting defines who plays each role and informs voice and performance downstream.</p>
<p><strong>Production Design</strong> in the tree holds props, wardrobe, locations, vehicles, art direction, and camera/lighting presets. <strong>Wardrobe</strong> links outfit sets and accessories to characters once assigned. <strong>Global Assets</strong> (below the divider) is the shared library—footage, audio, graphics, and the <strong>Library Browser</strong> for reusable elements pulled into many scenes.</p>`,
    tip: 'Parse the script to seed assets automatically, then refine in Global Assets before generating scene-specific shots.',
  },
  {
    id: 'sound',
    title: 'Sound Department',
    body: `<p>Production sound captures clean dialogue and ambience on set where possible. In post, dialogue is edited, ADR replaces problem lines, foley re-performs footsteps and props, designers build effects, and music is mixed toward a final re-recording mix.</p>
<p>The <strong>Sound Department</strong> folder groups Production Sound, ADR, Foley, Sound Design & SFX, Music / Score, and Temp Mix / Stems—the same lanes you would see on a dub stage or in a DAW.</p>`,
    tip: 'Casting notes and character voice direction (when added) cross-reference here so dialogue generation stays consistent across scenes.',
  },
  {
    id: 'assembly',
    title: 'Assembly & Timeline',
    body: `<p>Editorial starts with a rough cut: all usable material in loose story order. The fine cut tightens rhythm and performance. Online finishing conforms to full resolution, color grade, titles, and final VFX; sound post often runs in parallel.</p>
<p><strong>Rough Cut</strong> under Assembly opens the timeline. Clips follow scene order; <strong>AI Assemble</strong> suggests an initial string-out from your generated takes. Export an EDL from the Save menu or the timeline toolbar when handing off to another tool.</p>`,
    tip: 'Open <strong>Rough Cut</strong> under <strong>Assembly</strong> in the project tree for timeline work.',
  },
  {
    id: 'vocabulary',
    title: 'Traditional Vocabulary — Why These Names Matter',
    body: `<p>CineGen borrows real production language—scenes, shooting locations, shots, takes, coverage, master shots, pickups, continuity—so your mental model matches a film set. The underlying steps are the same even when the “camera” is generative: break the script, plan angles, capture options, and assemble a timeline.</p>
<p>When you see <em>INT.</em> / <em>EXT.</em> in the script, <em>SC 3</em> on a storyboard card, or <em>Master Shot</em> in a scene tab, those are not decorative labels. They are the same hooks producers, ADs, editors, and sound mixers use to stay aligned on a physical production.</p>`,
    tip: 'Revisit sections of this Guide from the <strong>Guide</strong> menu anytime—each topic pairs traditional practice with where to click in CineGen.',
  },
];

export interface SettingsTile {
  id: string;
  icon: string;
  title: string;
  desc: string;
}

export const SETTINGS_MODAL_TILES: SettingsTile[] = [
  {
    id: 'project-settings',
    icon: 'fa-solid fa-folder-open',
    title: 'Project Settings',
    desc: 'Name, aspect ratio, frame rate, and defaults for this production.',
  },
  {
    id: 'preferences',
    icon: 'fa-solid fa-sliders',
    title: 'Preferences',
    desc: 'Workspace layout, autosave, and defaults.',
  },
  {
    id: 'ui-magnification',
    icon: 'fa-solid fa-expand',
    title: 'UI Magnification',
    desc: 'Text and control size (Small / Medium / Large / X-Large).',
  },
  {
    id: 'ai-providers',
    icon: 'fa-solid fa-key',
    title: 'AI Providers & Models',
    desc: 'Server-managed keys, providers, and modality routing (text, image, video, audio).',
  },
  {
    id: 'generation-defaults',
    icon: 'fa-solid fa-wand-magic-sparkles',
    title: 'Generation Defaults',
    desc: 'Default resolution, aspect ratio, steps, and safety settings.',
  },
  {
    id: 'compute',
    icon: 'fa-solid fa-microchip',
    title: 'Compute & GPU',
    desc: 'Local or remote GPUs and queue priority.',
  },
];

export interface AiAssistTile {
  id: string;
  icon: string;
  title: string;
  desc: string;
}

export interface WizardEntryTile {
  id: string;
  icon: string;
  title: string;
  desc: string;
  group: 'main' | 'utilities';
}

export const AI_ASSIST_ASSISTANT_TILES: AiAssistTile[] = [
  {
    id: 'app-setup-assistant',
    icon: 'fa-solid fa-wand-magic-sparkles',
    title: 'App Setup Assistant',
    desc: 'Configure server-managed API keys, providers, and models for all AI modalities.',
  },
  {
    id: 'script-coach',
    icon: 'fa-solid fa-scroll',
    title: 'Script coach',
    desc: 'Beats, tone, and Fountain-aware suggestions for the active script.',
  },
  {
    id: 'storyboard-director',
    icon: 'fa-solid fa-film',
    title: 'Storyboard director',
    desc: 'Frame ideas, shot grammar, and coverage notes from script context.',
  },
  {
    id: 'continuity-guard',
    icon: 'fa-solid fa-shirt',
    title: 'Continuity guard',
    desc: 'Wardrobe, weather, and time-of-day checks across scenes.',
  },
  {
    id: 'dialogue-polish',
    icon: 'fa-solid fa-comments',
    title: 'Dialogue polish',
    desc: 'Subtext, pacing, and line economy without changing plot.',
  },
];

export const AI_ASSIST_TASK_TILES: AiAssistTile[] = [
  {
    id: 'sync-entities',
    icon: 'fa-solid fa-users-viewfinder',
    title: 'Sync script → assets',
    desc: 'Refresh characters, locations, and props from the Fountain source.',
  },
  {
    id: 'suggest-pickups',
    icon: 'fa-solid fa-clapperboard',
    title: 'Suggest pickups',
    desc: 'Flag coverage gaps and pickups for the scene you have open.',
  },
  {
    id: 'board-from-scene',
    icon: 'fa-solid fa-border-all',
    title: 'Storyboard pass',
    desc: 'Draft frames for the current scene from script and shot intent.',
  },
  {
    id: 'production-brief',
    icon: 'fa-solid fa-file-lines',
    title: 'Production brief',
    desc: 'One-page AI summary for department heads and vendors.',
  },
];

export const WIZARD_ENTRY_TILES: WizardEntryTile[] = [
  {
    id: 'script-wizard',
    icon: 'fa-solid fa-scroll',
    title: 'Start from Script',
    desc: 'Paste or write a script, extract characters and locations, build references and storyboards.',
    group: 'main',
  },
  {
    id: 'visual-wizard',
    icon: 'fa-solid fa-image',
    title: 'Visual-First Entry',
    desc: 'Upload photos and mood boards, auto-create a project with suggested script placeholders.',
    group: 'main',
  },
  {
    id: 'concept-wizard',
    icon: 'fa-solid fa-palette',
    title: 'Concept / Mood First',
    desc: 'Start with vibe and tone, generate scenes and character prompts that fit the aesthetic.',
    group: 'main',
  },
  {
    id: 'asset-wizard',
    icon: 'fa-solid fa-cubes',
    title: 'Asset Library Import',
    desc: 'Load a saved scene kit from previous projects as the foundation.',
    group: 'utilities',
  },
  {
    id: 'storyboard-wizard',
    icon: 'fa-solid fa-pen-ruler',
    title: 'Storyboard Sketch Mode',
    desc: 'Rough thumbnail sketching or text-based beats to frame your story.',
    group: 'utilities',
  },
];
