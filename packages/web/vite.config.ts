import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [tailwindcss(), react()],
  base: process.env.VITE_BASE_PATH || '/',
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
  },
  define: {
    'import.meta.env.CEPT_DEMO_MODE': JSON.stringify(process.env.CEPT_DEMO_MODE === 'true'),
  },
});
