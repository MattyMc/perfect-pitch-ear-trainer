import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    // Served from https://mattymc.github.io/perfect-pitch-ear-trainer/, not a domain
    // root. Set unconditionally so dev, preview and production all agree on the path
    // prefix — a conditional base makes `vite preview` disagree with the built HTML.
    base: '/perfect-pitch-ear-trainer/',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify — file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      rollupOptions: {
        output: {
          // Split node_modules out of the app chunk so nothing crosses Rollup's 500 kB
          // warning threshold. Tone and its audio-context stack (~230 kB minified) get
          // their own chunk; React, Dexie and Lucide share a `vendor` chunk (~335 kB).
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (/node_modules\/(tone|standardized-audio-context|automation-events|tslib)\//.test(id)) {
              return 'tone';
            }
            return 'vendor';
          },
        },
      },
    },
  };
});
