/* ============================================================
   lnr Studio — speech normalization
   Turns on-screen text into text a TTS engine reads naturally.

   The problem this solves: browsers read "1 John 3:16" as
   "one john three sixteen" (or worse, "one john colon three
   sixteen"), "586 BC" as "five eighty-six bee see", and
   "120,000" as "one hundred twenty comma zero zero zero".

   Everything spoken by the voice reader passes through
   normalizeSpeech() first. The on-screen text is never altered.

   Exposed as window.LNR_SPEECH = { normalizeSpeech, ... }
   ============================================================ */
(function () {
  'use strict';

  /* ---------- number -> words ---------- */

  var ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven',
    'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen',
    'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  var TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty',
    'seventy', 'eighty', 'ninety'];
  var TENS_PLURAL = ['', '', 'twenties', 'thirties', 'forties', 'fifties',
    'sixties', 'seventies', 'eighties', 'nineties'];

  /* 0-999 as words. Used for verse/chapter numbers and small counts. */
  function under1000(n) {
    n = Math.floor(n);
    if (n < 20) return ONES[n];
    if (n < 100) {
      var t = TENS[Math.floor(n / 10)];
      var r = n % 10;
      return r ? t + '-' + ONES[r] : t;
    }
    var h = ONES[Math.floor(n / 100)] + ' hundred';
    var rem = n % 100;
    return rem ? h + ' ' + under1000(rem) : h;
  }

  /* Any integer as words, with scale words. */
  function intToWords(n) {
    n = Math.floor(Math.abs(n));
    if (n === 0) return 'zero';
    var scales = [
      { v: 1000000000, w: 'billion' },
      { v: 1000000, w: 'million' },
      { v: 1000, w: 'thousand' }
    ];
    var out = [];
    for (var i = 0; i < scales.length; i++) {
      if (n >= scales[i].v) {
        var c = Math.floor(n / scales[i].v);
        out.push(under1000(c) + ' ' + scales[i].w);
        n -= c * scales[i].v;
      }
    }
    if (n > 0) out.push(under1000(n));
    return out.join(' ');
  }

  /* A year reads as a year, not a count:
     1066 -> "ten sixty-six", 1900 -> "nineteen hundred",
     2008 -> "twenty oh eight", 2000 -> "two thousand". */
  function yearToWords(n) {
    n = Math.floor(n);
    if (n < 1000 || n > 9999) return intToWords(n);
    var hi = Math.floor(n / 100);
    var lo = n % 100;
    if (lo === 0) {
      /* round thousands read as counts: 1000, 2000 */
      if (hi % 10 === 0) return intToWords(n);
      return under1000(hi) + ' hundred';
    }
    if (lo < 10) return under1000(hi) + ' oh ' + ONES[lo];
    return under1000(hi) + ' ' + under1000(lo);
  }

  /* Year-ish reading for any 3-4 digit number, used for BC/AD dates
     and date ranges: 586 -> "five eighty-six", 432 -> "four thirty-two". */
  function yearish(n) {
    n = Math.floor(n);
    if (n >= 1000) return yearToWords(n);
    if (n >= 100) {
      var hi = Math.floor(n / 100), lo = n % 100;
      if (lo === 0) return under1000(hi) + ' hundred';
      if (lo < 10) return under1000(hi) + ' oh ' + ONES[lo];
      return under1000(hi) + ' ' + under1000(lo);
    }
    return intToWords(n);
  }

  /* ---------- ordinals ---------- */

  var ORD_ONES = ['zeroth', 'first', 'second', 'third', 'fourth', 'fifth',
    'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth',
    'thirteenth', 'fourteenth', 'fifteenth', 'sixteenth', 'seventeenth',
    'eighteenth', 'nineteenth'];
  var ORD_TENS = ['', '', 'twentieth', 'thirtieth', 'fortieth', 'fiftieth',
    'sixtieth', 'seventieth', 'eightieth', 'ninetieth'];

  function ordinalToWords(n) {
    n = Math.floor(n);
    if (n < 20) return ORD_ONES[n];
    if (n < 100) {
      var t = Math.floor(n / 10), r = n % 10;
      if (r === 0) return ORD_TENS[t];
      return TENS[t] + '-' + ORD_ONES[r];
    }
    if (n < 1000) {
      var h = Math.floor(n / 100), rem = n % 100;
      if (rem === 0) return ONES[h] + ' hundredth';
      return ONES[h] + ' hundred ' + ordinalToWords(rem);
    }
    return intToWords(n) + 'th';
  }

  /* ---------- book names ---------- */

  /* Books whose leading number is part of the name: "1 John" is
     "First John", never "one John". */
  var NUMBERED_BOOKS = [
    'Samuel', 'Kings', 'Chronicles', 'Corinthians', 'Thessalonians',
    'Timothy', 'Peter', 'John', 'Maccabees', 'Esdras'
  ];
  var ORDINAL_WORD = { 1: 'First', 2: 'Second', 3: 'Third', 4: 'Fourth' };

  /* ---------- acronyms ---------- */

  /* Curated so ordinary words and "I am" are never spelled out. */
  var ACRONYMS = ['TCP', 'IP', 'AI', 'CEO', 'USA', 'UK', 'USSR', 'NATO',
    'UN', 'EU', 'NASA', 'DNA', 'HIV', 'AIDS', 'HTML', 'CSS', 'API', 'GPU',
    'CPU', 'RAM', 'WWI', 'WWII', 'OK', 'TV', 'PC', 'CD', 'DVD', 'GPS',
    'ATM', 'FBI', 'CIA', 'IMF', 'OPEC', 'WHO', 'US',
    'FC', 'UCL', 'PSG', 'MLS', 'EPL', 'AC', 'CP', 'AFCON', 'MVP'];

  /* ---------- abbreviations ---------- */

  var ABBREV = {
    'c': 'circa', 'ca': 'circa', 'approx': 'approximately',
    'vs': 'versus', 'etc': 'et cetera', 'eg': 'for example',
    'ie': 'that is', 'no': 'number', 'nos': 'numbers',
    'st': 'Saint', 'mt': 'Mount', 'rev': 'Revelation',
    'gen': 'Genesis', 'ex': 'Exodus', 'deut': 'Deuteronomy',
    'ps': 'Psalm', 'prov': 'Proverbs', 'isa': 'Isaiah',
    'jer': 'Jeremiah', 'matt': 'Matthew', 'mk': 'Mark',
    'lk': 'Luke', 'jn': 'John', 'rom': 'Romans',
    'cor': 'Corinthians', 'gal': 'Galatians', 'eph': 'Ephesians',
    'phil': 'Philippians', 'col': 'Colossians', 'thess': 'Thessalonians',
    'tim': 'Timothy', 'heb': 'Hebrews', 'jas': 'James',
    'pet': 'Peter', 'dr': 'Doctor', 'mr': 'Mister', 'mrs': 'Missus',
    'ms': 'Miss', 'jr': 'Junior', 'sr': 'Senior', 'ft': 'feet',
    'km': 'kilometres', 'kg': 'kilograms', 'mi': 'miles'
  };

  /* ---------- helpers ---------- */

  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  /* "TCP/IP" -> "T C P I P" (before "/" is read as "or") */
  function expandAcronymSlash(text) {
    return text.replace(/\b([A-Z]{2,5})\/([A-Z]{2,5})\b/g, function (_, a, b) {
      return a.split('').join(' ') + ' ' + b.split('').join(' ');
    });
  }

  function expandAcronyms(text) {
    var re = new RegExp('\\b(' + ACRONYMS.join('|') + ')\\b', 'g');
    return text.replace(re, function (m) { return m.split('').join(' '); });
  }

  /* "1 and 2 Timothy" -> "First and Second Timothy";
     "1, 2 and 3 John" -> "First, Second and Third John" */
  function expandNumberedBookRuns(text) {
    NUMBERED_BOOKS.forEach(function (book) {
      var b = escapeRe(book);
      /* N, N and N Book */
      var re3 = new RegExp('\\b([1-4])(?:\\s*,\\s*([1-4]))*\\s+and\\s+([1-4])\\s+(' + b + ')\\b', 'g');
      text = text.replace(re3, function (m, a, b2, c, name) {
        var nums = [a];
        if (b2) nums.push(b2);
        nums.push(c);
        var words = nums.map(function (n) { return ORDINAL_WORD[n] || n; });
        return words.slice(0, -1).join(', ') + ' and ' + words[words.length - 1] + ' ' + name;
      });
      /* N and N Book */
      var re2 = new RegExp('\\b([1-4])\\s+and\\s+([1-4])\\s+(' + b + ')\\b', 'g');
      text = text.replace(re2, function (m, a, c, name) {
        return (ORDINAL_WORD[a] || a) + ' and ' + (ORDINAL_WORD[c] || c) + ' ' + name;
      });
    });
    return text;
  }

  /* "1 John 3:16" -> "First John, chapter 3, verse 16"
     "Genesis 6:14" -> "Genesis, chapter 6, verse 14" */
  function expandVerseRefs(text) {
    /* numbered books first, so "1 John 3:16" is not read as "one John" */
    NUMBERED_BOOKS.forEach(function (book) {
      var re = new RegExp('\\b([1-4])\\s+(' + escapeRe(book) + ')\\b', 'g');
      text = text.replace(re, function (_, num, name) {
        return (ORDINAL_WORD[num] || num) + ' ' + name;
      });
    });

    /* chapter:verse — the colon is the part engines mangle most.
       A comma after the book name gives the engine a natural pause. */
    text = text.replace(/(\w)\s+(\d{1,3}):(\d{1,3})\b/g, function (_, pre, ch, vs) {
      return pre + ', chapter ' + intToWords(parseInt(ch, 10)) +
        ', verse ' + intToWords(parseInt(vs, 10));
    });
    /* a bare chapter:verse with no book before it */
    text = text.replace(/\b(\d{1,3}):(\d{1,3})\b/g, function (_, ch, vs) {
      return 'chapter ' + intToWords(parseInt(ch, 10)) +
        ', verse ' + intToWords(parseInt(vs, 10));
    });

    /* "Psalm 119" / "Psalm 23" — a bare chapter after a book name */
    text = text.replace(/\b(Psalm|Psalms)\s+(\d{1,3})\b/g, function (_, p, n) {
      return p + ' ' + intToWords(parseInt(n, 10));
    });

    return text;
  }

  /* "447–432 BC" -> "four forty-seven to four thirty-two B C"
     "2022–23" -> "two thousand twenty-two to twenty-three" */
  function expandRanges(text) {
    text = text.replace(/\b(\d{4})\s*[–—-]\s*(\d{2})\b/g, function (_, a, b) {
      return yearish(parseInt(a, 10)) + ' to ' + under1000(parseInt(b, 10));
    });
    return text.replace(/\b(\d{1,4})\s*[–—-]\s*(\d{1,4})\b/g, function (_, a, b) {
      return yearish(parseInt(a, 10)) + ' to ' + yearish(parseInt(b, 10));
    });
  }

  /* "586 BC" -> "five eighty-six B C"; "AD 79" -> "A D seventy-nine" */
  function expandEras(text) {
    text = text.replace(/\b(\d{1,4})\s*(BCE|BC|AD|CE)\b/g, function (_, n, era) {
      return yearish(parseInt(n, 10)) + ' ' + era.split('').join(' ');
    });
    text = text.replace(/\b(BCE|BC|AD|CE)\s+(\d{1,4})\b/g, function (_, era, n) {
      return era.split('').join(' ') + ' ' + yearish(parseInt(n, 10));
    });
    return text;
  }

  /* Any era token left over (e.g. after a range consumed the digits). */
  function expandStandaloneEras(text) {
    return text.replace(/\b(BCE|BC|AD|CE)\b/g, function (m) {
      return m.split('').join(' ');
    });
  }

  /* "c. 3500 BC" -> "circa thirty-five hundred B C" */
  function expandCirca(text) {
    return text.replace(/\bc\.\s*(?=\d)/gi, 'circa ');
  }

  /* "120,000" -> "one hundred twenty thousand" */
  function expandGroupedNumbers(text) {
    return text.replace(/\b\d{1,3}(?:,\d{3})+\b/g, function (m) {
      return intToWords(parseInt(m.replace(/,/g, ''), 10));
    });
  }

  /* "1340s" -> "thirteen forties"; "1900s" -> "nineteen hundreds";
     "40s" -> "forties" (a short decade, e.g. "the 1830s and 40s") */
  function expandDecades(text) {
    text = text.replace(/\b(\d{3,4})s\b/g, function (_, n) {
      var num = parseInt(n, 10);
      var hi = Math.floor(num / 100), lo = num % 100;
      if (lo === 0) return under1000(hi) + ' hundreds';
      return under1000(hi) + ' ' + TENS_PLURAL[Math.floor(lo / 10)] +
        (lo % 10 ? '-' + ONES[lo % 10] : '');
    });
    text = text.replace(/\b(\d{2})s\b/g, function (_, n) {
      var num = parseInt(n, 10);
      if (num % 10 === 0) return TENS_PLURAL[num / 10];
      return TENS[Math.floor(num / 10)] + '-' + ONES[num % 10] + 's';
    });
    return text;
  }

  /* "18th" -> "eighteenth" */
  function expandOrdinals(text) {
    return text.replace(/\b(\d+)(st|nd|rd|th)\b/gi, function (_, n) {
      return ordinalToWords(parseInt(n, 10));
    });
  }

  /* "E=mc²" -> "E equals m c squared"; "B&O" -> "B and O" */
  function expandSymbols(text) {
    text = text.replace(/²/g, ' squared').replace(/³/g, ' cubed');
    text = text.replace(/\s*=\s*/g, ' equals ');
    text = text.replace(/\s*&\s*/g, ' and ');
    text = text.replace(/\s*\/\s*/g, ' or ');
    text = text.replace(/\s*\+\s*/g, ' plus ');
    text = text.replace(/\s*%\s*/g, ' percent ');
    return text;
  }

  /* "Dr." -> "Doctor", "c." -> "circa", "St." -> "Saint".
     Only expands a period-abbreviation when the token is a known one,
     so ordinary sentence-ending periods are left alone. */
  function expandAbbreviations(text) {
    return text.replace(/\b([A-Za-z]{1,5})\.(?=\s|$)/g, function (m, w) {
      var key = w.toLowerCase();
      if (Object.prototype.hasOwnProperty.call(ABBREV, key)) {
        return ABBREV[key] + ' ';
      }
      return m;
    });
  }

  /* Bare 3-4 digit years read as years: "in 1066" -> "in ten sixty-six". */
  function expandBareYears(text) {
    return text.replace(/\b(\d{3,4})\b/g, function (m) {
      return yearish(parseInt(m, 10));
    });
  }

  /* "L2" -> "L two" — a single capital letter glued to a number. */
  function expandLetterNumbers(text) {
    return text.replace(/\b([A-Z])(\d{1,4})\b/g, function (_, letter, n) {
      return letter + ' ' + intToWords(parseInt(n, 10));
    });
  }

  /* Remaining small integers -> words. */
  function expandSmallNumbers(text) {
    return text.replace(/\b\d+\b/g, function (m) {
      return intToWords(parseInt(m, 10));
    });
  }

  /* "#6" / "#3" -> "jersey number six" in player quiz, or "number six" elsewhere
     (prevents TTS from reading "#" as "hashtag"). */
  function expandHashNumbers(text, opts) {
    if (opts && opts.jerseyHash) {
      return text.replace(/(?:\bjersey\s*(?:number|no\.?)?\s*|\b(?:number|no\.?)\s*)?#(\d{1,3})\b/gi, function (_, n) {
        return 'jersey number ' + intToWords(parseInt(n, 10));
      });
    }
    return text.replace(/(?:\b(?:number|no\.?)\s*)?#(\d{1,4})\b/gi, function (_, n) {
      return 'number ' + intToWords(parseInt(n, 10));
    });
  }

  /* ---------- main ---------- */

  function normalizeSpeech(input, opts) {
    if (input === null || typeof input === 'undefined') return '';
    var text = String(input);
    if (!text.trim()) return '';

    /* order matters: refs, ranges and eras consume the digits they
       need before the generic number passes run. */
    text = expandAcronymSlash(text);
    text = expandAcronyms(text);
    text = expandHashNumbers(text, opts);
    text = expandSymbols(text);
    text = expandCirca(text);
    text = expandNumberedBookRuns(text);
    text = expandVerseRefs(text);
    text = expandRanges(text);
    text = expandEras(text);
    text = expandStandaloneEras(text);
    text = expandGroupedNumbers(text);
    text = expandDecades(text);
    text = expandOrdinals(text);
    text = expandAbbreviations(text);
    text = expandBareYears(text);
    text = expandLetterNumbers(text);
    text = expandSmallNumbers(text);

    /* tidy: dashes become pauses, collapse whitespace, fix spacing */
    text = text.replace(/\s*[—–]\s*/g, ', ');
    text = text.replace(/\s+([,.;:!?])/g, '$1');
    text = text.replace(/\s{2,}/g, ' ');
    return text.trim();
  }

  /* Spoken form of a full question: announces arrival with "Next question.",
     then stem and each option with its letter. */
  function questionParts(q, opts) {
    if (!q) return [];
    var announceNext = !opts || opts.announceNext !== false;
    var parts = [];
    if (announceNext) parts.push('Next question.');
    parts.push(normalizeSpeech(q.q));
    (q.opts || []).forEach(function (o, i) {
      var letter = ['A', 'B', 'C', 'D'][i] || String(i + 1);
      parts.push(letter + '. ' + normalizeSpeech(o));
    });
    return parts.filter(function (p) { return p.replace(/\s+/g, ''); });
  }

  /* Spoken form of the reveal: the answer, then the reference, then
     the insight. */
  function revealParts(q) {
    if (!q) return [];
    var parts = [];
    var letter = ['A', 'B', 'C', 'D'][q.correct] || '';
    var answerText = (q.opts && q.opts[q.correct]) || '';
    parts.push('The answer is ' + letter + '. ' + normalizeSpeech(answerText));
    if (q.ref) parts.push('Reference: ' + normalizeSpeech(q.ref));
    if (q.insight) parts.push(normalizeSpeech(q.insight));
    return parts.filter(function (p) { return p.replace(/\s+/g, ''); });
  }

  function playerIntroParts(q, opts) {
    if (!q) return [];
    var announceNext = !opts || opts.announceNext !== false;
    var heading = q.question || 'Guess the player!';
    var parts = [];
    if (announceNext) parts.push('Next question.');
    parts.push(normalizeSpeech(heading, { jerseyHash: true }) + ' Listen carefully to the clues.');
    return parts;
  }

  function playerClueParts(clue, idx) {
    if (!clue) return [];
    return ['Clue ' + intToWords(idx + 1) + '. ' + normalizeSpeech(clue, { jerseyHash: true })];
  }

  function playerCountdownParts(secs) {
    return ['You have ' + intToWords(secs) + ' seconds. Drop your answer in the comments!'];
  }

  function playerRevealParts(q, player) {
    if (!q) return [];
    var name = (q.reveal_text || (player && player.name) || '').trim();
    var parts = ['The correct answer is ' + normalizeSpeech(name, { jerseyHash: true }) + '!'];
    if (player && player.club && player.nationality) {
      parts.push(normalizeSpeech(player.club + ', ' + player.nationality + '.', { jerseyHash: true }));
    }
    if (q.insight) parts.push(normalizeSpeech(q.insight, { jerseyHash: true }));
    return parts.filter(function (p) { return p.replace(/\s+/g, ''); });
  }

  function milestoneParts(roundNum, answers, kind) {
    var parts = ['Round ' + intToWords(roundNum) + ' complete!'];
    if (answers && answers.length) {
      parts.push('Check the last ' + intToWords(answers.length) + ' answers on screen and tally your score.');
    }
    if (kind === 'quiz' || kind === 'bible' || kind === 'history') {
      parts.push('Nine to ten is Master Scholar, seven to eight is Honor Roll, five to six is Faithful Learner, and zero to four is Warm Up. Drop your score in the live chat!');
    } else {
      parts.push('Nine to ten is World Class, seven to eight is Champions League Starter, five to six is First Team, and zero to four is Academy. Drop your rank in the live chat!');
    }
    return parts;
  }

  function storyIntroParts(episode) {
    if (!episode) return [];
    var parts = ['Documentary feature: ' + normalizeSpeech(episode.title) + '.'];
    if (episode.subtitle) parts.push(normalizeSpeech(episode.subtitle));
    if (episode.centralQuestion) parts.push(normalizeSpeech(episode.centralQuestion));
    return parts.filter(function (p) { return p.replace(/\s+/g, ''); });
  }

  function storySceneParts(scene, act, isNewAct) {
    if (!scene) return [];
    var parts = [];
    if (isNewAct && act) {
      parts.push('Act ' + intToWords(act.actNum || 1) + ': ' + normalizeSpeech(act.title) + '.');
      if (act.hook) parts.push(normalizeSpeech(act.hook));
    }
    if (scene.narration) parts.push(normalizeSpeech(scene.narration));
    if (scene.visual && scene.visual.quote) {
      parts.push(normalizeSpeech(scene.visual.quote));
    }
    if (scene.engagement) {
      parts.push(normalizeSpeech(scene.engagement));
    }
    return parts.filter(function (p) { return p.replace(/\s+/g, ''); });
  }

  function storyOutroParts(episode) {
    if (!episode) return [];
    var parts = ['In summary: ' + normalizeSpeech(episode.takeaway || '')];
    parts.push('Stay tuned as the next documentary chapter begins shortly.');
    return parts.filter(function (p) { return p.replace(/\s+/g, ''); });
  }

  window.LNR_SPEECH = {
    normalizeSpeech: normalizeSpeech,
    questionParts: questionParts,
    revealParts: revealParts,
    playerIntroParts: playerIntroParts,
    playerClueParts: playerClueParts,
    playerCountdownParts: playerCountdownParts,
    playerRevealParts: playerRevealParts,
    milestoneParts: milestoneParts,
    storyIntroParts: storyIntroParts,
    storySceneParts: storySceneParts,
    storyOutroParts: storyOutroParts,
    intToWords: intToWords,
    yearToWords: yearToWords,
    yearish: yearish,
    ordinalToWords: ordinalToWords
  };
})();
