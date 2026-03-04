/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly CEPT_DEMO_MODE: boolean;
  readonly VITE_BASE_PATH: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
