import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const DEFAULT_KCP_API = 'https://kcp-api-v2.adminkitchencostpro.workers.dev';

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), '');
  const configuredTarget = String(environment.VITE_KCP_API_BASE_URL || DEFAULT_KCP_API).trim();
  const proxyTarget = /^https?:\/\//i.test(configuredTarget) ? configuredTarget : DEFAULT_KCP_API;

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/kcp-api': {
          target: proxyTarget,
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/kcp-api/, '')
        }
      }
    },
    build: {
      target: 'es2022',
      sourcemap: true,
      cssCodeSplit: true
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      clearMocks: true,
      coverage: {
        reporter: ['text', 'html']
      }
    }
  };
});
