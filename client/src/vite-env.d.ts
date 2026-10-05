/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SHOW_TEAM_TAB?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
