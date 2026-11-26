/* ============================================================
   lnr Studio — timer edition · engine
   Zero-server. Everything persists in localStorage + IndexedDB.

   Engines
   -------
   The studio now runs two separate engines:
     quiz  — Bible / World History banks, non-repeating shuffle bag,
             per-question countdown, voice reader.
     video — the prerecorded clip, looped for a chosen playback length.
   The promo break belongs to neither: it runs between blocks on both,
   so the rotation is  block → promo → block  where "block" is whatever
   engine is selected.

   Model
   -----
   bank      : { bible: [Q], history: [Q] }
   Q         : { q, opts:[4], correct:0-3, ref, insight, level }
   bag       : per-segment shuffled queue of bank indices (non-repeating)
   phase     : 'quiz' | 'promo' | 'video'; phaseEndsAt is a timestamp
   ============================================================ */
(function () {
  'use strict';

  /* ---------- small helpers ---------- */
  var $ = function (id) { return document.getElementById(id); };
  var on = function (el, ev, fn) { if (el) el.addEventListener(ev, fn); };
  var now = function () { return Date.now(); };

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function clock(ms) {
    if (ms < 0) ms = 0;
    var total = Math.floor(ms / 1000);
    var h = Math.floor(total / 3600);
    var m = Math.floor((total % 3600) / 60);
    var s = total % 60;
    return h > 0 ? h + ':' + pad(m) + ':' + pad(s) : pad(m) + ':' + pad(s);
  }

  function sessionClock(ms) {
    var total = Math.floor(ms / 1000);
    return pad(Math.floor(total / 3600)) + ':' + pad(Math.floor((total % 3600) / 60)) + ':' + pad(total % 60);
  }

  var STORE = 'lnr_timer_v2';

  /* ---------- settings ---------- */
  var DEFAULT_WATERMARK = 'LNR';
  /* The site line is an address printed on the stage, not a link. No protocol
     and no trailing slash, so the whole host fits the one-line stage slot. */
  var DEFAULT_SITE = 'lnr-storytelling-hub.vercel.app';
  var DEFAULT_BRAND = 'LNR STUDIO';
  var DEFAULT_SITECTA = 'Run your own stream';
  /* Where a customer buys Pro. The pricing button opens this and nothing else. */
  var PRO_CHECKOUT_URL = 'https://selar.com/399774111a';

  var defaults = {
    engine: 'quiz',
    segment: 'bible',
    quizMin: 60,
    videoMin: 1,         /* legacy compat alias; break duration comes from promoAdSec */
    promoAdsEnabled: false,
    promoAdSec: 30,      /* fallback 1-break slot length (15-300s) when no clip uploaded */
    promoIntervalMin: 10, /* minimum uninterrupted quiz minutes before triggering a break after milestone */
    qSec: 10,
    loopHours: 2,        /* video engine playback length */
    playerBlockMin: 60,  /* player quiz block length */
    clueSec: 6,          /* pause/step per clue */
    guessSec: 12,        /* comment countdown window */
    playerRevealSec: 6,  /* answer reveal hold */
    milestoneSec: 30,    /* every-10-questions self-score board */
    playerMode: 'all',   /* 'all' | 'clues' | 'visual' */
    storyBlockMin: 60,   /* documentary storytelling block length */
    storySceneSec: 8,    /* hold seconds after narrator completes a story beat */
    storyCat: 'all',     /* 'all' | 'world-history' | 'biblical' */
    storyStartId: '',    /* optional selected starter episode id */
    storySpeechMode: 'episode', /* 'episode' | 'step' for uploaded narrator audio */
    storyInterleave: true,   /* run 2 rapid trivia questions after each Hook-Loop case */
    storyVaryCadence: true,  /* rotate palette, archetype cadence & ambient bed per case */
    chatSafe: true,      /* keep player content in upper ~68% above live chat/typing */
    chatGuide: false,    /* show preview dashed boundary line */
    brand: DEFAULT_BRAND, /* brand strap across the break */
    promoDisplayMode: 'full',      /* 'full' | 'pip' | 'split' */
    promoOrder: 'sequential',      /* 'sequential' | 'shuffle' */
    promoOverlayStyle: 'disclosure', /* 'disclosure' | 'clean-brand' | 'raw' */
    autoRotate: true,
    music: 'lnr_stream_bed',
    musicVol: 35,
    sfxOn: true,
    voiceOn: true,
    voiceReveal: true,
    voiceName: '',
    voiceRate: 0.96,
    watermark: DEFAULT_WATERMARK,
    site: DEFAULT_SITE,
    siteCta: DEFAULT_SITECTA,
    safeDefault: false,
    /* Which question bank the timer reads from:
       'builtin'  — the shipped Bible / World History packs
       'uploaded' — the JSON pack the creator imported on this device
       Only meaningful once an upload exists; otherwise it falls back. */
    questionSource: 'builtin',
    isPro: false
  };

  var S = {};
  try { S = JSON.parse(localStorage.getItem(STORE) || '{}') || {}; } catch (e) { S = {}; }
  Object.keys(defaults).forEach(function (k) {
    if (typeof S[k] === 'undefined' || S[k] === null) S[k] = defaults[k];
  });
  /* Older saves kept the full URL (https://host/). The stage shows the site
     line in a single ellipsised row, so a protocol only pushes the host out
     of view — reduce every stored value to the bare host. */
  S.site = normalizeSite(S.site) || DEFAULT_SITE;
  if (S.site === 'www.lnrstudio.com') S.site = DEFAULT_SITE;
  if (S.promoOverlayStyle === 'youtube-ad') S.promoOverlayStyle = 'disclosure';
  /* One-time move to the upbeat bed. Anyone who never touched the music
     setting was on the old calm default; carry them to the new one, but
     leave a deliberate choice (Moment Of Truth / No music) alone. */
  if (!S.__bedMigrated) {
    if (S.music === 'all_eyes_on_us') S.music = 'lnr_stream_bed';
    S.__bedMigrated = true;
  }

  function clampNumSetting(key, min, max) {
    var n = Number(S[key]);
    if (!isFinite(n) || isNaN(n)) n = defaults[key];
    S[key] = Math.max(min, Math.min(max, n));
  }
  clampNumSetting('quizMin', 5, 240);
  clampNumSetting('promoAdSec', 15, 300);
  clampNumSetting('promoIntervalMin', 5, 60);
  clampNumSetting('qSec', 5, 90);
  clampNumSetting('loopHours', 0.1, 168);
  clampNumSetting('playerBlockMin', 10, 240);
  clampNumSetting('clueSec', 3, 20);
  clampNumSetting('guessSec', 5, 45);
  clampNumSetting('playerRevealSec', 3, 20);
  clampNumSetting('milestoneSec', 10, 60);
  clampNumSetting('storyBlockMin', 10, 240);
  clampNumSetting('storySceneSec', 4, 30);
  clampNumSetting('musicVol', 0, 100);
  clampNumSetting('voiceRate', 0.7, 1.3);
  if (S.engine !== 'quiz' && S.engine !== 'players' && S.engine !== 'video' && S.engine !== 'story') S.engine = defaults.engine;
  if (S.segment !== 'bible' && S.segment !== 'history') S.segment = defaults.segment;
  if (S.storyCat !== 'all' && S.storyCat !== 'world-history' && S.storyCat !== 'biblical') S.storyCat = 'all';
  if (S.storySpeechMode !== 'episode' && S.storySpeechMode !== 'step') S.storySpeechMode = 'episode';
  if (S.promoDisplayMode !== 'full' && S.promoDisplayMode !== 'pip' && S.promoDisplayMode !== 'split') S.promoDisplayMode = 'full';
  if (S.promoOrder !== 'sequential' && S.promoOrder !== 'shuffle') S.promoOrder = 'sequential';
  if (S.promoOverlayStyle !== 'disclosure' && S.promoOverlayStyle !== 'clean-brand' && S.promoOverlayStyle !== 'raw') S.promoOverlayStyle = 'disclosure';
  if (S.questionSource !== 'builtin' && S.questionSource !== 'uploaded') S.questionSource = 'builtin';
  if (S.music !== 'lnr_stream_bed' && S.music !== 'all_eyes_on_us' && S.music !== 'moment_of_truth' && S.music !== 'off') S.music = defaults.music;

  function save() {
    try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) {}
    var tag = $('savedTag');
    if (tag) {
      tag.textContent = 'Saved on this device';
      window.setTimeout(function () { tag.textContent = 'All changes saved on this device'; }, 1400);
    }
  }

  /* ---------- studio limits & cross-session repeat protection ---------- */
  var MAX_VIDEOS = 12;
  var MAX_PROMOS = 5;
  var MAX_BAG_HISTORY = 1500;
  var POST_READ_COUNTDOWN_MS = 10000; /* 10s post-read countdown before answer reveal */
  var BAG_HIST_KEY = 'lnr_timer_bag_hist_v1';
  var LEGACY_HASH_KEY = 'lnr_played_hashes_v1';

  /* ---------- played-question hash memory (prevents cross-session repetition up to 1,500 items) ---------- */
  var playedHashes = [];
  var playedHashSet = {};
  try {
    var savedHashes = JSON.parse(localStorage.getItem(BAG_HIST_KEY) || localStorage.getItem(LEGACY_HASH_KEY) || '[]');
    if (Array.isArray(savedHashes)) {
      playedHashes = savedHashes.slice(-MAX_BAG_HISTORY);
      playedHashes.forEach(function (h) { playedHashSet[h] = 1; });
    }
  } catch (e) {}

  function qNormKey(text) {
    return String(text || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  var STOP_WORDS = {
    the: 1, a: 1, an: 1, of: 1, in: 1, to: 1, is: 1, was: 1, are: 1, were: 1,
    for: 1, on: 1, by: 1, with: 1, at: 1, from: 1, who: 1, what: 1, which: 1, where: 1, when: 1, did: 1, does: 1
  };

  function qTokens(text) {
    return qNormKey(text).split(' ').filter(function (w) { return w.length >= 2 && !STOP_WORDS[w]; });
  }

  function isNearDuplicate(text, existingKeys, existingTokenLists) {
    var norm = qNormKey(text);
    if (!norm) return true;
    if (existingKeys[norm]) return true;
    var tok = qTokens(text);
    if (tok.length < 4 || !existingTokenLists || !existingTokenLists.length) return false;
    var tokSet = {};
    tok.forEach(function (w) { tokSet[w] = 1; });
    for (var i = 0; i < existingTokenLists.length; i++) {
      var prev = existingTokenLists[i];
      if (!prev || prev.length < 4) continue;
      var inter = 0;
      for (var j = 0; j < prev.length; j++) {
        if (tokSet[prev[j]]) inter++;
      }
      var union = tok.length + prev.length - inter;
      if (union > 0 && (inter / union) >= 0.82) return true;
    }
    return false;
  }

  function recordPlayedHash(qText) {
    var norm = qNormKey(qText);
    if (!norm) return;
    if (!playedHashSet[norm]) {
      playedHashSet[norm] = 1;
      playedHashes.push(norm);
      if (playedHashes.length > MAX_BAG_HISTORY) {
        var dropped = playedHashes.shift();
        if (dropped) delete playedHashSet[dropped];
      }
      try { localStorage.setItem(BAG_HIST_KEY, JSON.stringify(playedHashes)); } catch (e) {}
    }
  }

  /* ---------- question banks ---------- */
  var SEGMENTS = { bible: 'Bible / Faith', history: 'World History / Trivia' };

  function normalise(t) {
    if (Array.isArray(t)) {
      return { q: t[0], opts: t[1], correct: t[2], ref: t[3], insight: t[4], level: t[5] || 'Medium' };
    }
    return t;
  }

  var bank = { bible: [], history: [] };
  var usingDemo = { bible: false, history: false };

  /* custom (imported) questions, persisted separately so a bank update never wipes them */
  var CUSTOM_KEY = 'lnr_custom_bank_v2';
  var custom = { bible: [], history: [] };
  try {
    var c = JSON.parse(localStorage.getItem(CUSTOM_KEY) || 'null');
    if (c && c.bible && c.history) custom = c;
  } catch (e) {}

  /* True when this device holds at least one imported question. */
  function hasUploadedBank() {
    return (Array.isArray(custom.bible) && custom.bible.length > 0) ||
           (Array.isArray(custom.history) && custom.history.length > 0);
  }

  /* The source the timer should actually read from. 'uploaded' is only
     honoured while an upload exists, so a cleared import can never leave the
     studio with an empty bank. */
  function effectiveQuestionSource() {
    return (S.questionSource === 'uploaded' && hasUploadedBank()) ? 'uploaded' : 'builtin';
  }

  function rebuildQuizBanks() {
    var builtIn = window.LNR_BUILT_IN_BANKS || {};
    var demoSource = window.LNR_DEMO || {};
    var source = effectiveQuestionSource();
    ['bible', 'history'].forEach(function (seg) {
      var list = [];
      var seen = {};
      var builtInList = Array.isArray(builtIn[seg]) ? builtIn[seg] : [];
      var customList = Array.isArray(custom[seg]) ? custom[seg] : [];
      usingDemo[seg] = false;

      /* Uploaded source: the creator's own pack is the whole bank. */
      if (source === 'uploaded') {
        customList.forEach(function (q) {
          if (!q || !q.q) return;
          var key = qNormKey(q.q);
          if (!seen[key]) { seen[key] = 1; list.push(q); }
        });
        bank[seg] = list;
        bags[seg] = [];
        return;
      }

      /* Built-in source: the shipped packs only. The uploaded pack is a
         separate source, chosen with the toggle — not merged in, so the two
         options really are different banks. */
      builtInList.forEach(function (raw) {
        var q = normalise(raw);
        if (!q || !q.q) return;
        var key = qNormKey(q.q);
        if (!seen[key]) { seen[key] = 1; list.push(q); }
      });

      if (!list.length && Array.isArray(demoSource[seg])) {
        usingDemo[seg] = true;
        demoSource[seg].forEach(function (raw) {
          var q = normalise(raw);
          if (!q || !q.q) return;
          var key = qNormKey(q.q);
          if (!seen[key]) { seen[key] = 1; list.push(q); }
        });
      }
      bank[seg] = list;
      bags[seg] = [];
    });
  }

  function saveCustom() {
    try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(custom)); } catch (e) {}
  }

  /* ---------- non-repeating shuffle bag ---------- */
  var bags = { bible: [], history: [] };
  var lastServed = { bible: -1, history: -1 };

  rebuildQuizBanks();

  function effectivePromoIntervalMin() {
    return Math.max(5, Math.min(60, Number(S.promoIntervalMin) || 10));
  }

  function effectivePromoAdSec() {
    return Math.max(15, Math.min(300, Number(S.promoAdSec) || 30));
  }

  function refill(seg) {
    var unseen = [];
    var seen = [];
    for (var i = 0; i < bank[seg].length; i++) {
      var k = qNormKey(bank[seg][i] && bank[seg][i].q);
      if (playedHashSet[k]) seen.push(i);
      else unseen.push(i);
    }
    shuffle(unseen);
    shuffle(seen);
    /* .pop() pulls from end — put seen at index 0.. and unseen at the end so unseen draw first */
    var idxs = seen.concat(unseen);
    if (idxs.length > 1 && idxs[idxs.length - 1] === lastServed[seg]) {
      var t = idxs[idxs.length - 1];
      idxs[idxs.length - 1] = idxs[0];
      idxs[0] = t;
    }
    bags[seg] = idxs;
  }

  function draw(seg) {
    if (!bank[seg].length) return null;
    if (!bags[seg].length) refill(seg);
    var idx = bags[seg].pop();
    lastServed[seg] = idx;
    if (bank[seg][idx]) recordPlayedHash(bank[seg][idx].q);
    return idx;
  }

  /* ---------- live state ---------- */
  var live = {
    running: false,
    phase: 'quiz',
    phaseEndsAt: 0,
    phaseLen: 0,
    startedAt: 0,
    paused: false,
    pausedAt: 0,
    qIndex: -1,
    qEndsAt: 0,
    qRemaining: 0,
    revealed: false,
    qRecorded: false,
    inSession: false,
    served: 0,
    clipIndex: 0,
    quizMilestone: false,
    quizMilestoneStartedAt: 0,
    quizMilestoneEndsAt: 0,
    quizRoundNum: 1,
    quizRoundAnswers: [],
    quizActiveMs: 0,
    lastTickAt: 0,
    promoStartedAt: 0,
    preAdPending: false,
    preAdReturnPhase: '',
    preAdStartedAt: 0,
    preAdEndsAt: 0,
    promoReturnPhase: '',
    promoCursor: 0,
    activeAdLog: null,
    waitingForSpeech: false,
    lastTickCueSec: -1,
    storyBurstRemaining: 0,
    storyBurstTotal: 0,
    storyBurstReturn: false
  };

  var bagHistory = [];

  /* ---------- elements ---------- */
  var el = {};
  [
    'screenSetup', 'screenStage', 'statBank', 'statRun', 'startBtn', 'openSettingsBtn',
    'startLabel', 'startHint', 'startSummary', 'brandHome', 'savedTag',
    'quickStart', 'topbarStartBtn',
    /* multi-page views & wizard */
    'pageHome', 'pageStudio', 'pagePricing', 'pageSettings', 'pageContact',
    'pricingFreeBtn', 'pricingProBtn',
    'homeGoStudioBtn',
    'wizContextTag', 'wizTab1', 'wizTab2', 'wizTab3',
    'wizStep1', 'wizStep2', 'wizStep3', 'wizStep2Title',
    'wizToStep2Btn', 'wizChangeEngineBtn', 'wizBackTo1Btn', 'wizToStep3Btn', 'wizBackTo2Btn',
    /* dedicated settings page controls */
    'stVoiceTag', 'stVoiceOn', 'stVoiceReveal', 'stVoiceSelect', 'stVoiceRate', 'stVoiceRateLabel',
    'stMusicTag', 'stMusicGrid', 'stMusicVol', 'stMusicVolLabel', 'stSfxOn',
    'stAudioInput', 'stAudioName', 'stAudioPreviewBtn', 'stAudioClearBtn',
    'stAutoRotate', 'stSafeDefault', 'stChatSafe', 'stChatGuide',
    'stWatermarkInput', 'stSiteInput', 'stBrandOverlayInput', 'stViewLogsBtn', 'stExportCsvBtn',
    /* engine picker */
    'engQuiz', 'engPlayers', 'engVideo', 'engStory',
    'engQuizCount', 'engPlayersCount', 'engVideoCount', 'engStoryCount',
    'engQuizRun', 'engPlayersRun', 'engVideoRun', 'engStoryRun',
    'quizSetup', 'playersSetup', 'videoSetup', 'storySetup', 'promoSetup',
    /* storytelling setup */
    'storyCatalogNotice', 'storyCatAll', 'storyCatHistory', 'storyCatBiblical',
    'storyCatAllCount', 'storyCatHistoryCount', 'storyCatBiblicalCount',
    'setupStoryMin', 'setupStorySceneSec', 'setupStoryInterleave', 'setupStoryVaryCadence',
    'storySceneTag', 'storyEpisodeList',
    'setupStorySpeechInput', 'setupStorySpeechMode', 'storySpeechStatus', 'storySpeechPreviewBtn', 'storySpeechClearBtn', 'storySpeechList',
    'setupStoryImportInput', 'dlStoryTemplateBtn', 'copyStoryPromptBtn', 'storyClearBtn', 'storyImportResult',
    /* quiz guide & segment */
    'quizPrivateNotice', 'quizTierLimitNote', 'segBible', 'segHistory', 'countBible', 'countHistory', 'runBible', 'runHistory',
    'setupQuizImportInput', 'dlQuizTemplateBtn', 'copyQuizPromptBtn', 'setupImportResult',
    'qSourceRow', 'qSourceHint', 'qSourceBuiltin', 'qSourceUploaded',
    'qSourceBuiltinCount', 'qSourceUploadedCount',
    'setupQuizMin', 'setupQSec',
    /* player quiz setup & card library */
    'playerPrivateNotice', 'playerTierLimitNote',
    'pmodeAll', 'pmodeClues', 'pmodeVisual', 'pmodeAllCount',
    'setupPlayerMin', 'setupClueSec', 'setupGuessSec', 'setupPlayerRevealSec', 'setupMilestoneSec',
    'setupChatSafe', 'setupChatGuide',
    'plPersistTag', 'plStatPlayers', 'plStatFormat', 'plStatQuizzes', 'plStatStorage',
    'plQuizJsonInput', 'dlPlayerTemplateBtn', 'copyPlayerPromptBtn', 'plClearBtn',
    'plStatus', 'plSearchInput', 'plSearchResults',
    /* video engine */
    'videoDrop', 'videoInput', 'videoTierLimitNote', 'loadDemoVideoBtn', 'demoVideoStatus',
    'ownVideoBtn', 'refVideoBtn', 'videoOwnershipTag',
    'videoPreroll', 'videoPrerollBar', 'videoPrerollTimer', 'videoPrerollVoice',
    'clipList', 'clipCount', 'loopCalc', 'loopMath',
    'lmDuration', 'lmLoops', 'lmTotal', 'loopPresets', 'loopHours', 'loopNote', 'loopClipInfo',
    /* promo / breaks */
    'setupPromoSwitchRow', 'setupPromoEnabled', 'promoToggleMeta', 'promoConfigWrap', 'promoTierLimitNote',
    'promoFreqControls',
    'promoDrop', 'promoInput', 'promoList', 'promoCount', 'setupPromoIntervalMin', 'promoAdRange', 'promoAdLabel',
    'promoCalc', 'promoNote', 'openAnalyticsBtn',
    /* contact */
    'copyContactTemplateBtn', 'contactFormBtn',
    /* stage */
    'onairPill', 'sessionClock', 'phaseName', 'phaseTime', 'phaseFill', 'phaseMeter',
    'rotateBtn', 'safeBtn', 'settingsBtn', 'exitBtn', 'broadcastBtn',
    'frame', 'frameInner', 'segLabel', 'counter', 'frameTimer', 'quizStage', 'qKicker', 'qText',
    'options', 'reveal', 'revealAnswer', 'revealRef', 'revealNote',
    'playerStage', 'plStageBadge', 'plCountdownPill', 'plHeadline', 'plCluesList',
    'plRevealMeta', 'plRevealName', 'plRevealSub', 'plRevealInsight',
    'plVisualCol', 'plCardFrame', 'plMysteryCover', 'plMysteryLabel', 'plPhoto', 'plCardTag',
    'chatSafeGuide',
    'milestoneStage', 'msRoundBadge', 'msTitle', 'msTimer', 'msGrid',
    'msGrades', 'msGrade0', 'msGrade1', 'msGrade2', 'msGrade3', 'msCta',
    'storyStage', 'storyActPill', 'storyEpTitle', 'storyDisclaimerTag', 'storyPhaseCountdown', 'storyActRail',
    'storyCanvas', 'storyVisualHost', 'storyNarrationBox', 'storyNarrationText',
    'videoStage', 'stageVideo', 'stageVideoB', 'demoVideoCanvas', 'videoEmpty', 'videoEmptyTitle', 'videoEmptyNote',
    'promoAdOverlay', 'promoAdBadge', 'promoAdTitle', 'promoAdClock', 'promoAdReturn', 'promoUnmuteBtn', 'videoUnmuteBtn',
    'promoFunnel', 'promoFunnelImg', 'promoFunnelKicker', 'promoFunnelTitle', 'promoFunnelCopy',
    'promoFunnelUrl', 'promoFunnelClock',
    'adNotice', 'adNoticeBadge', 'adNoticeTitle', 'adNoticeSub', 'adNoticeTimer', 'adNoticeFill',
    'stageNotice', 'stageNoticePill', 'stageNoticeText',
    'promoBrand', 'promoBrandText', 'loopBadge', 'loopBadgeText',
    'progFill', 'watermark', 'frameSite', 'frameCtaLead', 'curtain', 'safePeek',
    'stSiteCtaInput',
    'prevBtn', 'playBtn', 'playGlyph', 'revealToggleBtn', 'nextBtn',
    'voiceBtn', 'musicBtn', 'kbdHint',
    /* dev panel */
    'devPanel', 'devPanelClose', 'devBody', 'devNextQ', 'devReveal', 'devRotate',
    'devSafe', 'devRedraw',
    /* drawer */
    'drawer', 'drawerClose', 'drawerPromoTag', 'drawerPromoSwitchRow', 'promoEnabledDrawer',
    'quizMin', 'promoIntervalMin', 'promoSec', 'qSec', 'autoRotate',
    'musicGrid', 'musicVol', 'musicVolLabel', 'sfxOn',
    'audioInput', 'audioName', 'audioPreviewBtn', 'audioClearBtn',
    'storyMin', 'storySceneSec', 'drawerStoryTag', 'drawerStoryInterleave', 'drawerStoryVaryCadence',
    'drawerStorySpeechInput', 'drawerStorySpeechName', 'drawerStorySpeechClearBtn',
    'loopHoursDrawer', 'brandOverlayInput',
    'bankTag', 'pillBible', 'pillHistory', 'pillBibleCount', 'pillHistoryCount', 'quizBankSection',
    'importInput', 'importResult', 'voiceOn', 'voiceReveal', 'voiceSelect', 'voiceRate',
    'voiceRateLabel',
    'drawerPlayerTag', 'playerBlockMin', 'clueSec', 'guessSec', 'playerRevealSec',
    'milestoneSec', 'drawerChatSafe', 'drawerChatGuide',
    'watermarkInput', 'siteInput', 'siteCtaInput', 'safeDefault',
    'sponsorAnalyticsSection', 'alTotalCount', 'alTotalDuration',
    'alLogList', 'alExportCsvBtn', 'alClearBtn',
    /* studio operator modal */
    'accessModal', 'accessModalClose', 'panelAdmin',
    'adminToolsBox', 'adminPromoCountTag', 'adminPromoDisplay', 'adminPromoOrder', 'adminPromoOverlay',
    'adminPromoFolderInput', 'adminPromoFilesInput', 'syncPublicPromosBtn', 'adminPromoList',
    'scrim', 'toasts'
  ].forEach(function (id) { el[id] = $(id); });

  /* ---------- toast ---------- */
  /** Bare host for the site line: no protocol, no trailing slash. */
  function normalizeSite(value) {
    return String(value == null ? '' : value)
      .trim()
      .replace(/^https?:\/\//i, '')
      .replace(/^\/\//, '')
      .replace(/\/+$/, '')
      .slice(0, 42);
  }

  /**
   * The tier the studio is actually licensed for.
   *
   * pro/license.ts owns this answer (a verified key or the owner device). The
   * engine only reads it — a button click can never grant Pro.
   */
  function currentProTier() {
    try {
      if (window.LNR_PRO && typeof window.LNR_PRO.isPro === 'function') {
        return !!window.LNR_PRO.isPro();
      }
    } catch (e) {
      /* licence bridge not ready: treat the device as Free */
    }
    return false;
  }

  /** Send a plan button to the secure checkout (never to a local unlock). */
  function openProCheckout() {
    try {
      window.open(PRO_CHECKOUT_URL, '_blank', 'noopener,noreferrer');
      toast('Opening secure checkout. Activate your Pro key in the Pro panel after payment.');
    } catch (e) {
      toast('Subscribe at ' + PRO_CHECKOUT_URL + ', then activate your Pro key.');
    }
    // Existing Selar checkout surface.
    try {
      if (window.LNR_TRACK && typeof window.LNR_TRACK === 'function') {
        window.LNR_TRACK('selar_open');
        window.LNR_TRACK('upgrade_click', { location: 'pro_checkout_button' });
      }
    } catch (e) {}
  }

  function toast(msg, bad) {
    if (!el.toasts) return;
    var t = document.createElement('div');
    t.className = 'toast' + (bad ? ' is-bad' : '');
    t.textContent = msg;
    el.toasts.appendChild(t);
    window.setTimeout(function () {
      t.style.opacity = '0';
      t.style.transition = 'opacity .3s ease';
      window.setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 320);
    }, 2600);
  }

  /* ---------- stage-awareness notices ----------
     A toast is operator feedback: small, brief, and easy to miss on a stream.
     These notices are for the audience — they say what is about to happen on
     the stage ("the quiz is about to start", "this anecdote is ending") and
     stay up long enough to be read. Each one fires once per stage, guarded by
     a key so a re-render or a paused tick cannot repeat it. */
  var stageNoticeTimer = 0;
  var stageNoticeShown = {};

  function showStageNotice(key, pill, text, holdMs) {
    if (!el.stageNotice) return;
    if (stageNoticeShown[key]) return;
    stageNoticeShown[key] = true;
    if (el.stageNoticePill) el.stageNoticePill.textContent = pill;
    if (el.stageNoticeText) el.stageNoticeText.textContent = text;
    el.stageNotice.hidden = false;
    if (stageNoticeTimer) window.clearTimeout(stageNoticeTimer);
    stageNoticeTimer = window.setTimeout(function () {
      stageNoticeTimer = 0;
      if (el.stageNotice) el.stageNotice.hidden = true;
    }, holdMs || 9000);
  }

  function clearStageNotice() {
    if (stageNoticeTimer) { window.clearTimeout(stageNoticeTimer); stageNoticeTimer = 0; }
    if (el.stageNotice) el.stageNotice.hidden = true;
  }

  /* Reset the once-per-stage guards when a new stage begins. */
  function resetStageNotices() {
    stageNoticeShown = {};
    clearStageNotice();
  }

  /* ---------- runtime estimates ---------- */
  function runtimeText(count) {
    /* a question occupies qSec plus the (now shorter) answer-reveal hold */
    var perQ = S.qSec + Math.max(1.2, Math.min(8, S.qSec * 0.4) - 5);
    var secs = count * perQ;
    var h = Math.floor(secs / 3600);
    var m = Math.round((secs % 3600) / 60);
    return '\u2248 ' + h + 'h ' + pad(m) + 'm';
  }

  function playerRuntimeSeconds(count) {
    if (!count) return 0;
    /* Intro (~3s) + 3 clues (~8.5s each incl. speech) + comment countdown + reveal (~8s) */
    var perQ = 3 + 3 * Math.max(S.clueSec, 7) + S.guessSec + Math.max(S.playerRevealSec, 7);
    var milestones = Math.floor(count / 10) * Math.max(S.milestoneSec, 30);
    return count * perQ + milestones;
  }

  function formatRuntimeText(secs) {
    var h = Math.floor(secs / 3600);
    var m = Math.round((secs % 3600) / 60);
    return '\u2248 ' + h + 'h ' + pad(m) + 'm';
  }

  function formatShortSec(secs) {
    secs = Math.max(1, Math.round(secs || 30));
    if (secs < 60) return secs + 's';
    var m = Math.floor(secs / 60);
    var s = secs % 60;
    return s ? (m + 'm ' + s + 's') : (m + ' min');
  }

  function refreshStats() {
    var b = bank.bible.length, h = bank.history.length;
    var pLib = window.LNR_PLAYERS;
    var pQuizzes = pLib ? pLib.getAllQuizzes(S.playerMode) : [];
    var pAllQuizzes = pLib ? pLib.getAllQuizzes('all') : [];
    var pPlayers = pLib ? pLib.getAllPlayers() : [];
    var pIsDemo = pLib && pLib.isDemoOnly ? pLib.isDemoOnly() : false;

    var sApi = window.LNR_STORIES;
    var sStats = sApi && sApi.getStats ? sApi.getStats() : { total: 0, builtIn: 0, custom: 0, worldHistory: 0, biblical: 0, totalBeats: 0, archetypes: 0 };
    var sFiltered = sApi ? sApi.getAllEpisodes(S.storyCat) : [];
    var sBeatCount = 0;
    sFiltered.forEach(function (ep) {
      sBeatCount += (ep.beats || []).length;
    });

    if (el.countBible) el.countBible.textContent = b + (usingDemo.bible ? ' (demo)' : '');
    if (el.countHistory) el.countHistory.textContent = h + (usingDemo.history ? ' (demo)' : '');
    if (el.runBible) el.runBible.textContent = b ? runtimeText(b) + (usingDemo.bible ? ' · demo' : '') : 'import JSON';
    if (el.runHistory) el.runHistory.textContent = h ? runtimeText(h) + (usingDemo.history ? ' · demo' : '') : 'import JSON';
    if (el.statBank) el.statBank.textContent = b + h + pAllQuizzes.length + sStats.total;

    var longest = Math.max(b, h);
    if (el.statRun) el.statRun.textContent = longest ? runtimeText(longest).replace('\u2248 ', '') : 'Ready';
    if (el.engQuizCount) el.engQuizCount.textContent = b + h;
    if (el.engQuizRun) {
      var quizUsingDemoOnly = usingDemo.bible && usingDemo.history;
      el.engQuizRun.textContent = quizUsingDemoOnly
        ? '5-question demo \u00b7 ready'
        : (longest ? (runtimeText(longest).replace('\u2248 ', '') + ' per segment') : 'import JSON to begin');
    }

    var pRunTxt = formatRuntimeText(playerRuntimeSeconds(pQuizzes.length)).replace('\u2248 ', '');
    if (el.engPlayersCount) el.engPlayersCount.textContent = pPlayers.length;
    if (el.engPlayersRun) {
      el.engPlayersRun.textContent = pIsDemo
        ? '5-card demo \u00b7 ready'
        : (pQuizzes.length ? (pRunTxt + ' unbroken') : 'import pack to begin');
    }
    if (el.pmodeAllCount) el.pmodeAllCount.textContent = pAllQuizzes.length;
    if (el.drawerPlayerTag) el.drawerPlayerTag.textContent = pQuizzes.length + (pIsDemo ? ' demo' : ' quizzes');

    if (el.engVideoCount) el.engVideoCount.textContent = clips.length;
    if (el.engVideoRun) {
      var per = playlistSeconds(clips);
      el.engVideoRun.textContent = per
        ? (clock(per * 1000) + ' \u00b7 ' + effectiveLoopHours() + 'h loop')
        : (demoVideoMode ? '15s demo active' : ('up to ' + MAX_VIDEOS + ' clips \u00b7 24/7 ready'));
    }

    if (el.engStoryCount) el.engStoryCount.textContent = sStats.total;
    if (el.engStoryRun) el.engStoryRun.textContent = sStats.total ? ((sStats.archetypes || 5) + ' archetypes \u00b7 ' + (sStats.totalBeats || 0) + ' beats') : 'Hook-Loop studio';
    if (el.storyCatAllCount) el.storyCatAllCount.textContent = sStats.total;
    if (el.storyCatHistoryCount) el.storyCatHistoryCount.textContent = sStats.worldHistory;
    if (el.storyCatBiblicalCount) el.storyCatBiblicalCount.textContent = sStats.biblical;
    if (el.storySceneTag) el.storySceneTag.textContent = sBeatCount + ' beats ready';
    if (el.drawerStoryTag) el.drawerStoryTag.textContent = sFiltered.length + ' cases';
    if (el.storyCatalogNotice) {
      el.storyCatalogNotice.textContent = sStats.builtIn + ' Built-in Cases' + (sStats.custom ? (' + ' + sStats.custom + ' Custom') : ' + Custom JSON');
    }

    if (el.pillBibleCount) el.pillBibleCount.textContent = b;
    if (el.pillHistoryCount) el.pillHistoryCount.textContent = h;
    if (el.bankTag) el.bankTag.textContent = (S.segment === 'bible' ? b : h) + (usingDemo[S.segment] ? ' demo' : ' loaded');

    var promoActive = !!S.promoAdsEnabled;
    var activePromos = effectivePromoList();
    var intervalMin = effectivePromoIntervalMin();
    var adSecEff = effectivePromoAdSec();
    var adDesc = !promoActive
      ? 'breaks off'
      : (activePromos.length
        ? ('1 break clip after milestone once ' + intervalMin + 'm+ uninterrupted quiz passes')
        : ('1 break slot (' + formatShortSec(adSecEff) + ') after milestone once ' + intervalMin + 'm+ quiz passes'));
    var plan = 'Your session runs 10-question ' + (S.segment === 'history' ? 'World History' : 'Bible') + ' rounds with graphic milestone cards' + (promoActive ? (', then ' + adDesc + '.') : ' (uninterrupted).');
    if (S.engine === 'players') {
      plan = 'Your session runs 10-question Player Quiz rounds with milestone grading cards' + (promoActive ? (', then ' + adDesc + '.') : ' (uninterrupted).');
    } else if (S.engine === 'story') {
      plan = 'Your session runs Hook-Loop cases (Anomaly Hook \u2192 3 Evidence Beats \u2192 Live Deduction Gate \u2192 Twist Commentary)' + (S.storyInterleave ? ' interleaved with 2 rapid trivia Qs' : '') + (promoActive ? (', plus breaks after ' + intervalMin + 'm+.') : ' (uninterrupted).');
    } else if (S.engine === 'video') {
      plan = promoActive
        ? ('Your session runs ' + effectiveLoopHours() + ' hr of video, then ' + (activePromos.length ? '1 break clip' : formatShortSec(adSecEff) + ' break slot') + ', on repeat.')
        : ('Your session runs ' + effectiveLoopHours() + ' hr of seamless video on repeat (breaks off).');
    }
    if (!S.autoRotate && promoActive) plan = 'Auto-rotation is off, so the studio stays on the current round until you press Rotate now.';
    if (el.startHint) el.startHint.textContent = plan;

    if (el.startSummary) {
      var segName = S.segment === 'history' ? 'World History' : 'Bible';
      if (S.engine === 'video') {
        el.startSummary.textContent = 'Video engine \u00b7 ' + effectiveLoopHours() + ' hr of video' + (promoActive ? ', then 1 partner break.' : ' (breaks off).');
      } else if (S.engine === 'players') {
        el.startSummary.textContent = 'Player quiz \u00b7 ' + pQuizzes.length + (pIsDemo ? ' demo cards' : ' quizzes') + ' \u00b7 milestones every 10 Qs' + (promoActive ? ' \u2192 break every ' + intervalMin + 'm+.' : ' \u00b7 uninterrupted.');
      } else if (S.engine === 'story') {
        el.startSummary.textContent = 'Storytelling engine \u00b7 ' + sFiltered.length + ' Hook-Loop cases' + (S.storyInterleave ? ' + 2 trivia Qs between cases' : '') + ' \u00b7 varied cadence.';
      } else {
        el.startSummary.textContent = 'Quiz engine \u00b7 ' + segName + (usingDemo[S.segment] ? ' (Demo)' : '') + ' \u00b7 milestones every 10 Qs' + (promoActive ? ' \u2192 break every ' + intervalMin + 'm+.' : ' \u00b7 uninterrupted.');
      }
    }
  }

  /* ---------- multi-page routing & 3-step studio wizard ---------- */
  var currentPage = 'home';
  var wizardStep = 1;

  function engineTitle(eng) {
    if (eng === 'players') return 'Player quiz';
    if (eng === 'video') return 'Video engine';
    if (eng === 'story') return 'Storytelling engine';
    return 'Quiz engine';
  }

  function setWizardStep(step) {
    wizardStep = step === 2 ? 2 : (step === 3 ? 3 : 1);
    [[el.wizStep1, 1], [el.wizStep2, 2], [el.wizStep3, 3]].forEach(function (pair) {
      if (pair[0]) pair[0].hidden = pair[1] !== wizardStep;
    });
    [[el.wizTab1, 1], [el.wizTab2, 2], [el.wizTab3, 3]].forEach(function (pair) {
      if (!pair[0]) return;
      pair[0].classList.toggle('is-active', pair[1] === wizardStep);
      pair[0].classList.toggle('is-done', pair[1] < wizardStep);
    });
    if (el.wizStep2Title) el.wizStep2Title.textContent = 'Configuring: ' + engineTitle(S.engine);
    if (el.wizContextTag) el.wizContextTag.textContent = engineTitle(S.engine) + ' selected';
  }

  function setPage(page, opts) {
    var target = (page === 'studio' || page === 'settings' || page === 'contact' || page === 'pricing') ? page : 'home';
    currentPage = target;
    [
      [el.pageHome, 'home'],
      [el.pageStudio, 'studio'],
      [el.pagePricing, 'pricing'],
      [el.pageSettings, 'settings'],
      [el.pageContact, 'contact']
    ].forEach(function (pair) {
      if (pair[0]) pair[0].hidden = pair[1] !== target;
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-page-link]'), function (lnk) {
      lnk.classList.toggle('is-active', lnk.getAttribute('data-page-link') === target);
    });
    if (!opts || opts.updateHash !== false) {
      var wantedHash = '#' + target;
      if (window.location.hash !== wantedHash && window.history && window.history.replaceState) {
        try { window.history.replaceState(null, '', wantedHash); } catch (e) {}
      }
    }
    if (!opts || opts.scroll !== false) {
      window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
    }
  }

  function resolveHashRoute(rawHash) {
    var h = String(rawHash || '').replace(/^#/, '').toLowerCase();
    if (h === 'studio') { setPage('studio', { updateHash: false }); return; }
    if (h === 'quizsetup' || h === 'playerssetup' || h === 'videosetup' || h === 'storysetup') {
      if (h === 'playerssetup') setEngine('players');
      else if (h === 'videosetup') setEngine('video');
      else if (h === 'storysetup') setEngine('story');
      else if (h === 'quizsetup') setEngine('quiz');
      setPage('studio', { updateHash: false });
      setWizardStep(2);
      return;
    }
    if (h === 'promosetup') {
      setPage('studio', { updateHash: false });
      setWizardStep(3);
      return;
    }
    if (h === 'settings') { setPage('settings', { updateHash: false }); return; }
    if (h === 'pricing') { setPage('pricing', { updateHash: false }); return; }
    if (h === 'contact') { setPage('contact', { updateHash: false }); return; }
    setPage('home', { updateHash: false });
  }

  function initRouting() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-page-link]'), function (lnk) {
      on(lnk, 'click', function (e) {
        if (e && e.preventDefault) e.preventDefault();
        var pg = lnk.getAttribute('data-page-link') || 'home';
        setPage(pg);
      });
    });
    [[el.wizTab1, 1], [el.wizTab2, 2], [el.wizTab3, 3]].forEach(function (pair) {
      on(pair[0], 'click', function () { setWizardStep(pair[1]); });
    });
    on(el.homeGoStudioBtn, 'click', function () { setPage('studio'); setWizardStep(1); });
    on(el.topbarStartBtn, 'click', function () { setPage('studio'); setWizardStep(1); });
    on(el.pricingProBtn, 'click', function () {
      if (window.LNR_TRACK && typeof window.LNR_TRACK === 'function') {
        try { window.LNR_TRACK('upgrade_click', { location: 'pricing_pro_btn' }); } catch (e) {}
      }
      openProCheckout();
    });
    on(el.pricingFreeBtn, 'click', function () {
      if (window.LNR_TRACK && typeof window.LNR_TRACK === 'function') {
        try { window.LNR_TRACK('upgrade_click', { location: 'pricing_free_btn' }); } catch (e) {}
      }
    });
    on(el.homeGoStudioBtn, 'click', function () {
      if (window.LNR_TRACK && typeof window.LNR_TRACK === 'function') {
        try { window.LNR_TRACK('upgrade_click', { location: 'home_start_studio' }); } catch (e) {}
      }
    });
    /* A licence activated (or removed) in the dock re-evaluates the tier. */
    window.addEventListener('lnr:pro-changed', function () {
      S.isPro = currentProTier();
      syncInputs();
    });
    on(el.wizToStep2Btn, 'click', function () { setWizardStep(2); });
    on(el.wizToStep3Btn, 'click', function () { setWizardStep(3); });
    on(el.wizBackTo1Btn, 'click', function () { setWizardStep(1); });
    on(el.wizChangeEngineBtn, 'click', function () { setWizardStep(1); });
    on(el.wizBackTo2Btn, 'click', function () { setWizardStep(2); });
    window.addEventListener('hashchange', function () {
      if (!live.inSession) resolveHashRoute(window.location.hash);
    });
    resolveHashRoute(window.location.hash);
  }

  /* ---------- engine selection ---------- */
  function setEngine(eng) {
    S.engine = eng;
    save();
    [[el.engQuiz, 'quiz'], [el.engPlayers, 'players'], [el.engVideo, 'video'], [el.engStory, 'story']].forEach(function (p) {
      if (!p[0]) return;
      var active = p[1] === eng;
      p[0].classList.toggle('is-selected', active);
      p[0].setAttribute('aria-checked', active ? 'true' : 'false');
    });
    if (el.quizSetup) el.quizSetup.hidden = eng !== 'quiz';
    if (el.playersSetup) el.playersSetup.hidden = eng !== 'players';
    if (el.videoSetup) el.videoSetup.hidden = eng !== 'video';
    if (el.storySetup) el.storySetup.hidden = eng !== 'story';
    /* The Bible / Faith and World History segment pills only mean something
       for the quiz engine. They used to render unconditionally in the drawer,
       so the video engine showed "Bible / Faith" as if it were the active
       category. Hide the whole section for every other engine. */
    if (el.quizBankSection) el.quizBankSection.hidden = eng !== 'quiz';
    /* Let the break-card graphic pack know which engine is in charge. The pack
       is a quiz / trivia / storytelling device: it must not be offered or
       applied in the video engine, which airs footage instead of a card. */
    try {
      window.dispatchEvent(new CustomEvent('lnr:engine-changed', { detail: { engine: eng } }));
    } catch (e) {}
    if (el.wizStep2Title) el.wizStep2Title.textContent = 'Configuring: ' + engineTitle(eng);
    if (el.wizContextTag) el.wizContextTag.textContent = engineTitle(eng) + ' selected';
    if (el.startLabel) {
      el.startLabel.textContent = eng === 'video'
        ? 'Start video session'
        : (eng === 'players' ? 'Start player quiz session'
          : (eng === 'story' ? 'Start storytelling broadcast' : 'Start quiz session'));
    }
    refreshStats();
    refreshAccessUI();
  }

  on(el.engQuiz, 'click', function () { setEngine('quiz'); setWizardStep(2); });
  on(el.engPlayers, 'click', function () { setEngine('players'); setWizardStep(2); });
  on(el.engVideo, 'click', function () { setEngine('video'); setWizardStep(2); });
  on(el.engStory, 'click', function () { setEngine('story'); setWizardStep(2); });

  /* ---------- segment selection ---------- */
  function setSegment(seg) {
    S.segment = seg;
    save();
    [[el.segBible, 'bible'], [el.segHistory, 'history']].forEach(function (p) {
      if (!p[0]) return;
      var active = p[1] === seg;
      p[0].classList.toggle('is-selected', active);
      p[0].setAttribute('aria-checked', active ? 'true' : 'false');
    });
    if (el.pillBible) el.pillBible.classList.toggle('is-selected', seg === 'bible');
    if (el.pillHistory) el.pillHistory.classList.toggle('is-selected', seg === 'history');
    refreshStats();
    refreshAccessUI();
  }

  on(el.segBible, 'click', function () { setSegment('bible'); });
  on(el.segHistory, 'click', function () { setSegment('history'); });
  on(el.pillBible, 'click', function () { setSegment('bible'); });
  on(el.pillHistory, 'click', function () { setSegment('history'); });

  /* ---------- settings inputs ---------- */
  function bindNum(input, key, min, maxOrFn, hook) {
    if (!input) return;
    function getMax() {
      return typeof maxOrFn === 'function' ? maxOrFn() : maxOrFn;
    }
    input.value = S[key];
    function commit() {
      var effMax = getMax();
      var v = parseInt(input.value, 10);
      if (isNaN(v)) v = defaults[key];
      v = Math.max(min, Math.min(effMax, v));
      input.value = v;
      S[key] = v;
      save();
      refreshStats();
      if (hook) hook();
    }
    input.addEventListener('input', function () {
      var effMax = getMax();
      var v = parseInt(input.value, 10);
      if (isNaN(v)) return;
      v = Math.max(min, Math.min(effMax, v));
      S[key] = v;
      save();
      refreshStats();
      if (hook) hook();
    });
    input.addEventListener('blur', commit);
    input.addEventListener('change', commit);
  }

  function maxBlockMins() {
    return 240;
  }

  function effectiveQuizMin() {
    var v = Number(S.quizMin) || 60;
    return Math.max(5, Math.min(240, v));
  }

  function effectivePlayerBlockMin() {
    var v = Number(S.playerBlockMin) || 60;
    return Math.max(10, Math.min(240, v));
  }

  function effectiveStoryBlockMin() {
    var v = Number(S.storyBlockMin) || 60;
    return Math.max(10, Math.min(240, v));
  }

  bindNum(el.setupQuizMin, 'quizMin', 5, maxBlockMins, function () { syncInputs(); });
  bindNum(el.setupQSec, 'qSec', 5, 90, function () { syncInputs(); });
  bindNum(el.quizMin, 'quizMin', 5, maxBlockMins, function () { syncInputs(); });
  bindNum(el.qSec, 'qSec', 5, 90, function () { syncInputs(); });
  bindNum(el.setupPromoIntervalMin, 'promoIntervalMin', 5, 60, function () { refreshPromoText(); syncInputs(); });
  bindNum(el.promoIntervalMin, 'promoIntervalMin', 5, 60, function () { refreshPromoText(); syncInputs(); });
  /* single partner break fallback slot (15-300 seconds) */
  bindNum(el.promoSec, 'promoAdSec', 15, 300, function () { refreshPromoText(); syncInputs(); });

  /* player quiz timing dials */
  bindNum(el.setupPlayerMin, 'playerBlockMin', 10, maxBlockMins, function () { syncInputs(); });
  bindNum(el.playerBlockMin, 'playerBlockMin', 10, maxBlockMins, function () { syncInputs(); });
  bindNum(el.setupClueSec, 'clueSec', 3, 20, function () { syncInputs(); });
  bindNum(el.clueSec, 'clueSec', 3, 20, function () { syncInputs(); });
  bindNum(el.setupGuessSec, 'guessSec', 5, 45, function () { syncInputs(); });
  bindNum(el.guessSec, 'guessSec', 5, 45, function () { syncInputs(); });
  bindNum(el.setupPlayerRevealSec, 'playerRevealSec', 3, 20, function () { syncInputs(); });
  bindNum(el.playerRevealSec, 'playerRevealSec', 3, 20, function () { syncInputs(); });
  bindNum(el.setupMilestoneSec, 'milestoneSec', 10, 60, function () { syncInputs(); });
  bindNum(el.milestoneSec, 'milestoneSec', 10, 60, function () { syncInputs(); });

  /* story pacing dials */
  bindNum(el.setupStoryMin, 'storyBlockMin', 10, maxBlockMins, function () { syncInputs(); });
  bindNum(el.storyMin, 'storyBlockMin', 10, maxBlockMins, function () { syncInputs(); });
  bindNum(el.setupStorySceneSec, 'storySceneSec', 4, 30, function () { syncInputs(); });
  bindNum(el.storySceneSec, 'storySceneSec', 4, 30, function () { syncInputs(); });

  function effectiveLoopHours() {
    var v = Number(S.loopHours) || 2;
    return Math.max(0.1, Math.min(168, v));
  }

  function syncInputs() {
    /* Tier comes from the licence, not from anything stored in this blob. */
    S.isPro = currentProTier();
    /* Free keeps the preloaded promo ads on: the toggle cannot be switched off. */
    if (!S.isPro) S.promoAdsEnabled = true;
    var promoChecked = !!S.promoAdsEnabled;
    var blockMax = String(maxBlockMins());
    var loopMax = '168';
    var effInterval = effectivePromoIntervalMin();
    var effAdSec = effectivePromoAdSec();
    [el.setupQuizMin, el.quizMin].forEach(function (i) { if (i) { i.max = blockMax; i.value = S.quizMin; } });
    [el.setupQSec, el.qSec].forEach(function (i) { if (i) i.value = S.qSec; });
    [el.setupPromoIntervalMin, el.promoIntervalMin].forEach(function (i) {
      if (i) { i.value = effInterval; i.disabled = false; }
    });
    [el.promoSec, el.promoAdRange].forEach(function (i) {
      if (i) { i.value = effAdSec; i.disabled = false; }
    });
    [el.loopHours, el.loopHoursDrawer].forEach(function (i) { if (i) { i.max = loopMax; i.value = S.loopHours; } });
    [el.setupPlayerMin, el.playerBlockMin].forEach(function (i) { if (i) { i.max = blockMax; i.value = S.playerBlockMin; } });
    [el.setupClueSec, el.clueSec].forEach(function (i) { if (i) i.value = S.clueSec; });
    [el.setupGuessSec, el.guessSec].forEach(function (i) { if (i) i.value = S.guessSec; });
    [el.setupPlayerRevealSec, el.playerRevealSec].forEach(function (i) { if (i) i.value = S.playerRevealSec; });
    [el.setupMilestoneSec, el.milestoneSec].forEach(function (i) { if (i) i.value = S.milestoneSec; });
    [el.setupStoryMin, el.storyMin].forEach(function (i) { if (i) { i.max = blockMax; i.value = S.storyBlockMin; } });
    [el.setupStorySceneSec, el.storySceneSec].forEach(function (i) { if (i) i.value = S.storySceneSec; });
    if (el.setupStorySpeechMode) el.setupStorySpeechMode.value = S.storySpeechMode || 'episode';
    if (el.setupStoryInterleave) el.setupStoryInterleave.checked = !!S.storyInterleave;
    if (el.drawerStoryInterleave) el.drawerStoryInterleave.checked = !!S.storyInterleave;
    if (el.setupStoryVaryCadence) el.setupStoryVaryCadence.checked = !!S.storyVaryCadence;
    if (el.drawerStoryVaryCadence) el.drawerStoryVaryCadence.checked = !!S.storyVaryCadence;
    if (el.setupPromoEnabled) el.setupPromoEnabled.checked = promoChecked;
    if (el.promoEnabledDrawer) el.promoEnabledDrawer.checked = promoChecked;
    if (el.setupChatSafe) el.setupChatSafe.checked = !!S.chatSafe;
    if (el.drawerChatSafe) el.drawerChatSafe.checked = !!S.chatSafe;
    if (el.stChatSafe) el.stChatSafe.checked = !!S.chatSafe;
    if (el.setupChatGuide) el.setupChatGuide.checked = !!S.chatGuide;
    if (el.drawerChatGuide) el.drawerChatGuide.checked = !!S.chatGuide;
    if (el.stChatGuide) el.stChatGuide.checked = !!S.chatGuide;
    if (el.autoRotate) el.autoRotate.checked = !!S.autoRotate;
    if (el.stAutoRotate) el.stAutoRotate.checked = !!S.autoRotate;
    if (el.safeDefault) el.safeDefault.checked = !!S.safeDefault;
    if (el.stSafeDefault) el.stSafeDefault.checked = !!S.safeDefault;
    if (el.sfxOn) el.sfxOn.checked = !!S.sfxOn;
    if (el.stSfxOn) el.stSfxOn.checked = !!S.sfxOn;
    if (el.voiceOn) el.voiceOn.checked = !!S.voiceOn;
    if (el.stVoiceOn) el.stVoiceOn.checked = !!S.voiceOn;
    if (el.stVoiceTag) el.stVoiceTag.textContent = S.voiceOn ? 'On' : 'Off';
    if (el.voiceReveal) el.voiceReveal.checked = !!S.voiceReveal;
    if (el.stVoiceReveal) el.stVoiceReveal.checked = !!S.voiceReveal;
    if (el.musicVol) { el.musicVol.value = S.musicVol; }
    if (el.stMusicVol) { el.stMusicVol.value = S.musicVol; }
    if (el.musicVolLabel) el.musicVolLabel.textContent = S.musicVol + '%';
    if (el.stMusicVolLabel) el.stMusicVolLabel.textContent = S.musicVol + '%';
    if (el.voiceRate) el.voiceRate.value = Math.round(S.voiceRate * 100);
    if (el.stVoiceRate) el.stVoiceRate.value = Math.round(S.voiceRate * 100);
    if (el.voiceRateLabel) el.voiceRateLabel.textContent = S.voiceRate.toFixed(2) + '\u00d7';
    if (el.stVoiceRateLabel) el.stVoiceRateLabel.textContent = S.voiceRate.toFixed(2) + '\u00d7';
    if (el.adminPromoDisplay) el.adminPromoDisplay.value = S.promoDisplayMode || 'full';
    if (el.adminPromoOrder) el.adminPromoOrder.value = S.promoOrder || 'sequential';
    if (el.adminPromoOverlay) el.adminPromoOverlay.value = S.promoOverlayStyle || 'disclosure';
    applyChatSafe();
    applyBranding();
    refreshPromoText();
    refreshLoopMath();
    refreshStats();
  }

  function applyChatSafe() {
    if (el.frame) el.frame.classList.toggle('is-chat-safe', !!S.chatSafe);
    if (el.chatSafeGuide) {
      var safeOn = document.body.classList.contains('safe');
      el.chatSafeGuide.hidden = !(S.chatGuide && !safeOn);
    }
  }

  function bindChatSafeToggles() {
    [el.setupChatSafe, el.drawerChatSafe, el.stChatSafe].forEach(function (chk) {
      on(chk, 'change', function () {
        S.chatSafe = !!chk.checked;
        save();
        syncInputs();
        toast(S.chatSafe ? 'Chat-safe upper framing on' : 'Chat-safe framing off');
      });
    });
    [el.setupChatGuide, el.drawerChatGuide, el.stChatGuide].forEach(function (chk) {
      on(chk, 'change', function () {
        S.chatGuide = !!chk.checked;
        save();
        syncInputs();
      });
    });
    [el.setupPromoEnabled, el.promoEnabledDrawer].forEach(function (chk) {
      on(chk, 'change', function () {
        if (!S.isPro && !chk.checked) {
          chk.checked = true;
          S.promoAdsEnabled = true;
          save();
          refreshPromoText();
          syncInputs();
          toast('Promo breaks are required on Free tier. Upgrade to Pro Studio ($19/mo) to disable breaks.', true);
          return;
        }
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
    });
    [el.setupStoryInterleave, el.drawerStoryInterleave].forEach(function (chk) {
      on(chk, 'change', function () {
        S.storyInterleave = !!chk.checked;
        save();
        syncInputs();
        toast(S.storyInterleave ? '2 rapid trivia Qs will follow each story' : 'Continuous story-only rotation');
      });
    });
    // Existing quiz-and-anecdote toggle surface (#sermonAnecdoteToggle).
    // This is the only quiz-loop toggle in the app; track its changes as quiz_loop_toggle.
    var sermonAnecdoteToggle = el.sermonAnecdoteToggle;
    if (sermonAnecdoteToggle) {
      (function () {
        var initialOn = !!sermonAnecdoteToggle.checked;
        try {
          if (window.LNR_TRACK && typeof window.LNR_TRACK === 'function') {
            window.LNR_TRACK('quiz_loop_toggle', { on: initialOn ? 'on' : 'off' });
          }
        } catch (e) {}
        sermonAnecdoteToggle.addEventListener('change', function () {
          try {
            if (window.LNR_TRACK && typeof window.LNR_TRACK === 'function') {
              window.LNR_TRACK('quiz_loop_toggle', { on: sermonAnecdoteToggle.checked ? 'on' : 'off' });
            }
          } catch (e) {}
        });
      })();
    }
    [el.setupStoryVaryCadence, el.drawerStoryVaryCadence].forEach(function (chk) {
      on(chk, 'change', function () {
        S.storyVaryCadence = !!chk.checked;
        save();
        syncInputs();
        toast(S.storyVaryCadence ? 'Archetype, palette & audio variation active' : 'Fixed audio/visual bed');
      });
    });
  }
  bindChatSafeToggles();

  function setPlayerMode(mode) {
    S.playerMode = mode;
    save();
    [[el.pmodeAll, 'all'], [el.pmodeClues, 'clues'], [el.pmodeVisual, 'visual']].forEach(function (p) {
      if (p[0]) p[0].classList.toggle('is-selected', p[1] === mode);
    });
    plLive.bag = [];
    refreshStats();
  }
  on(el.pmodeAll, 'click', function () { setPlayerMode('all'); });
  on(el.pmodeClues, 'click', function () { setPlayerMode('clues'); });
  on(el.pmodeVisual, 'click', function () { setPlayerMode('visual'); });

  function effectiveBranding() {
    return {
      tier: 'studio',
      locked: false,
      watermark: S.watermark || DEFAULT_WATERMARK,
      site: normalizeSite(S.site) || DEFAULT_SITE,
      brand: S.brand || DEFAULT_BRAND
    };
  }

  function applyBranding() {
    var b = effectiveBranding();
    if (el.watermark) el.watermark.textContent = b.watermark;
    if (el.frameSite) el.frameSite.textContent = b.site;
    if (el.frameCtaLead) el.frameCtaLead.textContent = S.siteCta || DEFAULT_SITECTA;
    if (el.promoBrandText) el.promoBrandText.textContent = b.brand;

    [
      [el.watermarkInput, b.watermark],
      [el.stWatermarkInput, b.watermark],
      [el.siteInput, b.site],
      [el.stSiteInput, b.site],
      [el.brandOverlayInput, b.brand],
      [el.stBrandOverlayInput, b.brand]
    ].forEach(function (pair) {
      var inp = pair[0];
      if (!inp) return;
      if (document.activeElement !== inp) inp.value = pair[1];
      inp.readOnly = false;
      inp.disabled = false;
    });
  }

  [el.autoRotate, el.stAutoRotate].forEach(function (chk) {
    on(chk, 'change', function () {
      S.autoRotate = !!chk.checked;
      save();
      syncInputs();
      toast(S.autoRotate ? 'Auto-rotation on' : 'Auto-rotation off \u2014 stays on this block');
    });
  });

  [el.watermarkInput, el.stWatermarkInput].forEach(function (inp) {
    on(inp, 'input', function () {
      S.watermark = inp.value.slice(0, 14) || DEFAULT_WATERMARK;
      applyBranding(); save();
    });
  });
  [el.siteInput, el.stSiteInput].forEach(function (inp) {
    on(inp, 'input', function () {
      S.site = normalizeSite(inp.value) || DEFAULT_SITE;
      applyBranding(); save();
    });
  });
  [el.siteCtaInput, el.stSiteCtaInput].forEach(function (inp) {
    on(inp, 'input', function () {
      S.siteCta = inp.value.slice(0, 42) || DEFAULT_SITECTA;
      applyBranding(); save();
    });
  });
  [el.brandOverlayInput, el.stBrandOverlayInput].forEach(function (inp) {
    on(inp, 'input', function () {
      S.brand = inp.value.slice(0, 28) || DEFAULT_BRAND;
      applyBranding(); save();
    });
  });
  [el.safeDefault, el.stSafeDefault].forEach(function (chk) {
    on(chk, 'change', function () {
      S.safeDefault = !!chk.checked;
      save();
      syncInputs();
    });
  });

  /* ---------- drawer ---------- */
  function openDrawer() {
    if (!el.drawer) return;
    el.drawer.hidden = false;
    if (el.scrim) el.scrim.hidden = false;
    document.body.classList.add('drawer-open');
  }
  function closeDrawer() {
    if (!el.drawer) return;
    el.drawer.hidden = true;
    if (el.scrim) el.scrim.hidden = true;
    document.body.classList.remove('drawer-open');
  }
  on(el.openSettingsBtn, 'click', function () { setPage('settings'); });
  on(el.settingsBtn, 'click', openDrawer);
  on(el.drawerClose, 'click', closeDrawer);
  on(el.scrim, 'click', closeDrawer);

  /* ---------- music, SFX & persistent MP3 upload + preview ---------- */
  var musicCards = document.querySelectorAll('#musicGrid .music-card, #stMusicGrid .music-card');
  function isAudioSuppressedPhase() {
    return live.phase === 'video' || live.phase === 'promo';
  }

  function syncMusicCardsUI() {
    var activeName = 'No music';
    Array.prototype.forEach.call(musicCards, function (c) {
      var match = c.getAttribute('data-music') === S.music;
      c.classList.toggle('is-selected', match);
      if (match) {
        var b = c.querySelector('b');
        if (b) activeName = b.textContent;
      }
    });
    if (customAudioEl && customAudioName) activeName = 'MP3: ' + customAudioName;
    if (el.stMusicTag) el.stMusicTag.textContent = activeName;
  }

  Array.prototype.forEach.call(musicCards, function (card) {
    card.addEventListener('click', function () {
      S.music = card.getAttribute('data-music');
      syncMusicCardsUI();
      save();
      if (live.running && !live.paused && !isAudioSuppressedPhase()) startMusic();
      else if (previewingAudio) { stopAudioPreview(); startAudioPreview(); }
      toast(S.music === 'off' ? 'Music off' : 'Music bed: ' + card.querySelector('b').textContent);
    });
  });

  [el.sfxOn, el.stSfxOn].forEach(function (chk) {
    on(chk, 'change', function () {
      S.sfxOn = !!chk.checked;
      syncInputs();
      save();
      toast(S.sfxOn ? 'Scene cues & ticks enabled (excluded during Video clips)' : 'Scene cues & ticks muted');
    });
  });

  [el.musicVol, el.stMusicVol].forEach(function (slider) {
    on(slider, 'input', function () {
      S.musicVol = parseInt(slider.value, 10);
      if (el.musicVol) el.musicVol.value = S.musicVol;
      if (el.stMusicVol) el.stMusicVol.value = S.musicVol;
      if (el.musicVolLabel) el.musicVolLabel.textContent = S.musicVol + '%';
      if (el.stMusicVolLabel) el.stMusicVolLabel.textContent = S.musicVol + '%';
      if (defaultBgAudioEl) {
        if (previewingAudio && !customAudioEl) defaultBgAudioEl.volume = Math.min(1, Math.max(0.05, (S.musicVol / 100) * 1.75));
        else defaultBgAudioEl.volume = customBedGain(musicDucked);
      }
      if (customAudioEl) {
        if (previewingAudio) customAudioEl.volume = Math.min(1, Math.max(0.05, (S.musicVol / 100) * 1.75));
        else applyCustomVolume(musicDucked);
      }
      save();
    });
  });

  /* embedded default background tracks & SFX - excluded on video/promo phases */
  var DEFAULT_BG_TRACKS = {
    lnr_stream_bed: { name: 'LNR Stream Bed', url: '', synth: true },
    all_eyes_on_us: { name: 'All Eyes On Us', url: '/assets/aistudio/all_eyes_on_us_5bb2d8a8.mp3' },
    moment_of_truth: { name: 'Moment Of Truth', url: '/assets/aistudio/moment_of_truth_7e44ef53.mp3' }
  };

  /* ------------------------------------------------------------------
     LNR STREAM BED — synthesised, not sampled

     The default bed is generated live with Web Audio instead of shipping an
     MP3. Two reasons: nothing third-party is ever in the stream (so there is
     no licence to clear and no Content ID match on a YouTube broadcast), and
     there is no multi-megabyte asset to load before the first note.

     104 BPM, I–V–vi–IV in C major (C–G–Am–F), a soft pad, a plucked arp and
     a light kick/clap. A lookahead scheduler keeps it sample-accurate even
     when the tab throttles, which a setInterval-driven sequencer does not.
     ------------------------------------------------------------------ */
  var BED = {
    bpm: 104,
    chords: [
      { root: 130.81, notes: [261.63, 329.63, 392.00] }, /* C  */
      { root: 98.00,  notes: [246.94, 293.66, 392.00] }, /* G  */
      { root: 110.00, notes: [261.63, 329.63, 440.00] }, /* Am */
      { root: 87.31,  notes: [261.63, 349.23, 440.00] }  /* F  */
    ],
    nodes: null,
    timer: 0,
    nextNoteTime: 0,
    step: 0
  };

  function bedBus() {
    var ctx = ensureAudioCtx();
    if (!ctx) return null;
    if (BED.nodes && BED.nodes.ctx === ctx) return BED.nodes;

    var master = ctx.createGain();
    master.gain.value = 0.0001;

    /* A gentle low-pass keeps the pad from sounding brittle on phone
       speakers, and a short plate-ish delay gives it air. */
    var lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2600;
    lp.Q.value = 0.4;

    var delay = ctx.createDelay(0.6);
    delay.delayTime.value = 0.28;
    var fb = ctx.createGain();
    fb.gain.value = 0.22;
    var wet = ctx.createGain();
    wet.gain.value = 0.18;

    lp.connect(master);
    lp.connect(delay);
    delay.connect(fb);
    fb.connect(delay);
    delay.connect(wet);
    wet.connect(master);
    master.connect(ctx.destination);

    BED.nodes = { ctx: ctx, master: master, input: lp };
    return BED.nodes;
  }

  function bedNote(freq, t0, dur, peak, type) {
    var n = BED.nodes;
    if (!n) return;
    var ctx = n.ctx;
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(n.input);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  function bedKick(t0) {
    var n = BED.nodes;
    if (!n) return;
    var ctx = n.ctx;
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, t0);
    osc.frequency.exponentialRampToValueAtTime(46, t0 + 0.11);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.5, t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2);
    osc.connect(g);
    g.connect(n.input);
    osc.start(t0);
    osc.stop(t0 + 0.24);
  }

  function bedHat(t0, peak) {
    var n = BED.nodes;
    if (!n) return;
    var ctx = n.ctx;
    var len = Math.floor(ctx.sampleRate * 0.05);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7000;
    var g = ctx.createGain();
    g.gain.value = peak;
    src.connect(hp); hp.connect(g); g.connect(n.input);
    src.start(t0);
  }

  /* One 16th-note step. 16 steps per bar, 4 bars per progression. */
  function bedStep(step, t0) {
    var bar = Math.floor(step / 16) % 4;
    var s = step % 16;
    var chord = BED.chords[bar];
    var spb = 60 / BED.bpm;
    var sixteenth = spb / 4;

    /* pad: sustained across the bar, re-struck on the downbeat */
    if (s === 0) {
      chord.notes.forEach(function (f, i) {
        bedNote(f, t0, spb * 0.98, 0.075 - i * 0.010, 'triangle');
      });
      bedNote(chord.root, t0, spb * 0.9, 0.068, 'sine');
    }

    /* arp: a light pluck on the off-beats, walking the chord */
    if (s % 4 === 2) {
      var note = chord.notes[(Math.floor(step / 4)) % chord.notes.length] * 2;
      bedNote(note, t0, sixteenth * 2.2, 0.044, 'sine');
    }

    /* drums: kick on 1 and 3, hat on every 8th */
    if (s === 0 || s === 8) bedKick(t0);
    if (s % 2 === 0) bedHat(t0, s % 4 === 0 ? 0.05 : 0.028);
  }

  function bedScheduler() {
    var n = BED.nodes;
    if (!n) return;
    var ctx = n.ctx;
    var sixteenth = (60 / BED.bpm) / 4;
    /* 120 ms lookahead, 25 ms tick: enough to survive a throttled tab. */
    while (BED.nextNoteTime < ctx.currentTime + 0.12) {
      bedStep(BED.step, BED.nextNoteTime);
      BED.nextNoteTime += sixteenth;
      BED.step++;
    }
  }

  function startSynthBed() {
    var n = bedBus();
    if (!n) return false;
    var ctx = n.ctx;
    if (ctx.state === 'suspended') ctx.resume().catch(function () {});
    if (BED.timer) return true;
    BED.step = 0;
    BED.nextNoteTime = ctx.currentTime + 0.06;
    BED.timer = window.setInterval(bedScheduler, 25);
    bedScheduler();
    /* fade in so the bed never slams in under a sentence */
    var target = customBedGain(musicDucked);
    n.master.gain.cancelScheduledValues(ctx.currentTime);
    n.master.gain.setValueAtTime(Math.max(0.0001, n.master.gain.value), ctx.currentTime);
    n.master.gain.linearRampToValueAtTime(target, ctx.currentTime + 1.2);
    return true;
  }

  function stopSynthBed() {
    if (BED.timer) { window.clearInterval(BED.timer); BED.timer = 0; }
    var n = BED.nodes;
    if (!n) return;
    var ctx = n.ctx;
    try {
      n.master.gain.cancelScheduledValues(ctx.currentTime);
      n.master.gain.setValueAtTime(Math.max(0.0001, n.master.gain.value), ctx.currentTime);
      n.master.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    } catch (e) {}
  }

  function setSynthBedGain(ducked) {
    var n = BED.nodes;
    if (!n || !BED.timer) return;
    var ctx = n.ctx;
    try {
      n.master.gain.cancelScheduledValues(ctx.currentTime);
      n.master.gain.setValueAtTime(Math.max(0.0001, n.master.gain.value), ctx.currentTime);
      n.master.gain.linearRampToValueAtTime(customBedGain(ducked), ctx.currentTime + 0.25);
    } catch (e) {}
  }
  var audioCtx = null, musicDucked = false;
  var defaultBgAudioEl = null, defaultBgAudioKey = '';
  var customAudioEl = null, customAudioUrl = '', customAudioName = '';
  var previewingAudio = false, previewStopTimer = 0;

  function customBedGain(ducked) {
    /* 35% on the slider ~= 62% of the track's own level - present, not loud. */
    var base = Math.min(1, Math.max(0.02, (S.musicVol / 100) * 1.75));
    return base * (ducked ? 0.55 : 1);
  }

  /* A preview is an audition, not a broadcast: it must be clearly audible
     whatever the bed slider says, and the bed's ducking must never touch it.
     The old code reused the bed gain, so at a low slider the preview was
     near-silent and looked broken. */
  function previewGain() {
    return Math.min(1, Math.max(0.55, (S.musicVol / 100) * 1.75));
  }

  function applyCustomVolume(ducked) {
    if (!customAudioEl || previewingAudio) return;
    customAudioEl.volume = customBedGain(ducked);
  }

  function setMusicDucking(duck) {
    musicDucked = !!duck;
    if (defaultBgAudioEl && !previewingAudio) defaultBgAudioEl.volume = customBedGain(musicDucked);
    applyCustomVolume(musicDucked);
  }

  function ensureAudioCtx() {
    if (!audioCtx) {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      audioCtx = new Ctx();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(function () {});
    }
    return audioCtx;
  }

  function ensureDefaultBgAudio(key) {
    var resolvedKey = DEFAULT_BG_TRACKS[key] ? key : 'lnr_stream_bed';
    var track = DEFAULT_BG_TRACKS[resolvedKey];
    if (!defaultBgAudioEl || defaultBgAudioKey !== resolvedKey) {
      if (defaultBgAudioEl) {
        try { defaultBgAudioEl.pause(); } catch (e) {}
      }
      defaultBgAudioEl = new Audio(track.url);
      defaultBgAudioEl.preload = 'auto';
      defaultBgAudioEl.loop = true;
      defaultBgAudioKey = resolvedKey;
    }
    return defaultBgAudioEl;
  }

  /* ------------------------------------------------------------------
     ROBUST PLAYBACK

     Browsers refuse audio until the page has seen a real user gesture, and
     they refuse it with a rejected promise rather than an error event. The
     old code called play() and swallowed the rejection, so an uploaded MP3
     could sit there "not playing" with no explanation and no retry.

     safePlay():
       1. calls play() and awaits the promise (so a rejection is caught),
       2. if the browser blocked it, remembers the element and retries once
          the next real gesture arrives (pointerdown / keydown),
       3. only after that reports a failure, and only once per element,
          instead of failing silently forever.
     ------------------------------------------------------------------ */
  var gestureBlocked = [];

  function flushGestureBlocked() {
    var pending = gestureBlocked;
    gestureBlocked = [];
    pending.forEach(function (item) {
      try {
        var p = item.el.play();
        if (p && p.catch) p.catch(function () {});
      } catch (e) {}
    });
  }

  function installGestureUnlock() {
    var unlock = function () {
      try { if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume(); } catch (e) {}
      if (gestureBlocked.length) flushGestureBlocked();
    };
    ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) {
      document.addEventListener(ev, unlock, { passive: true });
    });
  }



  function safePlay(el, onFail) {
    if (!el) return;
    var p;
    try {
      p = el.play();
    } catch (e) {
      gestureBlocked.push({ el: el });
      if (onFail) onFail(e);
      return;
    }
    if (!p || !p.catch) return;
    p.catch(function (err) {
      var name = (err && err.name) || '';
      if (name === 'NotAllowedError' || name === 'AbortError') {
        /* Autoplay policy: retry on the next real gesture instead of dying. */
        if (gestureBlocked.indexOf(el) === -1 &&
            !gestureBlocked.some(function (i) { return i.el === el; })) {
          gestureBlocked.push({ el: el });
        }
        return;
      }
      if (onFail) onFail(err);
    });
  }

  function startMusic() {
    stopMusic();
    /* Never embed background sound during prerecorded Video or Partner Break phases */
    if (!live.running || live.paused || isAudioSuppressedPhase()) {
      updateVoiceBtn();
      return;
    }
    if (S.music === 'off' && !customAudioEl) {
      updateVoiceBtn();
      return;
    }
    /* Never let the bed start on top of an audition: that is what made an
       uploaded MP3 appear to "not play" \u2014 the bed took the element over. */
    if (previewingAudio) {
      updateVoiceBtn();
      return;
    }
    if (customAudioEl) {
      customAudioEl.volume = customBedGain(musicDucked);
      customAudioEl.loop = true;
      safePlay(customAudioEl);
      updateVoiceBtn();
      return;
    }
    var bedKey = DEFAULT_BG_TRACKS[S.music] ? S.music : 'lnr_stream_bed';
    if (DEFAULT_BG_TRACKS[bedKey] && DEFAULT_BG_TRACKS[bedKey].synth) {
      startSynthBed();
      updateVoiceBtn();
      return;
    }
    var bgAudio = ensureDefaultBgAudio(bedKey);
    if (bgAudio) {
      bgAudio.volume = customBedGain(musicDucked);
      bgAudio.loop = true;
      safePlay(bgAudio);
    }
    updateVoiceBtn();
  }

  function stopMusic() {
    stopSynthBed();
    if (customAudioEl && !previewingAudio) {
      try { customAudioEl.pause(); } catch (e) {}
    }
    if (defaultBgAudioEl && !previewingAudio) {
      try { defaultBgAudioEl.pause(); } catch (e) {}
    }
    updateVoiceBtn();
  }

  function playToneSequence(freqs, durSec, peakGain, waveType) {
    if (!S.sfxOn || !live.running || live.paused || isAudioSuppressedPhase()) return;
    try {
      var ctx = ensureAudioCtx();
      if (!ctx) return;
      var baseT = ctx.currentTime + 0.01;
      freqs.forEach(function (f, idx) {
        var t0 = baseT + idx * (durSec * 0.55);
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = waveType || 'triangle';
        osc.frequency.setValueAtTime(f, t0);
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.linearRampToValueAtTime(peakGain, t0 + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durSec);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + durSec + 0.02);
      });
    } catch (e) {}
  }

  function playSceneChime() {
    playToneSequence([392.0, 587.33], 0.24, 0.055, 'sine');
  }

  function playRevealChime() {
    playToneSequence([523.25, 659.25, 783.99], 0.28, 0.065, 'triangle');
  }

  function playMilestoneFanfare() {
    playToneSequence([440, 554.37, 659.25, 880], 0.32, 0.07, 'triangle');
  }

  function playCountdownTick(secsLeft) {
    if (!S.sfxOn || isAudioSuppressedPhase()) return;
    try {
      var ctx = ensureAudioCtx();
      if (!ctx || ctx.state !== 'running') return;
      var t0 = ctx.currentTime;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      var accent = secsLeft <= 3;
      osc.type = accent ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(accent ? 1046.5 : 880, t0);
      osc.frequency.exponentialRampToValueAtTime(accent ? 660 : 520, t0 + 0.045);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(accent ? 0.065 : 0.045, t0 + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.055);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.06);
    } catch (e) {}
  }

  function syncAudioPreviewUI() {
    var hasCustom = !!customAudioEl;
    var labelText = hasCustom ? customAudioName : 'No custom track';
    if (el.audioName) el.audioName.textContent = labelText;
    if (el.stAudioName) el.stAudioName.textContent = labelText;
    [el.audioClearBtn, el.stAudioClearBtn].forEach(function (btn) {
      if (btn) btn.hidden = !hasCustom;
    });
    [el.audioPreviewBtn, el.stAudioPreviewBtn].forEach(function (btn) {
      if (!btn) return;
      btn.classList.toggle('is-playing', previewingAudio);
      if (previewingAudio) {
        btn.textContent = 'Stop preview';
      } else {
        btn.textContent = hasCustom ? 'Preview MP3' : 'Preview sound bed';
      }
    });
    syncMusicCardsUI();
  }

  function stopAudioPreview() {
    if (previewSto);
    syncMusicCardsUI();
  }

  function stopAudioPreview() {
    if (previewStopTimer) { window.clearTimeout(previewStopTimer); previewStopTimer = 0; }
    /* Always actually stop the element that was auditioning. The old version
       only paused it when the show was idle, so pressing Stop during a live
       session left the track playing while the button said "Preview". */
    if (customAudioEl && previewingAudio) {
      try { customAudioEl.pause(); customAudioEl.currentTime = 0; } catch (e) {}
    }
    if (defaultBgAudioEl && previewingAudio) {
      try { defaultBgAudioEl.pause(); defaultBgAudioEl.currentTime = 0; } catch (e) {}
    }
    previewingAudio = false;
    syncAudioPreviewUI();
  }

  function startAudioPreview() {
    stopAudioPreview();
    if (customAudioEl) {
      previewingAudio = true;
      try { customAudioEl.currentTime = 0; } catch (e) {}
      /* Audition level: audible regardless of the bed slider, and immune to
         ducking (applyCustomVolume / setMusicDucking both skip while
         previewingAudio is true). */
      customAudioEl.volume = previewGain();
      customAudioEl.loop = false;
      customAudioEl.onended = function () {
        if (previewingAudio) stopAudioPreview();
      };
      safePlay(customAudioEl, function (err) {
        stopAudioPreview();
        toast('Could not start the audio track (' + ((err && err.name) || 'blocked') +
          ') \u2014 click anywhere on the page once, then press Preview again.', true);
      });
      syncAudioPreviewUI();
      return;
    }
    var bedKey = DEFAULT_BG_TRACKS[S.music] ? S.music : 'lnr_stream_bed';
    var bgAudio = ensureDefaultBgAudio(bedKey);
    if (!bgAudio) return;
    previewingAudio = true;
    try { bgAudio.currentTime = 0; } catch (e) {}
    bgAudio.volume = previewGain();
    bgAudio.loop = false;
    bgAudio.onended = function () {
      if (previewingAudio) stopAudioPreview();
    };
    safePlay(bgAudio, function (err) {
      stopAudioPreview();
      toast('Could not start the background sound (' + ((err && err.name) || 'blocked') +
        ') \u2014 click anywhere on the page once, then press Preview again.', true);
    });
    syncAudioPreviewUI();
  }

  /* Some Android/Windows pickers hand over a File with an empty or wrong
     `type` ("" or "application/octet-stream"). A blob URL built from that
     carries no usable MIME type, and Chrome then refuses to decode it \u2014
     the upload "succeeds" and the track silently never plays. Re-wrap the
     bytes with a type derived from the filename so the decoder is told what
     it is looking at. */
  function audioBlobFor(blob, name) {
    var type = (blob && blob.type) || '';
    var looksAudio = /^audio\//i.test(type);
    if (looksAudio) return blob;
    var ext = String(name || '').toLowerCase().match(/\.([a-z0-9]+)$/);
    var map = {
      mp3: 'audio/mpeg', m4a: 'audio/mp4', mp4: 'audio/mp4', aac: 'audio/aac',
      wav: 'audio/wav', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg',
      flac: 'audio/flac', webm: 'audio/webm'
    };
    var guessed = ext ? map[ext[1]] : '';
    if (!guessed) return blob;
    try {
      return new Blob([blob], { type: guessed });
    } catch (e) {
      return blob;
    }
  }

  function loadCustomAudioBlob(blob, name) {
    stopAudioPreview();
    if (customAudioUrl) { try { URL.revokeObjectURL(customAudioUrl); } catch (e) {} customAudioUrl = ''; }
    if (customAudioEl) { try { customAudioEl.pause(); } catch (e) {} }
    var playable = audioBlobFor(blob, name);
    customAudioUrl = URL.createObjectURL(playable);
    customAudioName = name || 'Custom track';
    var audio = new Audio();
    audio.preload = 'metadata';
    audio.loop = true;
    audio.onloadedmetadata = function () {
      if (isFinite(audio.duration) && audio.duration > 0) {
        customAudioName = (name || 'Custom track') + ' \u00b7 ' + clock(audio.duration * 1000);
        syncAudioPreviewUI();
      }
    };
    audio.onerror = function () {
      var code = audio.error && audio.error.code;
      var why = code === 4 ? 'this browser cannot decode that format \u2014 try MP3 or M4A'
        : code === 3 ? 'the file looks corrupted'
        : 'the file could not be read';
      toast('Could not load audio "' + (name || 'track') + '": ' + why + '.', true);
    };
    audio.src = customAudioUrl;
    customAudioEl = audio;
    syncAudioPreviewUI();
  }

  function clearCustomAudio() {
    stopAudioPreview();
    if (customAudioEl) { try { customAudioEl.pause(); } catch (e) {} }
    if (customAudioUrl) { try { URL.revokeObjectURL(customAudioUrl); } catch (e) {} customAudioUrl = ''; }
    customAudioEl = null;
    customAudioName = '';
    idbDeleteStore('vault', 'custom_audio_track').catch(function () {});
    syncAudioPreviewUI();
    if (live.running && !live.paused && !isAudioSuppressedPhase()) startMusic();
    toast('Custom track removed — using studio music bed');
  }

  [el.audioInput, el.stAudioInput].forEach(function (inp) {
    on(inp, 'change', function () {
      var f = inp.files && inp.files[0];
      inp.value = '';
      if (!f) return;
      loadCustomAudioBlob(f, f.name);
      idbPutStore('vault', { id: 'custom_audio_track', name: f.name, type: f.type, size: f.size, blob: f }).catch(function () {});
      toast('MP3 ready: ' + f.name + ' \u2014 press Preview MP3 to hear it, or Start to run it under the show.');
      if (live.running && !live.paused && !isAudioSuppressedPhase()) startMusic();
    });
  });

  [el.audioPreviewBtn, el.stAudioPreviewBtn].forEach(function (btn) {
    on(btn, 'click', function () {
      if (previewingAudio) {
        stopAudioPreview();
      } else {
        startAudioPreview();
      }
    });
  });

  [el.audioClearBtn, el.stAudioClearBtn].forEach(function (btn) {
    on(btn, 'click', clearCustomAudio);
  });

  /* ---------- IndexedDB clip, ad log & vault stores ---------- */
  var DB_NAME = 'lnr_timer_media', DB_VER = 2, dbPromise = null;

  function db() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      if (!window.indexedDB) { reject(new Error('IndexedDB unavailable')); return; }
      var req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = function () {
        var d = req.result;
        if (!d.objectStoreNames.contains('clips')) d.createObjectStore('clips', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('ad_logs')) d.createObjectStore('ad_logs', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('vault')) d.createObjectStore('vault', { keyPath: 'id' });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
    return dbPromise;
  }

  function idbListStore(store) {
    return db().then(function (d) {
      return new Promise(function (resolve) {
        var tx = d.transaction(store, 'readonly');
        var rq = tx.objectStore(store).getAll();
        rq.onsuccess = function () { resolve(rq.result || []); };
        rq.onerror = function () { resolve([]); };
      });
    }).catch(function () { return []; });
  }

  function idbGetStore(store, id) {
    return db().then(function (d) {
      return new Promise(function (resolve) {
        var tx = d.transaction(store, 'readonly');
        var rq = tx.objectStore(store).get(id);
        rq.onsuccess = function () { resolve(rq.result || null); };
        rq.onerror = function () { resolve(null); };
      });
    }).catch(function () { return null; });
  }

  function idbPutStore(store, rec) {
    return db().then(function (d) {
      return new Promise(function (resolve, reject) {
        var tx = d.transaction(store, 'readwrite');
        tx.objectStore(store).put(rec);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }

  function idbDeleteStore(store, id) {
    return db().then(function (d) {
      return new Promise(function (resolve) {
        var tx = d.transaction(store, 'readwrite');
        tx.objectStore(store).delete(id);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { resolve(); };
      });
    });
  }

  function idbClearStore(store) {
    return db().then(function (d) {
      return new Promise(function (resolve) {
        var tx = d.transaction(store, 'readwrite');
        tx.objectStore(store).clear();
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { resolve(); };
      });
    }).catch(function () {});
  }

  function idbList() { return idbListStore('clips'); }
  function idbPut(rec) { return idbPutStore('clips', rec); }
  function idbDelete(id) { return idbDeleteStore('clips', id); }

  var clips = [];        /* video engine: [{id,name,size,duration}] (up to 12) */
  var promos = [];       /* custom channel / partner break clips: up to 5 uploaded */
  var defaultFolderPromos = []; /* /promos/manifest.json default folder */

  /* The compulsory studio promo shown to FREE viewers only.
     It is a built-in file, not an upload, so it cannot be deleted from the
     playlist, and effectivePromoList() only ever adds it when the device is
     not Pro. Duration is the clip's real length (22s). */
  var STUDIO_PROMO_ID = 'studio_promo_lnr';
  var STUDIO_PROMO = {
    id: STUDIO_PROMO_ID,
    name: 'lnr Studio \u2014 studio promo',
    size: 3076645,
    duration: 22,
    enabled: true,
    builtIn: true,
    externalUrl: '/promos/lnr-studio-promo.mp4'
  };
  var adminPromos = [];  /* operator break folder clips & /promos/ manifest items */
  var clipURLs = {};     /* id -> objectURL */
  var pendingClipUploads = 0;
  var pendingPromoUploads = 0;
  var demoVideoMode = false;

  /* breaks are interstitial between blocks, capped at 5 minutes */
  var PROMO_MAX_SEC = 300;

  function effectivePromoList() {
    var list = [];
    var seenIds = {};
    promos.forEach(function (p) {
      if (p && !seenIds[p.id]) { seenIds[p.id] = 1; list.push(p); }
    });
    adminPromos.forEach(function (p) {
      if (p && p.enabled !== false && !seenIds[p.id]) { seenIds[p.id] = 1; list.push(p); }
    });
    if (!list.length && defaultFolderPromos.length) {
      defaultFolderPromos.forEach(function (p) {
        if (p && !seenIds[p.id]) { seenIds[p.id] = 1; list.push(p); }
      });
    }
    /* The compulsory studio promo is a FREE-TIER ad. It is appended last so a
       creator's own sponsor clips still lead the rotation, and it is never
       added for a Pro device — the tier check is the only gate, so no setting
       or upload can bring it back. */
    if (!currentProTier() && !seenIds[STUDIO_PROMO_ID]) {
      seenIds[STUDIO_PROMO_ID] = 1;
      list.push(STUDIO_PROMO);
    }
    return list;
  }

  function humanSize(bytes) {
    if (!bytes) return '';
    if (bytes > 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
    return Math.round(bytes / 1024) + ' KB';
  }

  function renderAdminPromoList() {
    if (el.adminPromoCountTag) {
      var enabledCount = adminPromos.filter(function (p) { return p.enabled !== false; }).length;
      el.adminPromoCountTag.textContent = enabledCount + '/' + adminPromos.length + ' active';
    }
    if (!el.adminPromoList) return;
    el.adminPromoList.innerHTML = '';
    if (!adminPromos.length) {
      var empty = document.createElement('li');
      empty.innerHTML = '<span>No admin folder promos loaded yet. Pick a device folder or sync /promos/.</span>';
      el.adminPromoList.appendChild(empty);
      return;
    }
    adminPromos.forEach(function (cc) {
      var li = document.createElement('li');
      var lbl = document.createElement('label');
      var chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.checked = cc.enabled !== false;
      chk.addEventListener('change', function () {
        cc.enabled = chk.checked;
        if (!cc.externalUrl) {
          idbGetStore('clips', cc.id).then(function (rec) {
            if (rec) {
              rec.enabled = cc.enabled;
              idbPut(rec).catch(function () {});
            }
          });
        }
        renderAdminPromoList();
        refreshPromoText();
        refreshStats();
      });
      var nm = document.createElement('span');
      nm.textContent = cc.name;
      lbl.appendChild(chk);
      lbl.appendChild(nm);

      var dur = document.createElement('small');
      dur.textContent = cc.duration ? clock(cc.duration * 1000) : (cc.externalUrl ? '/promos/' : 'video');

      var rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'clip-remove';
      rm.setAttribute('aria-label', 'Remove ' + cc.name);
      rm.textContent = '\u2715';
      rm.addEventListener('click', function () {
        idbDelete(cc.id).then(function () {
          adminPromos = adminPromos.filter(function (x) { return x.id !== cc.id; });
          if (clipURLs[cc.id] && !cc.externalUrl) { URL.revokeObjectURL(clipURLs[cc.id]); delete clipURLs[cc.id]; }
          renderAdminPromoList();
          refreshPromoText();
          refreshStats();
          toast('Removed ' + cc.name + ' from admin folder');
        });
      });

      li.appendChild(lbl);
      li.appendChild(dur);
      li.appendChild(rm);
      el.adminPromoList.appendChild(li);
    });
  }

  function renderClips() {
    renderMedia('clip');
    renderMedia('promo');
    renderAdminPromoList();
    refreshLoopMath();
    refreshPromoText();
    refreshStats();
    refreshOwnershipUI();
  }

  function refreshOwnershipUI() {
    var tag = el.videoOwnershipTag;
    var ownBtn = el.ownVideoBtn;
    var refBtn = el.refVideoBtn;
    if (!tag || !ownBtn || !refBtn) return;
    var hasClips = clips.length > 0;
    if (!hasClips) {
      tag.textContent = 'No clips uploaded';
      ownBtn.classList.remove('is-selected');
      refBtn.classList.remove('is-selected');
      ownBtn.disabled = true;
      refBtn.disabled = true;
      return;
    }
    var allOwn = clips.every(function (c) { return c.ownership === 'own'; });
    var allRef = clips.every(function (c) { return c.ownership !== 'own'; });
    if (allOwn) {
      tag.textContent = 'I own this video';
      ownBtn.classList.add('is-selected');
      refBtn.classList.remove('is-selected');
    } else if (allRef) {
      tag.textContent = 'Reference / source video';
      refBtn.classList.add('is-selected');
      ownBtn.classList.remove('is-selected');
    } else {
      tag.textContent = clips.length + ' clips \u00b7 mixed';
      ownBtn.classList.remove('is-selected');
      refBtn.classList.remove('is-selected');
    }
    ownBtn.disabled = false;
    refBtn.disabled = false;
  }

  function listFor(kind) { return kind === 'promo' ? el.promoList : el.clipList; }
  function itemFor(kind) { return kind === 'promo' ? promos : clips; }
  function countElFor(kind) { return kind === 'promo' ? el.promoCount : el.clipCount; }

  /* ---------- editable video titles ----------
     The uploaded file name ("81412.mp4") is the only label a creator sees, so
     it is the label they can edit. The saved title follows the clip id, so it
     survives a refresh and shows wherever the clip is listed; clearing it falls
     back to the file name without its extension. The store itself lives in
     clip-title-store.ts and publishes window.LNR_CLIP_TITLES, because this file
     is plain JS and cannot import a TS module directly. */
  function clipTitle(id, filename) {
    var api = window.LNR_CLIP_TITLES;
    if (api && typeof api.clipDisplayName === 'function') {
      try { return api.clipDisplayName(id, filename); } catch (e) {}
    }
    var base = String(filename || '').split('/').pop().split('\\').pop();
    return base.replace(/\.[^.]+$/, '').trim();
  }

  function saveClipTitle(id, value) {
    var api = window.LNR_CLIP_TITLES;
    if (api && typeof api.saveClipDisplayName === 'function') {
      try { return api.saveClipDisplayName(id, value); } catch (e) {}
    }
    return String(value || '').trim().slice(0, 60);
  }

  /* Rename in place: click the name, type, Enter or clicking away saves,
     Escape cancels. Clearing the field restores the file name. */
  function startClipRename(span, cc, index) {
    if (!span || span.getAttribute('contenteditable') === 'true') return;
    var original = clipTitle(cc.id, cc.name);
    span.textContent = original;
    span.setAttribute('contenteditable', 'true');
    span.classList.add('is-editing');
    span.focus();
    try {
      var range = document.createRange();
      range.selectNodeContents(span);
      var sel = window.getSelection();
      if (sel) { sel.removeAllRanges(); sel.addRange(range); }
    } catch (e) {}

    var done = false;
    function finish(commit) {
      if (done) return;
      done = true;
      span.removeAttribute('contenteditable');
      span.classList.remove('is-editing');
      var saved = commit ? saveClipTitle(cc.id, span.textContent) : original;
      var shown = saved || clipTitle(cc.id, cc.name);
      span.textContent = (index + 1) + '. ' + shown;
      if (!commit) return;
      toast(saved ? 'Video title saved' : 'Title cleared — showing the file name');
      renderClips();
    }
    span.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); span.blur(); }
      else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
    });
    span.addEventListener('blur', function () { finish(true); });
  }

  function renderMedia(kind) {
    var host = listFor(kind);
    var items = itemFor(kind);
    if (!host) return;
    host.innerHTML = '';
    items.forEach(function (cc, i) {
      var li = document.createElement('li');
      if (cc.id) li.setAttribute('data-clip-id', cc.id);
      var name = document.createElement('span');
      name.className = 'clip-name';
      var shownName = kind === 'clip' ? clipTitle(cc.id, cc.name) : cc.name;
      name.textContent = (i + 1) + '. ' + shownName;
      if (kind === 'clip') {
        name.classList.add('is-editable');
        name.title = 'Click to rename this video';
        name.setAttribute('tabindex', '0');
        name.setAttribute('role', 'button');
        name.setAttribute('aria-label', 'Rename ' + shownName);
        name.addEventListener('click', function (e) {
          e.stopPropagation();
          startClipRename(name, cc, i);
        });
        name.addEventListener('keydown', function (e) {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          startClipRename(name, cc, i);
        });
      }
      var size = document.createElement('span');
      size.className = 'clip-size';
      size.textContent = (cc.duration ? clock(cc.duration * 1000) + ' \u00b7 ' : '') + humanSize(cc.size);
      var ownership = cc.ownership || 'reference';
      var badge = document.createElement('span');
      badge.className = 'clip-ownership';
      badge.setAttribute('data-ownership', ownership);
      badge.textContent = ownership === 'own' ? 'Owned' : 'Reference';
      badge.title = ownership === 'own' ? 'You own this video — no disclaimer' : 'Reference clip — disclaimer plays before video';
      var btn = document.createElement('button');
      btn.className = 'clip-remove';
      btn.type = 'button';
      btn.setAttribute('aria-label', 'Remove ' + cc.name);
      btn.textContent = '\u2715';
      btn.addEventListener('click', function () {
        idbDelete(cc.id).then(function () {
          var arr = itemFor(kind).filter(function (x) { return x.id !== cc.id; });
          if (kind === 'promo') promos = arr; else clips = arr;
          if (clipURLs[cc.id]) { URL.revokeObjectURL(clipURLs[cc.id]); delete clipURLs[cc.id]; }
          if (standbyPrepared.id === cc.id) {
            standbyPrepared = { deckIdx: -1, id: '', url: '', index: -1 };
          }
          renderClips();
          if (!arr.length && live.phase === (kind === 'promo' ? 'promo' : 'video')) showVideoEmpty();
          else if (live.inSession && live.phase === 'video' && kind !== 'promo') {
            var av = activeVideo();
            if (av) av.loop = (arr.length === 1);
            if (arr.length > 1) preloadStandbyClip((live.clipIndex + 1) % arr.length);
          }
          toast((kind === 'promo' ? 'Break clip' : 'Clip') + ' removed');
        });
      });
      li.appendChild(name); li.appendChild(size); li.appendChild(badge); li.appendChild(btn);
      host.appendChild(li);
    });
    var ce = countElFor(kind);
    if (ce) {
      var shownCount = kind === 'promo' ? effectivePromoList().length : items.length;
      ce.textContent = shownCount + (shownCount === 1 ? ' clip' : ' clips');
    }
  }

  /* read a video's length without loading it into the stage */
  function probeDuration(file) {
    return new Promise(function (resolve) {
      var url = URL.createObjectURL(file);
      var v = document.createElement('video');
      v.preload = 'metadata';
      var done = false;
      function finish(d) {
        if (done) return;
        done = true;
        URL.revokeObjectURL(url);
        resolve(d);
      }
      v.onloadedmetadata = function () {
        finish(isFinite(v.duration) && v.duration > 0 ? v.duration : 0);
      };
      v.onerror = function () { finish(0); };
      window.setTimeout(function () { finish(isFinite(v.duration) && v.duration > 0 ? v.duration : 0); }, 5000);
      v.src = url;
    });
  }

  function storeMedia(f, kind) {
    var isVideo = f && (/^video\//i.test(f.type || '') || /\.(mp4|webm|mov|m4v|ogv|mkv)$/i.test(f.name || ''));
    if (!isVideo) { toast('That file is not a video', true); return; }
    if (kind === 'clip' && (clips.length + pendingClipUploads) >= MAX_VIDEOS) {
      toast('Studio allows up to ' + MAX_VIDEOS + ' uploaded prerecorded video clips', true);
      return;
    }
    if (kind === 'promo' && (promos.length + pendingPromoUploads) >= MAX_PROMOS) {
      toast('Studio allows up to ' + MAX_PROMOS + ' uploaded channel break clips', true);
      return;
    }
    var targetArr = kind === 'admin_promo' ? adminPromos : (kind === 'promo' ? promos : clips);
    var alreadyDup = targetArr.some(function (x) {
      return x.name === f.name && x.size === f.size;
    });
    if (alreadyDup) {
      toast('Skipped duplicate clip: ' + f.name);
      return;
    }

    function persistableMediaBlob(file) {
      if (!file) return Promise.resolve(null);
      if (typeof file.arrayBuffer !== 'function' || (file.size && file.size > 150 * 1024 * 1024)) {
        return Promise.resolve(file);
      }
      return file.arrayBuffer().then(function (buf) {
        return new Blob([buf], { type: file.type || 'video/mp4' });
      }).catch(function () {
        return file;
      });
    }

    if (kind === 'promo') pendingPromoUploads++;
    if (kind === 'clip') pendingClipUploads++;
    var prefix = kind === 'admin_promo' ? 'apromo_' : (kind === 'promo' ? 'promo_' : 'clip_');
    var id = prefix + now() + '_' + Math.random().toString(36).slice(2, 7);
    var storedBlobRef = f;
    probeDuration(f).then(function (d) {
      if ((kind === 'promo' || kind === 'admin_promo') && d > PROMO_MAX_SEC) {
        toast('Break clip rejected: ' + clock(d * 1000) + ' is over the 5:00 limit', true);
        return null;
      }
      return persistableMediaBlob(f).then(function (ownedBlob) {
        storedBlobRef = ownedBlob || f;
        return idbPut({ id: id, name: f.name, size: f.size, blob: storedBlobRef, kind: kind, duration: d, enabled: true, ownership: 'own' }).then(function () { return d; });
      });
    }).then(function (d) {
      if (kind === 'promo' && pendingPromoUploads > 0) pendingPromoUploads--;
      if (kind === 'clip' && pendingClipUploads > 0) pendingClipUploads--;
      if (d === null) return;
      /* A clip the creator uploaded from their own device is theirs: it plays
         straight away. It used to default to 'reference', which parked a
         full-screen "this clip is reference material" card over the video and
         held playback at 0:00 until a long voice read finished - so an
         uploaded video looked as if it had failed to load while a Bible /
         Faith branded reference card sat on air. The Reference toggle is
         still there for anyone who does want that notice. */
      var rec = { id: id, name: f.name, size: f.size, duration: d || 0, enabled: true, ownership: 'own' };
      if (!clipURLs[id]) clipURLs[id] = URL.createObjectURL(storedBlobRef);
      if (kind === 'admin_promo') adminPromos.push(rec);
      else if (kind === 'promo') {
        promos.push(rec);
        /* Uploading a clip never turns the break schedule on. */
        save();
      } else {
        clips.push(rec);
        demoVideoMode = false;
      }
      renderClips();
      if (live.inSession && live.phase === 'video' && kind === 'clip') {
        var av = activeVideo();
        if (av) av.loop = (clips.length === 1);
        if (clips.length > 1) preloadStandbyClip((live.clipIndex + 1) % clips.length);
      }
      toast(kind === 'promo' && !S.promoAdsEnabled
        ? 'Promo breaks are off. Turn them on to use this clip.'
        : ('Added ' + f.name + (d ? ' \u00b7 ' + clock(d * 1000) : '')));
    }).catch(function () {
      if (kind === 'promo' && pendingPromoUploads > 0) pendingPromoUploads--;
      if (kind === 'clip' && pendingClipUploads > 0) pendingClipUploads--;
      toast('Could not store that clip on this device', true);
    });
  }

  function handleClipFiles(list, kind) {
    if (!list || !list.length) return;
    Array.prototype.forEach.call(list, function (f) { storeMedia(f, kind || 'clip'); });
  }

  on(el.videoInput, 'change', function () {
    handleClipFiles(el.videoInput.files, 'clip');
    el.videoInput.value = '';
    // Existing video-upload success surface: a clip was stored.
    try {
      if (window.LNR_TRACK && typeof window.LNR_TRACK === 'function') {
        window.LNR_TRACK('video_upload', { user_type: S.isPro ? 'pro' : 'free' });
      }
    } catch (e) {}
  });
  on(el.loadDemoVideoBtn, 'click', function () {
    demoVideoMode = !demoVideoMode;
    if (el.demoVideoStatus) {
      el.demoVideoStatus.textContent = demoVideoMode
        ? 'Built-in 15s demo ready — press Start video session below to preview.'
        : 'Try Engine 03 right now without uploading an MP4.';
    }
    if (el.loadDemoVideoBtn) {
      el.loadDemoVideoBtn.textContent = demoVideoMode ? 'Demo Video Ready (Tap to Disable)' : 'Preview 15s Built-in Video Demo';
    }
    refreshStats();
    toast(demoVideoMode ? '15s Video Engine demo enabled' : 'Video Engine demo disabled');
  });
  on(el.ownVideoBtn, 'click', function () {
    applyOwnershipToAll('own');
    if (el.videoOwnershipTag) el.videoOwnershipTag.textContent = 'I own this video';
    // Immediately dismiss any showing preroll since we now own the video
    if (prerollActive) dismissPreroll();
    toast('Disclaimer off — videos play straight away');
  });
  on(el.refVideoBtn, 'click', function () {
    applyOwnershipToAll('reference');
    if (el.videoOwnershipTag) el.videoOwnershipTag.textContent = 'Reference / source video';
    toast('Disclaimer on — reference notice plays before video starts');
  });
  on(el.promoInput, 'change', function () {
    handleClipFiles(el.promoInput.files, 'promo');
    el.promoInput.value = '';
  });
  on(el.adminPromoFolderInput, 'change', function () {
    handleClipFiles(el.adminPromoFolderInput.files, 'admin_promo');
    el.adminPromoFolderInput.value = '';
  });
  on(el.adminPromoFilesInput, 'change', function () {
    handleClipFiles(el.adminPromoFilesInput.files, 'admin_promo');
    el.adminPromoFilesInput.value = '';
  });
  /* NOTE: the demo toggle is bound ONCE, above (near the video upload
     handlers). A second identical handler used to be bound here as well, and
     because each one flips `demoVideoMode`, a single click toggled it twice and
     left it unchanged — the button looked dead and the video engine could never
     be started without an upload. Do not re-add a second binding. */

  [[el.videoDrop, 'clip'], [el.promoDrop, 'promo']].forEach(function (pair) {
    var zone = pair[0], kind = pair[1];
    ['dragenter', 'dragover'].forEach(function (ev) {
      on(zone, ev, function (e) { e.preventDefault(); zone.classList.add('is-over'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      on(zone, ev, function (e) { e.preventDefault(); zone.classList.remove('is-over'); });
    });
    on(zone, 'drop', function (e) {
      if (e.dataTransfer && e.dataTransfer.files) handleClipFiles(e.dataTransfer.files, kind);
    });
  });

  /* ---------- loop calculator ---------- */
  function playlistSeconds(items) {
    var t = 0;
    items.forEach(function (cc) { t += (cc.duration || 0); });
    return t;
  }

  function refreshLoopMath() {
    var per = playlistSeconds(clips);
    var targetH = effectiveLoopHours();
    var targetS = targetH * 3600;
    if (el.lmDuration) el.lmDuration.textContent = per ? clock(per * 1000) : (demoVideoMode ? '00:15' : '\u2014');
    if (el.loopClipInfo) {
      el.loopClipInfo.textContent = clips.length
        ? clips.length + (clips.length === 1 ? ' video' : ' videos') + (per ? ' \u00b7 ' + clock(per * 1000) : '')
        : (demoVideoMode ? '15s built-in animated demo enabled (does not use your upload slot).' : 'Add your prerecorded video or tap Preview 15s Demo above.');
    }
    if (!per && demoVideoMode) {
      var dLoops = Math.max(1, Math.ceil(targetS / 15));
      var dTotalS = dLoops * 15;
      if (el.lmLoops) el.lmLoops.textContent = dLoops + '\u00d7';
      if (el.lmTotal) el.lmTotal.textContent = clock(dTotalS * 1000);
      if (el.loopNote) el.loopNote.textContent = '15s built-in Demo Canvas loops seamlessly to test Engine 03.';
    } else if (!per) {
      if (el.lmLoops) el.lmLoops.textContent = '\u2014';
      if (el.lmTotal) el.lmTotal.textContent = '\u2014';
      if (el.loopNote) el.loopNote.textContent = 'Add your prerecorded videos and the loop count appears here.';
    } else {
      var loops = Math.max(1, Math.ceil(targetS / per));
      var totalS = loops * per;
      if (el.lmLoops) el.lmLoops.textContent = loops + '\u00d7';
      if (el.lmTotal) el.lmTotal.textContent = clock(totalS * 1000);
      if (el.loopNote) {
        el.loopNote.textContent = targetH + ' hr on air = ' + loops + ' playback' + (loops === 1 ? '' : 's') +
          ' of ' + clock(per * 1000) + ' \u2192 ' + clock(totalS * 1000) + ' total, unbroken.';
      }
    }
    Array.prototype.forEach.call(document.querySelectorAll('#loopPresets .preset'), function (b) {
      var h = Number(b.getAttribute('data-hours'));
      b.classList.toggle('is-selected', Math.abs(h - targetH) < 0.001);
      b.disabled = false;
      b.title = '';
    });
  }

  function refreshPromoText() {
    S.promoAdSec = Math.max(15, Math.min(300, Number(S.promoAdSec) || 30));
    S.promoIntervalMin = Math.max(5, Math.min(60, Number(S.promoIntervalMin) || 10));
    var secs = effectivePromoAdSec();
    var intervalMin = effectivePromoIntervalMin();
    var enabled = !!S.promoAdsEnabled;
    var activePromos = effectivePromoList();
    if (el.promoToggleMeta) el.promoToggleMeta.textContent = enabled ? 'Enabled' : 'Breaks off';
    if (el.drawerPromoTag) el.drawerPromoTag.textContent = enabled ? 'Breaks on' : 'Breaks off';
    if (el.promoConfigWrap) el.promoConfigWrap.hidden = !enabled;
    if (el.promoAdLabel) el.promoAdLabel.textContent = formatShortSec(secs);
    if (el.promoAdRange && Number(el.promoAdRange.value) !== secs) el.promoAdRange.value = secs;
    if (el.promoSec && Number(el.promoSec.value) !== secs) el.promoSec.value = secs;
    if (el.setupPromoIntervalMin && Number(el.setupPromoIntervalMin.value) !== intervalMin) el.setupPromoIntervalMin.value = intervalMin;
    if (el.promoIntervalMin && Number(el.promoIntervalMin.value) !== intervalMin) el.promoIntervalMin.value = intervalMin;
    if (el.promoCalc) {
      el.promoCalc.textContent = !enabled
        ? 'Breaks off (uninterrupted)'
        : (activePromos.length
          ? activePromos.length + (activePromos.length === 1 ? ' clip \u00b7 after ' + intervalMin + 'm+ quiz' : ' clips \u00b7 after ' + intervalMin + 'm+ quiz')
          : 'After ' + intervalMin + 'm+ quiz & milestone (' + formatShortSec(secs) + ' slot)');
    }
    if (el.promoNote) {
      el.promoNote.textContent = !enabled
        ? 'Channel breaks are off. Your stream runs uninterrupted quiz rounds and 10-question milestones.'
        : (activePromos.length
          ? 'Milestones appear every 10 questions. After ' + intervalMin + ' min of uninterrupted quiz, a brief Partner Break notice plays 1 break clip (' + activePromos.length + ' available) right after the milestone.'
          : 'Milestones appear every 10 questions. After ' + intervalMin + ' min of uninterrupted quiz, a brief Partner Break notice plays 1 slot (' + formatShortSec(secs) + ') right after the milestone.');
    }
    Array.prototype.forEach.call(document.querySelectorAll('[data-promosec]'), function (b) {
      b.classList.toggle('is-selected', Number(b.getAttribute('data-promosec')) === secs);
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-promointerval]'), function (b) {
      b.classList.toggle('is-selected', Number(b.getAttribute('data-promointerval')) === intervalMin);
    });
  }

  on(el.promoAdRange, 'input', function () {
    S.promoAdSec = Math.max(15, Math.min(300, parseInt(el.promoAdRange.value, 10) || 30));
    save(); refreshPromoText(); refreshStats(); syncInputs();
  });

  Array.prototype.forEach.call(document.querySelectorAll('[data-promosec]'), function (b) {
    on(b, 'click', function () {
      S.promoAdSec = Number(b.getAttribute('data-promosec')) || 30;
      save(); refreshPromoText(); refreshStats(); syncInputs();
    });
  });

  Array.prototype.forEach.call(document.querySelectorAll('[data-promointerval]'), function (b) {
    on(b, 'click', function () {
      S.promoIntervalMin = Math.max(5, Math.min(60, Number(b.getAttribute('data-promointerval')) || 10));
      save(); refreshPromoText(); refreshStats(); syncInputs();
    });
  });

  Array.prototype.forEach.call(document.querySelectorAll('#loopPresets .preset'), function (b) {
    on(b, 'click', function () {
      var h = Number(b.getAttribute('data-hours'));
      S.loopHours = h;
      if (el.loopHours) el.loopHours.value = S.loopHours;
      if (el.loopHoursDrawer) el.loopHoursDrawer.value = S.loopHours;
      save(); refreshLoopMath(); refreshStats();
    });
  });

  on(el.loopHours, 'input', function () {
    var v = parseFloat(el.loopHours.value);
    if (isNaN(v)) return;
    S.loopHours = Math.max(0.1, Math.min(168, v));
    if (el.loopHoursDrawer) el.loopHoursDrawer.value = S.loopHours;
    save(); refreshLoopMath(); refreshStats();
  });

  on(el.loopHoursDrawer, 'input', function () {
    var v = parseFloat(el.loopHoursDrawer.value);
    if (isNaN(v)) return;
    S.loopHours = Math.max(0.1, Math.min(168, v));
    if (el.loopHours) el.loopHours.value = S.loopHours;
    save(); refreshLoopMath(); refreshStats();
  });

  /* ---------- video playback & built-in 15s demo canvas ---------- */
  var videoDecks = [el.stageVideo, el.stageVideoB].filter(Boolean);
  var activeDeckIdx = 0;
  var videoGen = 0;
  var videoTransitioning = false;
  var videoXfadeTimer = 0;
  var demoCanvasRaf = 0;
  var demoCanvasStart = 0;
  var standbyPrepared = { deckIdx: -1, id: '', url: '', index: -1 };
  var CROSSFADE_LEAD_SEC = 0.48;
  var CROSSFADE_MS = 460;
  var prerollActive = false;
  var prerollTimer = 0;
  var PREROLL_MS = 10000;
  /* Kept for the hold the quiz block used to run behind its "UP NEXT" notice.
     The notice now lives with the video engine, so nothing sets quizStartAt
     from here; the constant stays so external code reading it still resolves. */
  var QUIZ_START_NOTICE_MS = 10000;
  var PREROLL_VOICE = 'Video used as reference. This clip is the reference used to generate the quiz and anecdote breaks. The clip is attributed as reference material. Own the video or use it for reference at your discretion.';

  function activeVideo() {
    return videoDecks[activeDeckIdx] || el.stageVideo;
  }

  function findMediaRecordById(id) {
    var i;
    if (id === STUDIO_PROMO_ID) return STUDIO_PROMO;
    for (i = 0; i < adminPromos.length; i++) if (adminPromos[i].id === id) return adminPromos[i];
    for (i = 0; i < defaultFolderPromos.length; i++) if (defaultFolderPromos[i].id === id) return defaultFolderPromos[i];
    for (i = 0; i < promos.length; i++) if (promos[i].id === id) return promos[i];
    for (i = 0; i < clips.length; i++) if (clips[i].id === id) return clips[i];
    return null;
  }

  function clipFor(id) {
    if (clipURLs[id]) return Promise.resolve(clipURLs[id]);
    var known = findMediaRecordById(id);
    if (known && known.externalUrl) {
      clipURLs[id] = known.externalUrl;
      return Promise.resolve(known.externalUrl);
    }
    return db().then(function (d) {
      return new Promise(function (resolve) {
        var tx = d.transaction('clips', 'readonly');
        var rq = tx.objectStore('clips').get(id);
        rq.onsuccess = function () {
          var rec = rq.result;
          if (!rec || !rec.blob) { resolve(null); return; }
          var url = URL.createObjectURL(rec.blob);
          clipURLs[id] = url;
          resolve(url);
        };
        rq.onerror = function () { resolve(null); };
      });
    }).catch(function () { return null; });
  }

  var promoRefreshedIds = {};
  var promoFailedIds = {};

  function refreshClipUrl(id) {
    var known = findMediaRecordById(id);
    if (known && known.externalUrl) {
      clipURLs[id] = known.externalUrl;
      return Promise.resolve(known.externalUrl);
    }
    if (clipURLs[id]) {
      try { URL.revokeObjectURL(clipURLs[id]); } catch (e) {}
      delete clipURLs[id];
    }
    return clipFor(id);
  }

  function withClipUrl(id, cb) {
    if (clipURLs[id]) { cb(clipURLs[id]); return; }
    clipFor(id).then(cb);
  }

  function warmClipUrls(list) {
    (list || []).forEach(function (cc) {
      if (cc && cc.id && !clipURLs[cc.id]) clipFor(cc.id);
    });
  }

  function activeList() { return live.phase === 'promo' ? effectivePromoList() : clips; }

  function preloadStandbyClip(nextIndex) {
    if (videoDecks.length < 2 || !live.inSession || live.phase !== 'video') return;
    var list = activeList();
    if (list.length < 2) return;
    nextIndex = ((nextIndex % list.length) + list.length) % list.length;
    var cc = list[nextIndex];
    if (!cc) return;
    var sbIdx = 1 - activeDeckIdx;
    var sb = videoDecks[sbIdx];
    if (!sb) return;
    if (standbyPrepared.deckIdx === sbIdx && standbyPrepared.id === cc.id && standbyPrepared.url) return;

    var gen = videoGen;
    withClipUrl(cc.id, function (url) {
      if (!url || gen !== videoGen || !live.inSession || live.phase !== 'video') return;
      if ((1 - activeDeckIdx) !== sbIdx) return;
      sb.hidden = false;
      sb.className = 'is-standby';
      sb.muted = true;
      sb.loop = false;
      sb.preload = 'auto';
      if (sb.getAttribute('data-clip-id') !== cc.id) {
        sb.src = url;
        sb.setAttribute('data-clip-id', cc.id);
        try { sb.load(); } catch (e) {}
      } else {
        try { sb.pause(); sb.currentTime = 0; } catch (e) {}
      }
      standbyPrepared = { deckIdx: sbIdx, id: cc.id, url: url, index: nextIndex };
    });
  }

  function clipOwnership(id) {
    if (!id) return 'reference';
    var rec = findMediaRecordById(id);
    if (rec && rec.ownership) return rec.ownership;
    for (var i = 0; i < clips.length; i++) {
      if (clips[i].id === id && clips[i].ownership) return clips[i].ownership;
    }
    return 'reference';
  }

  function setClipOwnership(id, ownership) {
    if (!id || !ownership) return;
    ownership = ownership === 'own' ? 'own' : 'reference';
    for (var i = 0; i < clips.length; i++) {
      if (clips[i].id === id) { clips[i].ownership = ownership; break; }
    }
    /* Read the full DB record so we do not wipe blob/kind/enabled when
       writing back the ownership change. */
    idbGetStore('clips', id).then(function (full) {
      if (full) {
        full.ownership = ownership;
        return idbPut(full).catch(function () {});
      }
    });
    renderClips();
    refreshStats();
  }

  function applyOwnershipToAll(ownership) {
    ownership = ownership === 'own' ? 'own' : 'reference';
    var updated = false;
    clips.forEach(function (c) {
      if (c.ownership !== ownership) {
        c.ownership = ownership;
        updated = true;
      }
    });
    if (updated) {
      clips.forEach(function (c) {
        idbGetStore('clips', c.id).then(function (full) {
          if (full) { full.ownership = ownership; return idbPut(full).catch(function () {}); }
        });
      });
      renderClips();
      refreshStats();
    }
  }

  /* The intro disclaimer is READ first, then counted down. It used to run a
     fixed 10-second clock, which cut the voice off mid-sentence and lifted the
     card while the viewer was still being told what the clip is — the stream
     appeared to jump into the video during the disclaimer.

     Now: the card says "Reading…" with an empty bar while the voice speaks, the
     clip is held on its first frame (transitionToClip does not autoplay while
     prerollActive), and only when the reading ends does the 10-second countdown
     run. If the reader is off, or the device never speaks, the fallback reading
     time (words / 2.5 + 1) is used, so the card can never hang.
     One reader for the whole app: window.LNR_READER, published by
     break-voice.ts, the same module the break cards use. */
  function startPreroll() {
    if (prerollActive) return;
    // Don't show preroll during stream-safe mode for owned videos
    // (reference videos still show the disclaimer)
    var overlay = el.videoPreroll;
    if (!overlay) return;
    prerollActive = true;
    overlay.hidden = false;
    overlay.classList.remove('is-interactive');

    var bar = el.videoPrerollBar;
    var timer = el.videoPrerollTimer;
    var voiceTag = el.videoPrerollVoice;
    var voiceText = PREROLL_VOICE;
    if (bar) bar.style.width = '0%';
    if (timer) timer.textContent = 'Reading…';

    var reader = window.LNR_READER;
    var narration = null;
    if (reader && typeof reader.startNarration === 'function') {
      try { narration = reader.startNarration([voiceText]); } catch (e) { narration = null; }
    }
    var readSeconds = (reader && typeof reader.fallbackReadSeconds === 'function')
      ? reader.fallbackReadSeconds(voiceText)
      : 14;

    /* The onscreen reader is a visible part of the card, not a hidden voice:
       the operator and the audience must be able to see that the disclaimer is
       being read. It stays up for as long as the voice is speaking. */
    if (voiceTag) voiceTag.hidden = !narration;

    var reading = !!narration;
    var readDoneAt = reading ? 0 : now();
    var started = now();

    function takeDown() {
      prerollActive = false;
      if (overlay) overlay.hidden = true;
      if (voiceTag) voiceTag.hidden = true;
      if (overlay && overlay._prerollVoice && overlay._prerollVoice.stop) overlay._prerollVoice.stop();
      if (overlay) overlay._prerollVoice = null;
    }

    if (prerollTimer) window.clearInterval(prerollTimer);
    prerollTimer = window.setInterval(function () {
      if (!live.inSession || live.phase !== 'video' || !prerollActive) {
        window.clearInterval(prerollTimer);
        prerollTimer = 0;
        /* The stage moved on (stop, exit, another engine). Take the card down
           without ever starting playback. */
        if (prerollActive) takeDown();
        return;
      }

      if (reading) {
        var waited = now() - started;
        var speaking = !!(narration && typeof narration.speaking === 'function' && narration.speaking());
        var heard = !!(narration && typeof narration.started === 'function' && narration.started());

        if (speaking) {
          /* Never count down under the voice. Only a synthesiser that never
             goes quiet is cut off, and it gets a wide margin. */
          if (waited <= (readSeconds + 30) * 1000) {
            if (bar) bar.style.width = '0%';
            if (timer) timer.textContent = 'Reading…';
            if (voiceTag) voiceTag.hidden = false;
            return;
          }
        } else if (!heard && waited < readSeconds * 1000) {
          /* The voice has not started yet: give it the fallback reading time
             before counting down, so a phone that needs a beat to speak is not
             skipped straight past the disclaimer. */
          if (bar) bar.style.width = '0%';
          if (timer) timer.textContent = 'Reading…';
          if (voiceTag) voiceTag.hidden = false;
          return;
        }
        /* The reader has finished (or never spoke). Only now does the
           countdown begin, so the timer can never cut the voice off. */
        reading = false;
        readDoneAt = now();
        if (voiceTag) voiceTag.hidden = true;
      }

      if (!readDoneAt) readDoneAt = now();
      var elapsed = Math.max(0, now() - readDoneAt);
      var left = Math.max(0, PREROLL_MS - elapsed);
      if (bar) bar.style.width = Math.min(100, (elapsed / PREROLL_MS) * 100).toFixed(1) + '%';
      if (timer) timer.textContent = Math.max(1, Math.ceil(left / 1000)) + 's';
      if (left <= 0) dismissPreroll();
    }, 100);

    overlay._prerollVoice = narration;
  }

  function dismissPreroll() {
    if (!prerollActive) return;
    prerollActive = false;
    if (prerollTimer) { window.clearInterval(prerollTimer); prerollTimer = 0; }
    var overlay = el.videoPreroll;
    if (overlay) {
      overlay.hidden = true;
      overlay.onclick = null;
    }
    if (overlay._prerollVoice && overlay._prerollVoice.stop) overlay._prerollVoice.stop();
    overlay._prerollVoice = null;
    // Reset the interactive notice flag so it shows for the next clip
    interactiveNoticeDismissed = false;
    if (live.inSession && live.phase === 'video' && !live.paused) {
      var av = activeVideo();
      if (av) {
        var p = av.play();
        if (p && p.catch) {
          /* The preroll card was dismissed, but the browser may still refuse
             to start a clip with sound (no user gesture yet). Swallowing that
             left the stage on a frozen first frame forever. Fall back to a
             muted start and surface the unmute control, exactly as the
             transition path does. */
          p.catch(function () {
            av.muted = true;
            if (el.videoUnmuteBtn) el.videoUnmuteBtn.hidden = false;
            var p2 = av.play();
            if (p2 && p2.catch) p2.catch(function () {});
          });
        }
      }
    }
  }

  /* ---------- owned-video + breaks notice ---------- */
  var interactiveNoticeTimer = 0;
  var interactiveNoticeDismissed = false;

  /* True only when this clip has quiz & anecdote breaks switched on. The engine
     is plain JS and cannot import break-parser, so it reads the same store
     record the break panel writes (STORAGE_KEY 'lnr_video_breaks_v1'), one
     entry per clip id. Fail-closed: an unreadable store means no notice. */
  function breaksEnabledFor(clipId) {
    if (!clipId) return false;
    try {
      var raw = localStorage.getItem('lnr_video_breaks_v1');
      if (!raw) return false;
      var store = JSON.parse(raw);
      var rec = store && store[clipId];
      if (!rec || typeof rec !== 'object') return false;
      /* Breaks are only real when there is a quiz file to run: 'on' alone with
         nothing uploaded would announce a break that never comes. */
      return !!rec.on && (!!rec.quiz || !!rec.anecdote);
    } catch (e) {
      return false;
    }
  }

  /* The one disclaimer that belongs to this flow: the operator told us they own
     the clip AND switched quiz & anecdote breaks on. It states what happens to
     the footage and that the operator holds the rights. Nothing else shows it —
     not a reference clip, not an owned clip with breaks off. */
  function showOwnedBreaksNotice() {
    if (!el.videoPreroll) return;
    if (interactiveNoticeDismissed) return;
    if (prerollActive) return;

    var overlay = el.videoPreroll;
    var pill = el.videoPrerollPill;
    var title = el.videoPrerollTitle;
    var body = el.videoPrerollBody;

    if (!overlay || !pill || !title || !body) return;

    overlay.hidden = false;
    overlay.classList.add('is-interactive');
    pill.textContent = 'YOUR VIDEO';
    title.textContent = 'Quiz & anecdotes from your video';
    body.textContent =
      'This video is yours and you have confirmed you own the right to use it. ' +
      'It is used to generate the quiz and anecdote breaks that appear as it plays. ' +
      'Jump in when the questions show up.';

    var bar = el.videoPrerollBar;
    if (bar) bar.style.width = '0%';
    var timer = el.videoPrerollTimer;
    if (timer) timer.textContent = 'Tap to dismiss';

    if (interactiveNoticeTimer) window.clearTimeout(interactiveNoticeTimer);
    interactiveNoticeTimer = window.setTimeout(function () {
      dismissInteractiveNotice();
    }, 6000);

    overlay.onclick = function () {
      dismissInteractiveNotice();
    };
  }

  function dismissInteractiveNotice() {
    if (interactiveNoticeTimer) {
      window.clearTimeout(interactiveNoticeTimer);
      interactiveNoticeTimer = 0;
    }
    var overlay = el.videoPreroll;
    if (overlay) {
      overlay.hidden = true;
      overlay.onclick = null;
    }
    interactiveNoticeDismissed = true;
  }

  function currentInteractiveDisclaimer() {
    try {
      var raw = localStorage.getItem('lnr_video_disclaimer_v1');
      if (!raw) return 'This clip is part of an interactive session: a short quiz and a quick anecdote will appear as the video plays. Jump in when the questions show up.';
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed.copy === 'string' && parsed.copy.trim()) {
        return parsed.copy.trim();
      }
      return 'This clip is part of an interactive session: a short quiz and a quick anecdote will appear as the video plays. Jump in when the questions show up.';
    } catch (e) {
      return 'This clip is part of an interactive session: a short quiz and a quick anecdote will appear as the video plays. Jump in when the questions show up.';
    }
  }

  function transitionToClip(index) {
    var list = activeList();
    if (!list.length) { showVideoEmpty(); return; }
    index = ((index % list.length) + list.length) % list.length;
    var cc = list[index];
    if (!cc) { showVideoEmpty(); return; }

    warmClipUrls(list);
    if (videoXfadeTimer) {
      window.clearTimeout(videoXfadeTimer);
      videoXfadeTimer = 0;
    }

    var gen = videoGen;
    withClipUrl(cc.id, function (url) {
      if (gen !== videoGen || !live.inSession || (live.phase !== 'video' && live.phase !== 'promo')) return;
      if (!url) { showVideoEmpty(); return; }

      var listNow = activeList();
      if (!listNow.length) { showVideoEmpty(); return; }
      var curV = activeVideo();
      var shouldCrossfade = (videoDecks.length > 1) &&
        (live.phase === 'video') &&
        listNow.length > 1 &&
        curV &&
        !curV.hidden &&
        (curV.getAttribute('data-clip-id') || '') !== '' &&
        curV.readyState >= 1;

      if (!shouldCrossfade) {
        var deck = curV || el.stageVideo;
        if (!deck) return;
        videoTransitioning = false;
        videoDecks.forEach(function (d, i) {
          if (i === activeDeckIdx) return;
          d.className = 'is-standby';
          d.hidden = true;
          try { d.pause(); } catch (e) {}
        });
        var needLoad = (deck.getAttribute('data-clip-id') !== cc.id) || !deck.getAttribute('src') || deck.networkState === 0 || deck.networkState === 3 || !!deck.error;
        if (needLoad) {
          deck.setAttribute('data-clip-id', cc.id);
          deck.src = url;
          try { deck.load(); } catch (e) {}
        }
        deck.playsInline = true;
        deck.setAttribute('playsinline', '');
        deck.loop = (live.phase !== 'promo') && (listNow.length === 1);
        deck.muted = false;
        deck.volume = 1;
        if (el.promoUnmuteBtn) el.promoUnmuteBtn.hidden = true;
        try {
          if (deck.readyState >= 1 && deck.currentTime > 0.05) deck.currentTime = 0;
        } catch (e) {}
        deck.hidden = false;
        deck.className = 'is-active';
        if (el.videoEmpty) el.videoEmpty.hidden = true;
        live.clipIndex = index;
        if (!live.paused && !prerollActive) {
          var p = deck.play();
          if (p && p.catch) {
            p.catch(function () {
              /* Autoplay with sound was refused. Muting is the only way to
                 start at all, but a reference clip must still be audible, so
                 surface a control instead of leaving it silently muted. */
              deck.muted = true;
              if (live.phase === 'promo' && el.promoUnmuteBtn) el.promoUnmuteBtn.hidden = false;
              if (live.phase === 'video' && el.videoUnmuteBtn) el.videoUnmuteBtn.hidden = false;
              var p2 = deck.play();
              if (p2 && p2.catch) p2.catch(function () {});
            });
          }
        }
        updateLoopBadge();
        updatePromoBrand();
        updatePromoOverlay();
        if (live.phase === 'video' && listNow.length > 1) {
          preloadStandbyClip((index + 1) % listNow.length);
        }
        return;
      }

      /* Smooth dual-deck crossfade: outgoing stays painted at opacity: 1 underneath
         while preloaded incoming deck fades from 0 -> 1 over CROSSFADE_MS. */
      videoTransitioning = true;
      var outIdx = activeDeckIdx;
      var inIdx = 1 - outIdx;
      var outV = videoDecks[outIdx];
      var inV = videoDecks[inIdx];

      if (inV.getAttribute('data-clip-id') !== cc.id || !inV.getAttribute('src') || inV.networkState === 0) {
        inV.src = url;
        inV.setAttribute('data-clip-id', cc.id);
        try { inV.load(); } catch (e) {}
      }
      inV.loop = false;
      inV.muted = false;
      inV.volume = 1;
      try {
        if (inV.readyState >= 1 && inV.currentTime > 0.05) inV.currentTime = 0;
      } catch (e) {}

      outV.className = 'is-outgoing';
      inV.hidden = false;
      inV.className = 'is-standby';
      void inV.offsetWidth;
      inV.className = 'is-active';

      activeDeckIdx = inIdx;
      live.clipIndex = index;
      if (el.videoEmpty) el.videoEmpty.hidden = true;
      standbyPrepared = { deckIdx: -1, id: '', url: '', index: -1 };

      if (!live.paused && !prerollActive) {
        var pIn = inV.play();
        if (pIn && pIn.catch) {
          pIn.catch(function () {
            inV.muted = true;
            if (live.phase === 'video' && el.videoUnmuteBtn) el.videoUnmuteBtn.hidden = false;
            var pIn2 = inV.play();
            if (pIn2 && pIn2.catch) pIn2.catch(function () {});
          });
        }
      }
      updateLoopBadge();
      updatePromoBrand();
      updatePromoOverlay();

      videoXfadeTimer = window.setTimeout(function () {
        videoXfadeTimer = 0;
        videoTransitioning = false;
        if (gen !== videoGen) return;
        outV.className = 'is-standby';
        try { outV.pause(); } catch (e) {}
        if (live.inSession && live.phase === 'video' && activeList().length > 1) {
          preloadStandbyClip((live.clipIndex + 1) % activeList().length);
        }
      }, CROSSFADE_MS);
    });
  }

  function playClip(index) {
    transitionToClip(index);
  }

  function stopDemoCanvas() {
    if (demoCanvasRaf) {
      window.cancelAnimationFrame(demoCanvasRaf);
      demoCanvasRaf = 0;
    }
    if (el.demoVideoCanvas) el.demoVideoCanvas.hidden = true;
  }

  function startDemoCanvas() {
    if (!el.demoVideoCanvas) return;
    stopDemoCanvas();
    el.demoVideoCanvas.hidden = false;
    if (el.videoEmpty) el.videoEmpty.hidden = true;
    demoCanvasStart = now();
    var ctx = el.demoVideoCanvas.getContext('2d');
    var slides = [
      { title: 'ENGINE 03 \u00b7 DUAL-DECK VIDEO LOOP', sub: 'Preloads clip B while clip A finishes for seamless 24/7 handoffs' },
      { title: 'ZERO-DROP CHANNEL BREAKS', sub: 'Up to 12 prerecorded clips \u00b7 dual-deck crossfade \u00b7 24/7 uptime' },
      { title: 'MOBILE & DESKTOP CAPTURE READY', sub: 'Upload MP4, WebM or MOV directly from device storage \u2014 zero server bandwidth' }
    ];
    function draw() {
      if (!live.inSession || live.phase !== 'video' || clips.length || !demoVideoMode) {
        stopDemoCanvas();
        return;
      }
      var cv = el.demoVideoCanvas;
      if (cv.width !== 960 || cv.height !== 540) { cv.width = 960; cv.height = 540; }
      var elapsedSec = live.paused ? ((live.pausedAt - demoCanvasStart) / 1000) : ((now() - demoCanvasStart) / 1000);
      var cycle = ((elapsedSec % 15) + 15) % 15;
      var slideIdx = Math.min(2, Math.floor(cycle / 5));
      var slideProgress = (cycle % 5) / 5;
      var sl = slides[slideIdx];
      var grad = ctx.createLinearGradient(0, 0, 960, 540);
      grad.addColorStop(0, slideIdx === 0 ? '#0d1a15' : (slideIdx === 1 ? '#111f19' : '#0b1614'));
      grad.addColorStop(1, '#1a2f26');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 960, 540);

      /* subtle motion ring */
      ctx.strokeStyle = 'rgba(207, 163, 90, 0.25)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(480, 270, 170 + Math.sin(elapsedSec * 1.4) * 14, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#cfa35a';
      ctx.font = '600 18px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('BUILT-IN DEMO LOOP \u00b7 SLIDE ' + (slideIdx + 1) + ' OF 3', 480, 200);

      ctx.fillStyle = '#f5efe2';
      ctx.font = '700 34px Georgia, serif';
      ctx.fillText(sl.title, 480, 260);

      ctx.fillStyle = '#b4c2b9';
      ctx.font = '400 20px sans-serif';
      ctx.fillText(sl.sub, 480, 305);

      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(220, 360, 520, 6);
      ctx.fillStyle = '#cfa35a';
      ctx.fillRect(220, 360, 520 * slideProgress, 6);

      ctx.fillStyle = 'rgba(245,239,226,0.5)';
      ctx.font = '500 14px ui-monospace, monospace';
      ctx.fillText('15s seamless preview loop \u00b7 ' + (Math.ceil(15 - cycle)) + 's remaining in loop', 480, 405);

      demoCanvasRaf = window.requestAnimationFrame(draw);
    }
    draw();
  }

  function updatePromoBrand() {
    if (!el.promoBrand) return;
    var ov = S.promoOverlayStyle || 'disclosure';
    var show = live.phase === 'promo' && ov !== 'raw';
    el.promoBrand.hidden = !show;
    if (show && el.promoBrandText) el.promoBrandText.textContent = effectiveBranding().brand || 'LNR STUDIO';
  }

  /* The text-only promo funnel. Shown during a promo break when there is no
     sponsor clip to play, so the break still earns its place: it advertises
     the studio itself and sends viewers to the site. */
  function updatePromoFunnel() {
    if (!el.promoFunnel) return;
    var list = effectivePromoList();
    var show = live.inSession && live.phase === 'promo' && !list.length;
    el.promoFunnel.hidden = !show;
    if (!show) return;

    var b = effectiveBranding();
    if (el.promoFunnelUrl) el.promoFunnelUrl.textContent = b.site || DEFAULT_SITE;
    if (el.promoFunnelKicker) el.promoFunnelKicker.textContent = (b.brand || DEFAULT_BRAND) + ' \u00b7 LIVESTREAM CONTROL ROOM';
    var remMs = Math.max(0, live.phaseEndsAt - (live.paused ? live.pausedAt : now()));
    if (el.promoFunnelClock) el.promoFunnelClock.textContent = clock(remMs);
  }

  function updatePromoOverlay() {
    if (!el.promoAdOverlay) return;
    var ov = S.promoOverlayStyle || 'disclosure';
    var show = live.inSession && live.phase === 'promo' && ov === 'disclosure';
    el.promoAdOverlay.hidden = !show;
    updatePromoFunnel();
    if (!show) {
      if (el.promoUnmuteBtn) el.promoUnmuteBtn.hidden = true;
      return;
    }
    var list = effectivePromoList();
    var adClip = list.length ? list[live.clipIndex % list.length] : null;
    if (el.promoAdBadge) el.promoAdBadge.textContent = 'PARTNER';
    if (el.promoAdTitle) {
      el.promoAdTitle.textContent = adClip ? ('Paid promotion \u00b7 ' + adClip.name) : 'Partner spotlight';
    }
    var nextRound = live.promoReturnPhase === 'players' ? plLive.roundNum : live.quizRoundNum;
    if (el.promoAdReturn) {
      el.promoAdReturn.textContent = 'This round was sponsored by the promo ads \u00b7 Returns to Round ' + nextRound + ' after break';
    }
    var av = activeVideo();
    var remMs;
    if (list.length && av && !av.hidden && isFinite(av.duration) && av.duration > 0) {
      var cappedDur = Math.min(PROMO_MAX_SEC, av.duration);
      remMs = Math.max(0, (cappedDur - (av.currentTime || 0)) * 1000);
    } else {
      remMs = Math.max(0, live.phaseEndsAt - (live.paused ? live.pausedAt : now()));
    }
    if (el.promoAdClock) el.promoAdClock.textContent = clock(remMs);
    if (el.promoUnmuteBtn) {
      el.promoUnmuteBtn.hidden = !(av && !av.hidden && av.muted);
    }
  }

  on(el.promoUnmuteBtn, 'click', function () {
    var av = activeVideo();
    if (av) {
      av.muted = false;
      var p = av.play();
      if (p && p.catch) p.catch(function () {});
    }
    if (el.promoUnmuteBtn) el.promoUnmuteBtn.hidden = true;
    toast('Break clip sound on');
  });

  /* The video engine's own unmute control. A reference clip that autoplay
     refused to start with sound is muted by the browser, not by us; this is
     how the operator restores its audio without leaving the stage. */
  on(el.videoUnmuteBtn, 'click', function () {
    var av = activeVideo();
    if (av) {
      av.muted = false;
      av.volume = 1;
      var p = av.play();
      if (p && p.catch) {
        p.catch(function () {
          /* Still refused. Do not silently re-mute and leave the operator
             guessing: keep the control up and say so. */
          if (el.videoUnmuteBtn) el.videoUnmuteBtn.hidden = false;
          toast('Tap the video once, then tap for sound', true);
        });
      }
    }
    if (el.videoUnmuteBtn) el.videoUnmuteBtn.hidden = true;
    toast('Video sound on');
  });

  function updateLoopBadge() {
    if (el.loopBadge) el.loopBadge.hidden = true;
  }

  function showVideoEmpty() {
    if (live.phase === 'video' && !clips.length && demoVideoMode) {
      videoDecks.forEach(function (v) {
        v.hidden = true;
        v.className = 'is-standby';
        try { v.pause(); } catch (e) {}
      });
      startDemoCanvas();
      return;
    }
    stopDemoCanvas();
    if (!el.videoEmpty) return;
    el.videoEmpty.hidden = false;
    if (el.loopBadge) el.loopBadge.hidden = true;
    var activePromos = live.phase === 'promo' ? effectivePromoList() : [];
    var nextRound = live.promoReturnPhase === 'players' ? plLive.roundNum : live.quizRoundNum;
    if (el.videoEmptyTitle) {
      el.videoEmptyTitle.textContent = live.phase === 'promo'
        ? (activePromos.length ? 'Sponsored partner break' : 'Partner break \u00b7 slot')
        : 'Video break';
    }
    if (el.videoEmptyNote) {
      if (live.phase === 'promo') {
        el.videoEmptyNote.textContent = activePromos.length
          ? ('This round was sponsored by the promo ads. Returning automatically to Round ' + nextRound + '.')
          : ('This round was sponsored by the promo ads. This ' + formatShortSec(effectivePromoAdSec()) + ' break returns automatically to Round ' + nextRound + '.');
      } else {
        el.videoEmptyNote.textContent = 'No clip loaded yet. Add a clip or enable the built-in 15s demo in Setup.';
      }
    }
    videoDecks.forEach(function (v) {
      v.hidden = true;
      v.className = 'is-standby';
      try { v.pause(); } catch (e) {}
    });
    updatePromoBrand();
    updatePromoOverlay();
  }

  function stopVideo() {
    videoGen++;
    videoTransitioning = false;
    stopDemoCanvas();
    if (videoXfadeTimer) {
      window.clearTimeout(videoXfadeTimer);
      videoXfadeTimer = 0;
    }
    standbyPrepared = { deckIdx: -1, id: '', url: '', index: -1 };
    activeDeckIdx = 0;
    videoDecks.forEach(function (v) {
      try { v.pause(); } catch (e) {}
      v.removeAttribute('data-clip-id');
      v.removeAttribute('src');
      try { v.load(); } catch (e) {}
    });
    if (el.loopBadge) el.loopBadge.hidden = true;
    if (el.promoBrand) el.promoBrand.hidden = true;
    if (el.promoAdOverlay) el.promoAdOverlay.hidden = true;
    if (el.promoFunnel) el.promoFunnel.hidden = true;
    if (el.promoUnmuteBtn) el.promoUnmuteBtn.hidden = true;
    if (el.videoEmpty) el.videoEmpty.hidden = true;
    dismissPreroll();
  }

  function syncActivePromoDuration(v) {
    if (!v || live.phase !== 'promo') return;
    var d = v.duration;
    if (isFinite(d) && d > 0) {
      var list = effectivePromoList();
      var promoRec = list[live.clipIndex % Math.max(1, list.length)];
      if (promoRec && !promoRec.duration) {
        promoRec.duration = d;
        refreshPromoText();
      }
      var capped = Math.min(PROMO_MAX_SEC, d);
      var rem = Math.max(0.5, capped - (v.currentTime || 0));
      live.phaseLen = (capped + 1.5) * 1000;
      live.phaseEndsAt = now() + (rem + 1.5) * 1000;
      updatePhaseUI();
    }
  }

  videoDecks.forEach(function (v, deckIdx) {
    on(v, 'loadeddata', function () {
      if (deckIdx !== activeDeckIdx) {
        try {
          if (v.currentTime > 0.05) v.currentTime = 0;
          v.pause();
        } catch (e) {}
      } else if (live.phase === 'promo') {
        syncActivePromoDuration(v);
      }
    });

    on(v, 'loadedmetadata', function () {
      if (deckIdx !== activeDeckIdx || live.phase !== 'promo') return;
      syncActivePromoDuration(v);
    });

    on(v, 'durationchange', function () {
      if (deckIdx !== activeDeckIdx || live.phase !== 'promo') return;
      syncActivePromoDuration(v);
    });

    on(v, 'timeupdate', function () {
      if (deckIdx !== activeDeckIdx || live.paused || videoTransitioning) return;
      if (live.phase === 'promo') {
        if (isFinite(v.duration) && v.duration > 0) {
          var capped = Math.min(PROMO_MAX_SEC, v.duration);
          if (v.currentTime >= capped) {
            if (S.autoRotate) {
              enterPhase(live.promoReturnPhase || homePhase(), false);
            } else {
              playClip(live.clipIndex);
            }
          }
        }
        return;
      }
      if (live.phase !== 'video' || clips.length < 2) return;
      var d = v.duration;
      if (isFinite(d) && d > CROSSFADE_LEAD_SEC * 2 && (d - v.currentTime) <= CROSSFADE_LEAD_SEC) {
        transitionToClip((live.clipIndex + 1) % clips.length);
      }
    });

    on(v, 'ended', function () {
      if (deckIdx !== activeDeckIdx) return;
      if (live.phase === 'quiz' || live.phase === 'players' || live.phase === 'story') return;
      if (live.phase === 'promo') {
        if (S.autoRotate) {
          enterPhase(live.promoReturnPhase || homePhase(), false);
        } else {
          playClip(live.clipIndex);
        }
        return;
      }
      if (videoTransitioning) return;
      var list = activeList();
      if (list.length > 1) transitionToClip((live.clipIndex + 1) % list.length);
      else playClip(0);
    });

    on(v, 'error', function () {
      if (!v.getAttribute('src') && !v.getAttribute('data-clip-id')) return;
      if (deckIdx !== activeDeckIdx || !live.inSession) return;
      if (live.phase === 'video' && clips.length > 1 && !videoTransitioning) {
        transitionToClip((live.clipIndex + 1) % clips.length);
      } else if (live.phase === 'promo') {
        var list = effectivePromoList();
        var failedId = v.getAttribute('data-clip-id') || '';
        if (failedId && !promoRefreshedIds[failedId]) {
          promoRefreshedIds[failedId] = true;
          var genAtErr = videoGen;
          refreshClipUrl(failedId).then(function (freshUrl) {
            if (!freshUrl || genAtErr !== videoGen || !live.inSession || live.phase !== 'promo') {
              showVideoEmpty();
              return;
            }
            v.removeAttribute('src');
            v.removeAttribute('data-clip-id');
            playClip(live.clipIndex);
          });
          return;
        }
        if (failedId) promoFailedIds[failedId] = true;
        if (list.length > 1) {
          for (var step = 1; step < list.length; step++) {
            var altIdx = (live.clipIndex + step) % list.length;
            var alt = list[altIdx];
            if (alt && !promoFailedIds[alt.id]) {
              transitionToClip(altIdx);
              return;
            }
          }
        }
        showVideoEmpty();
      }
    });
  });

  /* ---------- voice reader ---------- */
  var synth = window.speechSynthesis || null;

  /* speech.js turns on-screen text into text a TTS engine reads naturally
     ("1 John 3:16" -> "First John, chapter three, verse sixteen"). The
     fallback keeps the reader working if that module ever fails to load. */
  var speech = window.LNR_SPEECH || {
    normalizeSpeech: function (t) { return String(t === null || typeof t === 'undefined' ? '' : t); },
    questionParts: function (q, opts) {
      if (!q) return [];
      var parts = (!opts || opts.announceNext !== false) ? ['Next question.'] : [];
      parts.push(String(q.q || ''));
      (q.opts || []).forEach(function (o, i) { parts.push(['A', 'B', 'C', 'D'][i] + '. ' + o); });
      return parts;
    },
    revealParts: function (q) {
      if (!q) return [];
      var parts = ['The answer is ' + ['A', 'B', 'C', 'D'][q.correct] + '. ' +
        ((q.opts && q.opts[q.correct]) || '')];
      if (q.ref) parts.push('Reference: ' + q.ref);
      if (q.insight) parts.push(q.insight);
      return parts;
    }
  };

  var voiceList = [];
  var speaking = false;
  var pausedSpeech = false;

  /* ---------- speech completion tracking ----------
     The broadcast must not cut the reader off. `speechPending` counts the
     utterances still queued; it reaches 0 only when the LAST one fires
     `onend`, which is the moment the answer, reference and note have all
     been spoken.

     `speechGen` is a generation token. `stopSpeech()` cancels the queue, and
     a cancelled utterance still fires `onend`/`onerror` — without the token
     those late events would decrement the count of the NEW queue and make
     the engine think it had finished while it was still talking.

     `speechDeadline` is a wall-clock fallback: some engines never fire
     `onend` at all (a long-standing Chrome/Safari quirk). Without it a
     missing event would stall the broadcast forever, so the queue is
     treated as done once a generous estimate of its spoken length passes. */
  var speechPending = 0;
  var speechGen = 0;
  var speechDeadline = 0;
  var activeUtterances = [];
  /* Cancellers for the prosody gap timers. Sequential speaking schedules a
     short pause between chunks; stopSpeech() must clear them or a stale
     timer would restart the old queue after a cancel. */
  var speechGapTimers = [];

  /* Uploaded narrator speech tracks for Storytelling Engine */
  var storySpeechTracks = []; /* [{ id, name, size, type, duration, blob, url }] */
  var storySpeechEl = new Audio();
  storySpeechEl.preload = 'auto';
  var storySpeechPlaying = false;
  var storySpeechPaused = false;
  var storySpeechPreviewing = false;
  var storySpeechPreviewIdx = -1;
  var storySpeechTrackIdx = -1;
  var storySpeechWaitMode = false;
  var storySpeechDeadline = 0;

  /* Live Voice-Synced Caption Animator (follows real speech or uploaded audio) */
  var captionSync = {
    el: null,
    spans: [],
    ranges: [],
    totalChars: 0,
    activeWord: -1,
    rafId: 0,
    active: false,
    paused: false,
    mode: 'tts', /* 'tts' | 'audio' */
    anchorPerf: 0,
    anchorChar: 0,
    chunkStartChar: 0,
    chunkEndChar: 0,
    charsPerSec: 12.5,
    sliceStartSec: 0,
    sliceEndSec: 10
  };

  function setCaptionWordCursor(idx) {
    if (!captionSync.spans.length) return;
    if (idx === captionSync.activeWord) return;
    var maxIdx = captionSync.spans.length - 1;
    var clamped = Math.max(-1, Math.min(maxIdx, idx));
    for (var i = 0; i < captionSync.spans.length; i++) {
      var sp = captionSync.spans[i];
      if (i < clamped) {
        sp.className = 'vword is-spoken';
      } else if (i === clamped) {
        sp.className = 'vword is-active';
      } else {
        sp.className = 'vword is-upcoming';
      }
    }
    captionSync.activeWord = clamped;
  }

  function stopCaptionSyncLoop() {
    if (captionSync.rafId) {
      window.cancelAnimationFrame(captionSync.rafId);
      captionSync.rafId = 0;
    }
  }

  function finishCaptionSync() {
    stopCaptionSyncLoop();
    captionSync.active = false;
    captionSync.paused = false;
    if (captionSync.spans.length) {
      for (var i = 0; i < captionSync.spans.length; i++) {
        captionSync.spans[i].className = 'vword is-spoken';
      }
      captionSync.activeWord = captionSync.spans.length - 1;
    }
  }

  function pauseCaptionSync() {
    if (!captionSync.active || captionSync.paused) return;
    captionSync.paused = true;
    stopCaptionSyncLoop();
    if (captionSync.mode === 'tts') {
      var elapsedSec = Math.max(0, (performance.now() - captionSync.anchorPerf) / 1000);
      captionSync.anchorChar = Math.min(captionSync.chunkEndChar, captionSync.anchorChar + elapsedSec * captionSync.charsPerSec);
    }
  }

  function tickCaptionSync() {
    if (!captionSync.active || captionSync.paused) return;
    var progressRatio = 0;
    if (captionSync.mode === 'audio') {
      var dur = Math.max(0.5, captionSync.sliceEndSec - captionSync.sliceStartSec);
      var cur = Math.max(0, (storySpeechEl.currentTime || 0) - captionSync.sliceStartSec);
      progressRatio = Math.max(0, Math.min(1, cur / dur));
      var targetWord = Math.min(captionSync.spans.length - 1, Math.floor(progressRatio * captionSync.spans.length));
      setCaptionWordCursor(targetWord);
      if (progressRatio >= 0.995 && storySpeechEl.ended) {
        finishCaptionSync();
        return;
      }
    } else {
      var elapsedSec = Math.max(0, (performance.now() - captionSync.anchorPerf) / 1000);
      var estChar = Math.min(captionSync.chunkEndChar, captionSync.anchorChar + elapsedSec * captionSync.charsPerSec);
      var wIdx = 0;
      for (var i = 0; i < captionSync.ranges.length; i++) {
        if (estChar >= captionSync.ranges[i].start) wIdx = i;
        else break;
      }
      setCaptionWordCursor(wIdx);
    }
    captionSync.rafId = window.requestAnimationFrame(tickCaptionSync);
  }

  function resumeCaptionSync() {
    if (!captionSync.active || !captionSync.paused) return;
    captionSync.paused = false;
    captionSync.anchorPerf = performance.now();
    stopCaptionSyncLoop();
    captionSync.rafId = window.requestAnimationFrame(tickCaptionSync);
  }

  function prepareVoiceCaption(targetEl, rawText, syncEnabled) {
    stopCaptionSyncLoop();
    captionSync.active = false;
    captionSync.paused = false;
    captionSync.el = null;
    captionSync.spans = [];
    captionSync.ranges = [];
    captionSync.activeWord = -1;
    if (!targetEl) return;
    var text = String(rawText || '').trim();
    if (!text) {
      targetEl.textContent = '';
      targetEl.classList.remove('is-voice-sync');
      return;
    }
    var tokens = [];
    var rx = /\S+/g;
    var m;
    while ((m = rx.exec(text)) !== null) {
      tokens.push({ word: m[0], start: m.index, end: m.index + m[0].length });
    }
    var frag = document.createDocumentFragment();
    var spans = [];
    tokens.forEach(function (tk, idx) {
      if (idx > 0) frag.appendChild(document.createTextNode(' '));
      var sp = document.createElement('span');
      sp.className = syncEnabled ? 'vword is-upcoming' : 'vword';
      sp.textContent = tk.word;
      frag.appendChild(sp);
      spans.push(sp);
    });
    targetEl.innerHTML = '';
    targetEl.appendChild(frag);
    targetEl.classList.toggle('is-voice-sync', !!syncEnabled);
    if (syncEnabled && spans.length) {
      captionSync.el = targetEl;
      captionSync.spans = spans;
      captionSync.ranges = tokens;
      captionSync.totalChars = text.length;
    }
  }

  function beginTtsCaptionChunk(chunkOffset, chunkLen, rate) {
    if (!captionSync.spans.length) return;
    captionSync.mode = 'tts';
    captionSync.active = true;
    captionSync.paused = !!(live && live.paused);
    captionSync.chunkStartChar = chunkOffset;
    captionSync.chunkEndChar = Math.min(captionSync.totalChars, chunkOffset + chunkLen + 4);
    captionSync.anchorChar = chunkOffset;
    captionSync.anchorPerf = performance.now();
    captionSync.charsPerSec = Math.max(7, Math.min(20, 12.2 * (rate || 0.96)));
    var startWord = 0;
    for (var i = 0; i < captionSync.ranges.length; i++) {
      if (chunkOffset >= captionSync.ranges[i].start) startWord = i;
      else break;
    }
    setCaptionWordCursor(startWord);
    stopCaptionSyncLoop();
    if (!captionSync.paused) {
      captionSync.rafId = window.requestAnimationFrame(tickCaptionSync);
    }
  }

  function onTtsCaptionBoundary(absChar) {
    if (!captionSync.active || captionSync.mode !== 'tts' || !captionSync.ranges.length) return;
    captionSync.anchorChar = absChar;
    captionSync.anchorPerf = performance.now();
    var wIdx = 0;
    for (var i = 0; i < captionSync.ranges.length; i++) {
      if (absChar >= captionSync.ranges[i].start) wIdx = i;
      else break;
    }
    setCaptionWordCursor(wIdx);
  }

  function startAudioCaptionSync(sliceStartSec, sliceEndSec) {
    if (!captionSync.spans.length) return;
    captionSync.mode = 'audio';
    captionSync.active = true;
    captionSync.paused = !!(live && live.paused);
    captionSync.sliceStartSec = Math.max(0, Number(sliceStartSec) || 0);
    captionSync.sliceEndSec = Math.max(captionSync.sliceStartSec + 0.8, Number(sliceEndSec) || (captionSync.sliceStartSec + 8));
    setCaptionWordCursor(0);
    stopCaptionSyncLoop();
    if (!captionSync.paused) {
      captionSync.rafId = window.requestAnimationFrame(tickCaptionSync);
    }
  }

  /* The reveal queue is tracked separately from the question queue.
     The scene gate must wait for the ANSWER, REFERENCE and NOTE — not for a
     question that happens to still be reading. If the reveal announcement is
     switched off, nothing is queued here and the scene advances on the clock
     exactly as it always did. */
  var revealPending = 0;
  var revealDeadline = 0;

  function speechUtteranceEnded(gen, isReveal, utt) {
    if (gen !== speechGen) return;          /* a cancelled, older queue */
    if (utt && utt._isLastSyncChunk) {
      finishCaptionSync();
    }
    if (utt) {
      var idx = activeUtterances.indexOf(utt);
      if (idx >= 0) activeUtterances.splice(idx, 1);
    }
    if (speechPending > 0) speechPending--;
    if (isReveal && revealPending > 0) revealPending--;
    if (speechPending > 0) {
      var bump = now() + 4500 + speechPending * 1500;
      if (bump > speechDeadline) speechDeadline = bump;
      if (isReveal && bump > revealDeadline) revealDeadline = bump;
    }
    if (speechPending === 0) {
      activeUtterances = [];
      speaking = false;
      updateVoiceBtn();
      if (!isReveal && live.inSession && live.phase === 'quiz' && !live.revealed && !live.quizMilestone && live.waitingForSpeech) {
        armPostReadQuizCountdown();
        playCountdownTick(10);
        live.lastTickCueSec = 10;
        updatePhaseUI();
      }
    }
  }

  function speechBusy() {
    if (storySpeechWaitMode) {
      if (!S.voiceOn || storySpeechEl.ended || storySpeechEl.paused && !storySpeechPaused) {
        storySpeechWaitMode = false;
        return false;
      }
      if (storySpeechDeadline && now() > storySpeechDeadline) {
        storySpeechWaitMode = false;
        return false;
      }
      return true;
    }
    if (!synth || !S.voiceOn) return false;
    if (speechPending <= 0) return false;
    if (now() > speechDeadline) {
      speechPending = 0;
      activeUtterances = [];
      speaking = false;
      finishCaptionSync();
      return false;
    }
    return true;
  }

  /* Is the reader still speaking the reveal? Used by the tick to hold the
     scene until the answer, reference and note have all been read out. */
  function revealBusy() {
    if (!synth || !S.voiceOn || !S.voiceReveal) return false;
    if (revealPending <= 0) return false;
    if (now() > revealDeadline) {           /* onend never came — give up */
      revealPending = 0;
      return false;
    }
    return true;
  }

  function curatedVoices() {
    var all = synth ? synth.getVoices() : [];
    if (!all.length) return [];
    var preferred = ['Google UK English Female', 'Google US English', 'Samantha', 'Daniel',
      'Microsoft Aria Online (Natural) - English (United States)',
      'Microsoft Guy Online (Natural) - English (United States)',
      'Karen', 'Moira', 'Serena'];
    var en = all.filter(function (v) { return /^en(-|_|$)/i.test(v.lang); });
    var picked = [];
    preferred.forEach(function (p) {
      en.forEach(function (v) { if (v.name === p && picked.indexOf(v) < 0) picked.push(v); });
    });
    en.forEach(function (v) { if (picked.indexOf(v) < 0 && picked.length < 10) picked.push(v); });
    return picked.length ? picked : all.slice(0, 8);
  }

  function fillVoices() {
    var targets = [el.voiceSelect, el.stVoiceSelect].filter(Boolean);
    if (!targets.length) return;
    voiceList = curatedVoices();
    targets.forEach(function (sel) {
      sel.innerHTML = '';
      if (!voiceList.length) {
        var o = document.createElement('option');
        o.value = ''; o.textContent = 'System default voice';
        sel.appendChild(o);
        return;
      }
      voiceList.forEach(function (v) {
        var opt = document.createElement('option');
        opt.value = v.name;
        opt.textContent = v.name + ' \u00b7 ' + v.lang;
        if (S.voiceName === v.name) opt.selected = true;
        sel.appendChild(opt);
      });
    });
  }

  if (synth) {
    fillVoices();
    if (typeof synth.onvoiceschanged !== 'undefined') synth.onvoiceschanged = fillVoices;
    /* some engines only populate the list after a speak() call — prime it silently */
    if (!(synth.getVoices() || []).length) {
      try {
        var primer = new SpeechSynthesisUtterance(' ');
        primer.volume = 0;
        primer.rate = 1;
        synth.speak(primer);
        synth.cancel();
      } catch (e) {}
      window.setTimeout(function () {
        fillVoices();
        [el.voiceSelect, el.stVoiceSelect].forEach(function (sel) {
          if (sel && sel.options.length <= 1) {
            var o = document.createElement('option');
            o.value = ''; o.textContent = 'Browser default voice';
            sel.appendChild(o);
          }
        });
      }, 700);
    }
  } else {
    [el.voiceSelect, el.stVoiceSelect].forEach(function (sel) {
      if (!sel) return;
      var o0 = document.createElement('option');
      o0.value = ''; o0.textContent = 'Speech not supported in this browser';
      sel.appendChild(o0);
    });
  }

  [el.voiceSelect, el.stVoiceSelect].forEach(function (sel) {
    on(sel, 'change', function () {
      S.voiceName = sel.value;
      if (el.voiceSelect) el.voiceSelect.value = S.voiceName;
      if (el.stVoiceSelect) el.stVoiceSelect.value = S.voiceName;
      save();
      toast('Voice: ' + ((sel.options[sel.selectedIndex] || {}).text || 'Default'));
    });
  });

  [el.voiceRate, el.stVoiceRate].forEach(function (slider) {
    on(slider, 'input', function () {
      S.voiceRate = parseInt(slider.value, 10) / 100;
      if (el.voiceRate) el.voiceRate.value = slider.value;
      if (el.stVoiceRate) el.stVoiceRate.value = slider.value;
      if (el.voiceRateLabel) el.voiceRateLabel.textContent = S.voiceRate.toFixed(2) + '\u00d7';
      if (el.stVoiceRateLabel) el.stVoiceRateLabel.textContent = S.voiceRate.toFixed(2) + '\u00d7';
      save();
    });
  });

  [el.voiceOn, el.stVoiceOn].forEach(function (chk) {
    on(chk, 'change', function () {
      S.voiceOn = !!chk.checked;
      syncInputs();
      save();
      updateVoiceBtn();
      if (!S.voiceOn) {
        stopSpeech();
        if (live.inSession && live.phase === 'quiz' && !live.revealed && !live.quizMilestone && live.waitingForSpeech) {
          armPostReadQuizCountdown();
          updatePhaseUI();
        } else if (live.inSession && live.phase === 'story') {
          if (storyLive.waitingForSpeech) armStoryHoldCountdown();
          renderStoryStep();
          updatePhaseUI();
        }
      } else if (live.inSession && live.phase === 'quiz') {
        if (live.quizMilestone) speakQuizMilestone();
        else {
          if (!live.revealed) {
            live.waitingForSpeech = true;
            live.lastTickCueSec = -1;
            live.qEndsAt = now() + Math.max(S.qSec, 30) * 1000;
          }
          speakCurrent(false);
          updatePhaseUI();
        }
      } else if (live.inSession && live.phase === 'players') {
        speakPlayerSubPhase(false);
      } else if (live.inSession && live.phase === 'story') {
        renderStoryStep();
        speakStoryStep();
      }
      toast(S.voiceOn ? 'Voice reader on' : 'Voice reader off');
    });
  });

  [el.voiceReveal, el.stVoiceReveal].forEach(function (chk) {
    on(chk, 'change', function () {
      S.voiceReveal = !!chk.checked;
      syncInputs();
      save();
      toast(S.voiceReveal ? 'Answer announcement on' : 'Answer announcement off');
    });
  });

  function updateVoiceBtn() {
    if (!el.voiceBtn) return;
    if (!synth && !storySpeechTracks.length) {
      el.voiceBtn.textContent = 'Voice: unsupported';
      el.voiceBtn.disabled = true;
    } else {
      el.voiceBtn.disabled = false;
      var hasSpeechFile = live.phase === 'story' && storySpeechTracks.length > 0;
      var isPaused = (synth && synth.paused) || storySpeechPaused;
      el.voiceBtn.textContent = S.voiceOn
        ? (hasSpeechFile ? ('Speech: ' + (isPaused ? 'paused' : 'audio')) : (isPaused ? 'Voice: paused' : 'Voice: on'))
        : 'Voice: off';
      el.voiceBtn.classList.toggle('is-on', !!S.voiceOn);
    }
    if (el.musicBtn) {
      if (isAudioSuppressedPhase()) {
        el.musicBtn.textContent = 'Audio: clip priority';
        el.musicBtn.classList.remove('is-on');
      } else {
        var playing = !!(defaultBgAudioEl && !defaultBgAudioEl.paused) || !!(customAudioEl && !customAudioEl.paused);
        el.musicBtn.textContent = customAudioEl
          ? ('MP3: ' + (playing ? 'on' : 'ready'))
          : ('Music: ' + (S.music === 'off' ? 'off' : (playing ? 'on' : 'ready')));
        el.musicBtn.classList.toggle('is-on', S.music !== 'off' || !!customAudioEl);
      }
    }
  }

  function pickVoice() {
    if (!voiceList.length) return null;
    for (var i = 0; i < voiceList.length; i++) {
      if (voiceList[i].name === S.voiceName) return voiceList[i];
    }
    return voiceList[0];
  }

  /* ------------------------------------------------------------------
     PUNCTUATION-AWARE CHUNKING

     Chromium truncates a single utterance at roughly 15 seconds, so a long
     paragraph has to be broken into several utterances. The old version
     broke it at a raw character count, which is exactly why the reader
     stopped in the middle of a clause and appeared to ignore the commas:
     the cut landed wherever character 145 happened to fall, not where a
     human would breathe.

     Every boundary below is now chosen at punctuation, strongest first:

       1. sentence end   .  !  ?
       2. clause break   ;  :
       3. comma          ,
       4. dash           —  –
       5. word gap       (only when the sentence has no punctuation at all)

     A chunk therefore always ends where the voice is *supposed* to pause,
     so the small gap the engine inserts between utterances lands on a
     comma or a full stop instead of mid-sentence.
     ------------------------------------------------------------------ */
  var CLAUSE_MARKS = [';', ':', ',', '\u2014', '\u2013'];

  /* Abbreviations whose full stop is NOT a sentence end. Without this the
     sentence pass split "Dr. Smith" and "e.g. this" into two utterances, and
     the engine's own inter-utterance gap landed in the middle of a phrase. */
  var ABBREV_TAIL = /\b(Mr|Mrs|Ms|Dr|Prof|St|Jr|Sr|vs|etc|approx|ca|No|Nos|Vol|Ch|pp|Fig|Rev|Gen|Ex|Deut|Ps|Prov|Isa|Jer|Matt|Mk|Lk|Jn|Rom|Cor|Gal|Eph|Phil|Col|Thess|Tim|Heb|Jas|Pet|e\.g|i\.e)\./gi;

  function splitSpeechText(text, maxLen) {
    var clean = String(text || '').replace(/\s+/g, ' ').trim();
    if (!clean) return [];
    var limit = Math.max(60, Number(maxLen) || 150);
    if (clean.length <= limit) return [clean];

    /* Protect abbreviation stops and decimal points so the sentence pass
       cannot mistake them for the end of a sentence. EVERY period inside the
       abbreviation is masked, not just the last one: masking only the final
       stop left the internal dot of "e.g." and "i.e." visible, and the
       sentence pass split "e." / "g. slower than expected" into two
       utterances. \u0001 / \u0002 are restored before anything is spoken. */
    var guarded = clean
      .replace(ABBREV_TAIL, function (m) { return m.replace(/\./g, '\u0001'); })
      .replace(/(\d)\.(\d)/g, '$1\u0002$2');

    var out = [];
    function pushChunk(s) {
      var t = String(s || '').trim();
      if (t) out.push(t);
    }

    /* A sentence that still does not fit. Cut at the STRONGEST punctuation
       available in the window, and only fall back to a space when the window
       genuinely contains no punctuation at all. The old version searched for
       the last comma anywhere in the window and, when that comma sat too
       early, silently cut at a bare space \u2014 which is exactly the
       mid-sentence break that made the reader sound like it ignored commas. */
    function splitLong(sentence) {
      var rest = String(sentence || '').trim();
      var guard = 0;
      while (rest.length > limit && guard++ < 60) {
        var win = rest.slice(0, limit);
        var cut = -1;

        /* 1. clause punctuation, strongest first, nearest the end of window */
        for (var m = 0; m < CLAUSE_MARKS.length && cut < 0; m++) {
          var idx = win.lastIndexOf(CLAUSE_MARKS[m]);
          if (idx >= Math.floor(limit * 0.45)) cut = idx + 1;
        }
        /* 2. any clause punctuation at all, even early \u2014 better a short
              chunk that ends on a comma than a long one cut mid-word */
        if (cut < 0) {
          for (var n = 0; n < CLAUSE_MARKS.length && cut < 0; n++) {
            var any = win.lastIndexOf(CLAUSE_MARKS[n]);
            if (any >= Math.floor(limit * 0.2)) cut = any + 1;
          }
        }
        /* 3. last resort: a word gap, but never a stub */
        if (cut < 0) {
          var sp = win.lastIndexOf(' ');
          cut = sp >= Math.floor(limit * 0.5) ? sp : limit;
        }
        pushChunk(rest.slice(0, cut));
        rest = rest.slice(cut).trim();
      }
      pushChunk(rest);
    }

    /* 1. Sentence pass \u2014 the terminator stays with its own sentence so the
          engine still performs the full stop. */
    var sentences = guarded.match(/[^.!?\u2026]+[.!?\u2026]+["')\]]*|[^.!?\u2026]+$/g) || [guarded];
    sentences.forEach(function (s) {
      var t = String(s || '').trim();
      if (!t) return;
      if (t.length <= limit) pushChunk(t);
      else splitLong(t);
    });

    /* 2. Merge stubs. A 12-character fragment spoken as its own utterance
          gets a full engine gap around it, which reads as a stutter. */
    var merged = [];
    out.forEach(function (chunk) {
      var prev = merged.length ? merged[merged.length - 1] : null;
      if (prev && (prev.length < 28 || chunk.length < 28) && (prev.length + chunk.length + 1) <= limit) {
        merged[merged.length - 1] = prev + ' ' + chunk;
      } else {
        merged.push(chunk);
      }
    });

    var restored = merged.map(function (c) {
      return c.replace(/\u0001/g, '.').replace(/\u0002/g, '.');
    });

    return restored.length ? restored : [clean];
  }

  function speakParts(parts, isReveal, voiceOpts) {
    if (!synth || !S.voiceOn) return;
    stopSpeech();
    try { if (synth.paused) synth.resume(); } catch (e) {}
    var v = pickVoice();
    var gen = speechGen;
    var expanded = [];
    var syncCharOffset = 0;
    var syncUtterances = [];

    (parts || []).forEach(function (item) {
      var raw = (item && typeof item === 'object') ? item.text : item;
      var isSync = Boolean(item && typeof item === 'object' && item.syncCaption);
      var txt = String(raw || '').replace(/\s+/g, ' ').trim();
      if (!txt) return;
      var chunks = splitSpeechText(txt, 145);
      chunks.forEach(function (c) {
        var entry = { text: c, sync: isSync, offset: isSync ? syncCharOffset : 0 };
        expanded.push(entry);
        if (isSync) {
          syncUtterances.push(entry);
          syncCharOffset += c.length + 1;
        }
      });
    });
    if (!expanded.length) return;
    if (syncUtterances.length) {
      syncUtterances[syncUtterances.length - 1].isLastSync = true;
    }

    var baseRate = Math.max(0.5, Number(S.voiceRate) || 0.96);
    var rateMult = (voiceOpts && Number(voiceOpts.rateMult)) || 1;
    var rate = Math.max(0.58, Math.min(1.5, baseRate * rateMult));
    var pitch = Math.max(0.5, Math.min(1.6, (voiceOpts && Number(voiceOpts.pitch)) || 1));

    /* ------------------------------------------------------------------
       PROSODY: a deliberate pause after every chunk.

       The Web Speech API gives no control over the gap it inserts between
       two utterances — on Chrome it is a flat ~0ms, on Safari it can be
       several hundred. That is why a comma and a full stop used to sound
       identical, and why the reading felt rushed and robotic.

       So we no longer hand the whole queue to the engine at once. We speak
       ONE chunk, wait a pause chosen from the punctuation that chunk ends
       on, then speak the next. The result is real, audible phrasing:

         full stop / question / exclamation  ->  long pause
         semicolon / colon                   ->  medium pause
         comma / dash                        ->  short pause
         no punctuation (forced word cut)    ->  a breath

       Pauses are divided by the speaking rate, so a faster voice keeps the
       same *relative* rhythm instead of swallowing the commas.
       ------------------------------------------------------------------ */
    function pauseAfter(text) {
      var t = String(text || '').replace(/["')\]\u201d\u2019]+$/, '').trim();
      var last = t.slice(-1);
      var ms;
      if (last === '.' || last === '!' || last === '?') ms = 430;
      else if (last === '\u2026') ms = 520;
      else if (last === ';' || last === ':') ms = 300;
      else if (last === ',') ms = 205;
      else if (last === '\u2014' || last === '\u2013') ms = 250;
      else ms = 95;

      /* A very short chunk is usually a fragment ("Act two." / "Clue one.").
         Give it a touch more air so it does not clip into the next line. */
      if (t.length < 26) ms += 60;

      return Math.round(ms / Math.max(0.6, rate));
    }

    var total = expanded.length;
    var chars = 0;
    expanded.forEach(function (e) { chars += e.text.length; });

    /* The scene gate counts utterances still to be spoken. With sequential
       speaking that is simply "chunks not yet finished". */
    speechPending = total;
    if (isReveal) revealPending = total;

    var estMs = (chars / 9.5) * 1000 / rate + total * 700;
    speechDeadline = now() + estMs + 6000;
    if (isReveal) revealDeadline = speechDeadline;

    speaking = true;
    pausedSpeech = false;
    updateVoiceBtn();

    var idx = 0;
    var gapTimer = 0;

    function speakNext() {
      if (gen !== speechGen) return;          /* a newer queue took over */
      if (idx >= total) return;
      var entry = expanded[idx];
      var p = entry.text;
      var u = new SpeechSynthesisUtterance(p);
      if (v) u.voice = v;
      /* A hair of variation per chunk. A perfectly constant rate across a
         long read is the biggest "robot" tell; ±2% is inaudible as a change
         of speed but removes the metronome feel. */
      var jitter = 1 + (((idx * 37) % 5) - 2) * 0.01;
      u.rate = Math.max(0.5, Math.min(1.6, rate * jitter));
      u.pitch = pitch;
      if (entry.isLastSync) u._isLastSyncChunk = true;
      activeUtterances.push(u);

      u.onstart = function () {
        if (gen !== speechGen) return;
        var remMs = (p.length / 8.5) * 1000 / rate + 4200 + Math.max(0, speechPending - 1) * 1800;
        var nextDeadline = now() + remMs;
        if (nextDeadline > speechDeadline) speechDeadline = nextDeadline;
        if (isReveal && nextDeadline > revealDeadline) revealDeadline = nextDeadline;
        if (entry.sync) beginTtsCaptionChunk(entry.offset, p.length, rate);
      };
      if (entry.sync) {
        u.onboundary = function (ev) {
          if (gen !== speechGen || !ev) return;
          if (typeof ev.charIndex === 'number') {
            onTtsCaptionBoundary(entry.offset + ev.charIndex);
          }
        };
      }

      /* Both handlers advance the queue: a failed utterance must not leave
         the broadcast waiting on speech that is never coming. */
      var advanced = false;
      function advance() {
        if (advanced) return;
        advanced = true;
        speechUtteranceEnded(gen, isReveal, u);
        if (gen !== speechGen) return;
        idx++;
        if (idx >= total) return;
        var wait = pauseAfter(p);
        gapTimer = window.setTimeout(function () {
          gapTimer = 0;
          speakNext();
        }, wait);
      }
      u.onend = advance;
      u.onerror = advance;

      try {
        synth.speak(u);
      } catch (e) {
        advance();
      }
    }

    /* Remember the gap timer so stopSpeech() can clear it. */
    speechGapTimers.push(function () {
      if (gapTimer) { window.clearTimeout(gapTimer); gapTimer = 0; }
    });

    speakNext();
  }

  function stopUploadedStorySpeech() {
    storySpeechWaitMode = false;
    storySpeechDeadline = 0;
    storySpeechPaused = false;
    storySpeechTrackIdx = -1;
    if (storySpeechPlaying && !storySpeechPreviewing) {
      try { storySpeechEl.pause(); } catch (e) {}
    }
    storySpeechPlaying = false;
    setMusicDucking(false);
  }

  function stopSpeech() {
    speechGen++;              /* invalidate every handler from the old queue */
    speechPending = 0;
    speechDeadline = 0;
    revealPending = 0;
    revealDeadline = 0;
    activeUtterances = [];
    /* Clear any pending prosody gap so a stale timer cannot restart the
       queue we are about to cancel. */
    speechGapTimers.forEach(function (fn) { try { fn(); } catch (e) {} });
    speechGapTimers = [];
    if (synth) {
      try { synth.cancel(); } catch (e) {}
    }
    speaking = false;
    pausedSpeech = false;
    stopUploadedStorySpeech();
    stopCaptionSyncLoop();
    captionSync.active = false;
    updateVoiceBtn();
  }

  function toggleSpeechPause() {
    if (storySpeechPlaying) {
      if (storySpeechEl.paused) {
        var p = storySpeechEl.play();
        if (p && p.catch) p.catch(function () {});
        storySpeechPaused = false;
        setMusicDucking(true);
        resumeCaptionSync();
        toast('Narrator audio resumed');
      } else {
        try { storySpeechEl.pause(); } catch (e) {}
        storySpeechPaused = true;
        setMusicDucking(false);
        pauseCaptionSync();
        toast('Narrator audio paused');
      }
      updateVoiceBtn();
      return;
    }
    if (!synth || !speaking) return;
    if (synth.paused) {
      synth.resume();
      pausedSpeech = false;
      resumeCaptionSync();
      toast('Voice resumed');
    } else {
      synth.pause();
      pausedSpeech = true;
      pauseCaptionSync();
      toast('Voice paused');
    }
    updateVoiceBtn();
  }

  /* keep the position: pause/resume rather than restart */
  function speakCurrent(announceNext) {
    var q = currentQ();
    if (!q) return;
    speakParts(speech.questionParts(q, { announceNext: announceNext !== false }));
  }

  /* Announce the reveal: the answer, then the reference, then the note.
     Called from revealAnswer(), which already guards on live.revealed,
     so this fires exactly once per question. */
  function speakReveal() {
    if (!synth || !S.voiceOn || !S.voiceReveal) return;
    var q = currentQ();
    if (!q) return;
    var parts = speech.revealParts(q) || [];
    if (q.insight && parts.length) {
      parts[parts.length - 1] = { text: parts[parts.length - 1], syncCaption: true };
    }
    speakParts(parts, true);
  }

  function speakQuizMilestone() {
    if (!synth || !S.voiceOn || !S.voiceReveal) return;
    var mp = speech.milestoneParts
      ? speech.milestoneParts(live.quizRoundNum, live.quizRoundAnswers, S.segment)
      : ['Round ' + live.quizRoundNum + ' complete! Check the last 10 answers and drop your score in the live chat!'];
    speakParts(mp, true);
  }

  on(el.voiceBtn, 'click', function () {
    if (!S.voiceOn) {
      S.voiceOn = true;
      if (el.voiceOn) el.voiceOn.checked = true;
      if (el.stVoiceOn) el.stVoiceOn.checked = true;
      save();
      updateVoiceBtn();
      if (live.inSession && live.phase === 'quiz') {
        if (live.quizMilestone) speakQuizMilestone();
        else {
          if (!live.revealed) {
            live.waitingForSpeech = true;
            live.lastTickCueSec = -1;
            live.qEndsAt = now() + Math.max(S.qSec, 30) * 1000;
          }
          speakCurrent(false);
          updatePhaseUI();
        }
      }
      else if (live.inSession && live.phase === 'players') speakPlayerSubPhase(false);
      else if (live.inSession && live.phase === 'story') { renderStoryStep(); speakStoryStep(); }
      toast('Voice reader on');
      return;
    }
    toggleSpeechPause();
  });

  /* ---------- JSON import ---------- */

  /* Option badges: A..Z, then AA, AB ... so a 5- or 6-option question still
     gets a readable letter instead of "undefined". */
  function optionLetter(i) {
    var s = '';
    var n = i;
    do {
      s = String.fromCharCode(65 + (n % 26)) + s;
      n = Math.floor(n / 26) - 1;
    } while (n >= 0);
    return s;
  }

  /* Every key a question's text may live under, in priority order. */
  var Q_TEXT_KEYS = ['question', 'q', 'text', 'prompt', 'title', 'ask'];
  /* Every key the option list may live under. */
  var Q_OPT_KEYS = ['options', 'opts', 'answers', 'choices', 'answerOptions', 'answer_options'];
  /* Every key the correct answer may live under. */
  var Q_ANSWER_KEYS = [
    'answer', 'correct', 'correctAnswer', 'correct_answer', 'correctIndex', 'correct_index',
    'correctLetter', 'correct_letter', 'answerIndex', 'answer_index', 'answerKey', 'answer_key',
    'right', 'solution'
  ];

  function firstDefined(obj, keys) {
    for (var i = 0; i < keys.length; i++) {
      if (obj && typeof obj[keys[i]] !== 'undefined' && obj[keys[i]] !== null) return obj[keys[i]];
    }
    return undefined;
  }

  function validateQuestion(raw, i, out, seg) {
    var errs = [];
    var where = 'Question ' + (i + 1);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      errs.push(where + ': not a question object');
      return errs;
    }

    var text = firstDefined(raw, Q_TEXT_KEYS);
    if (typeof text !== 'string' || text.trim().length < 8) {
      errs.push(where + ': "question" must be at least 8 meaningful characters');
    }

    var opts = firstDefined(raw, Q_OPT_KEYS);
    /* A missing or null option list used to leave `opts` undefined, and the
       answer check below then read opts.length and threw a TypeError. That
       aborted the whole import loop, so ONE malformed question silently
       killed the entire file. Normalise to an array first. */
    if (!Array.isArray(opts)) opts = [];
    if (opts.length < 2) {
      errs.push(
        where + ': "options" must be an array of at least 2 answer choices' +
        (opts.length ? ' (found ' + opts.length + ')' : ' (none found)')
      );
    } else {
      opts = opts.map(function (o) {
        if (typeof o === 'string') return o.trim();
        if (typeof o === 'number') return String(o);
        if (o && typeof o === 'object') return String(o.text || o.label || o.value || o.option || '').trim();
        return String(o == null ? '' : o).trim();
      });
      if (opts.some(function (o) { return !o; })) errs.push(where + ': an option is empty');
      if (new Set(opts.map(function (o) { return o.toLowerCase(); })).size !== opts.length) {
        errs.push(where + ': two options are identical');
      }
      /* No slice: a 5- or 6-option question is kept whole. */
    }

    var correct = -1;
    var av = firstDefined(raw, Q_ANSWER_KEYS);

    if (typeof av === 'number' && isFinite(av)) {
      /* 0-based index, or a 1-based number when 0 is not a valid index. */
      if (av >= 0 && av < opts.length) correct = av;
      else if (av >= 1 && av <= opts.length) correct = av - 1;
    } else if (typeof av === 'boolean') {
      correct = av ? 0 : 1;
    } else if (typeof av === 'string') {
      var s = av.trim();
      if (/^[A-Za-z]{1,2}$/.test(s)) {
        /* Letter: A, B, C ... Z, AA ... */
        var idx = 0;
        for (var k = 0; k < s.length; k++) idx = idx * 26 + (s.toUpperCase().charCodeAt(k) - 64);
        idx -= 1;
        if (idx >= 0 && idx < opts.length) correct = idx;
      } else if (/^\d+$/.test(s)) {
        var n = parseInt(s, 10);
        if (n >= 0 && n < opts.length) correct = n;
        else if (n >= 1 && n <= opts.length) correct = n - 1;
      } else {
        /* The answer given as its text. */
        var lower = s.toLowerCase();
        var found = opts.map(function (o) { return o.toLowerCase(); }).indexOf(lower);
        if (found < 0) {
          /* Tolerate "B) Noah" / "Noah." style answers. */
          found = opts.map(function (o) {
            return o.toLowerCase().replace(/^[a-z][).:\-]\s*/, '').replace(/[.\s]+$/, '');
          }).indexOf(lower.replace(/^[a-z][).:\-]\s*/, '').replace(/[.\s]+$/, ''));
        }
        if (found >= 0) correct = found;
      }
    }
    if (correct < 0) {
      errs.push(
        where + ': "answer" must be an index (0-' + Math.max(0, opts.length - 1) + '), ' +
        'a letter (A-' + optionLetter(Math.max(0, opts.length - 1)) + '), or the exact text of one option'
      );
    }

    if (errs.length) return errs;

    out.push({
      q: text.trim(),
      opts: opts,
      correct: correct,
      ref: String(firstDefined(raw, ['reference', 'ref', 'source', 'scripture', 'verse', 'citation']) || ''),
      insight: String(firstDefined(raw, ['insight', 'explanation', 'note', 'rationale', 'why']) || ''),
      level: String(firstDefined(raw, ['difficulty', 'level', 'tier']) || 'Medium')
    });
    return [];
  }

  /* Pull the question array out of every shape the app (and common exporters)
     produce: a plain array, {questions}, {items}, {data:{questions}},
     {quiz}, {bank}, {data:[...]}, {questions:{...}} ... */
  function extractQuestionList(data) {
    if (Array.isArray(data)) return data;
    if (!data || typeof data !== 'object') return null;

    var direct = ['questions', 'items', 'quiz', 'bank', 'questionBank', 'question_bank', 'data', 'list', 'rows', 'entries'];
    for (var i = 0; i < direct.length; i++) {
      var v = data[direct[i]];
      if (Array.isArray(v)) return v;
      /* one level of nesting: { data: { questions: [...] } } */
      if (v && typeof v === 'object') {
        for (var j = 0; j < direct.length; j++) {
          if (Array.isArray(v[direct[j]])) return v[direct[j]];
        }
      }
    }
    /* { questions: { q1: {...}, q2: {...} } } — an object keyed by id. */
    var qObj = data.questions || data.items || data.quiz || data.bank;
    if (qObj && typeof qObj === 'object') {
      var vals = Object.keys(qObj).map(function (k) { return qObj[k]; });
      if (vals.length && vals.every(function (x) { return x && typeof x === 'object'; })) return vals;
    }
    return null;
  }

  function importReport(ok, title, lines) {
    var html = '<b>' + String(title).replace(/</g, '&lt;') + '</b>';
    if (lines && lines.length) {
      html += '<ul>' + lines.slice(0, 8).map(function (l) {
        return '<li>' + String(l).replace(/</g, '&lt;') + '</li>';
      }).join('') + '</ul>';
      if (lines.length > 8) html += '<div>\u2026and ' + (lines.length - 8) + ' more.</div>';
    }
    [el.importResult, el.setupImportResult].forEach(function (box) {
      if (!box) return;
      box.hidden = false;
      box.className = 'import-result ' + (ok ? 'is-ok' : 'is-bad');
      box.innerHTML = html;
    });
  }

  function handleImport(file) {
    if (!file) return;
    if (!/\.json$/i.test(file.name) && file.type !== 'application/json') {
      importReport(false, 'That is not a JSON file', ['Choose a file ending in .json.']);
      toast('Import failed: not a JSON file', true);
      return;
    }
    var reader = new FileReader();
    reader.onerror = function () {
      importReport(false, 'Could not read the file', ['The browser refused to read it. Try again.']);
      toast('Import failed: unreadable file', true);
    };
    reader.onload = function () {
      var rawText = String(reader.result || '');
      var data;
      try {
        data = JSON.parse(rawText);
      } catch (e) {
        /* Name the actual problem instead of echoing the parser's jargon. */
        var msg = String(e && e.message ? e.message : 'the file is not valid JSON');
        var hint = 'Check for a missing comma, a trailing comma, or a quote that was never closed.';
        if (/position (\d+)/i.test(msg)) {
          var pos = parseInt(RegExp.$1, 10);
          var before = rawText.slice(0, pos);
          var line = before.split('\n').length;
          var col = pos - before.lastIndexOf('\n');
          hint = 'The problem is around line ' + line + ', column ' + col + '. ' + hint;
        }
        importReport(false, 'This file is not valid JSON', [msg, hint]);
        toast('Import failed: invalid JSON', true);
        return;
      }

      var segGuess = S.segment;
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        if (data.segment || data.category || data.subject) {
          var g = String(data.segment || data.category || data.subject).toLowerCase();
          if (/bib|script|church|faith/.test(g)) segGuess = 'bible';
          else if (/hist|world|trivia/.test(g)) segGuess = 'history';
        }
      }

      var list = extractQuestionList(data);
      if (!Array.isArray(list)) {
        var topKeys = (data && typeof data === 'object' && !Array.isArray(data))
          ? Object.keys(data).slice(0, 6).join(', ')
          : typeof data;
        importReport(false, 'No questions found in this file', [
          'Expected a list of questions, or an object holding one under "questions", "items", "quiz", "bank" or "data".',
          'This file\'s top level has: ' + topKeys + '.',
          'Example: { "segment": "bible", "questions": [ \u2026 ] }'
        ]);
        toast('Import failed: no question list found', true);
        return;
      }
      if (!list.length) {
        importReport(false, 'The question list is empty', ['The file parsed correctly but contains no questions.']);
        toast('Import failed: empty file', true);
        return;
      }

      var good = [], errs = [];
      list.forEach(function (raw, i) {
        /* One malformed question must never abort the whole file. Before this
           guard, a single item with no "options" threw inside validateQuestion
           and the entire import died with no message at all. */
        try {
          errs = errs.concat(validateQuestion(raw, i, good, segGuess));
        } catch (e) {
          errs.push('Question ' + (i + 1) + ': could not be read (' + String(e && e.message ? e.message : e) + ')');
        }
      });

      if (!good.length) {
        importReport(false, 'Nothing imported \u2014 ' + errs.length + ' problem' + (errs.length === 1 ? '' : 's'), errs);
        toast('Import failed: no valid questions', true);
        return;
      }

      /* merge, skipping exact & near-duplicate questions against existing built-in + custom bank */
      var existingAll = bank[segGuess] || [];
      var seenKeys = {};
      var seenTokens = [];
      existingAll.forEach(function (q) {
        seenKeys[qNormKey(q.q)] = 1;
        seenTokens.push(qTokens(q.q));
      });
      var added = 0, dupes = 0;
      good.forEach(function (q) {
        if (isNearDuplicate(q.q, seenKeys, seenTokens)) {
          dupes++;
          return;
        }
        seenKeys[qNormKey(q.q)] = 1;
        seenTokens.push(qTokens(q.q));
        custom[segGuess].push(q);
        added++;
      });

      if (!added) {
        importReport(false, 'All ' + dupes + ' questions matched existing or repetitive phrasing',
          ['Nothing was duplicated into the session. Pick fresh, non-repetitive questions.']);
        toast('Import: skipped repetitive items', true);
        return;
      }

      saveCustom();
      /* An upload switches the source to the uploaded pack, so the creator
         immediately sees their own questions instead of having to hunt for
         the toggle. */
      S.questionSource = 'uploaded';
      save();
      rebuildQuizBanks();       /* cleanly swaps out 5-item demo content once custom items exist */
      bags[segGuess] = [];
      setSegment(segGuess);
      refreshAccessUI();
      refreshStats();
      renderQuestionSource();

      var lines = [];
      lines.push('Added ' + added + ' to ' + SEGMENTS[segGuess] + '.');
      if (dupes) lines.push('Skipped ' + dupes + ' duplicate' + (dupes === 1 ? '' : 's') + '.');
      if (errs.length) lines.push('Skipped ' + errs.length + ' malformed item' + (errs.length === 1 ? '' : 's') + '.');
      lines.push('The ' + SEGMENTS[segGuess] + ' segment now holds ' + (segGuess === 'bible' ? bank.bible.length : bank.history.length) + ' questions.');
      lines.push('Question source is now your uploaded JSON. Switch back any time with the toggle below.');
      if (errs.length) lines = lines.concat(errs.slice(0, 4));

      importReport(true, 'Imported ' + added + ' question' + (added === 1 ? '' : 's'), lines);
      toast('Imported ' + added + ' question' + (added === 1 ? '' : 's') + ' into ' + SEGMENTS[segGuess]);
    };
    reader.readAsText(file);
  }

  on(el.importInput, 'change', function () {
    var f = el.importInput.files && el.importInput.files[0];
    handleImport(f);
    el.importInput.value = '';
  });

  on(el.setupQuizImportInput, 'change', function () {
    var f = el.setupQuizImportInput.files && el.setupQuizImportInput.files[0];
    handleImport(f);
    el.setupQuizImportInput.value = '';
  });

  /* ---------- question source toggle ---------- */
  /* Which bank the timer reads from. The row stays hidden until this device
     holds an imported pack, so there is never a switch between two identical
     things. Free and Pro both get it: the JSON is parsed in the browser and
     never leaves the device, so it costs nothing to serve. */
  function uploadedCount() {
    return (custom.bible ? custom.bible.length : 0) + (custom.history ? custom.history.length : 0);
  }

  function builtInCount() {
    var b = window.LNR_BUILT_IN_BANKS || {};
    return (Array.isArray(b.bible) ? b.bible.length : 0) + (Array.isArray(b.history) ? b.history.length : 0);
  }

  function renderQuestionSource() {
    var has = hasUploadedBank();
    var active = effectiveQuestionSource();

    if (el.qSourceRow) el.qSourceRow.hidden = !has;

    if (el.qSourceBuiltin) {
      var onB = active === 'builtin';
      el.qSourceBuiltin.classList.toggle('is-selected', onB);
      el.qSourceBuiltin.setAttribute('aria-checked', onB ? 'true' : 'false');
    }
    if (el.qSourceUploaded) {
      var onU = active === 'uploaded';
      el.qSourceUploaded.classList.toggle('is-selected', onU);
      el.qSourceUploaded.setAttribute('aria-checked', onU ? 'true' : 'false');
    }
    if (el.qSourceBuiltinCount) el.qSourceBuiltinCount.textContent = builtInCount() + ' questions';
    if (el.qSourceUploadedCount) el.qSourceUploadedCount.textContent = uploadedCount() + ' uploaded';

    if (el.qSourceHint) {
      el.qSourceHint.textContent = !has
        ? 'Import a JSON pack above to unlock this switch.'
        : active === 'uploaded'
          ? 'The timer is reading your uploaded JSON pack.'
          : 'The timer is reading the built-in question packs.';
    }
  }

  function setQuestionSource(source) {
    if (source !== 'builtin' && source !== 'uploaded') return;
    if (source === 'uploaded' && !hasUploadedBank()) {
      toast('Import a JSON pack first', true);
      return;
    }
    if (S.questionSource === source) { renderQuestionSource(); return; }

    S.questionSource = source;
    save();

    /* Rebuild the active bank so the very next question comes from the new
       source. The question already on screen is left alone, so a live
       broadcast never jumps mid-question. */
    rebuildQuizBanks();
    refreshStats();
    renderQuestionSource();

    toast(source === 'uploaded'
      ? 'Question source: uploaded JSON (' + uploadedCount() + ')'
      : 'Question source: built-in packs (' + builtInCount() + ')');
  }

  on(el.qSourceBuiltin, 'click', function () { setQuestionSource('builtin'); });
  on(el.qSourceUploaded, 'click', function () { setQuestionSource('uploaded'); });

  /* Expose for the browser test harness and for other modules. */
  window.LNR_QUESTION_SOURCE = {
    get: function () { return effectiveQuestionSource(); },
    set: setQuestionSource,
    counts: function () {
      return {
        builtin: builtInCount(),
        uploaded: uploadedCount(),
        active: effectiveQuestionSource(),
        activeBank: (bank[S.segment] || []).length
      };
    }
  };

  /* Read-only view of the promo rotation, so the free/Pro gate can be checked
     from outside without reaching into engine internals. */
  window.LNR_PROMO_DEBUG = {
    list: function () {
      return effectivePromoList().map(function (p) {
        return { id: p.id, name: p.name, builtIn: !!p.builtIn, duration: p.duration };
      });
    },
    isPro: function () { return currentProTier(); }
  };

  renderQuestionSource();

  /* ---------- length-driven typography ---------- */
  /* A question is set as large as it can be without crowding the frame.
     Bounds are deliberate: 'xl' for a handful of words, 'xs' for a long
     one. This is what makes a two-word question feel like a title card
     and a long one still fit without shrinking below legibility. */
  var Q_FITS = ['xl', 'lg', 'md', 'sm', 'xs'];

  function fitFor(len) {
    if (len <= 26) return 0;
    if (len <= 52) return 1;
    if (len <= 92) return 2;
    if (len <= 148) return 3;
    return 4;
  }

  function fitOptionsFor(len) {
    if (len <= 12) return 'lg';
    if (len <= 26) return 'md';
    if (len <= 46) return 'sm';
    return 'xs';
  }

  /* Apply the length tier, then step down while the block still overflows.

     Two things step down, in this order:
       1. the question text (xl -> xs)
       2. the option text (lg -> xs), only once the question is at its floor

     The type scale is now much larger, so a long question plus four long
     options can genuinely exceed the frame. This guard is what makes that
     safe: it measures the real rendered block and shrinks until it fits, so
     raising the tiers can never push content out of the frame.

     It must run AFTER the options are in the DOM — measuring before they
     exist would only ever see the question's height. */
  function applyQuestionFit(len) {
    if (!el.qText) return;
    var idx = fitFor(len);
    el.qText.setAttribute('data-fit', Q_FITS[idx]);

    var host = el.quizStage;
    if (!host) return;

    var optEls = el.options ? Array.prototype.slice.call(el.options.children) : [];
    var optFits = ['lg', 'md', 'sm', 'xs'];

    /* Reset every option to its own length tier first. Without this the
       previous question's shrink would carry over and the type would ratchet
       down question after question. */
    optEls.forEach(function (d) {
      var tx = d.querySelector('.opt-text');
      d.setAttribute('data-fit', fitOptionsFor(tx ? tx.textContent.length : 0));
    });

    var optIdx = 0;                       /* 0 = lg, 3 = xs */

    /* bounded so it can never loop forever */
    for (var guard = 0; guard < 8; guard++) {
      var overflow = host.scrollHeight - host.clientHeight;
      if (overflow <= 0) break;

      if (idx < 4) {
        idx++;
        el.qText.setAttribute('data-fit', Q_FITS[idx]);
        continue;
      }
      /* question is at its floor — shrink the options instead */
      if (optIdx < 3) {
        optIdx++;
        optEls.forEach(function (d) { d.setAttribute('data-fit', optFits[optIdx]); });
        continue;
      }
      break;                              /* nothing left to shrink */
    }

    /* One more pass on the next frame. The first pass can measure before the
       browser has finished laying out the new font sizes (a wrapped line
       changes the height only after reflow), which leaves a few pixels of
       overflow on some viewports. Re-measuring once the frame is painted
       catches that without ever looping. */
    if (host.scrollHeight - host.clientHeight > 0) {
      window.requestAnimationFrame(function () {
        for (var g2 = 0; g2 < 8; g2++) {
          if (host.scrollHeight - host.clientHeight <= 0) break;
          if (idx < 4) {
            idx++;
            el.qText.setAttribute('data-fit', Q_FITS[idx]);
            continue;
          }
          if (optIdx < 3) {
            optIdx++;
            optEls.forEach(function (d) { d.setAttribute('data-fit', optFits[optIdx]); });
            continue;
          }
          break;
        }
      });
    }
  }

  /* Trigger a CSS entrance animation cleanly on reuse */
  function retriggerAnimation(node, cls) {
    if (!node) return;
    node.classList.remove(cls);
    void node.offsetWidth;
    node.classList.add(cls);
  }

  /* Soft visual cross-dissolve between scenes without delaying timers */
  function crossfadeStage(hostEl, contentEl) {
    if (!hostEl || !contentEl || !contentEl.children || !contentEl.children.length) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    try {
      var prevGhosts = hostEl.querySelectorAll('.stage-crossfade-ghost');
      for (var i = 0; i < prevGhosts.length; i++) prevGhosts[i].remove();
      var ghost = contentEl.cloneNode(true);
      ghost.classList.add('stage-crossfade-ghost');
      ghost.setAttribute('aria-hidden', 'true');
      if (ghost.removeAttribute) ghost.removeAttribute('id');
      var withIds = ghost.querySelectorAll ? ghost.querySelectorAll('[id]') : [];
      for (var j = 0; j < withIds.length; j++) withIds[j].removeAttribute('id');
      hostEl.appendChild(ghost);
      window.setTimeout(function () {
        if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
      }, 420);
    } catch (e) {}
  }

  /* ---------- question rendering ---------- */
  function currentQ() {
    if (live.qIndex < 0) return null;
    return bank[S.segment][live.qIndex] || null;
  }

  function renderQuestion() {
    var seg = S.segment;
    var q = currentQ();
    if (!q) {
      el.qText.setAttribute('data-fit', 'md');
      el.qText.textContent = 'This segment has no questions yet. Import a JSON file to add some.';
      el.options.innerHTML = '';
      return;
    }
    el.qKicker.textContent = SEGMENTS[seg] + ' \u00b7 ' + q.level;
    el.qText.textContent = q.q;

    el.options.innerHTML = '';
    q.opts.forEach(function (text, i) {
      var d = document.createElement('div');
      d.className = 'opt';
      d.setAttribute('data-i', i);
      d.setAttribute('data-fit', fitOptionsFor(text.length));
      var badge = document.createElement('span');
      badge.className = 'opt-badge';
      badge.textContent = optionLetter(i);
      var tx = document.createElement('span');
      tx.className = 'opt-text';
      tx.textContent = text;
      d.appendChild(badge); d.appendChild(tx);
      el.options.appendChild(d);
    });

    el.reveal.hidden = true;
    live.revealed = false;
    live.qRecorded = false;
    if (el.quizStage) {
      el.quizStage.classList.remove('is-revealed');
      retriggerAnimation(el.quizStage, 'is-animating');
    }
    if (el.revealToggleBtn) el.revealToggleBtn.textContent = 'Reveal';

    applyQuestionFit(q.q.length);

    var total = bank[seg].length;
    var served = Math.min(live.served, total);
    var inRound = Math.min(10, live.quizRoundAnswers.length + 1);
    if (live.storyBurstRemaining > 0 && live.storyBurstTotal > 0) {
      var bNum = (live.storyBurstTotal - live.storyBurstRemaining) + 1;
      el.counter.textContent = 'Rapid Trivia ' + bNum + ' of ' + live.storyBurstTotal + ' \u00b7 Returns to Story';
      if (el.segLabel) el.segLabel.textContent = 'Story Loop \u00b7 ' + SEGMENTS[seg];
    } else {
      el.counter.textContent = 'Round ' + live.quizRoundNum + ' \u00b7 Q' + inRound + ' of 10 (' + served + '/' + total + (live.served > total ? ' \u00b7 bag refilled' : '') + ')';
      if (el.segLabel) el.segLabel.textContent = SEGMENTS[seg];
    }
    playSceneChime();
  }

  function revealAnswer() {
    var q = currentQ();
    if (!q || live.revealed || live.quizMilestone) return;
    live.waitingForSpeech = false;
    live.lastTickCueSec = -1;
    live.revealed = true;
    Array.prototype.forEach.call(el.options.children, function (child, i) {
      if (i === q.correct) child.classList.add('is-correct');
    });
    el.revealAnswer.textContent = 'Answer: ' + optionLetter(q.correct) + ' \u00b7 ' + q.opts[q.correct];
    el.revealRef.textContent = q.ref || '';
    prepareVoiceCaption(el.revealNote, q.insight || '', !!(S.voiceOn && S.voiceReveal && synth));
    el.reveal.hidden = false;
    if (el.quizStage) el.quizStage.classList.add('is-revealed');
    if (el.revealToggleBtn) el.revealToggleBtn.textContent = 'Hide';
    playRevealChime();
    speakReveal();
  }

  /* ---------- shared milestone graphic cards (Quiz + Player Quiz) ---------- */
  var svgGradSeq = 0;

  function escapeSvg(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function buildMilestoneGraphicSvg(ans, kind, idx) {
    var numLabel = String(idx + 1);
    if (kind === 'players') {
      var pLib = window.LNR_PLAYERS;
      var colors = (pLib && pLib.getPlayerColors) ? pLib.getPlayerColors(ans.player_id || '') : ['#d9ab63', '#152b23'];
      var c1 = escapeSvg(colors[0]);
      var c2 = escapeSvg(colors[1]);
      var jerseyNum = escapeSvg(String(ans.number || ans.initials || numLabel));
      var gradId = 'msj' + (++svgGradSeq);
      return '<svg viewBox="0 0 64 76" width="64" height="76" aria-hidden="true">' +
        '<defs><linearGradient id="' + gradId + '" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="' + c1 + '"/><stop offset="100%" stop-color="' + c2 + '"/></linearGradient></defs>' +
        '<rect x="1" y="1" width="62" height="74" rx="10" fill="#0c1512" stroke="#d9ab63" stroke-opacity="0.45" stroke-width="1.5"/>' +
        '<path d="M18 16 L26 12 C29 16 35 16 38 12 L46 16 L55 26 L49 34 L44 30 L44 54 C44 57 42 59 39 59 L25 59 C22 59 20 57 20 54 L20 30 L15 34 L9 26 Z" fill="url(#' + gradId + ')" stroke="#f5efe2" stroke-opacity="0.45" stroke-width="1.3"/>' +
        '<text x="32" y="44" text-anchor="middle" fill="#ffffff" font-family="Georgia,serif" font-size="16" font-weight="700">' + jerseyNum + '</text>' +
        '<rect x="6" y="61" width="22" height="10" rx="5" fill="#182722" stroke="#d9ab63" stroke-opacity="0.5"/>' +
        '<text x="17" y="68.5" text-anchor="middle" fill="#d9ab63" font-family="ui-monospace,monospace" font-size="7.5" font-weight="700">Q' + numLabel + '</text>' +
        '</svg>';
    }
    if (kind === 'history') {
      return '<svg viewBox="0 0 64 76" width="64" height="76" aria-hidden="true">' +
        '<rect x="1" y="1" width="62" height="74" rx="10" fill="#121c19" stroke="#d08262" stroke-opacity="0.55" stroke-width="1.5"/>' +
        '<rect x="5" y="5" width="54" height="66" rx="7" fill="none" stroke="#d08262" stroke-opacity="0.22"/>' +
        '<path d="M21 18 H43 L34 35 L43 52 H21 L30 35 Z" fill="#d08262" fill-opacity="0.24" stroke="#d08262" stroke-width="1.8" stroke-linejoin="round"/>' +
        '<path d="M20 18 H44 M20 52 H44" stroke="#f5efe2" stroke-opacity="0.65" stroke-width="2" stroke-linecap="round"/>' +
        '<circle cx="32" cy="35" r="2.2" fill="#d9ab63"/>' +
        '<rect x="16" y="57" width="32" height="12" rx="6" fill="#0b1310" stroke="#d08262" stroke-opacity="0.55"/>' +
        '<text x="32" y="65.5" text-anchor="middle" fill="#f0c6b0" font-family="ui-monospace,monospace" font-size="8" font-weight="700">Q' + numLabel + '</text>' +
        '</svg>';
    }
    /* Bible Scripture Shield Card */
    return '<svg viewBox="0 0 64 76" width="64" height="76" aria-hidden="true">' +
      '<rect x="1" y="1" width="62" height="74" rx="10" fill="#10201a" stroke="#d9ab63" stroke-opacity="0.55" stroke-width="1.5"/>' +
      '<rect x="5" y="5" width="54" height="66" rx="7" fill="none" stroke="#d9ab63" stroke-opacity="0.22"/>' +
      '<path d="M16 20 C22 17 28 18 32 22 C36 18 42 17 48 20 V46 C42 44 36 45 32 49 C28 45 22 44 16 46 Z" fill="#d9ab63" fill-opacity="0.2" stroke="#d9ab63" stroke-width="1.6" stroke-linejoin="round"/>' +
      '<line x1="32" y1="22" x2="32" y2="49" stroke="#d9ab63" stroke-width="1.4"/>' +
      '<path d="M32 10 L33.5 14 L37.5 15.5 L33.5 17 L32 21 L30.5 17 L26.5 15.5 L30.5 14 Z" fill="#f5efe2" fill-opacity="0.88"/>' +
      '<rect x="16" y="57" width="32" height="12" rx="6" fill="#0b1310" stroke="#d9ab63" stroke-opacity="0.55"/>' +
      '<text x="32" y="65.5" text-anchor="middle" fill="#d9ab63" font-family="ui-monospace,monospace" font-size="8" font-weight="700">Q' + numLabel + '</text>' +
      '</svg>';
  }

  function setMilestoneGradesUI(kind) {
    var isQuiz = kind === 'bible' || kind === 'history' || kind === 'quiz';
    if (el.msTitle) {
      el.msTitle.textContent = isQuiz
        ? 'Self-Score Check \u2014 Last 10 Answers'
        : 'Self-Score Check \u2014 Last 10 Players';
    }
    if (el.msGrade0) el.msGrade0.textContent = isQuiz ? 'Master Scholar' : 'World Class';
    if (el.msGrade1) el.msGrade1.textContent = isQuiz ? 'Honor Roll' : 'UCL Starter';
    if (el.msGrade2) el.msGrade2.textContent = isQuiz ? 'Faithful Learner' : 'First Team';
    if (el.msGrade3) el.msGrade3.textContent = isQuiz ? 'Warm Up' : 'Academy';
    if (el.msCta) el.msCta.textContent = 'Tally your score & drop your rank in the live chat!';
    if (el.milestoneStage) el.milestoneStage.setAttribute('data-ms-kind', kind);
  }

  function renderMilestoneCards(answers, kind) {
    if (!el.msGrid) return;
    el.msGrid.innerHTML = '';
    answers.forEach(function (ans, idx) {
      var card = document.createElement('div');
      card.className = 'ms-item ms-item-graphic';
      card.style.setProperty('--ms-i', String(idx));

      var art = document.createElement('div');
      art.className = 'ms-card-art';
      art.innerHTML = buildMilestoneGraphicSvg(ans, kind, idx);

      var body = document.createElement('div');
      body.className = 'ms-item-body';

      var top = document.createElement('div');
      top.className = 'ms-item-top';
      var qpill = document.createElement('span');
      qpill.className = 'ms-q-pill';
      qpill.textContent = 'Q' + (idx + 1);
      var tag = document.createElement('span');
      tag.className = 'ms-tag';
      tag.textContent = kind === 'players' ? (ans.player_id || 'CARD') : (ans.level || 'QUIZ');
      top.appendChild(qpill);
      top.appendChild(tag);

      var nm = document.createElement('b');
      nm.textContent = ans.name || ans.answer || '';
      var mt = document.createElement('span');
      mt.className = 'ms-item-sub';
      mt.textContent = ans.meta || '';

      body.appendChild(top);
      body.appendChild(nm);
      body.appendChild(mt);
      card.appendChild(art);
      card.appendChild(body);
      el.msGrid.appendChild(card);
    });
    retriggerAnimation(el.milestoneStage, 'is-animating');
  }

  var PRE_AD_NOTICE_MS = 5000;

  function promoThresholdMs() {
    return effectivePromoIntervalMin() * 60 * 1000;
  }

  function canTriggerPromoAfterMilestone() {
    return !!(S.autoRotate && S.promoAdsEnabled && live.quizActiveMs >= promoThresholdMs());
  }

  function clearPreAdNotice() {
    live.preAdPending = false;
    live.preAdReturnPhase = '';
    live.preAdStartedAt = 0;
    live.preAdEndsAt = 0;
    if (el.adNotice) el.adNotice.hidden = true;
    if (el.adNoticeFill) el.adNoticeFill.style.width = '0%';
  }

  function updateAdNoticeUI() {
    if (!el.adNotice) return;
    if (!live.preAdPending) {
      el.adNotice.hidden = true;
      return;
    }
    el.adNotice.hidden = false;
    var ref = live.paused ? live.pausedAt : now();
    var rem = Math.max(0, live.preAdEndsAt - ref);
    var total = Math.max(1000, live.preAdEndsAt - live.preAdStartedAt);
    var secLeft = Math.max(1, Math.ceil(rem / 1000));
    if (el.adNoticeTimer) el.adNoticeTimer.textContent = secLeft + 's';
    if (el.adNoticeFill) {
      var pct = Math.min(100, Math.max(0, (1 - rem / total) * 100));
      el.adNoticeFill.style.width = pct.toFixed(1) + '%';
    }
  }

  function startPreAdNotice(returnPhase) {
    clearPreAdNotice();
    live.preAdPending = true;
    live.preAdReturnPhase = returnPhase || homePhase();
    live.preAdStartedAt = now();
    live.preAdEndsAt = live.preAdStartedAt + PRE_AD_NOTICE_MS;
    var nextRound = returnPhase === 'players' ? (plLive.roundNum + 1) : (live.quizRoundNum + 1);
    var activePromos = effectivePromoList();
    if (el.adNoticeTitle) el.adNoticeTitle.textContent = 'Partner break starting soon';
    if (el.adNoticeSub) {
      if (returnPhase === 'story') {
        el.adNoticeSub.textContent = activePromos.length
          ? 'This chapter was sponsored by the promo ads \u00b7 Playing 1 break clip before the next episode'
          : ('This chapter was sponsored by the promo ads \u00b7 Brief break (' + formatShortSec(effectivePromoAdSec()) + ') before the next episode');
      } else {
        el.adNoticeSub.textContent = activePromos.length
          ? ('This round was sponsored by the promo ads \u00b7 Playing 1 break clip before Round ' + nextRound)
          : ('This round was sponsored by the promo ads \u00b7 Brief break (' + formatShortSec(effectivePromoAdSec()) + ') before Round ' + nextRound);
      }
    }
    if (activePromos.length) {
      var upcoming = activePromos[live.promoCursor % activePromos.length];
      if (upcoming && upcoming.id) withClipUrl(upcoming.id, function () {});
    }
    updateAdNoticeUI();
  }

  function completePreAdIntoPromo() {
    var retPhase = live.preAdReturnPhase || homePhase();
    clearPreAdNotice();
    if (retPhase === 'players') {
      plLive.roundAnswers = [];
      plLive.roundNum++;
    } else if (retPhase !== 'story') {
      live.quizMilestone = false;
      live.quizRoundAnswers = [];
      live.quizRoundNum++;
    }
    if (el.milestoneStage) el.milestoneStage.hidden = true;
    enterPhase('promo', false, { returnPhase: retPhase });
  }

  function recordQuizRoundAnswer() {
    if (live.qRecorded) return;
    var q = currentQ();
    if (!q) return;
    live.qRecorded = true;
    var last = live.quizRoundAnswers.length ? live.quizRoundAnswers[live.quizRoundAnswers.length - 1] : null;
    if (last && last.qIndex === live.qIndex && bank[S.segment].length > 10) return;
    var ansText = (q.opts && q.opts[q.correct]) || '';
    live.quizRoundAnswers.push({
      num: live.quizRoundAnswers.length + 1,
      qIndex: live.qIndex,
      title: q.q,
      answer: ansText,
      name: ansText,
      meta: q.ref || SEGMENTS[S.segment],
      segment: S.segment,
      level: q.level || 'Medium'
    });
  }

  function enterQuizMilestone() {
    if (live.phase !== 'quiz') return;
    clearPreAdNotice();
    live.quizMilestone = true;
    live.quizMilestoneStartedAt = now();
    live.quizMilestoneEndsAt = live.quizMilestoneStartedAt + Math.max(10, Number(S.milestoneSec) || 30) * 1000;

    if (el.quizStage) el.quizStage.hidden = true;
    if (el.milestoneStage) el.milestoneStage.hidden = false;
    if (el.msRoundBadge) el.msRoundBadge.textContent = 'ROUND ' + live.quizRoundNum + ' COMPLETE';
    if (el.segLabel) el.segLabel.textContent = SEGMENTS[S.segment] + ' \u00b7 Milestone';
    if (el.counter) el.counter.textContent = 'Round ' + live.quizRoundNum + ' \u00b7 10/10';

    setMilestoneGradesUI(S.segment);
    renderMilestoneCards(live.quizRoundAnswers, S.segment);
    if (el.msGrid) el.msGrid.scrollTop = 0;
    applyChatSafe();
    playMilestoneFanfare();
    speakQuizMilestone();
  }

  var demoRoundNoticed = { quiz: false, players: false };

  function finishQuizMilestone(skipPromo) {
    if (!skipPromo && canTriggerPromoAfterMilestone()) {
      startPreAdNotice('quiz');
      return;
    }
    clearPreAdNotice();
    if (usingDemo[S.segment] && !demoRoundNoticed.quiz) {
      demoRoundNoticed.quiz = true;
      toast('Demo round finished \u2014 import your own unique JSON pack for full streams');
    }
    live.quizMilestone = false;
    live.quizRoundAnswers = [];
    live.quizRoundNum++;
    if (el.milestoneStage) el.milestoneStage.hidden = true;
    if (el.quizStage) el.quizStage.hidden = false;
    nextQuestion();
  }

  function armPostReadQuizCountdown() {
    live.waitingForSpeech = false;
    live.lastTickCueSec = -1;
    live.qEndsAt = now() + POST_READ_COUNTDOWN_MS;
    live.qRemaining = POST_READ_COUNTDOWN_MS;
  }

  function nextQuestion() {
    if (live.phase !== 'quiz') return;
    clearPreAdNotice();
    live.quizMilestone = false;
    live.lastTickCueSec = -1;
    if (el.milestoneStage) el.milestoneStage.hidden = true;
    if (el.quizStage) el.quizStage.hidden = false;

    var idx = draw(S.segment);
    if (idx === null) { toast('No questions in this segment yet', true); return; }
    live.qIndex = idx;
    live.served++;
    if (S.voiceOn && synth) {
      live.waitingForSpeech = true;
      live.qEndsAt = now() + Math.max(S.qSec, 30) * 1000;
      live.qRemaining = POST_READ_COUNTDOWN_MS;
    } else {
      live.waitingForSpeech = false;
      live.qEndsAt = now() + S.qSec * 1000;
      live.qRemaining = S.qSec * 1000;
    }
    renderQuestion();
    if (S.voiceOn) speakCurrent(live.served > 1);
  }

  /* The first question of a quiz block is held behind the "quiz is about to
     start" notice. The question is rendered (so the stage is not blank) but its
     clock does not run until the notice has had its ten seconds. */
  function quizStartHeld() {
    return !!(live.quizStartAt && now() < live.quizStartAt);
  }

  function prevQuestion() {
    if (live.phase !== 'quiz') return;
    clearPreAdNotice();
    live.lastTickCueSec = -1;
    if (live.quizMilestone) {
      live.quizMilestone = false;
      if (el.milestoneStage) el.milestoneStage.hidden = true;
      if (el.quizStage) el.quizStage.hidden = false;
    }
    if (!bagHistory.length) { toast('No earlier question in this run'); return; }
    live.qIndex = bagHistory.pop();
    renderQuestion();
    if (S.voiceOn && synth) {
      live.waitingForSpeech = true;
      live.qEndsAt = now() + Math.max(S.qSec, 30) * 1000;
      live.qRemaining = POST_READ_COUNTDOWN_MS;
      speakCurrent(false);
    } else {
      live.waitingForSpeech = false;
      live.qEndsAt = now() + S.qSec * 1000;
      live.qRemaining = S.qSec * 1000;
    }
  }

  /* ============================================================
     ENGINE 03: PLAYER QUIZ (5-stage sequence + 10-Q milestone)
     ============================================================ */
  var plLive = {
    quiz: null,
    subPhase: 'intro',   /* 'intro' | 'clue' | 'countdown' | 'reveal' | 'milestone' */
    clueIndex: 0,
    subStartedAt: 0,
    subEndsAt: 0,
    revealed: false,
    revealing: false,
    visualHandle: null,
    visualPromise: null,
    bag: [],
    lastId: '',
    history: [],
    roundAnswers: [],
    roundNum: 1,
    totalServed: 0
  };

  function releasePlayerVisual() {
    var pLib = window.LNR_PLAYERS;
    if (pLib && plLive.visualHandle) {
      pLib.revokeVisual(plLive.visualHandle);
    }
    plLive.visualHandle = null;
    plLive.visualPromise = null;
  }

  function refillPlayerBag() {
    var pLib = window.LNR_PLAYERS;
    if (!pLib) { plLive.bag = []; return; }
    var list = pLib.getAllQuizzes(S.playerMode);
    var ids = list.map(function (q) { return q.quiz_id; });
    shuffle(ids);
    if (ids.length > 1 && ids[0] === plLive.lastId) {
      var tmp = ids[0]; ids[0] = ids[1]; ids[1] = tmp;
    }
    plLive.bag = ids;
  }

  function drawPlayerQuiz() {
    var pLib = window.LNR_PLAYERS;
    if (!pLib) return null;
    var list = pLib.getAllQuizzes(S.playerMode);
    if (!list.length) return null;
    if (!plLive.bag.length) refillPlayerBag();
    var map = {};
    list.forEach(function (q) { map[q.quiz_id] = q; });
    while (plLive.bag.length) {
      var id = plLive.bag.pop();
      if (map[id]) {
        plLive.lastId = id;
        return map[id];
      }
    }
    return list[0] || null;
  }

  function speakPlayerSubPhase(announceNext) {
    if (!synth || !S.voiceOn || live.phase !== 'players') return;
    var q = plLive.quiz;
    var shouldAnnounceNext = typeof announceNext === 'boolean' ? announceNext : (plLive.totalServed > 1);
    if (plLive.subPhase === 'intro' && q) {
      var intro = speech.playerIntroParts
        ? speech.playerIntroParts(q, { announceNext: shouldAnnounceNext })
        : (shouldAnnounceNext ? ['Next question.', q.question || 'Guess the player!'] : [q.question || 'Guess the player!']);
      speakParts(intro, false);
    } else if (plLive.subPhase === 'clue' && q) {
      var clueText = (q.clues && q.clues[plLive.clueIndex]) || '';
      var cp = speech.playerClueParts ? speech.playerClueParts(clueText, plLive.clueIndex) : [clueText];
      speakParts(cp, false);
    } else if (plLive.subPhase === 'countdown') {
      var cdp = speech.playerCountdownParts ? speech.playerCountdownParts(S.guessSec) : ['Drop your answer in the comments!'];
      speakParts(cdp, false);
    } else if (plLive.subPhase === 'reveal' && q && S.voiceReveal) {
      var pLib = window.LNR_PLAYERS;
      var player = (plLive.visualHandle && plLive.visualHandle.player) || (pLib && pLib.getPlayerById(q.answer_player_id)) || null;
      var rp = speech.playerRevealParts ? speech.playerRevealParts(q, player) : ['The answer is ' + q.reveal_text];
      if (q.insight && rp.length) {
        rp[rp.length - 1] = { text: rp[rp.length - 1], syncCaption: true };
      }
      speakParts(rp, true);
    } else if (plLive.subPhase === 'milestone' && S.voiceReveal) {
      var mp = speech.milestoneParts ? speech.milestoneParts(plLive.roundNum, plLive.roundAnswers, 'players') : ['Round complete! Tally your score!'];
      speakParts(mp, true);
    }
  }

  function applyVisualEffect(vis) {
    if (!el.plPhoto || !el.plCardFrame || !el.plMysteryCover) return;
    var q = plLive.quiz;
    if (!q || !vis) return;
    var mode = q.mode || 'clues';
    var revealed = plLive.subPhase === 'reveal';

    var targetSrc = revealed ? vis.url : (vis.mysteryUrl || vis.url);
    if (el.plPhoto.src !== targetSrc) {
      el.plPhoto.src = targetSrc;
    }

    el.plCardFrame.classList.remove('is-mode-clues', 'is-mode-blur', 'is-mode-zoom', 'is-mode-sil', 'is-revealed');
    el.plCardFrame.classList.add(
      mode === 'blur_reveal' ? 'is-mode-blur'
        : mode === 'zoom_crop' ? 'is-mode-zoom'
        : mode === 'silhouette' ? 'is-mode-sil'
        : 'is-mode-clues'
    );
    if (revealed) el.plCardFrame.classList.add('is-revealed');

    /* Progressive clarity step across clues -> countdown -> reveal */
    var step = 0;
    if (revealed) step = 4;
    else if (plLive.subPhase === 'countdown') step = 3;
    else if (plLive.subPhase === 'clue') step = Math.min(2, plLive.clueIndex + 1);
    el.plCardFrame.setAttribute('data-step', String(step));

    if (mode === 'clues' && !revealed) {
      el.plMysteryCover.hidden = false;
      el.plPhoto.hidden = true;
      if (el.plCardTag) {
        el.plCardTag.hidden = false;
        el.plCardTag.textContent = 'MYSTERY CARD';
      }
    } else {
      el.plMysteryCover.hidden = true;
      el.plPhoto.hidden = false;
      if (el.plCardTag) {
        if (revealed) {
          /* Never cover bottom of the full-content Player Card on final reveal */
          el.plCardTag.hidden = true;
        } else {
          el.plCardTag.hidden = false;
          el.plCardTag.textContent = mode === 'blur_reveal' ? 'BLUR REVEAL' : (mode === 'zoom_crop' ? 'ZOOM MYSTERY' : 'SILHOUETTE');
        }
      }
    }
  }

  function applyPlayerFit() {
    if (!el.playerStage) return;
    var mainCol = el.playerStage.querySelector('.player-main-col');
    if (!mainCol) return;
    var tiers = ['normal', 'tight', 'compact'];
    el.playerStage.setAttribute('data-pfit', 'normal');
    for (var i = 0; i < tiers.length; i++) {
      el.playerStage.setAttribute('data-pfit', tiers[i]);
      if (mainCol.scrollHeight <= mainCol.clientHeight + 2) break;
    }
  }

  function renderPlayerStage() {
    var q = plLive.quiz;
    if (!q) return;
    var pLib = window.LNR_PLAYERS;
    var totalPool = pLib ? pLib.getAllQuizzes(S.playerMode).length : 0;
    var isReveal = plLive.subPhase === 'reveal';

    if (el.segLabel) {
      var modeLabel = q.mode === 'blur_reveal' ? 'Blur Reveal'
        : q.mode === 'zoom_crop' ? 'Zoom Mystery'
        : q.mode === 'silhouette' ? 'Mystery Silhouette' : 'Guess the Player';
      el.segLabel.textContent = 'Player Quiz \u00b7 ' + modeLabel;
    }
    if (el.counter) {
      var inRound = plLive.roundAnswers.length + (plLive.subPhase === 'milestone' ? 0 : 1);
      el.counter.textContent = 'Round ' + plLive.roundNum + ' \u00b7 Q' + Math.min(10, inRound) + ' of 10' + (totalPool ? ' (' + plLive.totalServed + '/' + totalPool + ')' : '');
    }

    if (el.playerStage) {
      el.playerStage.classList.toggle('is-reveal-stage', isReveal);
    }

    if (el.plHeadline) {
      el.plHeadline.textContent = q.question || 'GUESS THE PLAYER!';
      el.plHeadline.hidden = isReveal;
      el.plHeadline.classList.toggle('is-with-clues', plLive.subPhase === 'clue' || plLive.subPhase === 'countdown');
    }

    if (el.plStageBadge) {
      var totalClues = (q.clues && q.clues.length) || 1;
      if (plLive.subPhase === 'intro') el.plStageBadge.textContent = 'STAGE 1 \u00b7 LISTEN';
      else if (plLive.subPhase === 'clue') el.plStageBadge.textContent = 'CLUE ' + (plLive.clueIndex + 1) + ' OF ' + totalClues;
      else if (plLive.subPhase === 'countdown') el.plStageBadge.textContent = 'STAGE 3 \u00b7 GUESS NOW';
      else if (isReveal) el.plStageBadge.textContent = 'ANSWER REVEAL';
    }

    if (el.plCountdownPill) {
      el.plCountdownPill.hidden = plLive.subPhase !== 'countdown';
      el.plCountdownPill.classList.remove('is-urgent');
    }

    if (el.plCluesList) {
      el.plCluesList.innerHTML = '';
      el.plCluesList.hidden = isReveal || plLive.subPhase === 'intro';
      if (!isReveal) {
        var visibleCount = 0;
        if (plLive.subPhase === 'clue') visibleCount = plLive.clueIndex + 1;
        else if (plLive.subPhase === 'countdown') visibleCount = (q.clues || []).length;

        (q.clues || []).forEach(function (clueText, idx) {
          if (idx >= visibleCount) return;
          var li = document.createElement('li');
          li.className = 'pl-clue-item' + (idx === visibleCount - 1 && plLive.subPhase === 'clue' ? ' is-fresh' : '');
          var num = document.createElement('span');
          num.className = 'pl-clue-num';
          num.textContent = 'Clue ' + (idx + 1);
          var txt = document.createElement('span');
          txt.className = 'pl-clue-text';
          txt.textContent = clueText;
          li.appendChild(num);
          li.appendChild(txt);
          el.plCluesList.appendChild(li);
        });
      }
    }

    if (el.plMysteryLabel) {
      el.plMysteryLabel.textContent = plLive.subPhase === 'countdown' ? 'Drop your answer!' : 'Listen to the clues';
    }

    if (el.plRevealMeta) {
      el.plRevealMeta.hidden = !isReveal;
      if (isReveal) {
        var player = (plLive.visualHandle && plLive.visualHandle.player) || (pLib && pLib.getPlayerById(q.answer_player_id)) || null;
        if (el.plRevealName) el.plRevealName.textContent = q.reveal_text || (player && player.name) || q.answer_player_id;
        if (el.plRevealSub) {
          el.plRevealSub.textContent = player ? (player.club + ' \u00b7 ' + player.nationality + (player.number ? ' \u00b7 #' + player.number : '')) : q.category;
        }
        if (el.plRevealInsight) {
          prepareVoiceCaption(el.plRevealInsight, q.insight || '', !!(S.voiceOn && S.voiceReveal && synth));
        }
      }
    }

    if (el.revealToggleBtn) {
      el.revealToggleBtn.textContent = isReveal ? 'Revealed' : 'Reveal';
    }

    if (plLive.visualHandle) applyVisualEffect(plLive.visualHandle);
    applyChatSafe();
    applyPlayerFit();
    window.requestAnimationFrame(applyPlayerFit);
    window.setTimeout(applyPlayerFit, 90);
    if (plLive.subPhase === 'intro' || isReveal) retriggerAnimation(el.playerStage, 'is-animating');
  }

  function enterPlayerSubPhase(sub, clueIdx) {
    plLive.subPhase = sub;
    plLive.clueIndex = typeof clueIdx === 'number' ? clueIdx : plLive.clueIndex;
    plLive.subStartedAt = now();
    live.lastTickCueSec = -1;

    if (sub === 'intro') {
      plLive.subEndsAt = plLive.subStartedAt + 2800;
      playSceneChime();
    } else if (sub === 'clue') {
      plLive.subEndsAt = plLive.subStartedAt + S.clueSec * 1000;
      playSceneChime();
    } else if (sub === 'countdown') {
      plLive.subEndsAt = plLive.subStartedAt + S.guessSec * 1000;
    } else if (sub === 'reveal') {
      plLive.revealed = true;
      plLive.subEndsAt = plLive.subStartedAt + S.playerRevealSec * 1000;
      playRevealChime();
    }

    renderPlayerStage();
    speakPlayerSubPhase(sub === 'intro' ? (plLive.totalServed > 1) : false);
  }

  /* Guarantee the answer never displays before the SVG card is ready */
  function enterPlayerReveal() {
    if (live.phase !== 'players' || !plLive.quiz) return;
    if (plLive.subPhase === 'reveal' || plLive.revealing) return;
    plLive.revealing = true;
    var targetQuizId = plLive.quiz.quiz_id;

    var pLib = window.LNR_PLAYERS;
    var ready = plLive.visualHandle
      ? Promise.resolve(plLive.visualHandle)
      : (plLive.visualPromise || (pLib ? pLib.preloadPlayerVisual(plLive.quiz.answer_player_id, { insight: plLive.quiz.insight }) : Promise.resolve(null)));

    ready.then(function (vis) {
      plLive.revealing = false;
      if (live.phase !== 'players' || !plLive.quiz || plLive.quiz.quiz_id !== targetQuizId) {
        if (vis && vis !== plLive.visualHandle && pLib) pLib.revokeVisual(vis);
        return;
      }
      if (vis) plLive.visualHandle = vis;
      enterPlayerSubPhase('reveal');
    }).catch(function () {
      plLive.revealing = false;
      if (live.phase === 'players' && plLive.quiz && plLive.quiz.quiz_id === targetQuizId) {
        enterPlayerSubPhase('reveal');
      }
    });
  }

  function recordCurrentRoundAnswer() {
    var q = plLive.quiz;
    if (!q) return;
    var pLib = window.LNR_PLAYERS;
    var player = (plLive.visualHandle && plLive.visualHandle.player) || (pLib && pLib.getPlayerById(q.answer_player_id)) || null;
    var nameStr = q.reveal_text || (player && player.name) || q.answer_player_id;
    var pParts = nameStr.trim().split(/\s+/);
    var initials = pParts.length >= 2 ? (pParts[0][0] + pParts[pParts.length - 1][0]).toUpperCase() : nameStr.slice(0, 2).toUpperCase();
    var already = plLive.roundAnswers.some(function (item) { return item.quiz_id === q.quiz_id; });
    if (!already) {
      plLive.roundAnswers.push({
        num: plLive.roundAnswers.length + 1,
        quiz_id: q.quiz_id,
        player_id: q.answer_player_id,
        number: (player && player.number) || '',
        initials: initials,
        name: nameStr,
        meta: player ? (player.club + ' \u00b7 ' + player.nationality) : q.category
      });
    }
  }

  function enterMilestone() {
    if (live.phase !== 'players') return;
    clearPreAdNotice();
    releasePlayerVisual();
    plLive.subPhase = 'milestone';
    plLive.subStartedAt = now();
    plLive.subEndsAt = plLive.subStartedAt + Math.max(10, Number(S.milestoneSec) || 30) * 1000;

    if (el.playerStage) el.playerStage.hidden = true;
    if (el.milestoneStage) el.milestoneStage.hidden = false;
    if (el.msRoundBadge) el.msRoundBadge.textContent = 'ROUND ' + plLive.roundNum + ' COMPLETE';
    if (el.segLabel) el.segLabel.textContent = 'Milestone \u00b7 Self-Score';
    if (el.counter) el.counter.textContent = 'Round ' + plLive.roundNum + ' \u00b7 10/10';

    setMilestoneGradesUI('players');
    renderMilestoneCards(plLive.roundAnswers, 'players');
    if (el.msGrid) el.msGrid.scrollTop = 0;
    applyChatSafe();
    playMilestoneFanfare();
    speakPlayerSubPhase();
  }

  function finishPlayerMilestone(skipPromo) {
    if (!skipPromo && canTriggerPromoAfterMilestone()) {
      startPreAdNotice('players');
      return;
    }
    clearPreAdNotice();
    if (window.LNR_PLAYERS && window.LNR_PLAYERS.isDemoOnly && window.LNR_PLAYERS.isDemoOnly() && !demoRoundNoticed.players) {
      demoRoundNoticed.players = true;
      toast('Player demo finished \u2014 import your own player JSON pack in Setup');
    }
    plLive.roundAnswers = [];
    plLive.roundNum++;
    if (el.milestoneStage) el.milestoneStage.hidden = true;
    if (el.playerStage) el.playerStage.hidden = false;
    nextPlayerQuestion(false);
  }

  function nextPlayerQuestion(pushHistory) {
    if (live.phase !== 'players') return;
    if (pushHistory && plLive.quiz) {
      plLive.history.push(plLive.quiz.quiz_id);
      if (plLive.history.length > MAX_BAG_HISTORY) plLive.history.shift();
    }
    releasePlayerVisual();
    if (el.milestoneStage) el.milestoneStage.hidden = true;
    if (el.playerStage) el.playerStage.hidden = false;

    var q = drawPlayerQuiz();
    if (!q) {
      toast('No player quizzes match this filter', true);
      return;
    }
    plLive.quiz = q;
    plLive.revealed = false;
    plLive.revealing = false;
    plLive.totalServed++;

    /* Pre-render Player Card SVG in the background while clues are read */
    var pLib = window.LNR_PLAYERS;
    if (pLib) {
      var qid = q.quiz_id;
      plLive.visualPromise = pLib.preloadPlayerVisual(q.answer_player_id, { insight: q.insight }).then(function (vis) {
        if (plLive.quiz && plLive.quiz.quiz_id === qid) {
          plLive.visualHandle = vis;
          applyVisualEffect(vis);
        } else {
          pLib.revokeVisual(vis);
        }
        return vis;
      });
    }

    enterPlayerSubPhase('intro', 0);
  }

  function prevPlayerQuestion() {
    if (live.phase !== 'players') return;
    if (!plLive.history.length) { toast('No earlier player in this run'); return; }
    var prevId = plLive.history.pop();
    var pLib = window.LNR_PLAYERS;
    var found = pLib ? pLib.getAllQuizzes('all').find(function (q) { return q.quiz_id === prevId; }) : null;
    if (!found) { toast('Previous question unavailable'); return; }

    releasePlayerVisual();
    if (el.milestoneStage) el.milestoneStage.hidden = true;
    if (el.playerStage) el.playerStage.hidden = false;
    plLive.quiz = found;
    plLive.revealed = false;
    plLive.revealing = false;
    if (pLib) {
      plLive.visualPromise = pLib.preloadPlayerVisual(found.answer_player_id, { insight: found.insight }).then(function (vis) {
        if (plLive.quiz && plLive.quiz.quiz_id === prevId) {
          plLive.visualHandle = vis;
          applyVisualEffect(vis);
        } else {
          pLib.revokeVisual(vis);
        }
        return vis;
      });
    }
    enterPlayerSubPhase('intro', 0);
  }

  function startPlayerRound() {
    plLive.roundAnswers = [];
    plLive.roundNum = 1;
    plLive.totalServed = 0;
    plLive.history = [];
    refillPlayerBag();
    nextPlayerQuestion(false);
  }

  /* ============================================================
     ENGINE 04: HOOK-LOOP STORYTELLING ENGINE
     4-Stage Interactive Micro-Loop:
       1. 8-10s Cold-Open Anomaly Hook
       2. 3 Escalating Evidence Beats (8 shifting visual compositions)
       3. Live Chat Deduction Gate (3 options + countdown)
       4. Twist Reveal, Authored Commentary & Rapid Trivia Interleave
     ============================================================ */
  var storyLive = {
    episode: null,
    flatSteps: [],
    stepIndex: 0,
    stepStartedAt: 0,
    stepEndsAt: 0,
    waitingForSpeech: false,
    bag: [],
    lastEpId: '',
    lastArchetype: '',
    lastPacing: '',
    episodesCompleted: 0,
    lastTickCueSec: -1
  };

  function formatArchetypeLabel(a) {
    if (a === 'historical_banter') return 'Sar & Diq \u00b7 Banter';
    if (a === 'historical_heist') return 'Historical Heist';
    if (a === 'biblical_mystery') return 'Biblical Mystery';
    if (a === 'ethical_dilemma') return 'Ethical Dilemma';
    if (a === 'survival_scenario') return 'Survival Scenario';
    return 'Historical Anomaly';
  }

  function formatPacingLabel(p) {
    if (p === 'slow_psychological') return 'Psychological';
    if (p === 'rapid_dilemma') return 'Rapid Dilemma';
    return 'Fast Investigative';
  }

  function refillStoryBag() {
    var sApi = window.LNR_STORIES;
    if (!sApi) { storyLive.bag = []; return; }
    var list = sApi.getAllEpisodes(S.storyCat);
    if (!list.length) list = sApi.getAllEpisodes('all');
    var ids = list.map(function (ep) { return ep.id; });
    var starterId = '';
    if (storyLive.episodesCompleted === 0) {
      starterId = S.storyStartId && ids.indexOf(S.storyStartId) >= 0 ? S.storyStartId : (ids[0] || '');
    }
    shuffle(ids);
    if (ids.length > 1 && ids[ids.length - 1] === storyLive.lastEpId) {
      var t = ids[ids.length - 1]; ids[ids.length - 1] = ids[0]; ids[0] = t;
    }
    if (starterId) {
      var foundIdx = ids.indexOf(starterId);
      if (foundIdx >= 0) {
        ids.splice(foundIdx, 1);
        ids.push(starterId);
      }
    }
    storyLive.bag = ids;
  }

  function drawStoryEpisode() {
    var sApi = window.LNR_STORIES;
    if (!sApi) return null;
    var list = sApi.getAllEpisodes(S.storyCat);
    if (!list.length) list = sApi.getAllEpisodes('all');
    if (!list.length) return null;
    if (!storyLive.bag.length) refillStoryBag();
    var map = {};
    list.forEach(function (ep) { map[ep.id] = ep; });

    /* Prefer an episode with BOTH a different archetype and pacing profile than the last case */
    if (S.storyVaryCadence && storyLive.episodesCompleted > 0 && storyLive.bag.length > 1) {
      for (var i = storyLive.bag.length - 1; i >= 0; i--) {
        var cand = map[storyLive.bag[i]];
        if (cand && cand.archetype !== storyLive.lastArchetype && cand.pacingProfile !== storyLive.lastPacing) {
          storyLive.bag.splice(i, 1);
          storyLive.lastEpId = cand.id;
          storyLive.lastArchetype = cand.archetype;
          storyLive.lastPacing = cand.pacingProfile;
          return cand;
        }
      }
      for (var j = storyLive.bag.length - 1; j >= 0; j--) {
        var cand2 = map[storyLive.bag[j]];
        if (cand2 && cand2.archetype !== storyLive.lastArchetype) {
          storyLive.bag.splice(j, 1);
          storyLive.lastEpId = cand2.id;
          storyLive.lastArchetype = cand2.archetype;
          storyLive.lastPacing = cand2.pacingProfile;
          return cand2;
        }
      }
    }

    while (storyLive.bag.length) {
      var id = storyLive.bag.pop();
      if (map[id]) {
        storyLive.lastEpId = id;
        storyLive.lastArchetype = map[id].archetype || '';
        storyLive.lastPacing = map[id].pacingProfile || '';
        return map[id];
      }
    }
    return list[0] || null;
  }

  function buildFlatStorySteps(ep) {
    var steps = [{ kind: 'hook', beatIdx: -1, beat: null }];
    (ep.beats || []).forEach(function (beat, idx) {
      steps.push({ kind: 'beat', beatIdx: idx, beat: beat });
    });
    if (ep.chatCheckpoint && ep.chatCheckpoint.options && ep.chatCheckpoint.options.length) {
      steps.push({ kind: 'checkpoint', beatIdx: (ep.beats || []).length, beat: null, checkpoint: ep.chatCheckpoint });
    }
    if (ep.resolution) {
      steps.push({ kind: 'resolution', beatIdx: (ep.beats || []).length + 1, beat: null, resolution: ep.resolution, checkpoint: ep.chatCheckpoint });
    }
    return steps;
  }

  function escHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatChapterTitle(chapterNum) {
    var words = speech.intToWords ? speech.intToWords(Math.max(1, Number(chapterNum) || 1)) : String(chapterNum);
    return 'Chapter ' + words.replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  function buildAnimatedMapSvg(route) {
    var pts = Array.isArray(route) && route.length ? route : ['Origin', 'Corridor', 'Resolution'];
    var W = 540, H = 190;
    var count = pts.length;
    var coords = pts.map(function (name, i) {
      var x = 48 + (count > 1 ? (i * (W - 96)) / (count - 1) : (W - 96) / 2);
      var y = i % 2 === 0 ? 114 : 68;
      if (i === Math.floor(count / 2)) y = 88;
      return { x: Math.round(x), y: y, name: name };
    });
    var d = coords.map(function (c, i) { return (i === 0 ? 'M ' : ' L ') + c.x + ' ' + c.y; }).join('');
    var nodes = coords.map(function (c, i) {
      var labelY = c.y > 95 ? c.y + 24 : c.y - 16;
      return '<circle cx="' + c.x + '" cy="' + c.y + '" r="' + (i === count - 1 ? 7 : 5.5) + '" fill="var(--story-accent, #cfa35a)" stroke="#0c1210" stroke-width="2"/>' +
        '<text x="' + c.x + '" y="' + labelY + '" text-anchor="middle" fill="#ede7da" font-family="ui-monospace,monospace" font-size="12" font-weight="600">' + escHtml(c.name) + '</text>';
    }).join('');
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Historical route map">' +
      '<defs><pattern id="stMapGrid" width="36" height="36" patternUnits="userSpaceOnUse"><path d="M 36 0 L 0 0 0 36" fill="none" stroke="rgba(237,231,218,0.06)" stroke-width="1"/></pattern></defs>' +
      '<rect width="' + W + '" height="' + H + '" rx="10" fill="url(#stMapGrid)"/>' +
      '<path class="story-map-route-path" d="' + d + '" fill="none" stroke="var(--story-accent, #cfa35a)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>' +
      nodes +
      '</svg>';
  }

  function renderStorySceneVisual(step, ep) {
    if (!el.storyVisualHost) return;
    var activeAccent = (step.beat && step.beat.accentColor) || ep.accentColor || '#cfa35a';
    if (el.storyStage && S.storyVaryCadence) {
      el.storyStage.style.setProperty('--story-accent', activeAccent);
    } else if (el.storyStage) {
      el.storyStage.style.setProperty('--story-accent', '#cfa35a');
    }

    if (step.kind === 'hook') {
      var chapLabel = formatChapterTitle(storyLive.episodesCompleted + 1);
      var hk = ep.hook || {};
      el.storyVisualHost.innerHTML =
        '<div class="story-intro-hero">' +
          '<div class="story-chapter-kicker">' + escHtml(chapLabel) + '</div>' +
          '<h2>' + escHtml(ep.title || hk.headline) + '</h2>' +
          (ep.subtitle ? '<p class="story-intro-sub">' + escHtml(ep.subtitle) + '</p>' : '') +
        '</div>';
      return;
    }

    if (step.kind === 'checkpoint') {
      var cp = step.checkpoint || ep.chatCheckpoint || {};
      var optsHtml = (cp.options || []).map(function (opt) {
        return '<div class="story-cp-opt"><span>' + escHtml(opt) + '</span></div>';
      }).join('');
      el.storyVisualHost.innerHTML =
        '<div class="story-checkpoint-wrap">' +
          '<div class="story-scene-kicker">VOTE A, B, OR C IN CHAT</div>' +
          '<h3 class="story-scene-headline">' + escHtml(cp.prompt || 'WHAT DOES THE EVIDENCE SHOW?') + '</h3>' +
          '<div class="story-checkpoint-opts">' + optsHtml + '</div>' +
        '</div>';
      return;
    }

    if (step.kind === 'resolution') {
      var res = step.resolution || ep.resolution || {};
      var cpR = step.checkpoint || ep.chatCheckpoint || {};
      var winnerTxt = (cpR.options && cpR.options[cpR.correctIndex]) ? cpR.options[cpR.correctIndex] : '';
      el.storyVisualHost.innerHTML =
        '<div class="story-scene-kicker">THE REVEAL</div>' +
        '<h3 class="story-scene-headline">' + escHtml(winnerTxt || 'Resolution &amp; Analysis') + '</h3>' +
        '<div class="story-resolution-grid">' +
          '<div class="story-analysis-card is-accent">' +
            '<h4>The Flaw Everyone Misses</h4>' +
            '<p>' + escHtml(res.flawEveryoneMisses) + '</p>' +
          '</div>' +
          '<div class="story-analysis-card">' +
            '<h4>Why This Matters</h4>' +
            '<p>' + escHtml(res.whyItMatters) + '</p>' +
          '</div>' +
        '</div>';
      return;
    }

    var beat = step.beat;
    var vis = beat.visual || {};
    var dateCtx = beat.dateLabel || vis.dateLabel || ep.era || '';
    var locCtx = beat.location || vis.location || '';
    var kickerParts = [];
    if (dateCtx) kickerParts.push(escHtml(dateCtx));
    if (locCtx) kickerParts.push(escHtml(locCtx));
    var kicker = kickerParts.length ? ('<div class="story-scene-kicker">' + kickerParts.join(' &middot; ') + '</div>') : '';
    var headline = '<h3 class="story-scene-headline">' + escHtml(beat.headline) + '</h3>';
    var mode = beat.visualMode || 'evidence_card';
    var distinctQuote = (vis.quote && String(vis.quote).trim() !== String(beat.text || '').trim()) ? String(vis.quote).trim() : '';

    if (mode === 'wildfire_surge' || mode === 'ember_glow') {
      var isSar = mode === 'wildfire_surge' || beat.speaker === 'SAR';
      var speakerTitle = isSar ? 'SAR' : 'DIQ';
      el.storyVisualHost.innerHTML = kicker + headline +
        '<div class="story-fire-grid">' +
          '<div class="story-fire-card ' + (isSar ? 'is-sar' : 'is-diq') + '">' +
            '<div class="story-speaker-row"><span class="story-speaker-dot" aria-hidden="true"></span><span>' + escHtml(speakerTitle) + '</span></div>' +
            (distinctQuote ? '<p class="story-doc-quote">\u201c' + escHtml(distinctQuote) + '\u201d</p>' : '') +
            (vis.attribution ? '<div class="story-doc-attr">\u2014 ' + escHtml(vis.attribution) + '</div>' : '') +
          '</div>' +
          '<div class="story-stat-box">' +
            '<div class="story-stat-val">' + escHtml(vis.accentStat || (isSar ? 'Surge' : 'Restraint')) + '</div>' +
            '<div class="story-stat-lbl">' + escHtml(vis.statLabel || (beat.location || ep.era)) + '</div>' +
          '</div>' +
        '</div>';
    } else if (mode === 'signal_waveform') {
      var bars = Array.isArray(vis.waveformBars) && vis.waveformBars.length ? vis.waveformBars : [28, 64, 42, 88, 52, 94, 38, 76, 48, 82, 34, 60];
      var barsHtml = bars.map(function (v) {
        var hPct = Math.max(12, Math.min(100, Number(v) || 40));
        return '<span class="story-waveform-bar" style="height:' + hPct + '%"></span>';
      }).join('');
      el.storyVisualHost.innerHTML = kicker + headline +
        '<div class="story-waveform-wrap">' +
          '<div class="story-waveform-box">' +
            '<div class="story-waveform-bars">' + barsHtml + '</div>' +
            '<div class="story-waveform-lbl">' + escHtml(vis.waveformLabel || 'Signal Trace') + '</div>' +
          '</div>' +
          '<div class="story-stat-box">' +
            '<div class="story-stat-val">' + escHtml(vis.accentStat || 'Trace Lock') + '</div>' +
            '<div class="story-stat-lbl">' + escHtml(vis.statLabel || 'Anomalous signature') + '</div>' +
          '</div>' +
        '</div>';
    } else if (mode === 'evidence_card') {
      if (distinctQuote) {
        el.storyVisualHost.innerHTML = kicker + headline +
          '<div class="story-evidence-grid">' +
            '<div class="story-doc-card">' +
              '<p class="story-doc-quote">\u201c' + escHtml(distinctQuote) + '\u201d</p>' +
              (vis.attribution ? '<div class="story-doc-attr">\u2014 ' + escHtml(vis.attribution) + '</div>' : '') +
            '</div>' +
            '<div class="story-stat-box">' +
              '<div class="story-stat-val">' + escHtml(vis.accentStat || 'Key Detail') + '</div>' +
              '<div class="story-stat-lbl">' + escHtml(vis.statLabel || 'Verified record') + '</div>' +
            '</div>' +
          '</div>';
      } else {
        el.storyVisualHost.innerHTML = kicker + headline +
          '<div class="story-stat-box">' +
            '<div class="story-stat-val">' + escHtml(vis.accentStat || 'Key Detail') + '</div>' +
            '<div class="story-stat-lbl">' + escHtml(vis.statLabel || 'Verified record') + '</div>' +
          '</div>';
      }
    } else if (mode === 'map') {
      el.storyVisualHost.innerHTML = kicker + headline +
        '<div class="story-map-layout">' +
          '<div class="story-map-svg-box">' + buildAnimatedMapSvg(vis.route) + '</div>' +
          '<div class="story-stat-box">' +
            '<div class="story-stat-val">' + escHtml(vis.accentStat || 'Corridor') + '</div>' +
            '<div class="story-stat-lbl">' + escHtml(vis.statLabel || (beat.location || vis.location || 'Route vector')) + '</div>' +
          '</div>' +
        '</div>';
    } else if (mode === 'timeline') {
      var itemsHtml = (vis.points || []).map(function (pt) {
        return '<li class="story-timeline-item">' + escHtml(pt) + '</li>';
      }).join('');
      el.storyVisualHost.innerHTML = kicker + headline + '<ul class="story-timeline-list">' + itemsHtml + '</ul>';
    } else if (mode === 'profile') {
      var subj = vis.subjectName || beat.headline;
      var initials = subj.trim().split(/\s+/).slice(0, 2).map(function (w) { return w[0] || ''; }).join('').toUpperCase();
      el.storyVisualHost.innerHTML = kicker +
        '<div class="story-profile-grid">' +
          '<div class="story-monogram" aria-hidden="true">' + escHtml(initials || 'H') + '</div>' +
          '<div>' +
            '<div class="story-profile-role">' + escHtml(vis.role || 'Key Figure') + (vis.eraSpan ? (' \u00b7 ' + escHtml(vis.eraSpan)) : '') + '</div>' +
            headline +
            (distinctQuote ? '<div class="story-doc-card"><p class="story-doc-quote">\u201c' + escHtml(distinctQuote) + '\u201d</p></div>' : '') +
          '</div>' +
        '</div>';
    } else if (mode === 'comparison') {
      var lList = (vis.leftItems || []).map(function (it) { return '<li>' + escHtml(it) + '</li>'; }).join('');
      var rList = (vis.rightItems || []).map(function (it) { return '<li>' + escHtml(it) + '</li>'; }).join('');
        '<div class="story-compare-grid">' +
          '<div class="story-compare-col"><h4>' + escHtml(vis.leftTitle || 'Claim') + '</h4><ul>' + lList + '</ul></div>' +
          '<div class="story-compare-col is-right"><h4>' + escHtml(vis.rightTitle || 'Evidence') + '</h4><ul>' + rList + '</ul></div>' +
        '</div>';
    } else if (mode === 'artifact') {
      el.storyVisualHost.innerHTML = kicker + headline +
        '<div class="story-artifact-grid">' +
          '<div class="story-artifact-meta">' +
            (vis.artifactName ? '<div><b>Artifact</b>' + escHtml(vis.artifactName) + '</div>' : '') +
            (vis.material ? '<div><b>Medium</b>' + escHtml(vis.material) + '</div>' : '') +
            (vis.provenance ? '<div><b>Provenance</b>' + escHtml(vis.provenance) + '</div>' : '') +
          '</div>' +
          '<div class="story-stat-box">' +
            '<div class="story-stat-val">' + escHtml(vis.accentStat || 'Artifact') + '</div>' +
            '<div class="story-stat-lbl">' + escHtml(vis.statLabel || 'Material exhibit') + '</div>' +
          '</div>' +
        '</div>';
    } else {
      el.storyVisualHost.innerHTML = kicker + headline +
        (distinctQuote ? ('<div class="story-doc-card"><p class="story-doc-quote">\u201c' + escHtml(distinctQuote) + '\u201d</p>' +
          (vis.attribution ? '<div class="story-doc-attr">\u2014 ' + escHtml(vis.attribution) + '</div>' : '') + '</div>') : '');
    }
  }

  function storyStepHoldMs(step, ep) {
    var baseSec = Math.max(4, Number(S.storySceneSec) || 8);
    if (step.kind === 'hook') return Math.max(6, Number(ep.hook && ep.hook.durationSec) || 9) * 1000;
    if (step.kind === 'checkpoint') return Math.max(10, Number(step.checkpoint && step.checkpoint.countdownSec) || 15) * 1000;
    if (step.kind === 'resolution') return Math.max(8, baseSec + 4) * 1000;
    var paceMult = ep.pacingProfile === 'rapid_dilemma' ? 0.85 : (ep.pacingProfile === 'slow_psychological' ? 1.15 : 1);
    return Math.round(Math.max(4000, baseSec * paceMult * 1000));
  }

  function armStoryHoldCountdown() {
    storyLive.waitingForSpeech = false;
    storyLive.lastTickCueSec = -1;
    var ep = storyLive.episode;
    var step = storyLive.flatSteps[storyLive.stepIndex];
    var holdMs = (ep && step) ? storyStepHoldMs(step, ep) : (Math.max(4, Number(S.storySceneSec) || 8) * 1000);
    storyLive.stepStartedAt = now();
    storyLive.stepEndsAt = storyLive.stepStartedAt + holdMs;
  }

  function playUploadedStoryAudioForStep(stepIdx, totalSteps) {
    if (!storySpeechTracks.length || !S.voiceOn || live.phase !== 'story') return false;
    stopSpeech();
    var mode = S.storySpeechMode || 'episode';
    var trackIndex = mode === 'step'
      ? ((storyLive.episodesCompleted * Math.max(1, totalSteps) + stepIdx) % storySpeechTracks.length)
      : (storyLive.episodesCompleted % storySpeechTracks.length);
    var track = storySpeechTracks[trackIndex];
    if (!track || !track.url) return false;

    storySpeechPreviewing = false;
    storySpeechPaused = false;
    storySpeechPlaying = true;
    storySpeechTrackIdx = trackIndex;
    setMusicDucking(true);

    var fallbackDur = Math.max(10, track.duration || (totalSteps * (Number(S.storySceneSec) || 8)));
    if (mode === 'episode') {
      var segDur = fallbackDur / Math.max(1, totalSteps);
      var targetTime = stepIdx * segDur;
      if (storySpeechEl.getAttribute('data-track-id') !== track.id || storySpeechEl.ended || stepIdx === 0) {
        storySpeechEl.setAttribute('data-track-id', track.id);
        storySpeechEl.src = track.url;
        storySpeechEl.loop = false;
        storySpeechEl.currentTime = stepIdx > 0 ? targetTime : 0;
      } else if (Math.abs((storySpeechEl.currentTime || 0) - targetTime) > segDur * 0.85) {
        try { storySpeechEl.currentTime = targetTime; } catch (e) {}
      }
      storySpeechWaitMode = false;
      storyLive.waitingForSpeech = false;
      storyLive.stepEndsAt = storyLive.stepStartedAt + Math.max(storyStepHoldMs(storyLive.flatSteps[stepIdx], storyLive.episode), Math.round(segDur * 1000));
      startAudioCaptionSync(targetTime, targetTime + segDur);
      storySpeechEl.onended = function () {
        if (!storySpeechPreviewing && storySpeechPlaying) {
          finishCaptionSync();
          setMusicDucking(false);
        }
      };
    } else {
      storySpeechEl.setAttribute('data-track-id', track.id);
      storySpeechEl.src = track.url;
      storySpeechEl.loop = false;
      storySpeechEl.currentTime = 0;
      storySpeechWaitMode = true;
      storySpeechDeadline = now() + Math.max(15000, fallbackDur * 1000 + 5000);
      storyLive.waitingForSpeech = true;
      storyLive.stepEndsAt = storyLive.stepStartedAt + Math.round(fallbackDur * 1000) + 12000;
      startAudioCaptionSync(0, fallbackDur);
      storySpeechEl.onended = function () {
        if (storySpeechPreviewing) return;
        storySpeechWaitMode = false;
        finishCaptionSync();
        setMusicDucking(false);
        if (live.inSession && live.phase === 'story' && storyLive.waitingForSpeech) {
          armStoryHoldCountdown();
          updatePhaseUI();
        }
      };
    }

    if (!live.paused) {
      var p = storySpeechEl.play();
      if (p && p.catch) p.catch(function () {});
    } else {
      storySpeechPaused = true;
      pauseCaptionSync();
      setMusicDucking(false);
    }
    updateVoiceBtn();
    return true;
  }

  /* Single skilled documentary narrator voice — consistent across every chapter & beat */
  function speakStoryStep() {
    if (!S.voiceOn || live.phase !== 'story') return;
    var ep = storyLive.episode;
    var step = storyLive.flatSteps[storyLive.stepIndex];
    if (!ep || !step) return;

    if (storySpeechTracks.length) {
      if (playUploadedStoryAudioForStep(storyLive.stepIndex, storyLive.flatSteps.length)) {
        return;
      }
    }

    if (!synth) return;
    var chapNum = storyLive.episodesCompleted + 1;
    var parts = [];
    if (step.kind === 'hook') {
      var hkParts = speech.storyHookParts ? speech.storyHookParts(ep, chapNum) : [formatChapterTitle(chapNum) + '. ' + (ep.title || ''), ep.hook && ep.hook.narration];
      parts = hkParts.map(function (txt, idx) {
        return idx === hkParts.length - 1 ? { text: txt, syncCaption: true } : txt;
      });
    } else if (step.kind === 'checkpoint') {
      var cpParts = speech.storyCheckpointParts ? speech.storyCheckpointParts(step.checkpoint) : ['Live deduction checkpoint.', step.checkpoint && step.checkpoint.prompt];
      parts = cpParts.map(function (txt, idx) {
        return idx === 1 ? { text: txt, syncCaption: true } : txt;
      });
    } else if (step.kind === 'resolution') {
      var resParts = speech.storyResolutionParts ? speech.storyResolutionParts(ep, step.checkpoint) : [ep.resolution && ep.resolution.reveal];
      parts = resParts.map(function (txt, idx) {
        return idx === 0 ? { text: txt, syncCaption: true } : txt;
      });
    } else if (step.beat) {
      var bParts = speech.storyBeatParts ? speech.storyBeatParts(step.beat) : [step.beat.text, step.beat.openLoop];
      parts = bParts.map(function (txt, idx) {
        return idx === 0 ? { text: txt, syncCaption: true } : txt;
      });
    }
    if (parts.length) speakParts(parts, false, null);
  }

  function renderStoryStep() {
    var ep = storyLive.episode;
    var step = storyLive.flatSteps[storyLive.stepIndex];
    if (!ep || !step) return;
    var chapNum = storyLive.episodesCompleted + 1;

    if (el.segLabel) el.segLabel.textContent = (ep.category === 'biblical' ? 'Biblical Mystery' : formatArchetypeLabel(ep.archetype));
    if (el.counter) el.counter.textContent = 'Chapter ' + chapNum + ' \u00b7 Step ' + (storyLive.stepIndex + 1) + ' of ' + storyLive.flatSteps.length;
    if (el.storyEpTitle) el.storyEpTitle.textContent = ep.title;

    if (el.storyDisclaimerTag) {
      var hasDisc = Boolean(ep.disclaimer && ep.disclaimer.isFictionalPersona);
      el.storyDisclaimerTag.hidden = !hasDisc;
      if (hasDisc) {
        el.storyDisclaimerTag.textContent = ep.disclaimer.badgeText || 'Fictional Characters \u00b7 Real History';
      }
    }

    if (el.storyActPill) {
      if (step.kind === 'checkpoint') el.storyActPill.textContent = 'Deduction';
      else if (step.kind === 'resolution') el.storyActPill.textContent = 'The Reveal';
      else el.storyActPill.textContent = 'Chapter ' + chapNum;
    }

    if (el.storyActRail) {
      var totalDots = Math.max(1, storyLive.flatSteps.length);
      el.storyActRail.innerHTML = '';
      for (var i = 0; i < totalDots; i++) {
        var dot = document.createElement('span');
        dot.className = 'story-act-dot' + (i < storyLive.stepIndex ? ' is-done' : (i === storyLive.stepIndex ? ' is-active' : ''));
        el.storyActRail.appendChild(dot);
      }
    }

    crossfadeStage(el.storyCanvas, el.storyVisualHost);
    renderStorySceneVisual(step, ep);
    retriggerAnimation(el.storyCanvas, 'is-animating');

    var activeSpeaker = '';
    if (step.kind === 'beat' && step.beat && step.beat.speaker) activeSpeaker = step.beat.speaker;
    else if (step.kind === 'resolution' && ep.resolution && ep.resolution.speaker) activeSpeaker = ep.resolution.speaker;

    if (el.storyNarrationBox) {
      if (activeSpeaker) el.storyNarrationBox.setAttribute('data-speaker', activeSpeaker);
      else el.storyNarrationBox.removeAttribute('data-speaker');
    }

    if (el.storyNarrationText) {
      var captionText = '';
      if (step.kind === 'hook') {
        captionText = (ep.hook && ep.hook.narration) || ep.subtitle || '';
      } else if (step.kind === 'checkpoint') {
        captionText = (step.checkpoint && step.checkpoint.prompt) || 'Vote A, B, or C in live chat right now!';
      } else if (step.kind === 'resolution') {
        captionText = (ep.resolution && ep.resolution.reveal) || '';
      } else if (step.beat) {
        captionText = step.beat.text;
      }
      var syncVoice = !!(S.voiceOn && (synth || storySpeechTracks.length));
      prepareVoiceCaption(el.storyNarrationText, captionText, syncVoice);
      retriggerAnimation(el.storyNarrationBox, 'is-animating');
    }

    if (el.storyPhaseCountdown) {
      el.storyPhaseCountdown.hidden = step.kind !== 'checkpoint';
      el.storyPhaseCountdown.classList.remove('is-urgent');
    }

    if (el.revealToggleBtn) {
      el.revealToggleBtn.textContent = step.kind === 'checkpoint' ? 'Reveal twist' : 'Next beat';
    }
  }

  function enterStoryStep(idx) {
    if (live.phase !== 'story' || !storyLive.episode) return;
    if (idx < 0) idx = 0;
    if (idx >= storyLive.flatSteps.length) {
      finishStoryEpisode();
      return;
    }
    storyLive.stepIndex = idx;
    storyLive.lastTickCueSec = -1;
    var step = storyLive.flatSteps[idx];
    if (step && step.kind === 'resolution') playRevealChime();
    else if (step && step.kind === 'checkpoint') playMilestoneFanfare();
    else playSceneChime();

    var ep = storyLive.episode;
    var holdMs = storyStepHoldMs(step, ep);
    storyLive.stepStartedAt = now();
    if (S.voiceOn && (synth || storySpeechTracks.length)) {
      storyLive.waitingForSpeech = true;
      storyLive.stepEndsAt = storyLive.stepStartedAt + holdMs + 35000;
    } else {
      storyLive.waitingForSpeech = false;
      storyLive.stepEndsAt = storyLive.stepStartedAt + holdMs;
    }

    renderStoryStep();
    speakStoryStep();
    updatePhaseUI();
  }

  function startNextStoryEpisode() {
    var ep = drawStoryEpisode();
    if (!ep) {
      toast('No stories loaded — import a Hook-Loop JSON pack', true);
      return;
    }
    storyLive.episode = ep;
    storyLive.flatSteps = buildFlatStorySteps(ep);
    resetStageNotices();
    if (S.storyVaryCadence && live.running && !live.paused && !isAudioSuppressedPhase()) {
      startMusic();
    }
    enterStoryStep(0);
  }

  function finishStoryEpisode() {
    stopUploadedStorySpeech();
    storyLive.episodesCompleted++;
    if (canTriggerPromoAfterMilestone()) {
      startPreAdNotice('story');
      return;
    }
    if (S.storyInterleave && bank[S.segment] && bank[S.segment].length) {
      live.storyBurstRemaining = 2;
      live.storyBurstTotal = 2;
      live.storyBurstReturn = true;
      enterPhase('quiz', false);
      return;
    }
    startNextStoryEpisode();
  }

  function startStoryRun() {
    storyLive.bag = [];
    storyLive.episodesCompleted = 0;
    storyLive.lastArchetype = '';
    storyLive.lastPacing = '';
    if (el.storyVisualHost) el.storyVisualHost.innerHTML = '';
    refillStoryBag();
    startNextStoryEpisode();
  }

  /* ---------- phases ---------- */
  function homePhase() {
    if (S.engine === 'video') return 'video';
    if (S.engine === 'players') return 'players';
    if (S.engine === 'story') return 'story';
    return 'quiz';
  }

  function nextPhaseFrom(phase) {
    if (phase === 'promo') {
      if (live.promoReturnPhase === 'story' && S.storyInterleave && bank[S.segment] && bank[S.segment].length) {
        live.storyBurstRemaining = 2;
        live.storyBurstTotal = 2;
        live.storyBurstReturn = true;
        return 'quiz';
      }
      return live.promoReturnPhase || homePhase();
    }
    /* Breaks off: never schedule a promo. Continue with the current
       non-promo phase instead (restarting it if it just ran out). */
    if (!S.promoAdsEnabled) return phase;
    return 'promo';
  }

  function startSession() {
    /* The built-in banks, story library and player library arrive
       asynchronously (loadBuiltInBanks / loadStoryLibrary / initLibrary run
       before the engine is imported, but a slow or failed load leaves
       window.LNR_BUILT_IN_BANKS unset). Pressing Start in that window used to
       drop straight onto the stage with an empty bank, where the quiz frame
       sat on its placeholder reading "Import a quiz pack to begin..." and the
       video engine sat on a dead frame. That is the setup screen the operator
       reported being stuck on: it looked like the source-selection step, but
       it was the stage with nothing to air. Repair the banks first, then
       judge whether the engine really can run. */
    if (S.engine === 'quiz') {
      if (!bank[S.segment] || !bank[S.segment].length) rebuildQuizBanks();
    }
    if (S.engine === 'quiz' && !bank[S.segment].length) {
      toast('Import a Quiz JSON pack first (or download the starter template below)', true);
      setPage('studio');
      setWizardStep(2);
      if (el.quizSetup && el.quizSetup.scrollIntoView) {
        el.quizSetup.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }
    if (S.engine === 'players') {
      var pLib = window.LNR_PLAYERS;
      var pCount = pLib ? pLib.getAllQuizzes(S.playerMode).length : 0;
      if (!pCount) {
        toast('Import a Player Quiz JSON pack first (or download the player template)', true);
        setPage('studio');
        setWizardStep(2);
        if (el.playersSetup && el.playersSetup.scrollIntoView) {
          el.playersSetup.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
      }
    }
    if (S.engine === 'story') {
      var sApi = window.LNR_STORIES;
      var sCount = sApi ? (sApi.getAllEpisodes(S.storyCat).length || sApi.getAllEpisodes('all').length) : 0;
      if (!sCount) {
        toast('Import a Hook-Loop Story JSON pack first to begin', true);
        setPage('studio');
        setWizardStep(2);
        return;
      }
    }

    stopAudioPreview();
    /* Video engine: with no clips and the demo loop off there is nothing to
       air. Starting anyway put the stage on screen with an empty video frame,
       which is the other half of the "stuck on the setup screen" report. */
    if (S.engine === 'video' && !clips.length && !demoVideoMode) {
      toast('Upload a video clip (or enable the 15s demo) before starting the video engine', true);
      setPage('studio');
      setWizardStep(2);
      if (el.videoSetup && el.videoSetup.scrollIntoView) {
        el.videoSetup.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    stopStorySpeechPreview();
    live.inSession = true;
    live.running = true;
    live.paused = false;
    live.served = 0;
    live.qIndex = -1;
    live.quizMilestone = false;
    live.quizRoundNum = 1;
    live.quizRoundAnswers = [];
    live.quizActiveMs = 0;
    live.storyBurstRemaining = 0;
    live.storyBurstTotal = 0;
    live.storyBurstReturn = false;
    live.lastTickAt = now();
    live.activeAdLog = null;
    clearPreAdNotice();
    live.promoReturnPhase = homePhase();
    live.startedAt = now();
    bags = { bible: [], history: [] };
    bagHistory = [];
    document.body.classList.remove('screen-setup');
    document.body.classList.add('screen-stage');
    el.screenSetup.hidden = true;
    el.screenStage.hidden = false;
    /* the stage is only measurable once it is visible */
    sizeStage();
    applyBranding();
    applyChatSafe();
    if (S.safeDefault) setSafe(true);
    enterPhase(homePhase(), true);
    ensureAudioCtx();
    startMusic();
    var intervalMin = effectivePromoIntervalMin();
    var promoActive = !!S.promoAdsEnabled;
    if (window.LNR_TRACK) {
      window.LNR_TRACK('stream_start', {
        engine: S.engine,
        segment: S.segment,
        tier: 'studio'
      });
    }
    toast(S.engine === 'video'
      ? ('Video engine \u00b7 ' + effectiveLoopHours() + ' hr on loop' + (promoActive ? ', then 1 break clip' : ' (breaks off)'))
      : S.engine === 'players'
        ? ('Player quiz \u00b7 milestones every 10 Qs' + (promoActive ? (' \u2192 break after ' + intervalMin + 'm+ quiz') : ' \u00b7 breaks off'))
        : S.engine === 'story'
          ? ('Storytelling mode \u00b7 continuous documentary narration' + (promoActive ? (' \u2192 break after ' + intervalMin + 'm+') : ''))
          : (SEGMENTS[S.segment] + ' \u00b7 milestones every 10 Qs' + (promoActive ? (' \u2192 break after ' + intervalMin + 'm+ quiz') : ' \u00b7 breaks off')));
  }
  on(el.startBtn, 'click', startSession);

  /* ---------- sponsor proof-of-play analytics ---------- */
  var adLogs = [];

  function formatTotalAdDuration(totalSec) {
    totalSec = Math.max(0, Math.round(totalSec || 0));
    var h = Math.floor(totalSec / 3600);
    var m = Math.floor((totalSec % 3600) / 60);
    var s = totalSec % 60;
    if (h > 0) return h + 'h ' + pad(m) + 'm ' + pad(s) + 's';
    return m + 'm ' + pad(s) + 's';
  }

  function renderAdAnalytics() {
    var totalDur = 0;
    var totalPlays = adLogs.length;
    var freePlays = 0, proPlays = 0;
    var freeDur = 0, proDur = 0;
    var enginePlays = {};
    var engineDur = {};
    adLogs.forEach(function (item) {
      var d = Number(item.durationSec) || 0;
      totalDur += d;
      var tier = item.tier || 'free';
      if (tier === 'pro') { proPlays++; proDur += d; } else { freePlays++; freeDur += d; }
      var eng = item.engine || 'quiz';
      enginePlays[eng] = (enginePlays[eng] || 0) + 1;
      engineDur[eng] = (engineDur[eng] || 0) + d;
    });

    if (el.alTotalCount) el.alTotalCount.textContent = String(totalPlays);
    if (el.alTotalDuration) el.alTotalDuration.textContent = formatTotalAdDuration(totalDur);

    // Extra breakdown metrics — render into the analytics summary block if the
    // elements exist (timer.html includes sponsorAnalyticsSection).
    var summaryBlock = el.sponsorAnalyticsSection;
    if (summaryBlock) {
      var existingBreakdown = summaryBlock.querySelector('.al-breakdown');
      if (!existingBreakdown) {
        var bd = document.createElement('div');
        bd.className = 'al-breakdown';
        bd.innerHTML =
          '<div class="al-breakdown-row">' +
            '<span class="al-b-label">Free-tier breaks</span>' +
            '<span class="al-b-val" id="alFreePlays">0</span>' +
            '<span class="al-b-val" id="alFreeDur">0m 00s</span>' +
          '</div>' +
          '<div class="al-breakdown-row">' +
            '<span class="al-b-label">Pro-tier breaks</span>' +
            '<span class="al-b-val" id="alProPlays">0</span>' +
            '<span class="al-b-val" id="alProDur">0m 00s</span>' +
          '</div>';
        summaryBlock.appendChild(bd);
        existingBreakdown = bd;
      }
      var fp = existingBreakdown.querySelector('#alFreePlays');
      var fd = existingBreakdown.querySelector('#alFreeDur');
      var pp = existingBreakdown.querySelector('#alProPlays');
      var pd = existingBreakdown.querySelector('#alProDur');
      if (fp) fp.textContent = String(freePlays);
      if (fd) fd.textContent = formatTotalAdDuration(freeDur);
      if (pp) pp.textContent = String(proPlays);
      if (pd) pd.textContent = formatTotalAdDuration(proDur);
    }

    if (!el.alLogList) return;
    el.alLogList.innerHTML = '';
    if (!totalPlays) {
      var liEmpty = document.createElement('li');
      liEmpty.innerHTML = '<div class="al-main"><b>No channel breaks logged yet</b><span>Break clips played during livestreams are recorded here automatically.</span></div>';
      el.alLogList.appendChild(liEmpty);
      return;
    }
    adLogs.slice(0, 25).forEach(function (item) {
      var li = document.createElement('li');
      var main = document.createElement('div');
      main.className = 'al-main';
      var b = document.createElement('b');
      b.textContent = item.clipName || 'Partner break';
      var sp = document.createElement('span');
      var localStr = '';
      try { localStr = new Date(item.startedAt).toLocaleString(); } catch (e) { localStr = item.isoTime || ''; }
      sp.textContent = localStr + ' \u00b7 ' + (item.engine || 'quiz') + ' R' + (item.roundNum || 1);
      main.appendChild(b);
      main.appendChild(sp);

      var rowRight = document.createElement('div');
      rowRight.style.cssText = 'display:flex;gap:8px;align-items:center';
      var tierChip = document.createElement('span');
      tierChip.className = 'al-tier al-tier-' + (item.tier || 'free');
      tierChip.textContent = (item.tier || 'free') === 'pro' ? 'PRO' : 'FREE';
      rowRight.appendChild(tierChip);

      var dur = document.createElement('span');
      dur.className = 'al-dur';
      dur.textContent = formatShortSec(item.durationSec || 30);
      rowRight.appendChild(dur);

      li.appendChild(main);
      li.appendChild(rowRight);
      el.alLogList.appendChild(li);
    });
  }

  function startActiveAdLog(clipLabel, returnPhase, plannedSec) {
    var branding = effectiveBranding();
    var roundNum = returnPhase === 'players' ? plLive.roundNum : live.quizRoundNum;
    live.activeAdLog = {
      id: 'ad_' + now() + '_' + Math.random().toString(36).slice(2, 6),
      startedAt: now(),
      isoTime: new Date().toISOString(),
      clipName: clipLabel,
      engine: returnPhase || S.engine,
      roundNum: roundNum || 1,
      plannedSec: Math.round(plannedSec || effectivePromoAdSec()),
      tier: S.isPro ? 'pro' : 'free',
      watermark: branding.watermark,
      brand: branding.brand
    };
  }

  function finalizeActiveAdLog() {
    if (!live.activeAdLog) return;
    var rec = live.activeAdLog;
    live.activeAdLog = null;
    var actualSec = Math.max(1, Math.min(PROMO_MAX_SEC, Math.round((now() - rec.startedAt) / 1000)));
    var entry = {
      id: rec.id,
      startedAt: rec.startedAt,
      endedAt: now(),
      isoTime: rec.isoTime,
      clipName: rec.clipName,
      engine: rec.engine,
      roundNum: rec.roundNum,
      durationSec: actualSec,
      tier: rec.tier || (S.isPro ? 'pro' : 'free'),
      watermark: rec.watermark,
      brand: rec.brand
    };
    adLogs.unshift(entry);
    if (adLogs.length > 500) adLogs = adLogs.slice(0, 500);
    idbPutStore('ad_logs', entry).catch(function () {});
    renderAdAnalytics();
    if (window.LNR_TRACK) {
      window.LNR_TRACK('promo_ad_played', {
        clip_name: entry.clipName,
        duration_sec: entry.durationSec,
        engine: entry.engine,
        tier: rec.tier || 'free'
      });
    }
  }

  function enterPhase(phase, first, opts) {
    opts = opts || {};
    var prevPhase = live.phase;
    /* Last line of defence: a promo phase can never be entered while the
       toggle is off, whichever path asked for it. */
    if (phase === 'promo' && !S.promoAdsEnabled) {
      phase = prevPhase && prevPhase !== 'promo' ? prevPhase : homePhase();
    }
    if (prevPhase === 'promo' && phase !== 'promo') {
      finalizeActiveAdLog();
    }
    live.phase = phase;
    live.quizMilestone = false;
    clearPreAdNotice();
    if (el.frameInner) {
      el.frameInner.classList.remove('is-promo-pip', 'is-promo-split');
    }

    var activePromos = effectivePromoList();

    if (phase === 'promo') {
      promoRefreshedIds = {};
      promoFailedIds = {};
      live.promoReturnPhase = opts.returnPhase || (prevPhase && prevPhase !== 'promo' ? prevPhase : homePhase());
      live.promoStartedAt = now();
      live.quizActiveMs = 0;
      var adSecDefault = effectivePromoAdSec();
      var clipLabel = 'Fallback Partner Break Slot (' + formatShortSec(adSecDefault) + ')';
      var plannedAdSec = adSecDefault;
      if (activePromos.length) {
        var adIdx;
        if (S.promoOrder === 'shuffle' && activePromos.length > 1) {
          adIdx = Math.floor(Math.random() * activePromos.length);
          if (adIdx === live.clipIndex) adIdx = (adIdx + 1) % activePromos.length;
        } else {
          adIdx = live.promoCursor % activePromos.length;
          live.promoCursor = (live.promoCursor + 1) % activePromos.length;
        }
        var adClip = activePromos[adIdx];
        var adSec = (adClip && adClip.duration > 0) ? Math.min(PROMO_MAX_SEC, adClip.duration) : adSecDefault;
        live.phaseLen = (adSec + 1.5) * 1000;
        live.clipIndex = adIdx;
        clipLabel = (adClip && adClip.name) || clipLabel;
        plannedAdSec = adSec;
      } else {
        live.phaseLen = adSecDefault * 1000;
      }
      startActiveAdLog(clipLabel, live.promoReturnPhase, plannedAdSec);
    } else {
      live.promoStartedAt = 0;
      var mins = phase === 'quiz' ? effectiveQuizMin()
        : phase === 'players' ? effectivePlayerBlockMin()
        : phase === 'story' ? effectiveStoryBlockMin()
        : (effectiveLoopHours() * 60);
      live.phaseLen = mins * 60 * 1000;
    }
    live.phaseEndsAt = now() + live.phaseLen;

    if (phase === 'quiz') {
      el.quizStage.hidden = false;
      if (el.playerStage) el.playerStage.hidden = true;
      if (el.milestoneStage) el.milestoneStage.hidden = true;
      if (el.storyStage) el.storyStage.hidden = true;
      el.videoStage.hidden = true;
      releasePlayerVisual();
      stopVideo();
      resetStageNotices();
      /* The "The quiz is about to start" stage notice used to fire here, in the
         quiz engine itself. It belongs to the Video engine, where it warns the
         audience that a video clip is about to be interrupted for a quiz break
         — that warning is now drawn by the break module on the video stage
         (video-breaks.ts noticeCard, "UP NEXT"). Shown on a quiz block it just
         landed on top of question 1 and its own countdown, so it is gone from
         here. The question clock is no longer held either: there is nothing
         left to hold it for. */
      live.quizStartAt = 0;
      nextQuestion();
    } else if (phase === 'players') {
      el.quizStage.hidden = true;
      el.videoStage.hidden = true;
      if (el.milestoneStage) el.milestoneStage.hidden = true;
      if (el.storyStage) el.storyStage.hidden = true;
      if (el.playerStage) el.playerStage.hidden = false;
      stopVideo();
      if (first) startPlayerRound();
      else nextPlayerQuestion(false);
    } else if (phase === 'story') {
      el.quizStage.hidden = true;
      el.videoStage.hidden = true;
      if (el.milestoneStage) el.milestoneStage.hidden = true;
      if (el.playerStage) el.playerStage.hidden = true;
      if (el.storyStage) el.storyStage.hidden = false;
      releasePlayerVisual();
      stopVideo();
      if (first || !storyLive.episode) startStoryRun();
      else startNextStoryEpisode();
    } else {
      var displayMode = ((live.promoReturnPhase === 'quiz' || live.promoReturnPhase === 'players' || live.promoReturnPhase === 'story') && phase === 'promo')
        ? (S.promoDisplayMode || 'full')
        : 'full';
      if (displayMode === 'pip' || displayMode === 'split') {
        if (el.frameInner) el.frameInner.classList.add(displayMode === 'pip' ? 'is-promo-pip' : 'is-promo-split');
        el.quizStage.hidden = live.promoReturnPhase !== 'quiz';
        if (el.playerStage) el.playerStage.hidden = live.promoReturnPhase !== 'players';
        if (el.storyStage) el.storyStage.hidden = live.promoReturnPhase !== 'story';
        if (el.milestoneStage) el.milestoneStage.hidden = true;
      } else {
        el.quizStage.hidden = true;
        if (el.playerStage) el.playerStage.hidden = true;
        if (el.storyStage) el.storyStage.hidden = true;
        if (el.milestoneStage) el.milestoneStage.hidden = true;
        releasePlayerVisual();
      }
      el.videoStage.hidden = false;
      stopSpeech();
      /* These branches used to `return` here, which skipped the phase-UI block
         below: the frame never got `is-video-clean`, the phase name stayed on
         the previous engine's label, and the Bible/Faith pill and the question
         counter were never cleared. Set the clip going, then fall through so
         the stage chrome is updated for the video engine. */
      if (phase === 'video' && clips.length > 0) {
        var firstClip = clips[0];
        var ownership = firstClip ? clipOwnership(firstClip.id) : 'reference';
        /* A REFERENCE clip gets the spoken disclaimer before it airs; an owned
           clip plays straight away. `startPreroll()` was left defined but never
           called, so the reference disclaimer never played at all — the reader
           and its countdown were dead code. It is started BEFORE playClip so
           `prerollActive` is already true when transitionToClip runs, which
           holds the clip on its first frame until the read finishes. */
        if (firstClip && ownership === 'reference') {
          startPreroll();
        }
        playClip(0);
        /* One notice, one combination only: the operator owns the clip AND has
           quiz & anecdote breaks switched on for it. Reference clips never get
           it, and neither does an owned clip with breaks off. */
        if (firstClip && ownership !== 'reference' && breaksEnabledFor(firstClip.id)) {
          showOwnedBreaksNotice();
        }
      } else {
        playClip(phase === 'promo' ? live.clipIndex : 0);
        updatePromoBrand();
        updatePromoOverlay();
      }
    }

    var isVideo = phase === 'video' || phase === 'promo';
    if (isVideo) {
      /* Video & Partner Break clips keep their own audio tracks clean */
      stopMusic();
    } else if (!first && live.running && !live.paused) {
      startMusic();
    }

    var label = phase === 'quiz' ? 'Quiz block'
      : phase === 'players' ? 'Player quiz'
      : phase === 'story' ? 'Documentary'
      : (phase === 'promo' ? 'Partner break' : 'Video engine');
    el.phaseName.textContent = label;
    el.phaseName.classList.toggle('is-video', isVideo);
    el.phaseFill.classList.toggle('is-video', isVideo);
    el.progFill.classList.toggle('is-video', isVideo);
    if (el.segLabel && phase !== 'players' && phase !== 'story') {
      el.segLabel.textContent = phase === 'quiz' ? SEGMENTS[S.segment] : label;
    }
    if (isVideo && el.counter) {
      if (phase === 'video') {
        el.counter.textContent = '';
      } else {
        el.counter.textContent = activePromos.length
          ? 'Break 1 of 1 (' + ((live.clipIndex % activePromos.length) + 1) + '/' + activePromos.length + ')'
          : ('Partner break (' + formatShortSec(effectivePromoAdSec()) + ' slot)');
      }
    }

    if (el.frame) {
      var isVid = phase === 'video' || phase === 'promo';
      el.frame.classList.toggle('is-video-clean', isVid);
      el.frame.classList.toggle('is-video-clean-video', phase === 'video');
      var sc = el.frame.closest('.screen-stage');
      if (sc) sc.classList.toggle('is-video-clean', isVid);
    }
    el.onairPill.classList.remove('is-paused');
    el.onairPill.innerHTML = '<i aria-hidden="true"></i> ' + (!isVideo ? 'On air' : 'On air \u00b7 ' + (phase === 'promo' ? 'partner break' : 'video'));

    if (!first) {
      flashCurtain();
      toast(phase === 'quiz'
        ? SEGMENTS[S.segment] + ' \u00b7 Round ' + live.quizRoundNum
        : phase === 'players'
          ? 'Player quiz \u00b7 Round ' + plLive.roundNum
          : phase === 'story'
            ? ('Documentary \u00b7 ' + (storyLive.episode ? storyLive.episode.title : 'Story Mode'))
            : (phase === 'promo'
              ? (activePromos.length ? 'Partner break \u00b7 playing 1 break clip' : 'Partner break \u00b7 ' + formatShortSec(effectivePromoAdSec()))
              : 'Video engine \u00b7 ' + effectiveLoopHours() + ' hr on loop'));
    }
    updatePhaseUI();
    updatePromoBrand();
    updatePromoOverlay();
    updateLoopBadge();
    updateVoiceBtn();
  }

  var curtainHideTimer = 0;
  function flashCurtain() {
    if (!el.curtain) return;
    if (curtainHideTimer) window.clearTimeout(curtainHideTimer);
    el.curtain.hidden = false;
    retriggerAnimation(el.curtain, 'is-active');
    curtainHideTimer = window.setTimeout(function () {
      if (el.curtain) {
        el.curtain.classList.remove('is-active');
        el.curtain.hidden = true;
      }
    }, 720);
  }

  function rotateNow() {
    if (!live.inSession) return;
    clearPreAdNotice();
    if (live.phase === 'quiz' && live.quizMilestone) {
      live.quizMilestone = false;
      live.quizRoundAnswers = [];
      live.quizRoundNum++;
      if (el.milestoneStage) el.milestoneStage.hidden = true;
    } else if (live.phase === 'players' && plLive.subPhase === 'milestone') {
      plLive.roundAnswers = [];
      plLive.roundNum++;
      if (el.milestoneStage) el.milestoneStage.hidden = true;
    }
    enterPhase(nextPhaseFrom(live.phase), false);
  }

  /* jump straight into the prerecorded broadcast loop */
  function startBroadcast() {
    if (!live.inSession) return;
    clearPreAdNotice();
    enterPhase('video', false);
  }

  function updatePhaseUI() {
    var remaining = live.phaseEndsAt - now();
    if (live.paused) remaining = live.phaseEndsAt - live.pausedAt;
    if (remaining < 0) remaining = 0;

    el.phaseTime.textContent = clock(remaining);
    var pct = live.phaseLen ? Math.min(100, Math.max(0, (1 - remaining / live.phaseLen) * 100)) : 0;
    el.phaseFill.style.width = pct.toFixed(1) + '%';

    var sessionMs = (live.paused ? live.pausedAt : now()) - live.startedAt;
    el.sessionClock.textContent = sessionClock(sessionMs);

    if (el.playGlyph) el.playGlyph.textContent = live.paused ? 'Resume' : 'Pause';

    if (live.phase === 'quiz') {
      if (live.quizMilestone) {
        var mRem = live.quizMilestoneEndsAt - (live.paused ? live.pausedAt : now());
        if (mRem < 0) mRem = 0;
        el.frameTimer.textContent = clock(mRem);
        var mTotal = Math.max(1000, live.quizMilestoneEndsAt - live.quizMilestoneStartedAt);
        el.progFill.style.width = Math.min(100, Math.max(0, (1 - mRem / mTotal) * 100)).toFixed(1) + '%';
        if (el.msTimer) el.msTimer.textContent = clock(mRem);
      } else if (!live.revealed && live.waitingForSpeech && speechBusy()) {
        el.frameTimer.textContent = clock(POST_READ_COUNTDOWN_MS);
        el.progFill.style.width = '0.0%';
      } else {
        var qRem = live.qEndsAt - (live.paused ? live.pausedAt : now());
        if (qRem < 0) qRem = 0;
        el.frameTimer.textContent = clock(qRem);
        var qTotal = live.revealed
          ? Math.max(1000, revealHoldMs())
          : (S.voiceOn ? POST_READ_COUNTDOWN_MS : Math.max(1000, S.qSec * 1000));
        el.progFill.style.width = Math.min(100, Math.max(0, (1 - qRem / qTotal) * 100)).toFixed(1) + '%';
      }
    } else if (live.phase === 'players') {
      var pRem = plLive.subEndsAt - (live.paused ? live.pausedAt : now());
      if (pRem < 0) pRem = 0;
      el.frameTimer.textContent = clock(pRem);
      var pTotal = Math.max(1000, plLive.subEndsAt - plLive.subStartedAt);
      el.progFill.style.width = Math.min(100, Math.max(0, (1 - pRem / pTotal) * 100)).toFixed(1) + '%';
      if (plLive.subPhase === 'countdown' && el.plCountdownPill) {
        el.plCountdownPill.textContent = clock(pRem) + ' \u00b7 Drop your answer in the comments!';
        el.plCountdownPill.classList.toggle('is-urgent', pRem > 0 && pRem <= 5000);
      }
      if (plLive.subPhase === 'milestone' && el.msTimer) {
        el.msTimer.textContent = clock(pRem);
      }
    } else if (live.phase === 'story') {
      var curStep = storyLive.flatSteps[storyLive.stepIndex];
      if (storyLive.waitingForSpeech && speechBusy()) {
        var holdDef = (storyLive.episode && curStep) ? storyStepHoldMs(curStep, storyLive.episode) : (Math.max(4, Number(S.storySceneSec) || 8) * 1000);
        el.frameTimer.textContent = clock(holdDef);
        el.progFill.style.width = '0.0%';
        if (el.storyPhaseCountdown && curStep && curStep.kind === 'checkpoint') {
          el.storyPhaseCountdown.textContent = Math.round(holdDef / 1000) + 's';
          el.storyPhaseCountdown.classList.remove('is-urgent');
        }
      } else {
        var sRem = storyLive.stepEndsAt - (live.paused ? live.pausedAt : now());
        if (sRem < 0) sRem = 0;
        el.frameTimer.textContent = clock(sRem);
        var sTotal = Math.max(1000, storyLive.stepEndsAt - storyLive.stepStartedAt);
        el.progFill.style.width = Math.min(100, Math.max(0, (1 - sRem / sTotal) * 100)).toFixed(1) + '%';
        if (el.storyPhaseCountdown && curStep && curStep.kind === 'checkpoint') {
          var sCeil = Math.max(0, Math.ceil(sRem / 1000));
          el.storyPhaseCountdown.textContent = sCeil + 's';
          el.storyPhaseCountdown.classList.toggle('is-urgent', sRem > 0 && sRem <= 5000);
        }
      }
    } else {
      var v = activeVideo();
      if (v && v.duration && !isNaN(v.duration) && !v.hidden) {
        var capDur = live.phase === 'promo' ? Math.min(PROMO_MAX_SEC, v.duration) : v.duration;
        var vRem = Math.max(0, (capDur - v.currentTime) * 1000);
        el.frameTimer.textContent = clock(vRem);
        el.progFill.style.width = Math.min(100, (v.currentTime / capDur) * 100).toFixed(1) + '%';
      } else {
        el.frameTimer.textContent = clock(remaining);
        el.progFill.style.width = pct.toFixed(1) + '%';
      }
      if (live.phase === 'promo') updatePromoOverlay();
    }
    if (live.preAdPending) updateAdNoticeUI();
  }

  /* ---------- main tick ---------- */
  var tickHandle = null;

  /* The answer hold. It used to be up to 8s; the partner asked for 5s less,
     so it is now up to 3s — with a 1.2s floor so the reveal is still readable
     when the per-question clock is short. */
  function revealHoldMs() {
    return Math.max(1200, Math.min(8000, S.qSec * 400) - 5000);
  }

  var gaHeartbeatAcc = 0;

  function tick() {
    if (!live.inSession) return;

    var t = now();
    var dt = live.lastTickAt ? Math.max(0, Math.min(2000, t - live.lastTickAt)) : 0;
    live.lastTickAt = t;

    if (!live.paused) {
      gaHeartbeatAcc += dt;
      if (gaHeartbeatAcc >= 60000) {
        gaHeartbeatAcc = 0;
        if (window.LNR_TRACK) {
          window.LNR_TRACK('stream_heartbeat', {
            engine: live.phase,
            tier: 'studio'
          });
        }
      }

      if (live.preAdPending) {
        if (t >= live.preAdEndsAt) {
          completePreAdIntoPromo();
        }
      } else if (live.phase === 'quiz') {
        if (!live.quizMilestone) live.quizActiveMs += dt;
        /* Hold the first question's clock while the "quiz is about to start"
           notice is up, so the ten-second warning is real time and not eaten
           by the question countdown. */
        if (quizStartHeld()) {
          live.qEndsAt = Math.max(live.qEndsAt, live.quizStartAt);
          return;
        }
        if (live.quizMilestone) {
          if (t >= live.quizMilestoneEndsAt && !revealBusy()) {
            finishQuizMilestone(false);
          }
        } else {
          if (!live.revealed && live.waitingForSpeech) {
            if (!speechBusy()) {
              armPostReadQuizCountdown();
              playCountdownTick(10);
              live.lastTickCueSec = 10;
            }
          } else if (!live.revealed && !live.waitingForSpeech && !speechBusy()) {
            var qRemSec = Math.ceil((live.qEndsAt - t) / 1000);
            if (qRemSec >= 1 && qRemSec <= 10 && qRemSec !== live.lastTickCueSec) {
              live.lastTickCueSec = qRemSec;
              playCountdownTick(qRemSec);
            }
          }
          if (t >= live.qEndsAt) {
            if (!live.revealed) {
              if (!speechBusy()) {
                revealAnswer();
                live.qEndsAt = t + revealHoldMs();
              }
            } else if (!revealBusy()) {
              recordQuizRoundAnswer();
              bagHistory.push(live.qIndex);
              if (bagHistory.length > MAX_BAG_HISTORY) bagHistory.shift();
              if (live.storyBurstRemaining > 0) {
                live.storyBurstRemaining--;
                if (live.storyBurstRemaining <= 0 && live.storyBurstReturn) {
                  live.storyBurstReturn = false;
                  enterPhase('story', false);
                } else {
                  nextQuestion();
                }
              } else if (live.quizRoundAnswers.length >= 10) {
                enterQuizMilestone();
              } else {
                nextQuestion();
              }
            }
          }
        }
      } else if (live.phase === 'players') {
        if (plLive.subPhase !== 'milestone') live.quizActiveMs += dt;
        if (plLive.subPhase === 'countdown' && !speechBusy()) {
          var pRemSec = Math.ceil((plLive.subEndsAt - t) / 1000);
          if (pRemSec >= 1 && pRemSec <= 10 && pRemSec !== live.lastTickCueSec) {
            live.lastTickCueSec = pRemSec;
            playCountdownTick(pRemSec);
          }
        }
        if (t >= plLive.subEndsAt) {
          if (plLive.subPhase === 'intro') {
            if (!speechBusy()) enterPlayerSubPhase('clue', 0);
          } else if (plLive.subPhase === 'clue') {
            if (!speechBusy()) {
              var clues = (plLive.quiz && plLive.quiz.clues) || [];
              if (plLive.clueIndex + 1 < clues.length) {
                enterPlayerSubPhase('clue', plLive.clueIndex + 1);
              } else {
                enterPlayerSubPhase('countdown');
              }
            }
          } else if (plLive.subPhase === 'countdown') {
            if (!speechBusy()) enterPlayerReveal();
          } else if (plLive.subPhase === 'reveal') {
            if (!revealBusy()) {
              recordCurrentRoundAnswer();
              if (plLive.roundAnswers.length >= 10) {
                enterMilestone();
              } else {
                nextPlayerQuestion(true);
              }
            }
          } else if (plLive.subPhase === 'milestone') {
            if (!revealBusy()) {
              finishPlayerMilestone(false);
            }
          }
        }
      } else if (live.phase === 'story') {
        live.quizActiveMs += dt;
        var stCur = storyLive.flatSteps[storyLive.stepIndex];
        if (storyLive.waitingForSpeech) {
          if (!speechBusy()) {
            armStoryHoldCountdown();
            if (stCur && stCur.kind === 'checkpoint') {
              playCountdownTick(10);
              storyLive.lastTickCueSec = 10;
            }
          }
        } else {
          if (stCur && stCur.kind === 'checkpoint' && !speechBusy()) {
            var stRemSec = Math.ceil((storyLive.stepEndsAt - t) / 1000);
            if (stRemSec >= 1 && stRemSec <= 10 && stRemSec !== storyLive.lastTickCueSec) {
              storyLive.lastTickCueSec = stRemSec;
              playCountdownTick(stRemSec);
            }
          }
          /* Ten seconds before the anecdote finishes, tell the audience the
             stage is ending. "Finishes" means the last step of the episode, so
             the notice is tied to the final step's clock rather than to any
             intermediate beat. */
          var isLastStep = storyLive.stepIndex >= storyLive.flatSteps.length - 1;
          if (isLastStep && !speechBusy()) {
            var endRemSec = Math.ceil((storyLive.stepEndsAt - t) / 1000);
            if (endRemSec >= 1 && endRemSec <= 10) {
              showStageNotice('story-end', 'WRAPPING UP', 'This anecdote is ending \u2014 the stage is about to change.', 9000);
            }
          }
          if (t >= storyLive.stepEndsAt) {
            enterStoryStep(storyLive.stepIndex + 1);
          }
        }
      } else if (live.phase === 'promo') {
        if (!S.promoAdsEnabled) {
          enterPhase(live.promoReturnPhase || homePhase(), false);
          return;
        }
        var av = activeVideo();
        var activePromos = effectivePromoList();
        var promoPlaying = activePromos.length > 0 && av && !av.hidden && !av.ended && isFinite(av.duration) && av.duration > 0 && !av.paused;
        var hitCap = live.promoStartedAt > 0 && (t - live.promoStartedAt) >= PROMO_MAX_SEC * 1000;
        if (hitCap) {
          if (S.autoRotate) enterPhase(nextPhaseFrom('promo'), false);
          else playClip(live.clipIndex);
        } else if (promoPlaying) {
          var capped = Math.min(PROMO_MAX_SEC, av.duration);
          live.phaseEndsAt = t + Math.max(500, (capped - av.currentTime) * 1000);
        } else if (S.autoRotate && t >= live.phaseEndsAt) {
          enterPhase(nextPhaseFrom('promo'), false);
        }
      } else if (S.autoRotate && t >= live.phaseEndsAt) {
        enterPhase(nextPhaseFrom(live.phase), false);
      }
    }
    if (live.phase === 'video' || live.phase === 'promo') updateLoopBadge();
    updatePhaseUI();
    if (el.devPanel && !el.devPanel.hidden) renderDev();
  }

  function startTick() {
    if (tickHandle) return;
    tickHandle = window.setInterval(tick, 250);
  }

  /* ---------- transport ---------- */
  function togglePlay() {
    if (!live.inSession) return;
    live.paused = !live.paused;
    if (live.paused) {
      live.pausedAt = now();
      el.onairPill.classList.add('is-paused');
      el.onairPill.innerHTML = '<i aria-hidden="true"></i> Paused';
      videoDecks.forEach(function (v) { try { v.pause(); } catch (e) {} });
      if (synth && speaking && !synth.paused) { synth.pause(); pausedSpeech = true; updateVoiceBtn(); }
      if (storySpeechPlaying && !storySpeechEl.paused) {
        try { storySpeechEl.pause(); } catch (e) {}
        storySpeechPaused = true;
        setMusicDucking(false);
        updateVoiceBtn();
      }
      pauseCaptionSync();
      stopMusic();
    } else {
      var delta = now() - live.pausedAt;
      live.phaseEndsAt += delta;
      live.qEndsAt += delta;
      live.quizMilestoneStartedAt += delta;
      live.quizMilestoneEndsAt += delta;
      live.preAdStartedAt += delta;
      live.preAdEndsAt += delta;
      storyLive.stepStartedAt += delta;
      storyLive.stepEndsAt += delta;
      if (storySpeechDeadline) storySpeechDeadline += delta;
      if (live.promoStartedAt) live.promoStartedAt += delta;
      if (speechDeadline) speechDeadline += delta;
      if (revealDeadline) revealDeadline += delta;
      live.lastTickAt = now();
      plLive.subStartedAt += delta;
      plLive.subEndsAt += delta;
      live.pausedAt = 0;
      el.onairPill.classList.remove('is-paused');
      el.onairPill.innerHTML = '<i aria-hidden="true"></i> ' + (isAudioSuppressedPhase() ? 'On air \u00b7 ' + (live.phase === 'promo' ? 'partner break' : 'video') : 'On air');
      var promoTotal = effectivePromoList().length;
      if ((live.phase === 'video' || live.phase === 'promo') && (live.phase === 'promo' ? promoTotal : clips.length)) {
        var av = activeVideo();
        if (av) {
          var p = av.play(); if (p && p.catch) p.catch(function () {});
        }
      }
      if (synth && pausedSpeech) { synth.resume(); pausedSpeech = false; updateVoiceBtn(); }
      if (storySpeechPlaying && storySpeechPaused && S.voiceOn) {
        var ps = storySpeechEl.play(); if (ps && ps.catch) ps.catch(function () {});
        storySpeechPaused = false;
        setMusicDucking(true);
        updateVoiceBtn();
      }
      resumeCaptionSync();
      startMusic();
    }
    updatePhaseUI();
  }

  function advanceNextStep() {
    if (live.preAdPending) {
      completePreAdIntoPromo();
      return;
    }
    if (live.phase === 'video') {
      if (clips.length > 1) transitionToClip((live.clipIndex + 1) % clips.length);
      return;
    }
    if (live.phase === 'story') {
      enterStoryStep(storyLive.stepIndex + 1);
      return;
    }
    if (live.phase === 'players') {
      if (plLive.subPhase === 'milestone') {
        finishPlayerMilestone(true);
      } else {
        if (plLive.quiz) recordCurrentRoundAnswer();
        if (plLive.roundAnswers.length >= 10) enterMilestone();
        else nextPlayerQuestion(true);
      }
      return;
    }
    if (live.phase === 'quiz') {
      if (live.quizMilestone) {
        finishQuizMilestone(true);
        return;
      }
      if (currentQ()) recordQuizRoundAnswer();
      bagHistory.push(live.qIndex);
      if (bagHistory.length > MAX_BAG_HISTORY) bagHistory.shift();
      if (live.storyBurstRemaining > 0) {
        live.storyBurstRemaining--;
        if (live.storyBurstRemaining <= 0 && live.storyBurstReturn) {
          live.storyBurstReturn = false;
          enterPhase('story', false);
          return;
        }
        nextQuestion();
        return;
      }
      if (live.quizRoundAnswers.length >= 10) {
        enterQuizMilestone();
        return;
      }
      nextQuestion();
    }
  }

  on(el.playBtn, 'click', togglePlay);
  on(el.nextBtn, 'click', advanceNextStep);
  on(el.prevBtn, 'click', function () {
    if (live.phase === 'video') {
      if (clips.length > 1) transitionToClip((live.clipIndex - 1 + clips.length) % clips.length);
      return;
    }
    if (live.phase === 'story') {
      enterStoryStep(Math.max(0, storyLive.stepIndex - 1));
      return;
    }
    if (live.phase === 'players') { prevPlayerQuestion(); return; }
    prevQuestion();
  });
  on(el.revealToggleBtn, 'click', function () {
    if (live.phase === 'players') { enterPlayerReveal(); return; }
    if (live.phase === 'story') { enterStoryStep(storyLive.stepIndex + 1); return; }
    revealAnswer();
  });
  on(el.rotateBtn, 'click', rotateNow);
  on(el.broadcastBtn, 'click', startBroadcast);

  /* ---------- stream-safe ---------- */
  function setSafe(on_) {
    document.body.classList.toggle('safe', !!on_);
    if (el.safeBtn) {
      el.safeBtn.textContent = on_ ? 'Safe mode on' : 'Stream-safe';
      el.safeBtn.classList.toggle('is-on', !!on_);
    }
    applyChatSafe();
    // Hide any video overlays during stream-safe mode
    if (on_) {
      closeDrawer();
      // Hide preroll and interactive notice if showing
      if (el.videoPreroll && !el.videoPreroll.hidden) {
        var wasPrerollActive = prerollActive;
        dismissPreroll();
        if (wasPrerollActive) interactiveNoticeDismissed = true;
      }
      // Hide break overlay if showing
      if (overlay && !overlay.hidden) {
        hideOverlay();
      }
    }
    window.requestAnimationFrame(function () {
      sizeStage();
      if (live.phase === 'quiz' && currentQ() && !live.quizMilestone) applyQuestionFit(currentQ().q.length);
      if (live.phase === 'players') applyPlayerFit();
    });
  }

  on(el.safeBtn, 'click', function () {
    var next = !document.body.classList.contains('safe');
    setSafe(next);
    toast(next ? 'Clean stream mode on \u2014 tap bottom-right corner or press S to restore controls' : 'Clean stream mode off');
  });

  on(el.safePeek, 'click', function () {
    setSafe(false);
    toast('Controls back');
  });

  /* ---------- dev panel: triple tap ---------- */
  /* Three taps inside 900ms opens the panel. It is deliberately kept
     hidden from the broadcast: the panel lives outside the capture
     region and stream-safe never un-hides it on its own. */
  var tapCount = 0, tapTimer = 0;

  function toggleDev(force) {
    if (!el.devPanel) return;
    var show = typeof force === 'boolean' ? force : el.devPanel.hidden;
    el.devPanel.hidden = !show;
    if (show) renderDev();
  }

  function registerTap() {
    tapCount++;
    if (tapTimer) window.clearTimeout(tapTimer);
    if (tapCount >= 3) {
      tapCount = 0;
      toggleDev();
      return;
    }
    tapTimer = window.setTimeout(function () { tapCount = 0; }, 900);
  }

  [el.frame, el.videoStage, el.quizStage].forEach(function (target) {
    on(target, 'pointerdown', function (e) {
      if (e.target && e.target.closest && e.target.closest('button, input, select, a, label')) return;
      registerTap();
    });
  });

  on(el.devPanelClose, 'click', function () { toggleDev(false); });
  on(el.devNextQ, 'click', function () {
    advanceNextStep();
    renderDev();
  });
  on(el.devReveal, 'click', function () {
    if (live.phase === 'players') enterPlayerReveal();
    else if (live.phase === 'story') enterStoryStep(storyLive.stepIndex + 1);
    else revealAnswer();
    renderDev();
  });
  on(el.devRotate, 'click', function () { rotateNow(); renderDev(); });
  on(el.devSafe, 'click', function () { setSafe(!document.body.classList.contains('safe')); renderDev(); });
  on(el.devRedraw, 'click', function () {
    if (live.phase === 'players') renderPlayerStage();
    else if (live.phase === 'story') enterStoryStep(storyLive.stepIndex);
    else renderQuestion();
    renderDev();
  });

  function row(label, value, cls) {
    return '<div class="dev-row"><span>' + label + '</span><b' + (cls ? ' class="' + cls + '"' : '') + '>' + value + '</b></div>';
  }

  function renderDev() {
    if (!el.devBody) return;
    var b = bank.bible.length, h = bank.history.length;
    var per = playlistSeconds(clips);
    var loopTarget = Number(S.loopHours) || 2;
    var loops = per ? Math.max(1, Math.ceil((loopTarget * 3600) / per)) : 0;
    var frameRect = el.frame ? el.frame.getBoundingClientRect() : { width: 0, height: 0 };
    var overflow = document.documentElement.scrollHeight - window.innerHeight;
    var q = currentQ();

    var html = '';
    html += row('engine', S.engine);
    html += row('phase', live.phase);
    html += row('segment', live.phase === 'players' ? ('players:' + plLive.subPhase) : live.phase === 'story' ? ('story:' + S.storyCat) : (S.segment + (live.quizMilestone ? ':milestone' : '')));
    if (live.phase === 'players' && plLive.quiz) {
      html += row('player quiz', plLive.quiz.quiz_id + ' \u00b7 ' + plLive.quiz.answer_player_id + ' (' + plLive.quiz.mode + ')');
      html += row('round answers', plLive.roundAnswers.length + ' / 10 (round ' + plLive.roundNum + ')');
      html += row('visual', plLive.visualHandle ? 'SVG Player Card ready' : 'loading');
      html += row('chat-safe', S.chatSafe ? 'on' : 'off');
    } else if (live.phase === 'story' && storyLive.episode) {
      var sLib = window.LNR_STORIES;
      html += row('episode', storyLive.episode.title + ' (' + storyLive.episodesCompleted + ' aired)');
      html += row('story step', (storyLive.stepIndex + 1) + ' / ' + storyLive.flatSteps.length);
      html += row('story library', (sLib ? sLib.getAllEpisodes('all').length : 0) + ' episodes');
    } else {
      html += row('question', q ? (q.q.length + ' chars \u00b7 fit ' + (el.qText ? el.qText.getAttribute('data-fit') : '?')) : '\u2014');
      html += row('round answers', live.quizRoundAnswers.length + ' / 10 (round ' + live.quizRoundNum + ')');
      html += row('served / bag', live.served + ' / ' + (bags[S.segment] ? bags[S.segment].length : 0));
    }
    html += row('bank', b + ' bible \u00b7 ' + h + ' history');
    html += row('phase left', clock(Math.max(0, live.phaseEndsAt - now())));
    html += row('paused', live.paused ? 'yes' : 'no', live.paused ? 'is-bad' : 'is-good');
    var activePromos = effectivePromoList();
    html += row('clips / promos', clips.length + ' / ' + activePromos.length);
    html += row('video loops', per ? (clock(per * 1000) + ' \u00d7 ' + loops + ' = ' + clock(loops * per * 1000)) : 'none');
    html += row('break slot', activePromos.length ? ('1 clip after ' + effectivePromoIntervalMin() + 'm+ quiz (' + activePromos.length + ' clips)') : ('1 slot (' + formatShortSec(effectivePromoAdSec()) + ') after ' + effectivePromoIntervalMin() + 'm+ quiz'));
    html += row('quiz before break', clock(live.quizActiveMs) + ' / ' + clock(promoThresholdMs()));
    html += row('break cap', PROMO_MAX_SEC / 60 + ':00 ' + (activePromos.some(function (p) { return p.duration > PROMO_MAX_SEC; }) ? 'VIOLATED' : 'ok'),
      activePromos.some(function (p) { return p.duration > PROMO_MAX_SEC; }) ? 'is-bad' : 'is-good');
    html += row('frame', Math.round(frameRect.width) + '\u00d7' + Math.round(frameRect.height) + ' @ ' + window.innerWidth + 'w');
    html += row('overflow', overflow + 'px' + (overflow > 1 ? ' OVERFLOW' : ' ok'), overflow > 1 ? 'is-bad' : 'is-good');
    html += row('stream-safe', document.body.classList.contains('safe') ? 'on' : 'off');
    html += row('voice', (S.voiceOn ? 'on' : 'off') + ' \u00b7 ' + voiceList.length + ' voices');
    html += row('reader', revealBusy() ? 'speaking reveal \u00b7 holding scene' : 'idle',
      revealBusy() ? 'is-bad' : 'is-good');
    html += row('reveal hold', (revealHoldMs() / 1000).toFixed(1) + 's');
    el.devBody.innerHTML = html;
  }

  /* ---------- exit ---------- */
  function exitSession() {
    var durSec = live.startedAt ? Math.max(0, Math.round((now() - live.startedAt) / 1000)) : 0;
    if (window.LNR_TRACK && live.inSession) {
      window.LNR_TRACK('stream_end', {
        engine: S.engine,
        tier: 'studio',
        duration_sec: durSec
      });
    }
    gaHeartbeatAcc = 0;
    finalizeActiveAdLog();
    live.inSession = false;
    live.running = false;
    live.paused = false;
    live.quizMilestone = false;
    live.quizActiveMs = 0;
    live.lastTickAt = 0;
    clearPreAdNotice();
    if (el.frameInner) {
      el.frameInner.classList.remove('is-promo-pip', 'is-promo-split');
    }
    if (el.storyStage) el.storyStage.hidden = true;
    releasePlayerVisual();
    stopSpeech();
    stopAudioPreview();
    stopStorySpeechPreview();
    stopMusic();
    stopVideo();
    document.body.classList.remove('screen-stage', 'safe');
    document.body.classList.add('screen-setup');
    el.screenStage.hidden = true;
    el.screenSetup.hidden = false;
    closeDrawer();
    toggleDev(false);
    setSafe(false);
    refreshStats();
  }
  on(el.exitBtn, 'click', exitSession);

  /* ---------- music button ---------- */
  on(el.musicBtn, 'click', openDrawer);

  /* ---------- keyboard ---------- */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && el.accessModal && !el.accessModal.hidden) {
      closeOperatorModal();
      return;
    }
    if (!live.inSession) return;
    if (/input|select|textarea/i.test((e.target && e.target.tagName) || '')) return;
    if (e.key === ' ' || e.code === 'Space') { e.preventDefault(); togglePlay(); }
    else if (e.key === 'ArrowRight') {
      advanceNextStep();
    }
    else if (e.key === 'ArrowLeft') {
      if (live.phase === 'video') {
        if (clips.length > 1) transitionToClip((live.clipIndex - 1 + clips.length) % clips.length);
      }
      else if (live.phase === 'story') enterStoryStep(Math.max(0, storyLive.stepIndex - 1));
      else if (live.phase === 'players') prevPlayerQuestion();
      else prevQuestion();
    }
    else if (e.key === 'r' || e.key === 'R') {
      if (live.phase === 'players') enterPlayerReveal();
      else if (live.phase === 'story') enterStoryStep(storyLive.stepIndex + 1);
      else revealAnswer();
    }
    else if (e.key === 'd' || e.key === 'D') { toggleDev(); }
    else if (e.key === 's' || e.key === 'S') {
      var next = !document.body.classList.contains('safe');
      setSafe(next);
      toast(next ? 'Clean stream mode on \u2014 tap bottom-right corner or press S to restore controls' : 'Clean stream mode off');
    } else if (e.key === 'Escape') { closeDrawer(); toggleDev(false); }
  });

  /* ---------- Player Card Library Manager UI ---------- */
  function setPlStatus(ok, title, lines) {
    if (!el.plStatus) return;
    el.plStatus.hidden = false;
    el.plStatus.className = 'import-result ' + (ok ? 'is-ok' : 'is-bad');
    var html = '<b>' + String(title).replace(/</g, '&lt;') + '</b>';
    if (lines && lines.length) {
      html += '<ul>' + lines.slice(0, 8).map(function (l) {
        return '<li>' + String(l).replace(/</g, '&lt;') + '</li>';
      }).join('') + '</ul>';
      if (lines.length > 8) html += '<div>\u2026and ' + (lines.length - 8) + ' more.</div>';
    }
    el.plStatus.innerHTML = html;
  }

  function refreshPlayerLibraryUI() {
    var pLib = window.LNR_PLAYERS;
    if (!pLib) return;
    pLib.runAudit().then(function (rep) {
      if (el.plStatPlayers) el.plStatPlayers.textContent = rep.totalPlayers;
      if (el.plStatFormat) el.plStatFormat.textContent = 'SVG 4:5';
      if (el.plStatQuizzes) el.plStatQuizzes.textContent = rep.totalQuizzes;
      if (el.plStatStorage) el.plStatStorage.textContent = (rep.storageUsageBytes / 1048576).toFixed(1) + ' MB';
      if (el.plPersistTag) {
        el.plPersistTag.textContent = rep.persisted ? 'Persistent storage active' : 'Device IndexedDB';
      }
      refreshStats();
    });
  }

  function renderPlayerSearch(query) {
    var pLib = window.LNR_PLAYERS;
    if (!el.plSearchResults || !pLib) return;
    var q = String(query || '').trim().toLowerCase();
    if (!q) {
      el.plSearchResults.hidden = true;
      el.plSearchResults.innerHTML = '';
      return;
    }
    var matches = pLib.getAllPlayers().filter(function (p) {
      return p.player_id.toLowerCase().indexOf(q) >= 0 ||
        p.name.toLowerCase().indexOf(q) >= 0 ||
        (p.club && p.club.toLowerCase().indexOf(q) >= 0) ||
        (p.nationality && p.nationality.toLowerCase().indexOf(q) >= 0);
    }).slice(0, 12);

    el.plSearchResults.hidden = false;
    el.plSearchResults.innerHTML = '';
    if (!matches.length) {
      var empty = document.createElement('li');
      empty.className = 'pl-search-empty';
      empty.textContent = 'No matching player found in library.';
      el.plSearchResults.appendChild(empty);
      return;
    }

    matches.forEach(function (p) {
      var li = document.createElement('li');
      li.className = 'pl-search-row';

      var thumb = document.createElement('div');
      thumb.className = 'pl-search-thumb';
      thumb.innerHTML = buildMilestoneGraphicSvg({
        player_id: p.player_id,
        number: p.number || '',
        initials: (p.name || p.player_id).slice(0, 2).toUpperCase()
      }, 'players', 0);

      var info = document.createElement('div');
      info.className = 'pl-search-info';
      info.innerHTML = '<b>' + p.name.replace(/</g, '&lt;') + '</b><span>' + p.player_id + ' \u00b7 ' + (p.club || '').replace(/</g, '&lt;') + ' \u00b7 ' + (p.nationality || '').replace(/</g, '&lt;') + (p.number ? ' \u00b7 #' + p.number : '') + '</span>';

      var previewBtn = document.createElement('button');
      previewBtn.type = 'button';
      previewBtn.className = 'btn btn-quiet btn-sm';
      previewBtn.textContent = 'Preview card';

      var cardWrap = document.createElement('div');
      cardWrap.className = 'pl-search-preview';
      cardWrap.hidden = true;

      previewBtn.addEventListener('click', function () {
        cardWrap.hidden = !cardWrap.hidden;
        previewBtn.textContent = cardWrap.hidden ? 'Preview card' : 'Hide card';
        if (!cardWrap.hidden && !cardWrap.firstChild) {
          var img = document.createElement('img');
          img.alt = p.name + ' Player Card';
          img.src = pLib.renderFallbackCardDataUrl(p, { mystery: false });
          cardWrap.appendChild(img);
        }
      });

      var topRow = document.createElement('div');
      topRow.className = 'pl-search-main';
      topRow.appendChild(thumb);
      topRow.appendChild(info);
      topRow.appendChild(previewBtn);

      li.appendChild(topRow);
      li.appendChild(cardWrap);
      el.plSearchResults.appendChild(li);
    });
  }

  on(el.plSearchInput, 'input', function () {
    renderPlayerSearch(el.plSearchInput.value);
  });

  on(el.plQuizJsonInput, 'change', function () {
    var f = el.plQuizJsonInput.files && el.plQuizJsonInput.files[0];
    var pLib = window.LNR_PLAYERS;
    el.plQuizJsonInput.value = '';
    if (!f || !pLib) return;
    var r = new FileReader();
    r.onload = function () {
      var text = String(r.result || '');
      try {
        var parsed = JSON.parse(text);
        if (!Array.isArray(parsed) && Array.isArray(parsed.players)) {
          pLib.importPlayersJson(text).then(function (res) {
            setPlStatus(res.added + res.updated > 0, 'Players JSON processed', [
              'Added: ' + res.added + ' \u00b7 Updated: ' + res.updated,
              res.errors.length ? 'Warnings: ' + res.errors.slice(0, 3).join('; ') : 'Zero errors'
            ]);
            refreshPlayerLibraryUI();
          });
        } else {
          pLib.importQuizzesJson(text).then(function (res) {
            setPlStatus(res.imported > 0, 'Player quizzes imported: ' + res.imported,
              res.errors.length ? res.errors : ['All quizzes validated and added to the Player Quiz rotation.']);
            plLive.bag = [];
            refreshPlayerLibraryUI();
            refreshAccessUI();
            toast('Imported ' + res.imported + ' player quizzes');
          });
        }
      } catch (e) {
        setPlStatus(false, 'Invalid JSON', [e.message]);
        toast('Invalid JSON file', true);
      }
    };
    r.readAsText(f);
  });

  var clearConfirmArmed = false;
  var clearConfirmTimer = 0;
  on(el.plClearBtn, 'click', function () {
    var pLib = window.LNR_PLAYERS;
    if (!pLib) return;
    if (!clearConfirmArmed) {
      clearConfirmArmed = true;
      el.plClearBtn.textContent = 'Confirm reset custom pack?';
      clearConfirmTimer = window.setTimeout(function () {
        clearConfirmArmed = false;
        if (el.plClearBtn) el.plClearBtn.textContent = 'Reset Custom Pack';
      }, 4000);
      return;
    }
    window.clearTimeout(clearConfirmTimer);
    clearConfirmArmed = false;
    el.plClearBtn.textContent = 'Reset Custom Pack';
      pLib.clearCustomLibrary().then(function () {
      plLive.bag = [];
      setPlStatus(true, 'Custom library cleared', [
        'Reverted to built-in 150+ Player Card pack.'
      ]);
      refreshPlayerLibraryUI();
      refreshAccessUI();
      toast('Custom player pack cleared');
    });
  });

  /* ---------- Templates & AI Generator Prompts ---------- */
  function downloadTextFile(filename, content, mime) {
    try {
      var blob = new Blob([content], { type: mime || 'application/json;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    } catch (e) {
      toast('Download failed on this browser', true);
    }
  }

  function copyText(text, successMsg) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        toast(successMsg || 'Copied to clipboard');
      }).catch(function () {
        fallbackCopy(text, successMsg);
      });
      return;
    }
    fallbackCopy(text, successMsg);
  }

  function fallbackCopy(text, successMsg) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      toast(successMsg || 'Copied to clipboard');
    } catch (e) {
      toast('Copy failed — select and copy manually', true);
    }
  }

  on(el.dlQuizTemplateBtn, 'click', function () {
    var tpl = {
      segment: S.segment || 'bible',
      questions: [
        {
          question: 'Which prophet confronted the prophets of Baal on Mount Carmel?',
          options: ['Elisha', 'Elijah', 'Isaiah', 'Jeremiah'],
          answer: 1,
          reference: '1 Kings 18:20-39',
          insight: 'Fire fell from heaven and consumed Elijah\'s water-soaked sacrifice.',
          difficulty: 'Easy'
        },
        {
          question: 'Which ancient empire built the Royal Road from Susa to Sardis?',
          options: ['Persian Empire', 'Roman Empire', 'Assyrian Empire', 'Byzantine Empire'],
          answer: 0,
          reference: 'Darius I, c. 5th century BCE',
          insight: 'Couriers could cover roughly 2,700 kilometres in about seven days.',
          difficulty: 'Medium'
        }
      ]
    };
    downloadTextFile('lnr-quiz-template.json', JSON.stringify(tpl, null, 2));
    toast('Downloaded lnr-quiz-template.json');
  });

  on(el.copyQuizPromptBtn, 'click', function () {
    var segLabel = S.segment === 'history' ? 'history' : 'bible';
    var prompt = [
      'Generate 50 completely original multiple-choice trivia questions formatted strictly as valid JSON (no markdown code fences, just raw JSON) for this livestream schema:',
      '{',
      '  "segment": "' + segLabel + '",',
      '  "questions": [',
      '    {',
      '      "question": "Clear concise question under 110 characters?",',
      '      "options": ["Option A", "Option B", "Option C", "Option D"],',
      '      "answer": 0,',
      '      "reference": "Short verified citation or year",',
      '      "insight": "One interesting sentence read aloud after the reveal.",',
      '      "difficulty": "Easy"',
      '    }',
      '  ]',
      '}',
      'Rules: 4 distinct options per question, "answer" must be the 0-3 index of the correct option, vary difficulty (Easy, Medium, Hard), and ensure 100% factual accuracy.'
    ].join('\n');
    copyText(prompt, 'Quiz AI prompt copied — paste into any AI tool');
  });

  on(el.dlPlayerTemplateBtn, 'click', function () {
    var tpl = {
      players: [
        {
          player_id: 'CUSTOM01',
          name: 'Thierry Henry',
          club: 'Arsenal',
          nationality: 'France',
          position: 'Forward',
          number: '14',
          era: 'Legend'
        },
        {
          player_id: 'CUSTOM02',
          name: 'Luka Modric',
          club: 'Real Madrid',
          nationality: 'Croatia',
          position: 'Midfielder',
          number: '10',
          era: 'Active'
        }
      ],
      quizzes: [
        {
          quiz_id: 'CQ001',
          category: 'Football',
          mode: 'clues',
          question: 'Guess the player!',
          clues: [
            'I won the 1998 World Cup with France as a young winger.',
            'I finished unbeaten in the 2003-04 Premier League Invincibles season.',
            'My number 14 statue stands outside the Emirates Stadium.'
          ],
          answer_player_id: 'CUSTOM01',
          reveal_text: 'Thierry Henry',
          insight: 'Arsenal\'s all-time top goalscorer with 228 goals across all competitions.',
          difficulty: 'Easy'
        }
      ]
    };
    downloadTextFile('lnr-player-quiz-template.json', JSON.stringify(tpl, null, 2));
    toast('Downloaded lnr-player-quiz-template.json');
  });

  on(el.copyPlayerPromptBtn, 'click', function () {
    var prompt = [
      'Generate 30 original sports/celebrity "Guess the Player" clue quizzes and their matching player records in valid raw JSON matching this schema:',
      '{',
      '  "players": [',
      '    { "player_id": "CUSTOM01", "name": "Full Name", "club": "Iconic Club", "nationality": "Country", "position": "Forward", "number": "10", "era": "Active" }',
      '  ],',
      '  "quizzes": [',
      '    {',
      '      "quiz_id": "CQ001",',
      '      "category": "Football",',
      '      "mode": "clues",',
      '      "question": "Guess the player!",',
      '      "clues": ["Clue 1 (career hint)", "Clue 2 (achievement)", "Clue 3 (signature stat/jersey)"],',
      '      "answer_player_id": "CUSTOM01",',
      '      "reveal_text": "Full Name",',
      '      "insight": "One-sentence career highlight spoken at reveal.",',
      '      "difficulty": "Medium"',
      '    }',
      '  ]',
      '}',
      'Rules: Do not name the player inside the clues. Allowed modes: clues, blur_reveal, zoom_crop, silhouette.'
    ].join('\n');
    copyText(prompt, 'Player Quiz AI prompt copied');
  });

  /* ---------- Support Contact & Break Playback Log Export ---------- */
  var STUDIO_EMAIL = 'lnrstrokes@gmail.com';

  function syncSupportEmailLink() {
    var support = {
      subject: 'Studio Question or Custom Pack Inquiry \u2014 lnr Studio',
      body: [
        'Hello lnr Studio,',
        '',
        'My Channel / Site URL: [Enter URL]',
        'Question or Custom Pack Request: [Describe here]',
        '',
        'Thanks!'
      ].join('\n')
    };
    if (el.contactFormBtn) {
      el.contactFormBtn.href = 'mailto:' + STUDIO_EMAIL + '?subject=' + encodeURIComponent(support.subject) + '&body=' + encodeURIComponent(support.body);
    }
  }

  on(el.copyContactTemplateBtn, 'click', function () {
    // Existing details-form / contact surface.
    try {
      if (window.LNR_TRACK && typeof window.LNR_TRACK === 'function') {
        window.LNR_TRACK('jotform_open');
      }
    } catch (e) {}
    var txt = [
      'To: ' + STUDIO_EMAIL,
      'Subject: Studio Question or Custom Pack Inquiry \u2014 lnr Studio',
      '',
      'Hello lnr Studio,',
      '',
      'My Channel / Site URL: [Enter URL]',
      'Question or Custom Pack Request: [Describe here]'
    ].join('\n');
    copyText(txt, 'Support email template copied');
  });
  on(el.contactFormBtn, 'click', function () {
    // Existing details-form / contact surface.
    try {
      if (window.LNR_TRACK && typeof window.LNR_TRACK === 'function') {
        window.LNR_TRACK('jotform_open');
      }
    } catch (e) {}
  });
  on(el.sermonUpgradeLink, 'click', function (e) {
    // Existing upgrade link on the sermon panel.
    try {
      if (window.LNR_TRACK && typeof window.LNR_TRACK === 'function') {
        window.LNR_TRACK('upgrade_click', { location: 'sermon_upgrade_link' });
      }
    } catch (e) {}
  });
  on(el.videoTierUpgradeLink, 'click', function (e) {
    // Existing upgrade link on the video tier note.
    try {
      if (window.LNR_TRACK && typeof window.LNR_TRACK === 'function') {
        window.LNR_TRACK('upgrade_click', { location: 'video_tier_upgrade_link' });
      }
    } catch (e) {}
  });

  function csvCell(val) {
    var s = String(val === null || typeof val === 'undefined' ? '' : val);
    if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function openSponsorLogsDrawer() {
    openDrawer();
    window.setTimeout(function () {
      if (el.sponsorAnalyticsSection && el.sponsorAnalyticsSection.scrollIntoView) {
        el.sponsorAnalyticsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 120);
  }
  on(el.openAnalyticsBtn, 'click', openSponsorLogsDrawer);
  on(el.stViewLogsBtn, 'click', openSponsorLogsDrawer);

  function triggerSponsorCsvExport() {
    if (!adLogs.length) {
      toast('No channel breaks recorded yet');
      return;
    }
    var lines = ['Timestamp (ISO UTC),Local Date/Time,Clip / Slot,Engine,Round,Duration (sec),Tier,Watermark,Brand'];
    adLogs.forEach(function (item) {
      var localStr = '';
      try { localStr = new Date(item.startedAt).toLocaleString(); } catch (e) { localStr = ''; }
      lines.push([
        csvCell(item.isoTime || ''),
        csvCell(localStr),
        csvCell(item.clipName || 'Partner break slot'),
        csvCell(item.engine || ''),
        csvCell(item.roundNum || 1),
        csvCell(item.durationSec || 0),
        csvCell(item.tier || 'free'),
        csvCell(item.watermark || ''),
        csvCell(item.brand || '')
      ].join(','));
    });
    var stamp = new Date().toISOString().slice(0, 10);
    downloadTextFile('lnr-break-log-' + stamp + '.csv', lines.join('\r\n'), 'text/csv;charset=utf-8');
    toast('Exported ' + adLogs.length + ' break record' + (adLogs.length === 1 ? '' : 's'));
  }
  on(el.alExportCsvBtn, 'click', triggerSponsorCsvExport);
  on(el.stExportCsvBtn, 'click', triggerSponsorCsvExport);

  var adClearArmed = false;
  var adClearTimer = 0;
  on(el.alClearBtn, 'click', function () {
    if (!adLogs.length) { toast('Playback log is already empty'); return; }
    if (!adClearArmed) {
      adClearArmed = true;
      el.alClearBtn.textContent = 'Confirm clear logs?';
      adClearTimer = window.setTimeout(function () {
        adClearArmed = false;
        if (el.alClearBtn) el.alClearBtn.textContent = 'Clear logs';
      }, 3500);
      return;
    }
    window.clearTimeout(adClearTimer);
    adClearArmed = false;
    el.alClearBtn.textContent = 'Clear logs';
    adLogs = [];
    idbClearStore('ad_logs').then(function () {
      renderAdAnalytics();
      toast('Break playback logs cleared');
    });
  });

  /* ---------- Studio Operator Tools Modal (7-Tap Brand Logo) ---------- */
  function refreshAccessUI() {
    var segCount = bank[S.segment] ? bank[S.segment].length : 0;
    var customCount = (custom[S.segment] && custom[S.segment].length) || 0;
    if (el.quizPrivateNotice) {
      el.quizPrivateNotice.textContent = usingDemo[S.segment]
        ? 'Demo active \u00b7 import JSON'
        : (segCount + ' Built-in' + (customCount ? (' + ' + customCount + ' Custom') : ' + Custom JSON'));
    }
    if (el.playerPrivateNotice) {
      var pLib = window.LNR_PLAYERS;
      var pDemo = pLib && pLib.isDemoOnly ? pLib.isDemoOnly() : false;
      var pCount = pLib ? pLib.getAllPlayers().length : 0;
      el.playerPrivateNotice.textContent = pDemo
        ? 'Demo active \u00b7 import JSON'
        : (pCount + ' Built-in Cards + Custom');
    }
    applyBranding();
    syncInputs();
    renderAdminPromoList();
    syncSupportEmailLink();
  }

  function openOperatorModal() {
    if (!el.accessModal) return;
    if (el.panelAdmin) el.panelAdmin.hidden = false;
    if (el.adminToolsBox) el.adminToolsBox.hidden = false;
    refreshAccessUI();
    el.accessModal.hidden = false;
  }

  function closeOperatorModal() {
    if (!el.accessModal) return;
    el.accessModal.hidden = true;
  }

  /* 7-tap trigger on top-left brand logo or footer brand */
  var adminTapCount = 0;
  var adminTapTimer = 0;
  function handleSecretAdminTap(e) {
    if (e && e.preventDefault) e.preventDefault();
    adminTapCount++;
    if (adminTapTimer) window.clearTimeout(adminTapTimer);
    if (adminTapCount >= 7) {
      adminTapCount = 0;
      openOperatorModal();
      toast('Studio Operator Tools opened');
      return;
    }
    adminTapTimer = window.setTimeout(function () { adminTapCount = 0; }, 2600);
  }
  on(el.brandHome, 'click', function (e) {
    if (live.inSession) {
      e.preventDefault();
      exitSession();
      return;
    }
    if (currentPage !== 'home') setPage('home');
    handleSecretAdminTap(e);
  });
  on(document.querySelector('.foot-brand'), 'click', handleSecretAdminTap);

  on(el.accessModalClose, 'click', closeOperatorModal);
  on(el.accessModal, 'click', function (e) {
    if (e.target === el.accessModal) closeOperatorModal();
  });

  /* Operator Break Folder display layout, order & disclosure bindings */
  on(el.adminPromoDisplay, 'change', function () {
    S.promoDisplayMode = el.adminPromoDisplay.value || 'full';
    save();
    toast('Break display: ' + S.promoDisplayMode);
  });
  on(el.adminPromoOrder, 'change', function () {
    S.promoOrder = el.adminPromoOrder.value || 'sequential';
    save();
    toast('Break order: ' + S.promoOrder);
  });
  on(el.adminPromoOverlay, 'change', function () {
    S.promoOverlayStyle = el.adminPromoOverlay.value || 'disclosure';
    save();
    updatePromoBrand();
    updatePromoOverlay();
    toast('Break disclosure: ' + S.promoOverlayStyle);
  });

  function syncPublicPromosManifest(silent) {
    fetch('/promos/manifest.json')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        var list = (data && Array.isArray(data.clips)) ? data.clips : [];
        if (!list.length) {
          if (!silent) toast('No files listed inside /public/promos/manifest.json');
          return;
        }
        var nextDefault = [];
        var added = 0;
        list.forEach(function (entry) {
          var url = typeof entry === 'string' ? entry : (entry && (entry.src || entry.url));
          if (!url) return;
          var absUrl = url.indexOf('/') === 0 ? url : ('/promos/' + url);
          var id = 'pub_' + absUrl.replace(/[^a-z0-9]/gi, '_');
          var item = {
            id: id,
            name: (entry && entry.name) || absUrl.split('/').pop(),
            size: 0,
            duration: (entry && Number(entry.duration)) || 0,
            enabled: true,
            externalUrl: absUrl
          };
          nextDefault.push(item);
          if (!adminPromos.some(function (p) { return p.id === id; })) {
            adminPromos.push(Object.assign({}, item));
            added++;
          }
        });
        defaultFolderPromos = nextDefault;
        renderClips();
        refreshPromoText();
        refreshStats();
        if (!silent) toast(added ? ('Synced ' + added + ' clip(s) from /promos/') : 'All /promos/ manifest clips already synced');
      })
      .catch(function () {
        if (!silent) toast('Could not read /promos/manifest.json', true);
      });
  }
  on(el.syncPublicPromosBtn, 'click', function () { syncPublicPromosManifest(false); });

  window.addEventListener('pagehide', function () {
    finalizeActiveAdLog();
  });

  function sizeStage() {
    var wrap = document.querySelector('.stage-wrap');
    if (!wrap) return;
    var h = wrap.clientHeight;
    if (h > 0) document.documentElement.style.setProperty('--stage-h', h + 'px');
  }

  /* re-fit the question when the frame changes size (resize / rotate) */
  var resizeTimer = 0;
  window.addEventListener('resize', function () {
    sizeStage();
    if (resizeTimer) window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(function () {
      sizeStage();
      if (live.phase === 'quiz' && currentQ()) applyQuestionFit(currentQ().q.length);
      if (live.phase === 'players') applyPlayerFit();
      if (el.devPanel && !el.devPanel.hidden) renderDev();
    }, 180);
  });

  /* ---------- Storytelling Setup & Catalog UI ---------- */
  function setStoryStatus(ok, title, lines) {
    if (!el.storyImportResult) return;
    el.storyImportResult.hidden = false;
    el.storyImportResult.className = 'import-result ' + (ok ? 'is-ok' : 'is-bad');
    var html = '<b>' + escHtml(title) + '</b>';
    if (lines && lines.length) {
      html += '<ul>' + lines.slice(0, 6).map(function (l) {
        return '<li>' + escHtml(l) + '</li>';
      }).join('') + '</ul>';
    }
    el.storyImportResult.innerHTML = html;
  }

  function renderStoryCatalogUI() {
    var sApi = window.LNR_STORIES;
    if (!sApi || !el.storyEpisodeList) return;
    var list = sApi.getAllEpisodes(S.storyCat);
    el.storyEpisodeList.innerHTML = '';
    [[el.storyCatAll, 'all'], [el.storyCatHistory, 'world-history'], [el.storyCatBiblical, 'biblical']].forEach(function (pair) {
      if (pair[0]) pair[0].classList.toggle('is-selected', pair[1] === S.storyCat);
    });
    list.forEach(function (ep) {
      var btn = document.createElement('button');
      btn.type = 'button';
      var isChosen = S.storyStartId === ep.id;
      btn.className = 'story-ep-item' + (isChosen ? ' is-selected' : '');
      var beatTotal = (ep.beats || []).length;
      btn.innerHTML =
        '<div class="story-ep-top"><span>' + escHtml(formatArchetypeLabel(ep.archetype)) + ' \u00b7 ' + escHtml(ep.era) + '</span><span>' + beatTotal + ' beats + gate</span></div>' +
        '<b>' + escHtml(ep.title) + '</b>' +
        '<span>' + escHtml(ep.subtitle) + '</span>';
      btn.addEventListener('click', function () {
        S.storyStartId = (S.storyStartId === ep.id) ? '' : ep.id;
        save();
        renderStoryCatalogUI();
        toast(S.storyStartId ? ('Starts with: ' + ep.title) : 'Automatic Hook-Loop archetype rotation');
      });
      el.storyEpisodeList.appendChild(btn);
    });
    refreshStats();
  }

  [[el.storyCatAll, 'all'], [el.storyCatHistory, 'world-history'], [el.storyCatBiblical, 'biblical']].forEach(function (pair) {
    on(pair[0], 'click', function () {
      S.storyCat = pair[1];
      S.storyStartId = '';
      save();
      renderStoryCatalogUI();
    });
  });

  on(el.setupStoryImportInput, 'change', function () {
    var f = el.setupStoryImportInput.files && el.setupStoryImportInput.files[0];
    el.setupStoryImportInput.value = '';
    var sApi = window.LNR_STORIES;
    if (!f || !sApi) return;
    var r = new FileReader();
    r.onload = function () {
      var res = sApi.importEpisodesJson(String(r.result || ''));
      setStoryStatus(res.added > 0, res.added ? ('Imported ' + res.added + ' Hook-Loop story case(s)') : 'No new stories added', [
        'Added: ' + res.added + ' \u00b7 Skipped duplicates: ' + res.skipped,
        res.errors && res.errors.length ? ('Notes: ' + res.errors.slice(0, 3).join('; ')) : 'Ready for interactive broadcast'
      ]);
      renderStoryCatalogUI();
      toast(res.added ? ('Imported ' + res.added + ' story case(s)') : 'Check Story JSON report', !res.added);
    };
    r.readAsText(f);
  });

  on(el.dlStoryTemplateBtn, 'click', function () {
    var tpl = {
      stories: [
        {
          story_id: 'myst_sample_01',
          archetype: 'historical_anomaly',
          pacing_profile: 'fast_investigative',
          category: 'world-history',
          era: '1977',
          accent_color: '#5b9bd5',
          title: 'The 72-Second Deep Space Signal',
          subtitle: 'Why Ohio astronomers circled one mysterious narrowband spike in red ink',
          hook: {
            duration_sec: 9,
            on_screen_badge: 'CASE #077 \u00b7 OHIO RADIO ARRAY',
            headline: 'THE 72-SECOND SIGNAL THAT WAS NEVER HEARD AGAIN',
            narration: 'Late one August night in 1977, an unmanned radio telescope swept the sky and recorded a signal thirty times louder than deep-space background noise.'
          },
          beats: [
            {
              beat_number: 1,
              visual_mode: 'signal_waveform',
              accent_color: '#5b9bd5',
              headline: 'The Printout Margin Note',
              dateLabel: 'August 15, 1977',
              location: 'Big Ear Observatory, Ohio',
              text: 'Three days later, astronomer Jerry Ehman scanned the paper printout, saw the sequence 6EQUJ5 spiking straight off the scale, and wrote a single astonished word in the margin: Wow.',
              open_loop: 'Even stranger than the spike itself was the exact frequency the beam arrived on.',
              visual: {
                waveformLabel: '1420.4 MHz Hydrogen Line Spike',
                waveformBars: [16, 18, 22, 48, 95, 98, 72, 30, 18, 15, 19, 14],
                accentStat: '1420 MHz',
                statLabel: 'protected hydrogen band forbidden to Earth transmitters'
              }
            },
            {
              beat_number: 2,
              visual_mode: 'evidence_card',
              accent_color: '#cfa35a',
              headline: 'Two Feed Horns, Only One Horn Hit',
              dateLabel: 'Dual-Beam Check',
              location: 'Delaware, Ohio',
              text: 'Because the telescope used two adjacent feed horns scanning the sky as Earth rotated, any fixed distant source had to appear twice three minutes apart—yet the second horn stayed dead silent.',
              open_loop: 'So did something pass briefly through one beam, turn off in under three minutes, or bounce off orbital debris?',
              visual: {
                quote: '6EQUJ5 lasted seventy-two seconds in one horn and vanished completely before the second swept past.',
                attribution: 'Ohio State Observatory Log',
                accentStat: '72 sec',
                statLabel: 'exact beam transit duration of a stationary sky point'
              }
            }
          ],
          chat_checkpoint: {
            countdown_sec: 15,
            prompt: 'WHY DID ONLY ONE OF TWO FEED HORNS DETECT THE SPIKE?',
            options: [
              'A) The signal switched off or drifted right inside the 3-minute gap',
              'B) Paper ink ran dry before the second sweep printed',
              'C) Both horns always record identical channels simultaneously'
            ],
            correct_index: 0
          },
          resolution: {
            reveal: 'Answer A: Whether intermittent natural maser flare or transient reflection, the source dimmed or moved during the three-minute interval between beams—never repeating in 45 years of follow-up sweeps.',
            flaw_everyone_misses: 'Most headlines overlook the missing second-horn echo, which proves the 72-second duration matched Earth rotating across a point source rather than an arbitrary broadcast length.',
            why_it_matters: 'Understanding instrument geometry keeps genuine unsolved data separate from clickbait folklore.',
            next_story_bridge: 'Speaking of signals hiding inside ordinary objects—let us test your rapid trivia instincts next.'
          }
        }
      ]
    };
    downloadTextFile('lnr-hook-loop-story-template.json', JSON.stringify(tpl, null, 2));
    toast('Downloaded lnr-hook-loop-story-template.json');
  });

  on(el.copyStoryPromptBtn, 'click', function () {
    var prompt = [
      'Generate 3 Interactive Hook-Loop Storytelling cases in raw valid JSON matching this anti-repetitious schema (supports investigative mysteries OR Sar vs. Diq fictionalized historical banter):',
      '{',
      '  "stories": [{',
      '    "story_id": "myst_001",',
      '    "archetype": "historical_anomaly | historical_heist | biblical_mystery | ethical_dilemma | survival_scenario | historical_banter",',
      '    "pacing_profile": "fast_investigative | slow_psychological | rapid_dilemma",',
      '    "category": "world-history | biblical",',
      '    "era": "Year or Era",',
      '    "accent_color": "#df8f6b",',
      '    "title": "Compelling Case Title",',
      '    "subtitle": "Short premise",',
      '    "disclaimer": { "is_fictional_persona": false, "badge_text": "Fictional Characters · Real History", "note": "Include only for Sar & Diq banter cases" },',
      '    "hook": {',
      '      "duration_sec": 9,',
      '      "on_screen_badge": "CASE #001 · UNSOLVED",',
      '      "headline": "COLD-OPEN ANOMALY HEADLINE",',
      '      "narration": "Drop straight into the contradiction or turning point in 1-2 crisp sentences."',
      '    },',
      '    "beats": [{',
      '      "beat_number": 1,',
      '      "speaker": "SAR | DIQ | NARRATOR",',
      '      "tone": "boastful_ordeal | sneering_warning | investigative",',
      '      "visual_mode": "evidence_card | signal_waveform | wildfire_surge | ember_glow | map | timeline | profile | comparison | artifact | document",',
      '      "accent_color": "#cfa35a",',
      '      "headline": "Beat Title",',
      '      "dateLabel": "...",',
      '      "location": "...",',
      '      "text": "2 crisp spoken sentences advancing the story.",',
      '      "open_loop": "Curiosity hook pulling viewers into the next beat.",',
      '      "visual": { "quote": "...", "attribution": "...", "route": ["..."], "points": ["..."], "waveformBars": [20,50,90,40], "accentStat": "...", "statLabel": "..." }',
      '    }],',
      '    "chat_checkpoint": {',
      '      "countdown_sec": 15,',
      '      "prompt": "SHARP DEDUCTION QUESTION FOR LIVE CHAT?",',
      '      "options": ["A) Option one", "B) Option two", "C) Option three"],',
      '      "correct_index": 1',
      '    },',
      '    "resolution": {',
      '      "speaker": "DIQ | NARRATOR",',
      '      "reveal": "Explain the true historical outcome clearly.",',
      '      "flaw_everyone_misses": "Authored commentary explaining why most people guess wrong.",',
      '      "why_it_matters": "Short reflective takeaway.",',
      '      "next_story_bridge": "Cliffhanger tease into the next segment."',
      '    }',
      '  }]',
      '}'
    ].join('\n');
    copyText(prompt, 'Hook-Loop + Sar/Diq AI prompt copied');
  });

  /* ---------- Custom Speech Audio Upload (Storytelling Narrator) ---------- */
  function stopStorySpeechPreview() {
    if (storySpeechPreviewIdx < 0) return;
    storySpeechPreviewIdx = -1;
    storySpeechPreviewing = false;
    try { storySpeechEl.pause(); storySpeechEl.currentTime = 0; } catch (e) {}
    setMusicDucking(false);
    renderStorySpeechUI();
  }

  function startStorySpeechPreview(idx) {
    var target = typeof idx === 'number' ? idx : 0;
    if (!storySpeechTracks[target]) return;
    if (storySpeechPreviewIdx === target && storySpeechPreviewing) {
      stopStorySpeechPreview();
      return;
    }
    stopAudioPreview();
    stopStorySpeechPreview();
    storySpeechPreviewing = true;
    storySpeechPreviewIdx = target;
    storySpeechEl.src = storySpeechTracks[target].url;
    storySpeechEl.loop = false;
    storySpeechEl.currentTime = 0;
    storySpeechEl.onended = function () {
      if (storySpeechPreviewing) stopStorySpeechPreview();
    };
    var p = storySpeechEl.play();
    if (p && p.catch) {
      p.catch(function () {
        stopStorySpeechPreview();
        toast('Unable to preview speech audio on this device', true);
      });
    }
    renderStorySpeechUI();
  }

  function persistStorySpeechTracks() {
    var payload = storySpeechTracks.map(function (t) {
      return { id: t.id, name: t.name, size: t.size, type: t.type, duration: t.duration || 0, blob: t.blob };
    });
    idbPutStore('vault', { id: 'custom_story_speech_tracks', tracks: payload }).catch(function () {});
  }

  function renderStorySpeechUI() {
    var count = storySpeechTracks.length;
    if (el.storySpeechStatus) {
      el.storySpeechStatus.textContent = count
        ? (count + ' uploaded audio ' + (count === 1 ? 'track' : 'tracks'))
        : 'Built-in Narrator';
    }
    if (el.drawerStorySpeechName) {
      el.drawerStorySpeechName.textContent = count
        ? (count === 1 ? storySpeechTracks[0].name : (count + ' speech tracks'))
        : 'Built-in narrator';
    }
    [el.storySpeechClearBtn, el.drawerStorySpeechClearBtn].forEach(function (b) {
      if (b) b.hidden = !count;
    });
    if (el.storySpeechPreviewBtn) {
      el.storySpeechPreviewBtn.hidden = !count;
      el.storySpeechPreviewBtn.textContent = storySpeechPreviewing ? 'Stop preview' : 'Preview';
      el.storySpeechPreviewBtn.classList.toggle('is-playing', storySpeechPreviewing);
    }
    if (el.storySpeechList) {
      el.storySpeechList.innerHTML = '';
      storySpeechTracks.forEach(function (tr, idx) {
        var li = document.createElement('li');
        var meta = document.createElement('span');
        meta.className = 'clip-name';
        meta.textContent = (idx + 1) + '. ' + tr.name + (tr.duration > 0 ? (' \u00b7 ' + clock(tr.duration * 1000)) : '');

        var acts = document.createElement('div');
        acts.className = 'clip-acts';

        var prevBtn = document.createElement('button');
        prevBtn.type = 'button';
        prevBtn.className = 'btn btn-quiet btn-sm';
        var isThisPlaying = storySpeechPreviewing && storySpeechPreviewIdx === idx;
        prevBtn.textContent = isThisPlaying ? 'Stop' : 'Play';
        prevBtn.addEventListener('click', function () { startStorySpeechPreview(idx); });

        var rmBtn = document.createElement('button');
        rmBtn.type = 'button';
        rmBtn.className = 'btn btn-ghost btn-sm';
        rmBtn.textContent = 'Remove';
        rmBtn.addEventListener('click', function () {
          stopStorySpeechPreview();
          if (storySpeechTrackIdx === idx) stopUploadedStorySpeech();
          try { if (tr.url) URL.revokeObjectURL(tr.url); } catch (e) {}
          storySpeechTracks.splice(idx, 1);
          persistStorySpeechTracks();
          renderStorySpeechUI();
          toast('Speech audio removed');
        });

        acts.appendChild(prevBtn);
        acts.appendChild(rmBtn);
        li.appendChild(meta);
        li.appendChild(acts);
        el.storySpeechList.appendChild(li);
      });
    }
    updateVoiceBtn();
  }

  function hydrateStorySpeechTrack(rec) {
    if (!rec || !rec.blob) return;
    var url = URL.createObjectURL(rec.blob);
    var track = {
      id: rec.id || ('sp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)),
      name: rec.name || 'Speech.mp3',
      size: rec.size || rec.blob.size || 0,
      type: rec.type || rec.blob.type || 'audio/mpeg',
      duration: Number(rec.duration) || 0,
      blob: rec.blob,
      url: url
    };
    storySpeechTracks.push(track);
    if (!track.duration) {
      var probe = new Audio(url);
      probe.preload = 'metadata';
      probe.onloadedmetadata = function () {
        if (isFinite(probe.duration) && probe.duration > 0) {
          track.duration = probe.duration;
          persistStorySpeechTracks();
          renderStorySpeechUI();
        }
      };
    }
  }

  function handleStorySpeechFiles(fileList) {
    if (!fileList || !fileList.length) return;
    var added = 0;
    Array.prototype.forEach.call(fileList, function (f) {
      if (!f) return;
      hydrateStorySpeechTrack({
        id: 'sp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        name: f.name,
        size: f.size,
        type: f.type,
        duration: 0,
        blob: f
      });
      added++;
    });
    if (added) {
      persistStorySpeechTracks();
      renderStorySpeechUI();
      toast('Uploaded ' + added + ' speech audio file' + (added === 1 ? '' : 's'));
    }
  }

  function clearStorySpeechTracks() {
    stopStorySpeechPreview();
    stopUploadedStorySpeech();
    storySpeechTracks.forEach(function (t) {
      try { if (t.url) URL.revokeObjectURL(t.url); } catch (e) {}
    });
    storySpeechTracks = [];
    idbDeleteStore('vault', 'custom_story_speech_tracks').catch(function () {});
    renderStorySpeechUI();
    toast('Speech uploads cleared \u2014 using built-in narrator');
  }

  [el.setupStorySpeechInput, el.drawerStorySpeechInput].forEach(function (inp) {
    on(inp, 'change', function () {
      handleStorySpeechFiles(inp.files);
      inp.value = '';
    });
  });
  on(el.setupStorySpeechMode, 'change', function () {
    S.storySpeechMode = el.setupStorySpeechMode.value === 'step' ? 'step' : 'episode';
    save();
    toast(S.storySpeechMode === 'step' ? '1 speech file per step' : '1 speech file per chapter');
  });
  on(el.storySpeechPreviewBtn, 'click', function () {
    if (storySpeechPreviewing) stopStorySpeechPreview();
    else startStorySpeechPreview(0);
  });
  [el.storySpeechClearBtn, el.drawerStorySpeechClearBtn].forEach(function (btn) {
    on(btn, 'click', clearStorySpeechTracks);
  });

  on(el.storyClearBtn, 'click', function () {
    var sApi = window.LNR_STORIES;
    if (!sApi) return;
    sApi.clearCustomEpisodes();
    S.storyStartId = '';
    save();
    renderStoryCatalogUI();
    toast('Custom story episodes cleared (built-in episodes preserved)');
  });

  /* ---------- boot ---------- */
  window.addEventListener('lnr:banks-ready', function () {
    rebuildQuizBanks();
    refreshAccessUI();
    refreshStats();
    if (el.devPanel && !el.devPanel.hidden) renderDev();
  });

  window.addEventListener('lnr:stories-ready', function () {
    renderStoryCatalogUI();
    refreshStats();
  });

  function boot() {
    rebuildQuizBanks();
    initRouting();
    /* Arm the gesture unlock before anything tries to make sound: the first
       click/keypress anywhere releases a blocked background track. */
    installGestureUnlock();
    setEngine(S.engine);
    setSegment(S.segment);
    setPlayerMode(S.playerMode);
    syncInputs();
    syncMusicCardsUI();
    syncAudioPreviewUI();
    renderStorySpeechUI();
    renderStoryCatalogUI();
    renderClips();
    updateVoiceBtn();
    updatePromoBrand();
    refreshAccessUI();
    renderAdAnalytics();
    if (el.startBtn) el.startBtn.disabled = false;
    startTick();

    if (window.LNR_PLAYERS) {
      window.LNR_PLAYERS.initLibrary().then(function () {
        refreshPlayerLibraryUI();
        refreshAccessUI();
      });
    }

    idbGetStore('vault', 'custom_audio_track').then(function (rec) {
      if (rec && rec.blob) {
        loadCustomAudioBlob(rec.blob, rec.name || 'Custom track.mp3');
      }
    });

    idbGetStore('vault', 'custom_story_speech_tracks').then(function (rec) {
      if (rec && Array.isArray(rec.tracks) && rec.tracks.length) {
        rec.tracks.forEach(hydrateStorySpeechTrack);
        renderStorySpeechUI();
      }
    });

    idbList().then(function (rows) {
      clips = rows.filter(function (r) { return r.kind !== 'promo' && r.kind !== 'admin_promo'; })
        .map(function (r) { return { id: r.id, name: r.name, size: r.size, duration: r.duration || 0, ownership: r.ownership || 'reference' }; });
      promos = rows.filter(function (r) { return r.kind === 'promo'; })
        .map(function (r) { return { id: r.id, name: r.name, size: r.size, duration: r.duration || 0 }; });
      adminPromos = rows.filter(function (r) { return r.kind === 'admin_promo'; })
        .map(function (r) { return { id: r.id, name: r.name, size: r.size, duration: r.duration || 0, enabled: r.enabled !== false }; });
      warmClipUrls(clips);
      warmClipUrls(promos);
      warmClipUrls(adminPromos);
      renderClips();
      refreshPromoText();
      syncPublicPromosManifest(true);
    });

    idbListStore('ad_logs').then(function (logs) {
      adLogs = (logs || []).slice().sort(function (a, b) { return (b.startedAt || 0) - (a.startedAt || 0); });
      renderAdAnalytics();
    });

    if (el.loopHours) el.loopHours.value = effectiveLoopHours();
    if (el.loopHoursDrawer) el.loopHoursDrawer.value = effectiveLoopHours();
    refreshLoopMath();
    refreshPromoText();

    if (S.autoRotate === false && el.autoRotate) el.autoRotate.checked = false;

    syncMusicCardsUI();
    toggleDev(false);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  /* exposed for diagnostics & tests */
  window.LNR_DEBUG = {
    tier: function () { return 'studio'; },
    bankCount: function () {
      var pLib = window.LNR_PLAYERS;
      var sLib = window.LNR_STORIES;
      return {
        bible: bank.bible.length,
        history: bank.history.length,
        bibleDemo: usingDemo.bible,
        historyDemo: usingDemo.history,
        players: pLib ? pLib.getAllPlayers().length : 0,
        playerQuizzes: pLib ? pLib.getAllQuizzes('all').length : 0,
        stories: sLib ? sLib.getAllEpisodes('all').length : 0
      };
    },
    importText: function (text, name) {
      var file = new File([text], name || 'test.json', { type: 'application/json' });
      handleImport(file);
    },
    state: function () {
      return {
        tier: 'studio',
        engine: S.engine,
        phase: live.phase,
        subPhase: plLive.subPhase,
        storyEpisode: storyLive.episode ? storyLive.episode.id : null,
        storyStep: storyLive.stepIndex,
        quizMilestone: live.quizMilestone,
        quizRoundAnswers: live.quizRoundAnswers.length,
        quizRoundNum: live.quizRoundNum,
        quizActiveMs: live.quizActiveMs,
        promoAdsEnabled: !!S.promoAdsEnabled,
        promoDisplayMode: S.promoDisplayMode,
        promoOrder: S.promoOrder,
        promoOverlayStyle: S.promoOverlayStyle,
        demoVideoMode: demoVideoMode,
        promoThresholdMs: promoThresholdMs(),
        preAdPending: live.preAdPending,
        qIndex: live.qIndex,
        served: live.served,
        roundAnswers: plLive.roundAnswers.length,
        roundNum: plLive.roundNum,
        paused: live.paused,
        adLogsCount: adLogs.length
      };
    },
    setSegment: setSegment,
    setEngine: setEngine,
    startSession: startSession,
    rotate: rotateNow,
    startBroadcast: startBroadcast,
    toggleDev: toggleDev,
    fits: function () {
      return {
        qText: el.qText ? el.qText.getAttribute('data-fit') : null,
        qFont: el.qText ? getComputedStyle(el.qText).fontSize : null,
        opts: Array.prototype.map.call(el.options.children, function (cc) { return cc.getAttribute('data-fit'); })
      };
    },
    promoCap: function () { return PROMO_MAX_SEC; },
    promo: function () {
      var activePromos = effectivePromoList();
      return {
        enabled: !!S.promoAdsEnabled,
        minutes: Math.round((S.promoAdSec / 60) * 10) / 10,
        promoAdSec: S.promoAdSec,
        promoIntervalMin: S.promoIntervalMin,
        clips: activePromos.length,
        seconds: playlistSeconds(activePromos)
      };
    },
    brand: function () { var b = effectiveBranding(); return { text: b.brand, watermark: b.watermark, site: b.site, locked: b.locked, visible: el.promoBrand ? !el.promoBrand.hidden : false, loopBadgeVisible: el.loopBadge ? !el.loopBadge.hidden : false }; },
    loopMath: function () {
      var per = playlistSeconds(clips);
      var targetS = effectiveLoopHours() * 3600;
      var loops = per ? Math.max(1, Math.ceil(targetS / per)) : 0;
      return {
        clipSeconds: per,
        clips: clips.length,
        promos: promos.length,
        adminPromos: adminPromos.length,
        targetHours: effectiveLoopHours(),
        loops: loops,
        totalSeconds: loops * per
      };
    },
    storeClip: function (file, kind) { storeMedia(file, kind); },
    audio: function () {
      return {
        ctxState: audioCtx ? audioCtx.state : 'none',
        bedRunning: !!(BED.timer || (defaultBgAudioEl && !defaultBgAudioEl.paused)),
        bedTrack: BED.timer ? 'lnr_stream_bed (synth)' : (defaultBgAudioKey || null),
        bedVolume: BED.nodes ? Math.round(BED.nodes.master.gain.value * 100) / 100
          : (defaultBgAudioEl ? Math.round(defaultBgAudioEl.volume * 100) / 100 : null),
        customTrack: customAudioName || null,
        customPlaying: !!(customAudioEl && !customAudioEl.paused),
        customVolume: customAudioEl ? Math.round(customAudioEl.volume * 100) / 100 : null,
        ducked: musicDucked,
        suppressed: isAudioSuppressedPhase(),
        musicSetting: S.music,
        musicVol: S.musicVol
      };
    },
    layout: function () {
      var f = el.frame.getBoundingClientRect();
      var t = document.querySelector('.transport');
      var tb = t ? t.getBoundingClientRect() : null;
      return {
        vh: window.innerHeight,
        frameH: Math.round(f.height),
        frameW: Math.round(f.width),
        onScreen: tb ? (tb.bottom <= window.innerHeight + 1) : true,
        overflow: document.documentElement.scrollHeight - window.innerHeight
      };
    }
  };

  /* Defer ownership UI init until the DOM is ready and clips may have loaded. */
  if (el.ownVideoBtn && el.refVideoBtn && el.videoOwnershipTag) {
    refreshOwnershipUI();
  }
})();
