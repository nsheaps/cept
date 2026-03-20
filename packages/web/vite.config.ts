import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const rootPkg = require('../../package.json') as { version: string };

/**
 * Provide empty stubs for Node.js built-in modules.
 *
 * @cept/core re-exports LocalFsBackend and GitBackend which import node:fs,
 * node:path, etc.  These backends are never instantiated in the web bundle
 * but Rollup must still resolve their imports during tree-shaking.  This
 * plugin returns an empty module for any `node:*` import so the build
 * succeeds and the final bundle contains no Node.js references.
 */
function nodeStubs(): Plugin {
  // Returns a module that re-exports a Proxy as default so any named import
  // (e.g. `import { watch } from "node:fs"`) resolves to a no-op.
  const stub = [
    'const noop = () => {};',
    'const handler = { get: () => noop };',
    'const p = new Proxy(noop, handler);',
    'export default p;',
    // Common named exports used by local-fs.ts — Rollup validates these at
    // build time so they must be declared explicitly.
    'export const watch = noop;',
    'export const readFile = noop;',
    'export const writeFile = noop;',
    'export const mkdir = noop;',
    'export const readdir = noop;',
    'export const stat = noop;',
    'export const unlink = noop;',
    'export const rename = noop;',
    'export const access = noop;',
    'export const resolve = noop;',
    'export const join = noop;',
    'export const dirname = noop;',
    'export const basename = noop;',
    'export const relative = noop;',
    'export const sep = "/";',
  ].join('\n');

  return {
    name: 'node-stubs',
    enforce: 'pre',
    resolveId(source) {
      if (source.startsWith('node:')) return `\0stub:${source}`;
      return null;
    },
    load(id) {
      if (id.startsWith('\0stub:')) return stub;
      return null;
    },
  };
}

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
  plugins: [tailwindcss(), react(), nodeStubs(), inject404BasePath()],
  base: process.env.VITE_BASE_PATH || '/',
  define: {
    __APP_VERSION__: JSON.stringify(process.env.VITE_APP_VERSION || rootPkg.version),
    __COMMIT_SHA__: JSON.stringify(process.env.COMMIT_SHA || ''),
    __PR_NUMBER__: JSON.stringify(process.env.PR_NUMBER || ''),
    __REPO_URL__: JSON.stringify(process.env.REPO_URL || ''),
    __PRODUCTION_URL__: JSON.stringify(process.env.PRODUCTION_URL || ''),
    __IS_PREVIEW__: JSON.stringify(process.env.VITE_IS_PREVIEW === 'true'),
    __HEAD_BRANCH__: JSON.stringify(process.env.HEAD_BRANCH || 'main'),
    // isomorphic-git checks process.platform at runtime
    'process.platform': JSON.stringify('browser'),
  },
  resolve: {
    alias: {
      '@cept/core': path.resolve(__dirname, '../core/src'),
      '@cept/ui': path.resolve(__dirname, '../ui/src'),
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
