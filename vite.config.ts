import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
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

/*
 * Reader guard for the engine's TTS queue.
 *
 * Two real-world failures made the onscreen reader go silent:
 *
 *   1. The boot primer spoke a blank utterance and then cancelled it in the
 *      SAME task. Android Chrome can wedge its engine there, and the first
 *      real sentence is swallowed.
 *
 *   2. A swallowed utterance fires neither onstart nor onend. The sequential
 *      queue then waited on a chunk that was never spoken, so the reader went
 *      quiet for the rest of the block while the scene advanced on its own
 *      deadline.
 *
 * engine.js is the one file this project treats as read-only (see the clip
 * order plugin above), so these are applied at build time instead. Every
 * anchor must match exactly once: if engine.js ever drifts, the build fails
 * rather than shipping a reader that silently dies mid-sentence.
 */
function readerGuardPlugin(): Plugin {
  const edits: Array<{ name: string; find: string; replace: string }> = [
    {
      name: 'defer-primer-cancel',
      find: '        synth.speak(primer);\n        synth.cancel();',
      replace: [
        '        synth.speak(primer);',
        '        /* Do NOT cancel synchronously: on Android Chrome a cancel() in the',
        '           same task as speak() can wedge the engine and swallow the first',
        '           real utterance. Cancel once the prime has taken. */',
        '        window.setTimeout(function () { try { synth.cancel(); } catch (e) {} }, 250);'
      ].join('\n')
    },
    {
      name: 'start-watchdog',
      find: [
        '      var advanced = false;',
        '      function advance() {',
        '        if (advanced) return;',
        '        advanced = true;',
        '        speechUtteranceEnded(gen, isReveal, u);'
      ].join('\n'),
      replace: [
        '      var advanced = false;',
        '      var started = false;',
        '      var startTimer = 0;',
        '',
        '      /* START WATCHDOG. A swallowed utterance fires neither onstart nor',
        '         onend, which used to leave the reader silent for the rest of the',
        '         block. If no start is observed shortly, skip the chunk and keep',
        '         reading: one lost line beats a dead reader. */',
        '      function armStartWatchdog() {',
        '        window.clearTimeout(startTimer);',
        '        startTimer = window.setTimeout(function () {',
        '          if (gen !== speechGen || started || advanced) return;',
        '          advance();',
        '        }, 4000);',
        '      }',
        '',
        '      function advance() {',
        '        if (advanced) return;',
        '        advanced = true;',
        '        window.clearTimeout(startTimer);',
        '        speechUtteranceEnded(gen, isReveal, u);'
      ].join('\n')
    },
    {
      name: 'onstart-clears-watchdog',
      find: [
        '      u.onstart = function () {',
        '        if (gen !== speechGen) return;'
      ].join('\n'),
      replace: [
        '      u.onstart = function () {',
        '        started = true;',
        '        window.clearTimeout(startTimer);',
        '        if (gen !== speechGen) return;'
      ].join('\n')
    },
    {
      name: 'arm-watchdog-on-speak',
      find: [
        '      try {',
        '        synth.speak(u);',
        '      } catch (e) {',
        '        advance();',
        '      }'
      ].join('\n'),
      replace: [
        '      try {',
        '        synth.speak(u);',
        '        armStartWatchdog();',
        '      } catch (e) {',
        '        advance();',
        '      }'
      ].join('\n')
    }
  ];

  return {
    name: 'lnr-reader-guard',
    enforce: 'pre',
    transform(code, id) {
      if (!/[\\/]src[\\/]timer[\\/]engine\.js$/.test(id)) return null;

      let out = code;
      for (const edit of edits) {
        const parts = out.split(edit.find);
        if (parts.length !== 2) {
          this.error(
            `engine.js: reader guard "${edit.name}" matched ${parts.length - 1} time(s), expected exactly 1`
          );
        }
        out = parts.join(edit.replace);
      }
      return { code: out, map: null };
    }
  };
}

/*
 * Non-Latin quiz packs.
 *
 * A Chinese pack imported fine and then vanished: `qNormKey()` stripped
 * everything that was not `[a-z0-9 ]` before using the question as a
 * duplicate key, so every CJK question normalised to an empty string. Two
 * callers treat an empty key as "duplicate":
 *
 *   1. the importer's `isNearDuplicate()` returns true, so the whole file is
 *      reported as duplicates and NOTHING is added - which is why the upload
 *      appeared to do nothing and the built-in English bank kept playing;
 *   2. `rebuildQuizBanks()` keys questions the same way, so a pack that did
 *      get through would collapse to a single question.
 *
 * `validateQuestion()` also required eight characters, which rejects short
 * but complete CJK questions (four CJK characters already make a sentence).
 *
 * engine.js is the one file this project treats as read-only, so both fixes
 * are applied at build time the same way the clip-order and reader-guard
 * patches are. Anchors must match exactly once, so drift fails the build
 * instead of shipping a pack importer that silently drops non-English files.
 */
function packLanguagePlugin(): Plugin {
  const edits: Array<{ name: string; find: string; replace: string }> = [
    {
      name: 'unicode-question-key',
      find: [
        '  function qNormKey(text) {',
        "    return String(text || '').toLowerCase().replace(/[^a-z0-9\\s]/g, ' ').replace(/\\s+/g, ' ').trim();",
        '  }'
      ].join('\n'),
      replace: [
        '  /* Unicode-aware question key. The original kept only [a-z0-9 ] , so',
        "     every CJK question normalised to '' and was treated as a duplicate of",
        '     every other question: imports added nothing and a rebuilt bank kept',
        '     one item. Letters and digits of every script are kept now. */',
        '  function qNormKey(text) {',
        "    return String(text || '').toLowerCase().replace(/[^\\p{L}\\p{N}\\s]/gu, ' ').replace(/\\s+/g, ' ').trim();",
        '  }'
      ].join('\n')
    },
    {
      name: 'cjk-question-length',
      find: [
        '    var text = firstDefined(raw, Q_TEXT_KEYS);',
        "    if (typeof text !== 'string' || text.trim().length < 8) {",
        "      errs.push(where + ': \"question\" must be at least 8 meaningful characters');",
        '    }'
      ].join('\n'),
      replace: [
        '    var text = firstDefined(raw, Q_TEXT_KEYS);',
        '    /* Four CJK characters already make a complete question, so the same',
        '       eight-character floor rejected short but valid Chinese items. */',
        "    var minChars = (typeof text === 'string' && /[\\u3040-\\u30ff\\u3400-\\u4dbf\\u4e00-\\u9fff\\uac00-\\ud7af]/.test(text)) ? 4 : 8;",
        "    if (typeof text !== 'string' || text.trim().length < minChars) {",
        "      errs.push(where + ': \"question\" must be at least ' + minChars + ' meaningful characters');",
        '    }'
      ].join('\n')
    }
  ];

  return {
    name: 'lnr-pack-language',
    enforce: 'pre',
    transform(code, id) {
      if (!/[\\/]src[\\/]timer[\\/]engine\.js$/.test(id)) return null;

      let out = code;
      for (const edit of edits) {
        const parts = out.split(edit.find);
        if (parts.length !== 2) {
          this.error(
            `engine.js: pack language "${edit.name}" matched ${parts.length - 1} time(s), expected exactly 1`
          );
        }
        out = parts.join(edit.replace);
      }
      return { code: out, map: null };
    }
  };
}

/*
 * Absolute site URL for link previews.
 *
 * Open Graph and Twitter card images MUST be absolute and publicly reachable:
 * a preview service fetches the image from ITS OWN network, so a relative path
 * resolves against the wrong host and the card renders with no picture.
 *
 * The URL is resolved at build time, in this order:
 *   1. VITE_SITE_URL            - set this on Vercel to your custom domain
 *   2. VERCEL_PROJECT_PRODUCTION_URL - Vercel's own production host
 *   3. VERCEL_URL               - the deployment host
 *   4. the known production host
 *
 * Every `__SITE_URL__` in index.html is replaced, so the tags can never drift
 * out of sync with the deployment.
 */
function siteUrlPlugin(): Plugin {
  const fallback = 'https://lnr-storytelling-hub.vercel.app';

  function resolveSiteUrl(): string {
    const explicit = (process.env.VITE_SITE_URL || '').trim();
    const prod = (process.env.VERCEL_PROJECT_PRODUCTION_URL || '').trim();
    const dep = (process.env.VERCEL_URL || '').trim();
    const raw = explicit || prod || dep || fallback;
    const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    return withProto.replace(/\/+$/, '');
  }

  return {
    name: 'lnr-site-url',
    enforce: 'pre',
    transformIndexHtml(html) {
      const site = resolveSiteUrl();
      return html.split('__SITE_URL__').join(site);
    }
  };
}

/*
 * Build-stamped service worker version.
 *
 * The installed PWA only picks up a new deploy when the worker's CACHE_VERSION
 * changes: a new worker installs, the old caches are deleted and the page is
 * reloaded once. That number used to be bumped by hand, which is exactly the
 * kind of step that gets forgotten - and a forgotten bump is invisible, because
 * the site looks fine in a browser while every installed copy keeps serving the
 * previous build.
 *
 * This plugin stamps it at build time from a hash of the finished bundle. Two
 * builds that differ in any shipped byte produce different versions, so an
 * installed app cannot be stale after a deploy, and an unchanged version is
 * proof that the app is current. The same value is what the settings page shows
 * as "Build:", and what a stale worker is asked for over postMessage.
 *
 * The anchor must match exactly once: if public/sw.js ever stops carrying the
 * line, the build fails instead of shipping an app that can never update.
 */
function swVersionPlugin(): Plugin {
  let outDir = path.resolve(import.meta.dirname, 'dist');

  return {
    name: 'lnr-sw-version',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir || 'dist');
    },
    closeBundle() {
      const swPath = path.join(outDir, 'sw.js');
      if (!existsSync(swPath)) {
        this.error('sw version: dist/sw.js is missing, so an installed app could never see this build');
      }

      const hash = createHash('sha256');
      const indexPath = path.join(outDir, 'index.html');
      if (existsSync(indexPath)) hash.update(readFileSync(indexPath));

      /* Asset names are content hashes, so listing them would be nearly enough;
         hashing their bytes too means a same-length edit can never reuse a
         version and leave an installed app on the old build. */
      const assetsDir = path.join(outDir, 'assets');
      if (existsSync(assetsDir)) {
        readdirSync(assetsDir)
          .sort()
          .forEach((name) => {
            const full = path.join(assetsDir, name);
            if (!statSync(full).isFile()) return;
            hash.update(name).update(readFileSync(full));
          });
      }

      const version = hash.digest('hex').slice(0, 12);
      const source = readFileSync(swPath, 'utf8');
      const anchor = /const CACHE_VERSION = '[^']*';/;
      const found = source.match(new RegExp(anchor.source, 'g')) || [];
      if (found.length !== 1) {
        this.error(`sw version: expected exactly one CACHE_VERSION line in public/sw.js, found ${found.length}`);
      }

      writeFileSync(swPath, source.replace(anchor, `const CACHE_VERSION = '${version}';`), 'utf8');
      console.log(`[lnr-sw] cache version ${version}`);
    }
  };
}

/*
 * One imported quiz pack at a time.
 *
 * Importing a JSON pack APPENDED to whatever was already imported, so loading a
 * Chinese pack on a device that held an English one left both languages in the
 * same custom bank and the timer read whichever came up next. The pack also had
 * no way out: once imported, it was on the device for good.
 *
 * Two fixes, both in engine.js because it owns the bank, the shuffle bags and
 * the stored copy:
 *
 *   1. an import now REPLACES the uploaded bank instead of merging into it, so
 *      one import is one pack, in one language;
 *   2. `LNR_QUESTION_SOURCE.clear()` empties that bank on request, which is
 *      what the Remove uploaded pack button calls.
 *
 * Free and Pro alike: the JSON is parsed in the browser and never uploaded.
 * Anchors must match exactly once, so drift fails the build rather than
 * shipping an importer that quietly mixes two packs.
 */
function quizPackPlugin(): Plugin {
  const edits: Array<{ name: string; find: string; replace: string }> = [
    {
      name: 'import-replaces-pack',
      find: [
        '      /* merge, skipping exact & near-duplicate questions against existing built-in + custom bank */',
        '      var existingAll = bank[segGuess] || [];'
      ].join('\n'),
      replace: [
        '      /* REPLACE, do not merge. Appending was why an English pack and a',
        '         Chinese pack ended up in the same bank: the second import kept the',
        '         first one behind. One import is now one pack. */',
        '      var existingAll = [];'
      ].join('\n')
    },
    {
      name: 'collect-new-pack',
      find: [
        '      var added = 0, dupes = 0;',
        '      good.forEach(function (q) {'
      ].join('\n'),
      replace: [
        '      var picked = [];',
        '      var added = 0, dupes = 0;',
        '      good.forEach(function (q) {'
      ].join('\n')
    },
    {
      name: 'push-into-new-pack',
      find: [
        '        custom[segGuess].push(q);',
        '        added++;'
      ].join('\n'),
      replace: [
        '        picked.push(q);',
        '        added++;'
      ].join('\n')
    },
    {
      name: 'commit-new-pack',
      find: [
        '      saveCustom();',
        '      /* An upload switches the source to the uploaded pack, so the creator'
      ].join('\n'),
      replace: [
        '      /* The uploaded bank is exactly this file. The other segment goes too,',
        '         so a pack guessed into the wrong segment cannot leave the previous',
        '         language behind. */',
        '      custom = { bible: [], history: [] };',
        '      custom[segGuess] = picked;',
        '      saveCustom();',
        '      /* An upload switches the source to the uploaded pack, so the creator'
      ].join('\n')
    },
    {
      name: 'clear-uploaded-bank',
      find: [
        '  function uploadedCount() {',
        '    return (custom.bible ? custom.bible.length : 0) + (custom.history ? custom.history.length : 0);',
        '  }'
      ].join('\n'),
      replace: [
        '  function uploadedCount() {',
        '    return (custom.bible ? custom.bible.length : 0) + (custom.history ? custom.history.length : 0);',
        '  }',
        '',
        '  /* Remove the uploaded pack from this device and fall back to the',
        '     built-in packs. Called by the Remove uploaded pack button, and exposed',
        '     on LNR_QUESTION_SOURCE so the control needs no engine internals. */',
        '  function clearUploadedBank() {',
        '    custom = { bible: [], history: [] };',
        '    try { localStorage.removeItem(CUSTOM_KEY); } catch (e) {}',
        "    S.questionSource = 'builtin';",
        '    save();',
        '    rebuildQuizBanks();',
        '    bags = { bible: [], history: [] };',
        '    refreshStats();',
        '    renderQuestionSource();',
        '    return 0;',
        '  }'
      ].join('\n')
    },
    {
      name: 'expose-clear',
      find: [
        '  window.LNR_QUESTION_SOURCE = {',
        '    get: function () { return effectiveQuestionSource(); },'
      ].join('\n'),
      replace: [
        '  window.LNR_QUESTION_SOURCE = {',
        '    get: function () { return effectiveQuestionSource(); },',
        '    clear: clearUploadedBank,'
      ].join('\n')
    }
  ];

  return {
    name: 'lnr-quiz-pack',
    enforce: 'pre',
    transform(code, id) {
      if (!/[\\/]src[\\/]timer[\\/]engine\.js$/.test(id)) return null;

      let out = code;
      for (const edit of edits) {
        const parts = out.split(edit.find);
        if (parts.length !== 2) {
          this.error(
            `engine.js: quiz pack "${edit.name}" matched ${parts.length - 1} time(s), expected exactly 1`
          );
        }
        out = parts.join(edit.replace);
      }
      return { code: out, map: null };
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
    plugins: [siteUrlPlugin(), clipOrderPlugin(), readerGuardPlugin(), packLanguagePlugin(), swVersionPlugin(), quizPackPlugin(), react(), tailwindcss(), localApiPlugin()],
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
      // Do not modify-file watching is disabled to prevent flickering during agent edits.
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
