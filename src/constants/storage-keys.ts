/**
 * ── SERVER PERSISTENCE STORAGE KEYS ──
 *
 * These keys are used by the Persistence abstraction layer (services/persistence.ts)
 * which writes/reads through the server-backed settings store.
 * Sensitive values should still use dedicated API endpoints:
 *
 *   - API keys    → MUST go through saveApiKeys() → POST /api/settings/keys
 *   - Prefs       → MUST go through server-backed persistence or /api/settings/*
 *   - AI routing  → MUST go through saveAiApiSettings() → POST /api/settings/routing
 * ──────────────────────────────────────────────────────────────────────────
 */

export const SETUP_COMPLETE_STORAGE_KEY = 'cinegen.setupComplete';
export const SETUP_PROGRESS_STORAGE_KEY = 'cinegen.setupProgress';
export const AI_API_SETTINGS_STORAGE_KEY = 'cinegen.aiApiSettings';
export const API_KEYS_STORAGE_KEY = 'cinegen.apiKeys';
export const PROVIDER_MODEL_CATALOG_STORAGE_KEY = 'cinegen.providerModelCatalog';
export const PREFERENCES_STORAGE_KEY = 'cinegen.preferences';
export const LOCAL_PROJECTS_STORAGE_KEY = 'cinegen.local-projects.v1';
/** Per-project sidebar tree `expanded` state for bundled `.cine` packages. */
export const PROJECT_TREE_UI_STORAGE_KEY = 'cinegen.project-tree-ui.v1';
/** Per-project mood boards for bundled `.cine` packages (read-only on disk). */
export const MOOD_BOARDS_STORAGE_KEY = 'cinegen.mood-boards.v1';
/** Per-project settings overrides (name + picture/timebase) for bundled `.cine` packages. */
export const PROJECT_SETTINGS_STORAGE_KEY = 'cinegen.project-settings.v1';
/** Script editor previs timeline margin collapsed (1 = collapsed). */
export const SCRIPT_PREVIS_MARGIN_COLLAPSED_KEY = 'cinegen.scriptPrevisMarginCollapsed';
/** Storyboard reference bank persistence. */
export const STORYBOARD_REFERENCE_STORAGE_KEY = 'cinegen.storyboard.references';
/** Storyboard generation mode preference (`review` | `auto`). */
export const STORYBOARD_GENERATION_MODE_STORAGE_KEY = 'cinegen.storyboard.generationMode';
/** Section visibility toggles for hierarchy section settings modal. */
export const SECTION_VISIBILITY_STORAGE_KEY = 'cinegen-section-visibility';
/** Developer console command history. */
export const CONSOLE_HISTORY_STORAGE_KEY = 'cg:console:history';
/** Image API keys for Unsplash, Pexels, Pixabay (stored as JSON object). */
export const IMAGE_API_KEYS_STORAGE_KEY = 'cinegen.imageApiKeys';
