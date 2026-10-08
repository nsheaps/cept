import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const rootPkg = require('../../package.json') as { version: string };

/**
 * Post-build plugin that injects the base path into 404.html so the
 * SPA redirect hack works for both production and preview deploys.
 */
function inject404BasePath(): Plugin {
  let resolvedBase = '/';
  return {
    name: 'inject-404-base-path',
    configResolved(config) {
      resolvedBase = config.base;
    },
    closeBundle() {
      const notFoundPath = path.resolve(__dirname, 'dist/404.html');
      if (fs.existsSync(notFoundPath)) {
        let html = fs.readFileSync(notFoundPath, 'utf-8');
        html = html.replace('__VITE_BASE_PATH__', resolvedBase);
        fs.writeFileSync(notFoundPath, html);
      }
    },
  };
}

export default defineConfig({
  plugins: [tailwindcss(), react(), inject404BasePath()],
  base: process.env.VITE_BASE_PATH || '/',
  define: {
    __APP_VERSION__: JSON.stringify(process.env.VITE_APP_VERSION || rootPkg.version),
    __COMMIT_SHA__: JSON.stringify(process.env.COMMIT_SHA || ''),
    __PR_NUMBER__: JSON.stringify(process.env.PR_NUMBER || ''),
    __REPO_URL__: JSON.stringify(process.env.REPO_URL || ''),
    __PRODUCTION_URL__: JSON.stringify(process.env.PRODUCTION_URL || ''),
    __IS_PREVIEW__: JSON.stringify(process.env.VITE_IS_PREVIEW === 'true'),
    __DEMO_DEFAULT__: JSON.stringify(process.env.VITE_DEMO_DEFAULT === 'true'),
    __HEAD_BRANCH__: JSON.stringify(process.env.HEAD_BRANCH || 'main'),
    // Git CORS proxy (D-39); empty means the default in packages/ui/src/config/git-proxy.ts
    __GIT_CORS_PROXY__: JSON.stringify(process.env.VITE_CORS_PROXY || ''),
    // isomorphic-git checks process.platform at runtime
    'process.platform': JSON.stringify('browser'),
  },
  resolve: {
    alias: {
      '@cept/core': path.resolve(__dirname, '../core/src'),
      '@cept/ui': path.resolve(__dirname, '../ui/src'),
    },
  },
  optimizeDeps: {
    // Ensure isomorphic-git and buffer are pre-bundled together so
    // Buffer is available when isomorphic-git CJS code is evaluated.
    include: ['buffer', 'isomorphic-git'],
    esbuildOptions: {
      // Make Buffer available as a global in esbuild pre-bundling
      define: {
        Buffer: 'Buffer',
      },
    },
  },
  server: {
    port: 5173,
    open: false,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        'service-worker': path.resolve(__dirname, 'src/service-worker.ts'),
      },
      output: {
        entryFileNames(chunkInfo) {
          // Service worker must be at a fixed path (no hash) at the app root
          if (chunkInfo.name === 'service-worker') return 'service-worker.js';
          return 'assets/[name]-[hash].js';
        },
      },
    },
  },
});
