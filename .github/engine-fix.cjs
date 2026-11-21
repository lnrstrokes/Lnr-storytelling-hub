/*
 * One-shot patch for src/timer/engine.js.
 *
 * The promo-toggle fix touches seven small anchors in a 294 KB file. This
 * script applies them from a GitHub Actions runner so the whole file does not
 * have to be uploaded through the contents API. It refuses to write anything
 * unless every anchor matches exactly once.
 *
 * Usage:
 *   node .github/engine-fix.cjs            apply to src/timer/engine.js
 *   node .github/engine-fix.cjs --check    verify anchors only
 *   node .github/engine-fix.cjs --reverse  write the pre-patch file to /tmp
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const target = path.join(__dirname, '..', 'src', 'timer', 'engine.js');
const reverse = process.argv.includes('--reverse');
const check = process.argv.includes('--check');

const pairs = [
  {
    old: `    [el.setupPromoEnabled, el.promoEnabledDrawer].forEach(function (chk) {
      on(chk, 'change', function () {
        S.promoAdsEnabled = !!chk.checked;
        save();
        refreshPromoText();
        syncInputs();
        toast(S.promoAdsEnabled ? 'Channel / partner breaks enabled' : 'Channel breaks turned off (uninterrupted)');
      });
    });`,
    new: `    [el.setupPromoEnabled, el.promoEnabledDrawer].forEach(function (chk) {
      on(chk, 'change', function () {
        S.promoAdsEnabled = !!chk.checked;
        save();
        refreshPromoText();
        syncInputs();
        /* Turning breaks off must also end a break already on air: the normal
           exit path finalises its ad log and returns to where it came from. */
        if (!S.promoAdsEnabled && live.phase === 'promo') {
          enterPhase(live.promoReturnPhase || homePhase(), false);
        }
        toast(S.promoAdsEnabled ? 'Channel / partner breaks enabled' : 'Channel breaks turned off (uninterrupted)');
      });
    });`
  },
  {
    old: `      else if (kind === 'promo') {
        promos.push(rec);
        S.promoAdsEnabled = true;
        save();
      } else {`,
    new: `      else if (kind === 'promo') {
        promos.push(rec);
        /* Uploading a clip never turns the break schedule on. */
        save();
      } else {`
  },
  {
    old: `      toast('Added ' + f.name + (d ? ' \\u00b7 ' + clock(d * 1000) : ''));`,
    new: `      toast(kind === 'promo' && !S.promoAdsEnabled
        ? 'Promo breaks are off. Turn them on to use this clip.'
        : ('Added ' + f.name + (d ? ' \\u00b7 ' + clock(d * 1000) : '')));`
  },
  {
    old: `    items.forEach(function (cc, i) {
      var li = document.createElement('li');
      var name = document.createElement('span');`,
    new: `    items.forEach(function (cc, i) {
      var li = document.createElement('li');
      if (cc.id) li.setAttribute('data-clip-id', cc.id);
      var name = document.createElement('span');`
  },
  {
    old: `      return live.promoReturnPhase || homePhase();
    }
    return 'promo';
  }`,
    new: `      return live.promoReturnPhase || homePhase();
    }
    /* Breaks off: never schedule a promo. Continue with the current
       non-promo phase instead (restarting it if it just ran out). */
    if (!S.promoAdsEnabled) return phase;
    return 'promo';
  }`
  },
  {
    old: `  function enterPhase(phase, first, opts) {
    opts = opts || {};
    var prevPhase = live.phase;
    if (prevPhase === 'promo' && phase !== 'promo') {`,
    new: `  function enterPhase(phase, first, opts) {
    opts = opts || {};
    var prevPhase = live.phase;
    /* Last line of defence: a promo phase can never be entered while the
       toggle is off, whichever path asked for it. */
    if (phase === 'promo' && !S.promoAdsEnabled) {
      phase = prevPhase && prevPhase !== 'promo' ? prevPhase : homePhase();
    }
    if (prevPhase === 'promo' && phase !== 'promo') {`
  },
  {
    old: `      } else if (live.phase === 'promo') {
        var av = activeVideo();
        var activePromos = effectivePromoList();`,
    new: `      } else if (live.phase === 'promo') {
        if (!S.promoAdsEnabled) {
          enterPhase(live.promoReturnPhase || homePhase(), false);
          return;
        }
        var av = activeVideo();
        var activePromos = effectivePromoList();`
  }
];

function count(haystack, needle) {
  return haystack.split(needle).length - 1;
}

let source = fs.readFileSync(target, 'utf8');
const alreadyApplied = pairs.every((pair) => count(source, pair.new) === 1 && count(source, pair.old) === 0);

if (alreadyApplied && !reverse) {
  console.log('engine.js already carries this patch; nothing to do.');
  process.exit(0);
}

pairs.forEach((pair, index) => {
  const from = reverse ? pair.new : pair.old;
  const matches = count(source, from);
  if (matches !== 1) {
    console.error(`anchor ${index + 1} matched ${matches} times (expected exactly 1)`);
    process.exit(1);
  }
  source = source.replace(from, reverse ? pair.old : pair.new);
});

if (check) {
  console.log('All 7 anchors matched exactly once.');
  process.exit(0);
}

if (reverse) {
  const out = path.join('/tmp', 'engine-base.js');
  fs.writeFileSync(out, source);
  console.log(`wrote ${out}`);
  process.exit(0);
}

fs.writeFileSync(target, source);
console.log('Patched src/timer/engine.js (7 anchors).');
