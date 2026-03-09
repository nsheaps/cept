declare const __APP_VERSION__: string;
declare const __COMMIT_SHA__: string;
declare const __PR_NUMBER__: string;
declare const __REPO_URL__: string;
declare const __PRODUCTION_URL__: string;
declare const __IS_PREVIEW__: boolean;

// Vite's import.meta.env — BASE_URL is always available in Vite builds.
interface ImportMetaEnv {
  readonly BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
