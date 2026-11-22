/* ============================================================
   lnr Studio — football pronunciation layer
   Turns the football half of the narration into words an English
   TTS engine actually says correctly.

   WHY THIS IS A SEPARATE FILE

   speech.js already owns number, verse and date normalisation and
   it is proven code — the reader depends on it. Football needs one
   more pass in front of it, so this module wraps the functions the
   engine calls, fixes the text, and hands it to the original.

   It changes nothing on screen. Only the spoken form changes.

   WHAT IT FIXES

     · Names        "Mbappé" -> "Embappay", "De Bruyne" ->
                    "De Broynuh", "Xavi" -> "Chahvee",
                    "Lewandowski" -> "Levandovski", "Modrić" ->
                    "Modrich", and the rest of the player library.
     · Shirt numbers "#2" -> "jersey number 2" (already the rule in
                    speech.js, kept here so it also covers "No. 2").
     · Age grades    "Under 17/18", "U17/U18", "U-17/U-18" ->
                    "Under seventeen, Under eighteen",
                    "U17s" -> "Under seventeens".

   Load order: AFTER speech.js and BEFORE the engine imports.
   Exposed as a patched window.LNR_SPEECH; delete the import in
   TimerApp.tsx to remove the whole layer.
   ============================================================ */
(function () {
  'use strict';

  var api = window.LNR_SPEECH;
  if (!api || typeof api.questionParts !== 'function') return;

  /* ---------------------------------------------------------- names --- */

  /* TTS-only respellings, written the way an English engine says them
     correctly. Longest phrase first so "Ronaldo Nazário" wins over a bare
     "Ronaldo". */
  var PRONOUNCE = [
    ['Kylian Mbappé', 'Killian Embappay'],
    ['Kylian Mbappe', 'Killian Embappay'],
    ['Mbappé', 'Embappay'],
    ['Mbappe', 'Embappay'],
    ['Vinícius Júnior', 'Vinisius Junior'],
    ['Vinicius Junior', 'Vinisius Junior'],
    ['Vinícius', 'Vinisius'],
    ['Vinicius', 'Vinisius'],
    ['Erling Haaland', 'Erling Hahlahnd'],
    ['Haaland', 'Hahlahnd'],
    ['Kevin De Bruyne', 'Kevin De Broynuh'],
    ['De Bruyne', 'De Broynuh'],
    ['Luka Modrić', 'Luka Modrich'],
    ['Modrić', 'Modrich'],
    ['Modric', 'Modrich'],
    ['Robert Lewandowski', 'Robert Levandovski'],
    ['Lewandowski', 'Levandovski'],
    ['Antoine Griezmann', 'Antwan Greezmann'],
    ['Griezmann', 'Greezmann'],
    ['N’Golo Kanté', 'Ngolo Kantay'],
    ['N\'Golo Kanté', 'Ngolo Kantay'],
    ['N\'Golo Kante', 'Ngolo Kantay'],
    ['Kanté', 'Kantay'],
    ['Sadio Mané', 'Sadio Manay'],
    ['Mané', 'Manay'],
    ['Achraf Hakimi', 'Ashraf Hakeemee'],
    ['Hakimi', 'Hakeemee'],
    ['Jay-Jay Okocha', 'Jay Jay Okohcha'],
    ['Nwankwo Kanu', 'Nwankwo Kahnoo'],
    ['Zinedine Zidane', 'Zeenadeen Zeedahn'],
    ['Zidane', 'Zeedahn'],
    ['Ronaldo Nazário', 'Ronaldo Nazahrio'],
    ['Ronaldo Nazario', 'Ronaldo Nazahrio'],
    ['Nazário', 'Nazahrio'],
    ['Ronaldinho', 'Ronaldinyo'],
    ['Kaká', 'Kahkah'],
    ['Kaka', 'Kahkah'],
    ['Eusébio', 'Ewzebio'],
    ['Eusebio', 'Ewzebio'],
    ['Didier Drogba', 'Deedeeay Drogbah'],
    ['Drogba', 'Drogbah'],
    ['Samuel Eto’o', 'Samuel Ehtoh'],
    ['Samuel Eto\'o', 'Samuel Ehtoh'],
    ['Eto’o', 'Ehtoh'],
    ['Eto\'o', 'Ehtoh'],
    ['Yaya Touré', 'Yaya Tooray'],
    ['Touré', 'Tooray'],
    ['Riyad Mahrez', 'Reeyad Mahrez'],
    ['Virgil van Dijk', 'Virgil van Dike'],
    ['van Dijk', 'van Dike'],
    ['Xavi Hernández', 'Chahvee Hernandez'],
    ['Xavi Hernandez', 'Chahvee Hernandez'],
    ['Xavi', 'Chahvee'],
    ['Andrés Iniesta', 'Andres Innyesta'],
    ['Iniesta', 'Innyesta'],
    ['Manuel Neuer', 'Manuel Noyer'],
    ['Gianluigi Buffon', 'Janlooeejee Boofon'],
    ['Buffon', 'Boofon'],
    ['Francesco Totti', 'Franchesko Totti'],
    ['Alessandro Del Piero', 'Alessandro Del Peeairo'],
    ['Del Piero', 'Del Peeairo'],
    ['Abedi Pele', 'Abedi Pelay'],
    ['Pelé', 'Pelay'],
    ['Pele', 'Pelay'],
    ['Cafu', 'Kahfoo'],
    ['Lamine Yamal', 'Lameen Yamal'],
    ['El Clásico', 'El Clasico'],
    ['Ballon d\'Or', 'Balon Dor'],
    ['AS Roma', 'A S Roma'],
    ['Ligue 1', 'League one'],
    ['Serie A', 'Serie Ah'],
    ['Schalke', 'Shalkuh'],
    ['Eredivisie', 'Ayrdeeveesee'],
    ['Bundesliga', 'Boondesleegah'],
    ['Mönchengladbach', 'Munchergladbach'],
    ['Atlético Madrid', 'Atletico Madrid']
  ];

  var PRONOUNCE_MAP = {};
  PRONOUNCE.forEach(function (p) {
    var k = p[0].toLowerCase();
    if (!PRONOUNCE_MAP[k]) PRONOUNCE_MAP[k] = p[1];
  });

  /* Whole names only. The lead character is captured rather than using a
     lookbehind, because older iOS Safari does not support lookbehind. */
  var PRONOUNCE_RE = new RegExp(
    '(^|[^A-Za-z\\u00C0-\\u024F])(' +
      PRONOUNCE.map(function (p) {
        return p[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }).join('|') +
    ')(?![A-Za-z\\u00C0-\\u024F])',
    'gi'
  );

  /* ------------------------------------------------------ age grades --- */

  var ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven',
    'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen',
    'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  var TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty',
    'seventy', 'eighty', 'ninety'];

  function under100(n) {
    if (n < 20) return ONES[n];
    var t = TENS[Math.floor(n / 10)];
    var r = n % 10;
    return r ? t + '-' + ONES[r] : t;
  }

  function under1000(n) {
    n = parseInt(n, 10);
    if (n < 100) return under100(n);
    var hundreds = ONES[Math.floor(n / 100)] + ' hundred';
    var rest = n % 100;
    return rest ? hundreds + ' ' + under100(rest) : hundreds;
  }

  /* A three-digit STAT is a count, not a year. speech.js reads a bare 3-digit
     number as a year, so "450 goals" came out as "four fifty goals". */
  var COUNT_UNITS = 'goals|appearances|games|matches|assists|caps|starts|seasons|titles|wins|minutes|points|passes|saves|clean sheets|fans|people|subscribers|episodes|questions|clips';
  var COUNT_RE = new RegExp('\\b(\\d{3})\\s+(' + COUNT_UNITS + ')\\b', 'gi');

  var AGE_GRADE = '(?:U\\s?-?\\s?|Under[\\s-])';

  function ageWord(prefix, n, plural) {
    var word = 'Under ' + under100(parseInt(n, 10)) + (plural ? 's' : '');
    return prefix.charAt(0) === 'u' ? word.charAt(0).toLowerCase() + word.slice(1) : word;
  }

  /* Age grades are spoken the way a commentator says them, never as letters.
     "Under 17/18" must not become "under seventeen or eighteen" — that loses
     the second age group. */
  var AGE_PAIR = new RegExp(
    '\\b(' + AGE_GRADE + ')(\\d{1,2})(?!\\s*[,\\d])\\s*(?:\\/|(?:\\s+or\\s+))(?:' +
      AGE_GRADE + ')?(\\d{1,2})(s)?(?!\\s*[,\\d])',
    'gi'
  );
  var AGE_ONE = new RegExp('\\b(' + AGE_GRADE + ')(\\d{1,2})(s)?(?!\\s*[,\\d])', 'gi');

  /* ------------------------------------------------- shirt numbers --- */

  function shirt(source, n) {
    var words = 'jersey number ' + under100(parseInt(n, 10));
    return /^[A-Z]/.test(source) ? words.charAt(0).toUpperCase() + words.slice(1) : words;
  }

  /* --------------------------------------------------------- the pass --- */

  function fixText(input) {
    if (typeof input !== 'string' || !input) return input;
    var text = input;

    /* 1. Names. */
    text = text.replace(PRONOUNCE_RE, function (m, lead, hit) {
      var said = PRONOUNCE_MAP[hit.toLowerCase()];
      return said ? lead + said : m;
    });

    /* 1b. "586 BC." used to come out as "five eighty-six B circa", because
       the abbreviation pass reads the trailing "C." as "circa". Spell the era
       out when it ends a sentence; without a full stop speech.js already
       reads "B C" correctly. */
    text = text.replace(/\bBCE\b\./g, 'before the common era.');
    text = text.replace(/\bBC\b\./g, 'before Christ.');

    /* 2. Age grades, before speech.js reads "/" as "or". */
    text = text.replace(AGE_PAIR, function (_, prefix, a, b, plural) {
      return ageWord(prefix, a, false) + ', ' + ageWord(prefix, b, plural);
    });
    text = text.replace(AGE_ONE, function (_, prefix, n, plural) {
      return ageWord(prefix, n, plural);
    });

    /* 3. Three-digit stats stay counts ("450 goals", not "four fifty goals"). */
    text = text.replace(COUNT_RE, function (_, n, unit) {
      return under1000(n) + ' ' + unit;
    });

    /* 4. Shirt numbers. "#" is never a hashtag in this studio. */
    text = text.replace(/\bNo\.?\s*(\d{1,3})\b/gi, function (m, n) {
      return shirt(m, n);
    });
    text = text.replace(/#\s*(\d{1,4})\b/g, function (_, n) {
      return 'jersey number ' + under100(parseInt(n, 10));
    });

    return text;
  }

  /* Deep-fix the arguments a speech function receives. Only plain objects and
     arrays are copied, and only a few levels deep, so a cyclic story object
     can never trap this. */
  function fixValue(value, depth, seen) {
    if (typeof value === 'string') return fixText(value);
    if (!value || typeof value !== 'object') return value;
    if (depth >= 3 || seen.has(value)) return value;
    seen.add(value);

    if (Array.isArray(value)) {
      return value.map(function (item) { return fixValue(item, depth + 1, seen); });
    }

    var proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return value;

    var out = {};
    Object.keys(value).forEach(function (key) {
      out[key] = fixValue(value[key], depth + 1, seen);
    });
    return out;
  }

  var WRAPPED = [
    'normalizeSpeech', 'questionParts', 'revealParts',
    'playerIntroParts', 'playerClueParts', 'playerCountdownParts', 'playerRevealParts',
    'milestoneParts', 'storyIntroParts', 'storySceneParts', 'storyOutroParts',
    'storyHookParts', 'storyBeatParts', 'storyCheckpointParts', 'storyResolutionParts'
  ];

  WRAPPED.forEach(function (name) {
    var original = api[name];
    if (typeof original !== 'function') return;
    api[name] = function () {
      var seen = new WeakSet();
      var args = Array.prototype.slice.call(arguments);
      for (var i = 0; i < args.length; i++) {
        args[i] = fixValue(args[i], 0, seen);
      }
      return original.apply(api, args);
    };
  });
})();
