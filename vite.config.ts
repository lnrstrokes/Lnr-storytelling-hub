import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';
import adminHandler from './api/admin';
import verifyLicenseHandler from './api/verify-license';
import { forwardApi } from './local-api';

/*
 * Clip-order handoff for the video engine.
 *
 * The setup panel's "Video clip rotation" pills (Sequential / Shuffle) store
 * their choice in localStorage. Only the engine knows when a clip ends and
 * which clip comes next, and engine.js is the one file this project treats as
 * read-only (see src/timer/pro-gate.ts and src/timer/rotationDriver.ts, which
 * solve their problems from the outside). A DOM shim cannot reach this, so the
 * smallest possible change is applied to that file at build time: one helper,
 * and the seven places that hand off to the next clip call it.
 *
 * If engine.js ever stops matching, the build fails instead of shipping a
 * rotation switch that quietly does nothing.
 */
function clipOrderPlugin(): Plugin {
  const anchor = '  function playClip(index) {';
  const helper = `  /* Clip order. The video setup panel stores 'lnr_video_order_v1' and this is
     read at every handoff, so switching Sequential/Shuffle applies to the
     next clip without a reload. */
  function clipOrderIsShuffle() {
    try { return localStorage.getItem('lnr_video_order_v1') === 'shuffle'; } catch (e) { return false; }
  }

  function nextClipIndex(len) {
    if (!(len > 1)) return 0;
    if (clipOrderIsShuffle()) {
      var idx = Math.floor(Math.random() * len);
      if (idx === live.clipIndex) idx = (idx + 1) % len;
      return idx;
    }
    return (live.clipIndex + 1) % len;
  }

`;
  const swaps: Array<[RegExp, string, number]> = [
    [/preloadStandbyClip\(\(live\.clipIndex \+ 1\) % arr\.length\)/g, 'preloadStandbyClip(nextClipIndex(arr.length))', 1],
    [/preloadStandbyClip\(\(live\.clipIndex \+ 1\) % clips\.length\)/g, 'preloadStandbyClip(nextClipIndex(clips.length))', 1],
    [/preloadStandbyClip\(\(live\.clipIndex \+ 1\) % activeList\(\)\.length\)/g, 'preloadStandbyClip(nextClipIndex(activeList().length))', 1],
    [/transitionToClip\(\(live\.clipIndex \+ 1\) % clips\.length\)/g, 'transitionToClip(nextClipIndex(clips.length))', 3],
    [/transitionToClip\(\(live\.clipIndex \+ 1\) % list\.length\)/g, 'transitionToClip(nextClipIndex(list.length))', 1]
  ];

  return {
    name: 'lnr-clip-order',
    enforce: 'pre',
    transform(code, id) {
      if (!/[\\/]src[\\/]timer[\\/]engine\.js$/.test(id)) return null;

      const at = code.indexOf(anchor);
      if (at === -1) this.error('engine.js: could not find the clip handoff anchor');

      let out = code.slice(0, at) + helper + code.slice(at);
      for (const [pattern, replacement, expected] of swaps) {
        const found = out.match(pattern);
        if (!found || found.length !== expected) {
          this.error(`engine.js: expected ${expected} clip handoff site(s) matching ${pattern}, found ${found ? found.length : 0}`);
        }
        out = out.replace(pattern, replacement);
      }

      const calls = out.split('nextClipIndex(').length - 1;
      if (calls !== 8) this.error(`engine.js: expected 8 clip-order uses, found ${calls}`);

      return {code: out, map: null};
    }
  };
}

function localApiPlugin(): Plugin {
  return {
    name: 'lnr-local-api',
    configureServer(server) {
      server.middlewares.use('/api/admin', (req, res, next) => {
        void forwardApi(adminHandler, req, res).catch(next);
      });
      server.middlewares.use('/api/verify-license', (req, res, next) => {
        void forwardApi(verifyLicenseHandler, req, res).catch(next);
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [clipOrderPlugin(), react(), tailwindcss(), localApiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true as const,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      sourcemap: false,
      minify: 'terser' as const,
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true,
          passes: 2,
        },
        mangle: {
          toplevel: true,
        },
        format: {
          comments: false,
        },
      },
    },
  };
});
