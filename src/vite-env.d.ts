/// <reference types="vite/client" />

/** package.json version baked into this web bundle at build time. */
declare const __KCP_APP_VERSION__: string;

interface ImportMetaEnv { readonly VITE_SENTRY_DSN?:string; readonly VITE_SENTRY_TRACES_SAMPLE_RATE?:string; }
interface ImportMeta { readonly env:ImportMetaEnv; }

interface ImportMetaEnv {
  readonly VITE_KCP_API_BASE_URL?: string;
  readonly VITE_KCP_OTA_BASE_URL?: string;
  readonly VITE_KCP_OTA_CHANNEL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
