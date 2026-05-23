/**
 * ── DO NOT STORE API KEYS OR AUTH TOKENS IN LOCALSTORAGE ──
 *
 * These keys are used by the Persistence abstraction layer (services/persistence.ts)
 * which can back reads/writes to either localStorage (local mode) or the server
 * (server mode). In a collaborative or multi-user deployment:
 *
 *   - API keys    → MUST go through saveApiKeys() → POST /api/settings/keys
 *   - Prefs       → MUST go through server-backed persistence or /api/settings/*
 *   - AI routing  → MUST go through saveAiApiSettings() → POST /api/settings/routing
 *
 * localStorage is single-origin and does not sync across users. Adding new keys
 * here for sensitive data is a design smell. Route new settings through the
 * dedicated server API endpoints instead.
 * ──────────────────────────────────────────────────────────────────────────
 */

export const SETUP_COMPLETE_STORAGE_KEY = 'cinegen.setupComplete';
export const SETUP_PROGRESS_STORAGE_KEY = 'cinegen.setupProgress';
export const AI_API_SETTINGS_STORAGE_KEY = 'cinegen.aiApiSettings';
export const API_KEYS_STORAGE_KEY = 'cinegen.apiKeys';
export const PROVIDER_MODEL_CATALOG_STORAGE_KEY = 'cinegen.providerModelCatalog';
export const PREFERENCES_STORAGE_KEY = 'cinegen.preferences';
export const LOCAL_PROJECTS_STORAGE_KEY = 'cinegen.local-projects.v1';
