/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PROJECT_PERSISTENCE_MODE?: 'local' | 'server';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
