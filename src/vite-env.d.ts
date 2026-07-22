/// <reference types="vite/client" />

interface ImportMetaEnv { readonly VITE_SENTRY_DSN?:string; readonly VITE_SENTRY_TRACES_SAMPLE_RATE?:string; }
interface ImportMeta { readonly env:ImportMetaEnv; }

interface ImportMetaEnv {
  readonly VITE_KCP_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
