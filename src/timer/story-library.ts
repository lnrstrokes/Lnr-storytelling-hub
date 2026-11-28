/* ============================================================
   lnr Studio — Interactive Hook-Loop Storytelling Library
   4-Act Micro-Loop Documentary Architecture (Anti-Repetitious):
     1. In-Medias-Res Anomaly Hook (8–10s cold open)
     2. 3 Escalation Beats with shifting visual modes & open loops
     3. Live Chat Deduction Gate (3 options + countdown)
     4. Twist Reveal, Authored Host Commentary & Next-Case Bridge
   Zero external API dependencies — runs deterministically offline.
   ============================================================ */

/* The pack layer: named graphic and motion primitives a story can reference.
   Imported here so the Evidence Board schema can be validated on ingestion —
   an unknown pack name is now a named error instead of a silently blank scene. */
import {
  validatePackReferences,
  checkStoryQuality,
  loadCustomPacks,
} from './story-packs.ts';

export type StoryArchetype =
  | 'historical_anomaly'
  | 'historical_heist'
  | 'biblical_mystery'
  | 'ethical_dilemma'
  | 'survival_scenario'
  | 'historical_banter';

export type StoryPacingProfile =
  | 'fast_investigative'
  | 'slow_psychological'
  | 'rapid_dilemma';

export type StoryBeatVisualMode =
  | 'evidence_card'
  | 'signal_waveform'
  | 'wildfire_surge'
  | 'ember_glow'
  | 'map'
  | 'timeline'
  | 'profile'
  | 'comparison'
  | 'artifact'
  | 'document';

export type StorySpeaker = 'SAR' | 'DIQ' | 'NARRATOR';

export interface StoryDisclaimer {
  isFictionalPersona: boolean;
  badgeText: string;
  note?: string;
}

export type StoryCategory = 'world-history' | 'biblical';

export interface StorySceneVisual {
  dateLabel?: string;
  location?: string;
  quote?: string;
  attribution?: string;
  points?: string[];
  leftTitle?: string;
  leftItems?: string[];
  rightTitle?: string;
  rightItems?: string[];
  route?: string[];
  subjectName?: string;
  role?: string;
  eraSpan?: string;
  artifactName?: string;
  material?: string;
  provenance?: string;
  accentStat?: string;
  statLabel?: string;
  waveformLabel?: string;
  waveformBars?: number[];
}

export interface StoryHook {
  durationSec: number;
  badge: string;
  headline: string;
  narration: string;
}

export interface StoryBeat {
  beatNumber: number;
  visualMode: StoryBeatVisualMode;
  speaker?: StorySpeaker;
  tone?: string;
  accentColor?: string;
  headline: string;
  dateLabel?: string;
  location?: string;
  text: string;
  openLoop?: string;
  visual?: StorySceneVisual;
}

export interface StoryCheckpoint {
  countdownSec: number;
  prompt: string;
  options: string[];
  correctIndex: number;
}

export interface StoryResolution {
  speaker?: StorySpeaker;
  reveal: string;
  flawEveryoneMisses: string;
  whyItMatters: string;
  nextStoryBridge: string;
}

export interface StoryEpisode {
  id: string;
  title: string;
  subtitle: string;
  category: StoryCategory;
  era: string;
  archetype: StoryArchetype;
  pacingProfile: StoryPacingProfile;
  accentColor: string;
  audioBedPreference: 'sacred' | 'ambient' | 'focus';
  disclaimer?: StoryDisclaimer;
  hook: StoryHook;
  beats: StoryBeat[];
  chatCheckpoint: StoryCheckpoint;
  resolution: StoryResolution;
}

declare global {
  interface Window {
    LNR_STORIES?: {
      getAllEpisodes: (category?: string) => StoryEpisode[];
      getCustomEpisodes: () => StoryEpisode[];
      getStats: () => {
        total: number;
        builtIn: number;
        custom: number;
        worldHistory: number;
        biblical: number;
        totalBeats: number;
        archetypes: number;
      };
      importEpisodesJson: (jsonText: string) => {
        added: number;
        skipped: number;
        errors: string[];
      };
      clearCustomEpisodes: () => void;
    };
  }
}

const CUSTOM_STORIES_KEY = 'lnr_custom_stories_v2';

const BUILT_IN_EPISODES: StoryEpisode[] = [
  {
    id: 'myst-ironwood-signal',
    title: 'The Distress Call That Arrived 40 Years Late',
    subtitle: 'Why a scrapped 1944 freighter transmitted an exact Morse distress signature in 1984',
    category: 'world-history',
    era: '1944 / 1984',
    archetype: 'historical_anomaly',
    pacingProfile: 'fast_investigative',
    accentColor: '#5b9bd5',
    audioBedPreference: 'focus',
    hook: {
      durationSec: 9,
      badge: 'CASE #042 · UNEXPLAINED SIGNAL',
      headline: 'THE DISTRESS CALL FROM A SHIP SCRAPPED 40 YEARS EARLIER',
      narration: 'In 1984, a North Atlantic listening post logged a crisp Morse distress signal from the SS Ironwood—a cargo vessel broken apart for scrap metal in 1944.'
    },
    beats: [
      {
        beatNumber: 1,
        visualMode: 'evidence_card',
        accentColor: '#5b9bd5',
        headline: 'Exhibit A: Identical Telegrapher Cadence',
        dateLabel: 'File Log 1984-11B',
        location: 'North Atlantic Listening Array',
        text: 'Signal analysts pulled archived wartime logs and compared the keystrokes. The message didn’t just use the Ironwood’s four-letter call sign—it matched the original radio officer’s personal wrist timing down to millisecond pauses.',
        openLoop: 'At first, duty officers assumed it was an elaborate amateur hoax. Until they measured the elevation angle.',
        visual: {
          quote: 'Call sign WLM-4 verified. Fist spacing matches 1943 convoy tape #19 within 4% tolerance.',
          attribution: 'Coastal Signal Verification Log',
          accentStat: '40 yrs',
          statLabel: 'elapsed since the ship was dismantled'
        }
      },
      {
        beatNumber: 2,
        visualMode: 'signal_waveform',
        accentColor: '#d98a4e',
        headline: 'Bouncing Off an Invisible Atmospheric Corridor',
        dateLabel: '21.8 MHz Dead Band',
        location: 'Ionosphere F-Layer',
        text: 'Directional bearings showed the burst wasn’t rising from any ship hull on the water. Instead, the carrier wave was dropping steeply from a high-altitude plasma duct where solar storms occasionally trap radio waves in long-delay reflection loops.',
        openLoop: 'Yet standard plasma echoes decay within three seconds—so how did this signal carry a clear 1944 timestamp?',
        visual: {
          waveformLabel: '21.8 MHz Carrier Trace · Anomalous Delay Window',
          waveformBars: [22, 48, 86, 35, 92, 64, 28, 78, 95, 42, 68, 30],
          accentStat: 'F2 Duct',
          statLabel: 'ionospheric wave-trap altitude (~300 km)'
        }
      },
      {
        beatNumber: 3,
        visualMode: 'map',
        accentColor: '#7bb095',
        headline: 'Three Coordinates Missing From Wartime Charts',
        dateLabel: 'Convoy Route HX-28',
        location: 'Halifax to Liverpool Corridor',
        text: 'When engineers decoded the trailing coordinates inside the static, they pointed to an unrecorded cold-water weather station buoy retrofitted from salvaged wartime transmitters during a solar storm test.',
        openLoop: 'Wait—was it natural ionospheric trapping, salvage hardware, or a human decoy? Look closely at the clues before you vote.',
        visual: {
          route: ['Halifax Yard', 'Mid-Atlantic Ridge', 'F2 Plasma Duct', 'Listening Post'],
          accentStat: '3 clues',
          statLabel: 'wrist cadence · skyward angle · salvaged crystal'
        }
      }
    ],
    chatCheckpoint: {
      countdownSec: 16,
      prompt: 'WHAT EXPLAINS THE 1984 SIGNAL?',
      options: [
        'A) A Long-Delayed Ionospheric Echo trapping the original 1944 wave for 40 years',
        'B) A salvaged wartime transmitter crystal re-broadcasting a recorded test loop',
        'C) A misread Soviet coastal submarine beacon using allied encryption'
      ],
      correctIndex: 1
    },
    resolution: {
      reveal: 'Answer B: Long-Delayed Echoes (LDEs) are real atmospheric phenomena—but they hold signals for seconds, never four decades. Salvaged wartime spark-crystal oscillators and test-tape loops reused by remote automated stations occasionally re-keyed old ship identifiers during solar spikes.',
      flawEveryoneMisses: 'Most viewers jump straight to the sci-fi explanation ("40-year plasma trap") because both ionospheric echoes and the 40-year gap sound exotic—missing that physics caps LDE storage at seconds, while surplus military hardware stayed in field closets for half a century.',
      whyItMatters: 'Checking physical decay limits separates real atmospheric science from maritime legend.',
      nextStoryBridge: 'Speaking of messages sealed inside overlooked places—wait until you hear why an ancient desert cave held treasure coordinates nobody could read until copper was sliced open...'
    }
  },
  {
    id: 'dead-sea-copper-scroll',
    title: 'Cave 3’s Uncrackable Copper Treasure Map',
    subtitle: 'Why one Qumran scroll wasn’t written on parchment—and listed 64 buried vaults of gold',
    category: 'biblical',
    era: '1st Century CE',
    archetype: 'biblical_mystery',
    pacingProfile: 'rapid_dilemma',
    accentColor: '#cfa35a',
    audioBedPreference: 'sacred',
    hook: {
      durationSec: 9,
      badge: 'ARCHIVE CASE #014 · QUMRAN CAVE 3',
      headline: 'THE ONLY DEAD SEA SCROLL HAMMERED INTO SOLID COPPER',
      narration: 'Among nearly a thousand fragile leather and papyrus scrolls pulled from Qumran caves, archaeologists froze when Cave Three yielded two riveted rolls of pure green-oxidized copper.'
    },
    beats: [
      {
        beatNumber: 1,
        visualMode: 'artifact',
        accentColor: '#cfa35a',
        headline: 'Too Brittle to Unroll—Until a Jewelry Saw Split It',
        dateLabel: '1952 – 1955 Discovery',
        location: 'Qumran Cave 3 · Dead Sea',
        text: 'Unlike every prayer book, Isaiah manuscript, and community rule found nearby, this scroll was 99% copper—so corroded by nineteen centuries that touching it risked shattering every letter into dust.',
        openLoop: 'When Manchester engineers finally sliced it into twenty-three narrow strips, translators expected another hymn. Instead, they gasped.',
        visual: {
          artifactName: 'The Copper Scroll (3Q15)',
          material: '99% hammered copper sheets, originally riveted (~2.4 m)',
          provenance: 'Qumran Cave 3 · Amman Citadel Archive',
          accentStat: '23 strips',
          statLabel: 'precision diamond-saw cuts required to read it'
        }
      },
      {
        beatNumber: 2,
        visualMode: 'evidence_card',
        accentColor: '#d08262',
        headline: 'Sixty-Four Locations of Hidden Silver and Gold',
        dateLabel: 'Columns I – XII',
        location: 'Jerusalem & Judean Hills',
        text: 'The metal ledger didn’t preach a sermon. It barked crisp survey directions: paces under ruined cisterns, stairs leading east, and tombs holding chests of silver ingots, temple vessels, and priestly vestments.',
        openLoop: 'Yet look at the total tally: over 4,600 talents of precious metal—roughly 150 tons. Why chisel an unsearchable map into expensive copper?',
        visual: {
          quote: 'In the salt pit that is under the steps: forty-two talents of silver.',
          attribution: 'Copper Scroll 3Q15 · Column II',
          accentStat: '64 sites',
          statLabel: 'cataloged underground caches across Judea'
        }
      },
      {
        beatNumber: 3,
        visualMode: 'comparison',
        accentColor: '#7bb095',
        headline: 'Temple Treasury Ledger vs. Monastic Folklore',
        dateLabel: '66 – 70 CE Siege Window',
        location: 'Jerusalem Temple Mount',
        text: 'One detail stood out to linguists: the copper uses practical Mishnaic Hebrew—street vocabulary used by city builders and temple stewards—rather than the poetic literary Hebrew of the Qumran sect.',
        openLoop: 'Before Roman legions breached Jerusalem’s walls in 70 CE, why would anyone bury a metal inventory miles away in a desert cliff?',
        visual: {
          leftTitle: 'Parchment Qumran Scrolls',
          leftItems: [
            'Scriptural copies & sect hymns',
            'Classical literary Hebrew ink',
            'Designed for weekly community study'
          ],
          rightTitle: '3Q15 Copper Scroll',
          rightItems: [
            'Pure inventory & pace measurements',
            'Colloquial steward Hebrew + Greek letters',
            'Fire-resistant metal built to outlast a siege'
          ]
        }
      }
    ],
    chatCheckpoint: {
      countdownSec: 16,
      prompt: 'WHY WAS 3Q15 HAMMERED ONTO COPPER?',
      options: [
        'A) A purely mythical fable written by medieval travelers',
        'B) A fire-proof emergency record of hidden Temple assets before 70 CE',
        'C) A Roman tax receipt forged by desert smugglers'
      ],
      correctIndex: 1
    },
    resolution: {
      reveal: 'Answer B: Most historians conclude 3Q15 was an emergency disaster ledger hammered onto metal so it could survive fire and dampness if Jerusalem fell—recording dispersed priestly caches just before the 70 CE Roman siege.',
      flawEveryoneMisses: 'Viewers often assume "Qumran Cave = Qumran Sect," ignoring that the Copper Scroll uses completely different Hebrew grammar, spelling, and Greek code letters from the monastery’s own library.',
      whyItMatters: 'Material choice—ink on skin versus chisel on copper—reveals when a text was meant for daily reading versus post-catastrophe recovery.',
      nextStoryBridge: 'From hidden desert ledgers to a locked harbor chain nobody thought a navy could cross—next, watch how seventy warships vanished off the sea...'
    }
  },
  {
    id: 'constantinople-chains',
    title: 'Seventy Ships Carried Over a Mountain Overnight',
    subtitle: 'How one unexpected engineering maneuver broke a thousand-year harbor barrier in 1453',
    category: 'world-history',
    era: 'April 1453',
    archetype: 'historical_heist',
    pacingProfile: 'fast_investigative',
    accentColor: '#e07a5f',
    audioBedPreference: 'focus',
    hook: {
      durationSec: 9,
      badge: 'CASE #089 · SIEGE OF 1453',
      headline: 'THE MORNING SENTRIES LOOKED AT THE HARBOR—AND SAW ENEMY SAILS BEHIND THEIR WALLS',
      narration: 'On April 22, 1453, Byzantine lookouts woke up to an impossible sight: seventy Ottoman galleys floating calmly inside a harbor sealed tight by an iron sea chain.'
    },
    beats: [
      {
        beatNumber: 1,
        visualMode: 'artifact',
        accentColor: '#e07a5f',
        headline: 'The Iron Boom That No Fleet Could Ram',
        dateLabel: 'April 2 – 20, 1453',
        location: 'Entrance of the Golden Horn',
        text: 'Constantinople’s weakest flank faced the calm Golden Horn inlet—so defenders stretched a massive wrought-iron chain across floating wooden logs from tower to tower, guarding their thin sea wall with just two dozen ships.',
        openLoop: 'For three weeks, Ottoman admiral ships bounced helplessly off the boom. Then Sultan Mehmed II stopped attacking the water.',
        visual: {
          artifactName: 'Golden Horn Iron Boom Chain',
          material: '50-cm forged wrought-iron links buoyed on timber floats',
          provenance: 'Preserved fragment · Istanbul Military Museum',
          accentStat: '300+ m',
          statLabel: 'armored chain span locking out naval assault'
        }
      },
      {
        beatNumber: 2,
        visualMode: 'map',
        accentColor: '#cfa35a',
        headline: 'A Greased Timber Highway Over the Pera Hills',
        dateLabel: 'Night of April 21–22',
        location: 'Bosporus to Valley of Springs',
        text: 'While giant siege cannons pounded the western land walls to drown out the noise, thousands of carpenters laid greased wooden rollers up a steep 200-foot hill behind neutral Genoese Galata.',
        openLoop: 'Oxen teams hauled ships with sails still raised over dry dirt—yet one fatal flaw made the whole maneuver nearly impossible to pull off silently.',
        visual: {
          route: ['Dolmabahçe Cove', '200 ft Ridge Climb', 'Galata Back-Slope', 'Golden Horn'],
          accentStat: '72 ships',
          statLabel: 'dragged overland in a single moonless night'
        }
      },
      {
        beatNumber: 3,
        visualMode: 'comparison',
        accentColor: '#7bb095',
        headline: 'Diversion Artillery vs. Thin Sea Walls',
        dateLabel: 'Dawn, April 22',
        location: 'Golden Horn Interior',
        text: 'Lookouts never suspected an overland fleet because Genoese merchants in Galata controlled the hillside—and cannon smoke along the land walls kept every eye pointed southwest.',
        openLoop: 'Once those seventy hulls splashed inside the chain, what tactical shock forced the Byzantines into an unwinnable choice?',
        visual: {
          leftTitle: 'Before April 22',
          leftItems: [
            'Harbor sealed by 1 iron chain',
            'Defenders massed on land walls',
            'Galleys safe behind boom'
          ],
          rightTitle: 'After Dawn Splashdown',
          rightItems: [
            'Two-front perimeter forced open',
            'Thin sea-walls suddenly exposed',
            'Defender manpower halved across 12 miles'
          ]
        }
      }
    ],
    chatCheckpoint: {
      countdownSec: 15,
      prompt: 'WHY DID BYZANTINE WATCHERS MISS 72 SHIPS CROSSING DRY LAND?',
      options: [
        'A) Fog blinded every tower on the Bosporus',
        'B) Artillery fire & neutral Galata hills masked the greased roller route',
        'C) Ottoman ships sailed underwater beneath the chain floats'
      ],
      correctIndex: 1
    },
    resolution: {
      reveal: 'Answer B: Mehmed paired diversionary cannon fire with greased timber tracks routed quietly behind neutral Galata—turning defensive geography upside down overnight.',
      flawEveryoneMisses: 'Many summaries treat the overland portage as an isolated stunt; in reality, it succeeded because artillery thunder masked construction noise and neutral merchant hills shielded the slope.',
      whyItMatters: 'Fortifications fail when defenders guard yesterday’s doorway while opponents build a new road around the lock.',
      nextStoryBridge: 'If moving ships over hills sounds audacious, wait until you read how two ordinary midwives quietly defeated a superpower’s royal decree...'
    }
  },
  {
    id: 'exodus-midwives-dossier',
    title: 'The Palace Decree That Backfired at Dawn',
    subtitle: 'Why Exodus names two obscure midwives before ever naming Pharaoh',
    category: 'biblical',
    era: 'Bronze Age Sanctuary Narrative',
    archetype: 'ethical_dilemma',
    pacingProfile: 'slow_psychological',
    accentColor: '#7bb095',
    audioBedPreference: 'sacred',
    hook: {
      durationSec: 9,
      badge: 'TEXTUAL CASE #002 · EXODUS CHAPTER 1',
      headline: 'THE KING HAD AN ARMY—YET TWO WOMEN STOPPED HIS DECREE WITH FOUR WORDS',
      narration: 'Exodus opens with the mightiest ruler in the ancient world issuing a secret infanticide order—and records the exact names of Shiphrah and Puah while leaving Pharaoh nameless.'
    },
    beats: [
      {
        beatNumber: 1,
        visualMode: 'document',
        accentColor: '#7bb095',
        headline: 'A Secret Order Inside the Birthing Room',
        dateLabel: 'Exodus 1:15–17',
        location: 'Eastern Nile Delta',
        text: 'Pharaoh hoped to crush a growing enslaved population silently, before panic spread—ordering two chief midwives to kill every newborn boy right on the birthing stones while sparing girls.',
        openLoop: 'When Pharaoh summoned them weeks later because Hebrew boys were still everywhere, they didn’t flee. They stood before the throne with a clever answer.',
        visual: {
          quote: 'The midwives, however, feared God and did not do what the king of Egypt had told them to do; they let the boys live.',
          attribution: 'Exodus 1:17 · Narrative Turn',
          accentStat: '2 names',
          statLabel: 'preserved where the empire’s king stays unnamed'
        }
      },
      {
        beatNumber: 2,
        visualMode: 'evidence_card',
        accentColor: '#cfa35a',
        headline: 'Turning Royal Prejudice Against the Crown',
        dateLabel: 'Exodus 1:19',
        location: 'Royal Audience Hall',
        text: 'Asked why the decree had stalled, Shiphrah and Puah exploited Egyptian stereotypes about hardy brick-yard laborers: "Hebrew women are not like Egyptian women; they are vigorous and give birth before the midwife arrives."',
        openLoop: 'Unable to prove treason without stationing guards in every hut, Pharaoh escalated publicly—driving the story straight toward a river basket.',
        visual: {
          quote: 'They are vigorous and give birth before the midwife can arrive.',
          attribution: 'Shiphrah & Puah · Diplomatic Subversion',
          accentStat: '0 troops',
          statLabel: 'could police every private home after their alibi'
        }
      },
      {
        beatNumber: 3,
        visualMode: 'map',
        accentColor: '#5b9bd5',
        headline: 'From Secret Resistance to Sinai Charter',
        dateLabel: 'Exodus 2 → 19',
        location: 'Goshen to Mount Horeb',
        text: 'One spared infant placed in a tar-sealed reed ark was raised in the very palace that targeted him—linking civil courage in chapter one directly to Israel’s liberation and wilderness law at Sinai.',
        openLoop: 'Pause here: why does the biblical narrator leave Egypt’s sovereign ruler unnamed while recording two working-class names forever?',
        visual: {
          route: ['Birthing Houses', 'Nile Reeds', 'Midian Exile', 'Sinai'],
          accentStat: '40 yrs',
          statLabel: 'between the midwives’ defiance and the mountain covenant'
        }
      }
    ],
    chatCheckpoint: {
      countdownSec: 15,
      prompt: 'WHY DOES EXODUS RECORD SHIPHRAH & PUAH BY NAME BUT NOT PHARAOH?',
      options: [
        'A) Scribes lost the royal dynasty lists during exile',
        'B) It inverts ancient power—moral courage outlives imperial titles',
        'C) Midwives held higher palace rank than Egyptian ministers'
      ],
      correctIndex: 1
    },
    resolution: {
      reveal: 'Answer B: Ancient kings carved their names on granite obelisks to achieve immortality. By stripping Pharaoh of a name while preserving two women who resisted him, Exodus declares moral conscience outlasts raw empire.',
      flawEveryoneMisses: 'Many readers spend hours trying to guess which historical Pharaoh ruled in Exodus 1—missing that the omission of his name is a deliberate literary verdict, not an accidental memory gap.',
      whyItMatters: 'History often changes through quiet non-compliance in ordinary rooms long before dramatic armies ever march.',
      nextStoryBridge: 'And speaking of storms at sea—next we track a prisoner transport caught in fourteen pitch-black nights where sailors dropped lead weights into invisible water...'
    }
  },
  {
    id: 'paul-malta-drift',
    title: 'Fourteen Nights Adrift With Zero Stars',
    subtitle: 'How ancient sounding lines in Acts 27 pinpointed land in pitch-black gale darkness',
    category: 'biblical',
    era: 'c. 59 CE · Mediterranean',
    archetype: 'survival_scenario',
    pacingProfile: 'rapid_dilemma',
    accentColor: '#4e9aa8',
    audioBedPreference: 'ambient',
    hook: {
      durationSec: 9,
      badge: 'MARITIME LOG #027 · ACTS CHAPTER 27',
      headline: '276 SOULS DRIFTING BLIND—THEN AT MIDNIGHT THE DEPTH SUDDENLY DROPPED FIVE FATHOMS',
      narration: 'For fourteen straight days under hurricane skies without sun or stars, a Roman grain ship drifted helplessly—until sailors heard breaking surf in dead darkness.'
    },
    beats: [
      {
        beatNumber: 1,
        visualMode: 'signal_waveform',
        accentColor: '#4e9aa8',
        headline: 'Twenty Fathoms... Then Fifteen Fathoms',
        dateLabel: 'Night 14 · Midnight Watch',
        location: 'Approaching St. Paul’s Bay, Malta',
        text: 'Crews tossed greased lead weights on knotted ropes into foaming water. First reading: twenty fathoms—about one hundred twenty feet. Moments later: fifteen fathoms—ninety feet. Something steep was rising straight toward the keel.',
        openLoop: 'Four anchors dropped from the stern to keep the bow pointed toward dawn. Yet a split inside the crew nearly doomed everyone onboard.',
        visual: {
          waveformLabel: 'Fathom Depth Soundings · 20 → 15 → Shoal',
          waveformBars: [92, 88, 84, 72, 60, 48, 34, 24, 18, 12, 16, 22],
          accentStat: '276',
          statLabel: 'passengers and crew aboard the Alexandrian grain ship'
        }
      },
      {
        beatNumber: 2,
        visualMode: 'evidence_card',
        accentColor: '#e07a5f',
        headline: 'Pretending to Drop Bow Anchors While Lowering the Skiff',
        dateLabel: 'Acts 27:30–32',
        location: 'Stern & Bow Decks',
        text: 'Professional sailors quietly untied the ship’s lifeboat under cover of darkness, claiming they were laying forward anchors—planning to abandon prisoners and soldiers on the breaking hull.',
        openLoop: 'Notice who spotted the betrayal first: not the centurion, nor the shipmaster—and cutting the ropes left zero safety net.',
        visual: {
          quote: 'Unless these men stay with the ship, you cannot be saved.',
          attribution: 'Paul to Centurion Julius · Acts 27:31',
          accentStat: '0 boats',
          statLabel: 'remaining once Roman soldiers severed the ropes'
        }
      },
      {
        beatNumber: 3,
        visualMode: 'map',
        accentColor: '#cfa35a',
        headline: 'The Sandbar Where Two Currents Met',
        dateLabel: 'Daybreak · Shoal Strike',
        location: 'Crete → Adriatic Drift → Malta',
        text: 'Modern oceanographers traced wind vectors from Crete: a northeast Euroaquilo gale pushes an Alexandrian hull at ~1.5 knots—landing almost precisely on Malta’s St. Paul’s Bay after 476 nautical miles.',
        openLoop: 'With the hull wedged fast in reef clay and waves tearing the stern apart, Roman guards faced a brutal standard rule about escaping prisoners.',
        visual: {
          route: ['Fair Havens', 'Cauda Island', '14-Night Drift', 'St. Paul’s Bay'],
          accentStat: '476 nm',
          statLabel: 'drifted west-northwest matching modern wind models'
        }
      }
    ],
    chatCheckpoint: {
      countdownSec: 15,
      prompt: 'WHY DID SAILORS DROP ANCHORS FROM THE STERN INSTEAD OF THE BOW?',
      options: [
        'A) Ancient grain ships lacked forward anchor hawses',
        'B) It keeps the bow pointed landward so they can cut cables and beach cleanly at dawn',
        'C) It reverses wind direction away from limestone reefs'
      ],
      correctIndex: 1
    },
    resolution: {
      reveal: 'Answer B: Dropping stern anchors prevents a wooden ship from broaching sideways in surf, holding the bow pointed straight toward the beach so crew can cut the ropes and drive ashore at first light.',
      flawEveryoneMisses: 'Most land-bound readers miss that "four anchors from the stern" is rare, hyper-specific ancient seamanship—something nineteenth-century Royal Navy captains verified matches Malta’s exact holding mud.',
      whyItMatters: 'Eyewitness nautical precision turns a dramatic rescue narrative into one of the most verifiable survival logs of the ancient Mediterranean.',
      nextStoryBridge: 'From a ship saved by cutting ropes to a superpower undone by what it shaved out of its own pocket change...'
    }
  },
  {
    id: 'rome-silver-collapse',
    title: 'The Coin That Hollowed Out a Superpower',
    subtitle: 'How Rome’s silver denarius shrank from 95% pure bullion to a copper wash',
    category: 'world-history',
    era: '161 – 476 CE',
    archetype: 'historical_anomaly',
    pacingProfile: 'fast_investigative',
    accentColor: '#d08262',
    audioBedPreference: 'ambient',
    hook: {
      durationSec: 9,
      badge: 'ECONOMIC AUTOPSY #019 · ROMAN MINTS',
      headline: 'NO FOREIGN ARMY BREACHED ROME’S GATES FOR 800 YEARS—SO WHY DID ITS TREASURY COLLAPSE FIRST?',
      narration: 'Before Alaric ever reached Rome’s gates, merchants across three continents stopped trusting the empire’s signature silver coin—because the silver inside had quietly vanished.'
    },
    beats: [
      {
        beatNumber: 1,
        visualMode: 'artifact',
        accentColor: '#d08262',
        headline: 'From Pure Silver Bullion to Copper Wash',
        dateLabel: '180 – 270 CE',
        location: 'Imperial Mints Across Europe',
        text: 'Emperors needed triple the coins to pay border legions during civil wars, yet mines produced less ore. Mint masters began melting older coins and diluting them with copper until a late "silver" antoninianus contained barely 2 to 5 percent silver.',
        openLoop: 'Soldiers quickly figured out the trick by scratching coins with knives—demanding raises or payment in grain and cloth instead.',
        visual: {
          artifactName: 'Debased Antoninianus',
          material: 'Bronze core coated in < 5% silver surface wash',
          provenance: 'Third-Century Imperial Mints',
          accentStat: '95% → 3%',
          statLabel: 'crash in silver purity over 80 years'
        }
      },
      {
        beatNumber: 2,
        visualMode: 'timeline',
        accentColor: '#cfa35a',
        headline: 'Twenty Emperors in Fifty Chaos Years',
        dateLabel: '235 – 284 CE',
        location: 'Rhine, Danube & Syrian Frontiers',
        text: 'Once legions learned they could auction the throne to whichever general promised higher pay, stability evaporated. Twenty-plus rulers claimed Rome in fifty years; almost all died by mutiny.',
        openLoop: 'Splitting the empire East and West finally restored order—yet created two mismatched economies staring down the same storm.',
        visual: {
          points: [
            '235 CE — Rhine legions assassinate Severus Alexander over frontier pay',
            '260 CE — Empire breaks into three rival states during Persian war',
            '270 CE — Aurelian builds defensive brick walls around Rome itself',
            '284 CE — Diocletian splits command into East and West'
          ]
        }
      },
      {
        beatNumber: 3,
        visualMode: 'comparison',
        accentColor: '#5b9bd5',
        headline: 'Why the East Survived 1,000 Years Longer',
        dateLabel: '376 – 476 CE',
        location: 'Ravenna vs. Constantinople',
        text: 'Eastern cities retained gold trade routes from Egypt and Syria, paying off threats or redirecting migrations westward—leaving western emperors defending longer river borders with hollowed-out tax rolls.',
        openLoop: 'When young Romulus Augustulus stepped down in 476 CE, why didn’t Constantinople even send a fleet to stop it?',
        visual: {
          leftTitle: 'Western Provinces',
          leftItems: [
            'Expensive Rhine & Danube defenses',
            'Contracting urban tax base',
            'Mercenary generals hold real power'
          ],
          rightTitle: 'Eastern Empire',
          rightItems: [
            'Gold solidus holds steady value',
            'Syrian & Egyptian trade surplus',
            'Outlasts the West by 977 years'
          ]
        }
      }
    ],
    chatCheckpoint: {
      countdownSec: 15,
      prompt: 'WHAT TRIGGERED ROME’S THIRD-CENTURY SPIRAL FIRST?',
      options: [
        'A) A single decisive defeat at Hadrian’s Wall',
        'B) Currency debasement + soldier-driven succession coups',
        'C) Complete abandonment of Latin across Italy'
      ],
      correctIndex: 1
    },
    resolution: {
      reveal: 'Answer B: Currency debasement wrecked fiscal trust, fueling mutinous army succession crises long before fifth-century invasions fractured the western frontier.',
      flawEveryoneMisses: 'Pop history treats "The Fall of Rome" like a single military knockout in 476 CE—ignoring that the eastern Roman half thrived for nearly another thousand years with unbroken gold coinage.',
      whyItMatters: 'Great states rarely fall solely from outside pressure; they fracture when internal trust and fiscal discipline erode first.',
      nextStoryBridge: 'If Rome struggled to guard its borders, imagine an entire ancient library that legally confiscated every book carried onboard visiting cargo ships...'
    }
  },
  {
    id: 'alexandria-ghost-catalog',
    title: 'Why Alexandria Seized Every Book on Every Ship',
    subtitle: 'The ruthless harbor customs rule—and why the Great Library didn’t die in one fire',
    category: 'world-history',
    era: '3rd Century BCE – 3rd Century CE',
    archetype: 'historical_heist',
    pacingProfile: 'rapid_dilemma',
    accentColor: '#9b82c4',
    audioBedPreference: 'focus',
    hook: {
      durationSec: 9,
      badge: 'ARCHIVE HEIST #031 · PTOLEMAIC HARBOR',
      headline: 'CUSTOMS INSPECTORS BOARDED EVERY SHIP—NOT FOR GOLD, BUT FOR PRIVATE SCROLLS',
      narration: 'Ships docking at Alexandria were boarded by armed royal clerks who confiscated every manuscript onboard—and legally kept the originals while returning hurried copies.'
    },
    beats: [
      {
        beatNumber: 1,
        visualMode: 'evidence_card',
        accentColor: '#9b82c4',
        headline: 'The "Fund of the Ships" Book Confiscation',
        dateLabel: 'c. 250 BCE',
        location: 'Great Harbor of Alexandria',
        text: 'Physician Galen recorded the ruthless system: Alexandria’s kings paid immense silver deposits to borrow Athens’s official playbooks—then forfeited the huge deposit just to keep the priceless originals in their vault.',
        openLoop: 'With up to half a million scrolls stacked across halls, why do modern scholars say the Library wasn’t destroyed by one dramatic inferno?',
        visual: {
          quote: 'Every book brought ashore by visitors was seized, copied on fresh papyrus, and the original tagged "From the Ships."',
          attribution: 'Galen · Commentary on Hippocrates',
          accentStat: '400k+',
          statLabel: 'cataloged scrolls labeled by port provenance'
        }
      },
      {
        beatNumber: 2,
        visualMode: 'document',
        accentColor: '#cfa35a',
        headline: 'Julius Caesar’s Dockside Warehouse Fire',
        dateLabel: '48 BCE',
        location: 'Alexandria Waterfront',
        text: 'During Caesar’s Alexandrian civil war, flames swept dockside warehouses storing grain and exported scroll crates—burning tens of thousands of rolls waiting for transport or overflow storage.',
        openLoop: 'Yet Strabo visited Alexandria twenty-five years later and still studied inside thriving royal halls. So what actually finished the collection?',
        visual: {
          quote: 'Forty thousand books happened to be burned near the harbor docks during the battle.',
          attribution: 'Seneca & Plutarch Accounts · 1st Century CE',
          accentStat: '25 yrs later',
          statLabel: 'scholars still cited active halls inside Alexandria'
        }
      },
      {
        beatNumber: 3,
        visualMode: 'comparison',
        accentColor: '#7bb095',
        headline: 'One Dramatic Myth vs. Three Centuries of Neglect',
        dateLabel: '48 BCE – 272 CE',
        location: 'Royal Quarter (Bruchion)',
        text: 'Budgets dried up under later wars, emperors cut scholarly stipends, papyrus rotted in humid Mediterranean air unless copied every few decades, and Emperor Aurelian’s 272 CE siege leveled the entire Royal Quarter.',
        openLoop: 'Look closely at all three centuries: why is blaming a single villain historically inaccurate?',
        visual: {
          leftTitle: 'Popular Myth',
          leftItems: [
            'All human knowledge in 1 room',
            'Destroyed in a single dramatic fire',
            'Set knowledge back 1,000 years'
          ],
          rightTitle: 'Archival Evidence',
          rightItems: [
            'Copies existed in Pergamum & Rome',
            'Lost gradually to budget cuts & war',
            'Papyrus decays without active copying'
          ]
        }
      }
    ],
    chatCheckpoint: {
      countdownSec: 15,
      prompt: 'WHAT SILENTLY DESTROYED MOST ANCIENT TEXTS AT ALEXANDRIA?',
      options: [
        'A) A single night fire in 48 BCE wiped out every scroll worldwide',
        'B) Centuries of war, defunded scribes, and humid papyrus decay',
        'C) Royal librarians dumped scrolls into the Mediterranean'
      ],
      correctIndex: 1
    },
    resolution: {
      reveal: 'Answer B: While Caesar’s dock fire, Aurelian’s 272 CE battle, and later unrest each inflicted blows, the true killer of ancient knowledge was loss of funding to recopy fragile papyrus every generation.',
      flawEveryoneMisses: 'Everyone imagines one cinematic blaze turning paper to ash overnight—overlooking that papyrus turns brittle and unreadable within a century unless someone keeps paying scribes to copy it.',
      whyItMatters: 'Knowledge isn’t preserved by building a vault once; it survives only when each generation invests in copying and teaching it.',
      nextStoryBridge: 'Now jump forward a millennium to the invention that finally broke fragile hand-copying forever—and the bitter courtroom trap that bankrupted its inventor...'
    }
  },
  {
    id: 'gutenberg-ledger-trap',
    title: 'The Quiet Lawsuit That Seized the Printing Press',
    subtitle: 'How Gutenberg’s financier foreclosed right as the first 42-line Bibles hit the market',
    category: 'world-history',
    era: '1450 – 1455 CE · Mainz',
    archetype: 'ethical_dilemma',
    pacingProfile: 'slow_psychological',
    accentColor: '#c9a25e',
    audioBedPreference: 'sacred',
    hook: {
      durationSec: 9,
      badge: 'COURT ARCHIVE #055 · MAINZ, 1455',
      headline: 'HE INVENTED MOVABLE METAL TYPE—THEN LOST HIS OWN WORKSHOP DAYS BEFORE SELLING A SINGLE BIBLE',
      narration: 'In November 1455, right as Europe’s first printed Bibles neared completion, goldsmith Johannes Gutenberg walked into a Mainz courtroom and lost control of his presses forever.'
    },
    beats: [
      {
        beatNumber: 1,
        visualMode: 'evidence_card',
        accentColor: '#c9a25e',
        headline: 'The Helmasperger Notarial Parchment',
        dateLabel: 'November 6, 1455',
        location: 'Barefoot Friars Convent, Mainz',
        text: 'Wealthy investor Johann Fust had loaned Gutenberg 1,600 guilders—enough to buy twenty houses—to build the secret alloy molds, oil-based ink, and oak presses.',
        openLoop: 'Just weeks before finished Bibles could repay the debt, Fust demanded immediate repayment with compound interest. Why right then?',
        visual: {
          quote: 'I demand accounting for the 1,600 guilders spent upon the work of the books, plus interest.',
          attribution: 'Johann Fust · Helmasperger Instrument, 1455',
          accentStat: '1,600 fl.',
          statLabel: 'capital loan triggering workshop foreclosure'
        }
      },
      {
        beatNumber: 2,
        visualMode: 'comparison',
        accentColor: '#5b9bd5',
        headline: 'Inventor’s Perfectionism vs. Investor’s Patience',
        dateLabel: '1452 – 1455 Production',
        location: 'Mainz Printshop',
        text: 'Gutenberg obsessed over 290 separate ligature characters so printed pages rivaled luxury cathedral manuscripts—slowing deliveries while Fust noticed Gutenberg’s lead assistant, Peter Schöffer, already understood the whole trade.',
        openLoop: 'Fust won the suit, took the primary presses, and immediately partnered with Gutenberg’s top apprentice. Look at what neither of them printed on the cover.',
        visual: {
          leftTitle: 'Johannes Gutenberg',
          leftItems: [
            'Perfected tin-lead-antimony alloy',
            'Designed 290 calligraphic glyphs',
            'Walked away stripped of primary presses'
          ],
          rightTitle: 'Fust & Schöffer',
          rightItems: [
            'Seized workshop & half the print run',
            'Published the 1457 Mainz Psalter',
            'Stamped their own names on the colophon'
          ]
        }
      },
      {
        beatNumber: 3,
        visualMode: 'artifact',
        accentColor: '#7bb095',
        headline: 'Zero Signatures on the Greatest Book of the Age',
        dateLabel: 'c. 1455 Edition',
        location: 'Mainz → Frankfurt Book Fair',
        text: 'Not a single copy of the 180 original 42-line Bibles bears Gutenberg’s printed name inside—yet forty-nine surviving copies prove Europe’s information floodgate could never be closed again.',
        openLoop: 'Wait—did Gutenberg die penniless in obscurity, or did one surprising twist rescue his final years?',
        visual: {
          artifactName: '42-Line Gutenberg Bible',
          material: 'Rag paper & calfskin vellum · oil-lampblack ink',
          provenance: '~180 printed · 49 surviving today',
          accentStat: '290 glyphs',
          statLabel: 'hand-cast metal punches mimicked live quill strokes'
        }
      }
    ],
    chatCheckpoint: {
      countdownSec: 15,
      prompt: 'WHY DID GUTENBERG’S NAME NEVER APPEAR ON HIS 42-LINE BIBLE?',
      options: [
        'A) Printing books was illegal across Germany until 1500',
        'B) Foreclosure transferred the presses right at publication, and early Bibles imitated anonymous manuscripts',
        'C) He used a secret pen name to hide from Frankfurt guild scribes'
      ],
      correctIndex: 1
    },
    resolution: {
      reveal: 'Answer B: Early printed books intentionally imitated anonymous handwritten choir Bibles—and Fust’s 1455 foreclosure stripped Gutenberg’s ownership just as sales began. Later, Mainz’s Archbishop granted Gutenberg a lifelong grain and wine pension.',
      flawEveryoneMisses: 'People often say "Gutenberg died broke and forgotten." In reality, he ran a smaller press again and received an honored court stipend from Archbishop Adolf of Nassau in 1465.',
      whyItMatters: 'Technical breakthroughs rarely enrich their inventors automatically; timing, contracts, and apprentices shape who scales them.',
      nextStoryBridge: 'From a Mainz courtroom to a Babylonian banquet hall—how one buried clay cylinder solved a biblical riddle critics mocked for two hundred years...'
    }
  },
  {
    id: 'belshazzar-nabonidus-cylinder',
    title: 'The Missing King Who Proved Critics Wrong',
    subtitle: 'Why Daniel 5 offered "third ruler in the kingdom"—and what desert clay finally revealed',
    category: 'biblical',
    era: '539 BCE / 1854 CE',
    archetype: 'biblical_mystery',
    pacingProfile: 'fast_investigative',
    accentColor: '#d49a4c',
    audioBedPreference: 'sacred',
    hook: {
      durationSec: 9,
      badge: 'EXCAVATION CASE #005 · UR OF THE CHALDEES',
      headline: 'FOR CENTURIES NO ANCIENT LIST NAMED KING BELSHAZZAR—UNTIL A CRUMBLED CLAY CYLINDER TURNED UP',
      narration: 'For two hundred years skeptics dismissed Daniel chapter five because every Greek chronicle insisted Nabonidus, never Belshazzar, was Babylon’s final king.'
    },
    beats: [
      {
        beatNumber: 1,
        visualMode: 'evidence_card',
        accentColor: '#d49a4c',
        headline: 'A Strange Detail Inside Daniel Chapter Five',
        dateLabel: '539 BCE · Babylon Banquet',
        location: 'Euphrates Royal Palace',
        text: 'When mysterious handwriting appeared on the plaster wall during Babylon’s final feast, panicked Belshazzar didn’t promise to make the interpreter second in the kingdom—he offered "third ruler in the kingdom."',
        openLoop: 'Why offer THIRD place instead of second, if Belshazzar himself were truly sole king on the throne?',
        visual: {
          quote: 'Whoever reads this writing... shall be clothed in purple and be made third ruler in the kingdom.',
          attribution: 'Daniel 5:7 · Exact Constitutional Clue',
          accentStat: '3rd place',
          statLabel: 'highest vacant rank available to offer'
        }
      },
      {
        beatNumber: 2,
        visualMode: 'artifact',
        accentColor: '#7bb095',
        headline: 'Excavated Under Mudbrick at Ur in 1854',
        dateLabel: '1854 Archaeological Find',
        location: 'Ziggurat Foundation · Southern Iraq',
        text: 'British consul J.E. Taylor pulled four small baked cuneiform cylinders from corner bricks of Ur’s temple—carved in the name of Nabonidus, Babylon’s absent ruler living ten years away in desert Tema.',
        openLoop: 'Reading line twenty-four stunned Assyriologists: Nabonidus explicitly prayed for "Bel-shar-usur, my eldest son."',
        visual: {
          artifactName: 'Nabonidus Cylinder of Ur',
          material: 'Baked cuneiform clay barrel seal (British Museum)',
          provenance: 'Cornerstone of Moon-God Ziggurat · Ur',
          accentStat: '10 yrs',
          statLabel: 'Nabonidus stayed absent in Arabia leaving his son co-regent'
        }
      },
      {
        beatNumber: 3,
        visualMode: 'profile',
        accentColor: '#5b9bd5',
        headline: 'Father Abroad, Son Holding Babylon’s Keys',
        dateLabel: '553 – 539 BCE Co-Regency',
        location: 'Babylon & Oasis of Tema',
        text: 'Nabonidus remained first king in Arabia; Belshazzar ruled second inside Babylon’s gates. That left third ruler as the highest title Belshazzar could legally hand anyone on Earth.',
        openLoop: 'Lock that detail in: even Greek historians Herodotus and Berossus forgot Belshazzar’s name within two centuries—so how did this court detail survive?',
        visual: {
          subjectName: 'Belshazzar (Bel-shar-usur)',
          role: 'Crown Prince & Co-Regent of Babylon',
          eraSpan: 'Ruled inside Babylon 553 – October 539 BCE',
          quote: 'I entrusted the kingship to my eldest son, Bel-shar-usur.'
        }
      }
    ],
    chatCheckpoint: {
      countdownSec: 15,
      prompt: 'WHY COULD BELSHAZZAR ONLY OFFER "THIRD RULER" IN DANIEL 5?',
      options: [
        'A) Babylonian custom reserved second place strictly for priests',
        'B) His absent father Nabonidus was #1 and Belshazzar himself was #2',
        'C) Persian envoys already held the second seat inside the court'
      ],
      correctIndex: 1
    },
    resolution: {
      reveal: 'Answer B: Nabonidus held top kingship from desert Tema (#1), making co-regent Belshazzar #2—so #3 was literally the top promotion available on the night Babylon fell.',
      flawEveryoneMisses: 'Notice how rapidly later Greek writers forgot Belshazzar existed. That "third ruler" phrasing preserves an insider administrative arrangement that nobody writing centuries later from outside sources could even have known to invent.',
      whyItMatters: 'Often the tiniest throwaway line in an ancient text turns out to be its sharpest historical fingerprint.',
      nextStoryBridge: 'From desert clay bricks to frozen Atlantic ice—join three starving explorers with fifty feet of rope and one impossible vertical glacier...'
    }
  },
  {
    id: 'shackleton-south-georgia',
    title: 'Three Men, One Rope, 36 Hours Without Sleep',
    subtitle: 'Why Shackleton’s mountain crossing succeeded—and what ghostly feeling all three felt',
    category: 'world-history',
    era: 'May 1916 · Sub-Antarctic',
    archetype: 'survival_scenario',
    pacingProfile: 'rapid_dilemma',
    accentColor: '#67a9cf',
    audioBedPreference: 'focus',
    hook: {
      durationSec: 9,
      badge: 'SURVIVAL CASE #016 · SOUTH GEORGIA ISLAND',
      headline: 'FIVE THOUSAND FEET UP AN UNMAPPED GLACIER, EXHAUSTED TO COLLAPSE—THEY HAD TO SLIDE BLIND INTO FOG',
      narration: 'In May 1916, twenty-two stranded sailors awaited rescue on Elephant Island while Ernest Shackleton and two companions stood freezing on an unmapped razor ridge.'
    },
    beats: [
      {
        beatNumber: 1,
        visualMode: 'map',
        accentColor: '#67a9cf',
        headline: 'Wrong Side of a Jagged Island',
        dateLabel: 'May 10 – 19, 1916',
        location: 'King Haakon Bay to Stromness',
        text: 'After surviving an 800-mile open-boat voyage across the stormiest ocean on Earth, their rudder broke—stranding them on South Georgia’s uninhabited south shore, separated from whaling stations by 32 miles of vertical glaciers.',
        openLoop: 'Four steep mountain ridges blocked every turn. Dropping down by rope had already failed three times before nightfall.',
        visual: {
          route: ['Elephant Island', '800 mi Open Boat', 'Haakon Bay', 'Allardyce Ridge', 'Stromness'],
          accentStat: '32 mi',
          statLabel: 'unmapped jagged mountain spine crossed on foot'
        }
      },
      {
        beatNumber: 2,
        visualMode: 'timeline',
        accentColor: '#d98a4e',
        headline: 'The Calculated Coiled-Rope Gamble',
        dateLabel: '10:00 PM – 6:30 AM',
        location: 'Upper Snowfields',
        text: 'Night frost meant standing still equaled freezing solid within minutes. Shackleton coiled their fifty-foot alpine rope into a makeshift sled pad beneath the three men, linked arms, and launched down 1,500 feet of dark slope into cloud.',
        openLoop: 'Miraculously they stopped unscathed in soft snow—yet all three later swore silently to the same eerie phenomenon along the trek.',
        visual: {
          points: [
            '03:00 AM — First pass blocked by sheer thousand-foot ice drop',
            '09:00 PM — Freezing fog closes; sitting down means fatal hypothermia',
            '09:30 PM — Coiled rope sled plunges 1,500 ft in three minutes',
            '07:00 AM — Distant steam whistle wakes them: Stromness whaling station!'
          ]
        }
      },
      {
        beatNumber: 3,
        visualMode: 'profile',
        accentColor: '#7bb095',
        headline: 'The "Fourth Presence" Phenomenon',
        dateLabel: '36-Hour Nonstop March',
        location: 'Stromness Station Arrival',
        text: 'Days later at rest, navigator Frank Worsley leaned over quietly and confessed he felt a fourth unseen walker beside them the whole march. Shackleton admitted he felt it too—without any of the three ever mentioning it aloud on the ridge.',
        openLoop: 'When they walked into Stromness looking like bearded ghosts, why did hardened whaling captains literally weep upon seeing them?',
        visual: {
          subjectName: 'Shackleton, Worsley & Crean',
          role: 'Endurance Rescue Party',
          eraSpan: '36 Continuous Hours · Brass Boat Screws in Boot Soles',
          quote: 'I had no doubt that Providence had guided us... I felt there were four of us.'
        }
      }
    ],
    chatCheckpoint: {
      countdownSec: 15,
      prompt: 'HOW DID SHACKLETON’S CREW GET GRIP ON SOLID ICE WITH WORN BOOTS?',
      options: [
        'A) Carved crampons from rusted whaling harpoons found onshore',
        'B) Twisted brass hull screws straight out of their lifeboat into their boot soles',
        'C) Wrapped tarred canvas sails tightly over wool socks'
      ],
      correctIndex: 1
    },
    resolution: {
      reveal: 'Answer B: Carpenter Harry McNish unscrewed brass screws directly from the damaged lifeboat’s planking and drove them into the soles of their worn leather boots as emergency ice cleats.',
      flawEveryoneMisses: 'Everyone celebrates Shackleton’s bravery, forgetting two microscopic survival engineering touches: brass screws in leather heels and timing their 36-hour sprint strictly between full-moon frost and midday slush.',
      whyItMatters: 'Survival in extreme crises rarely comes from blind luck—it is improvised engineering paired with relentless teamwork. All 28 men came home alive.',
      nextStoryBridge: 'From frozen Antarctic ice back to sunlit Mediterranean caravans—how one Silk Road city quietly invented paper money centuries before Europe...'
    }
  },
  {
    id: 'silk-road-oasis-ledger',
    title: 'Why Silk Road Merchants Never Carried Gold',
    subtitle: 'How caravan towns from Chang’an to Samarkand ran on stamped paper contracts & credit',
    category: 'world-history',
    era: '2nd – 14th Century CE',
    archetype: 'ethical_dilemma',
    pacingProfile: 'slow_psychological',
    accentColor: '#cfa35a',
    audioBedPreference: 'ambient',
    hook: {
      durationSec: 9,
      badge: 'TRADE DOSSIER #074 · TAKLAMAKAN DESERT',
      headline: 'CROSSING FOUR THOUSAND MILES WITH TONS OF SILK—AND ALMOST ZERO COINS IN THEIR SADDLEBAGS',
      narration: 'How did Tang-era merchants haul fortunes across bandit-ridden deserts when silver ingots were heavy, conspicuous, and instantly fatal targets?'
    },
    beats: [
      {
        beatNumber: 1,
        visualMode: 'map',
        accentColor: '#cfa35a',
        headline: 'A Relay Network, Never One Single Caravan',
        dateLabel: 'c. 650 – 850 CE',
        location: 'Chang’an to Antioch Corridor',
        text: 'Contrary to maps showing one long arrow, few traders ever walked the whole four-thousand-mile span. Goods changed hands relay-style through Sogdian oasis brokers speaking seven languages.',
        openLoop: 'Moving heavy bronze strings across desert dunes would crush pack camels. So merchants invented "flying cash."',
        visual: {
          route: ['Chang’an', 'Dunhuang', 'Samarkand', 'Merv', 'Antioch'],
          accentStat: '4,000 mi',
          statLabel: 'relay network linked by bilingual Sogdian brokers'
        }
      },
      {
        beatNumber: 2,
        visualMode: 'evidence_card',
        accentColor: '#7bb095',
        headline: 'Feiqian: "Flying Cash" Credit Receipts',
        dateLabel: 'Tang Dynasty Innovation',
        location: 'Imperial Treasury & Guild Houses',
        text: 'Tea and silk merchants deposited heavy strings of coins at the capital and walked out carrying a split wooden tally or stamped mulberry-paper receipt redeemable in distant provinces.',
        openLoop: 'Paper receipts worked beautifully—until one unforeseen risk tempted governments to print far more paper than silver inside the vault.',
        visual: {
          quote: 'Merchants deposited capital cash and received split half-certificates redeemable at provincial treasuries.',
          attribution: 'Tang Fiscal Archives · 9th Century',
          accentStat: '1/100th',
          statLabel: 'weight of paper credit drafts vs. bronze coins'
        }
      },
      {
        beatNumber: 3,
        visualMode: 'comparison',
        accentColor: '#5b9bd5',
        headline: 'More Than Silk: Zero, Paper & Compass Tech',
        dateLabel: 'Cross-Continental Exchange',
        location: 'Samarkand Papermills · Baghdad Houses',
        text: 'Alongside spices and cobalt glass traveled technologies that remade Europe: Chinese papermaking reached Samarkand in 751 CE, then Baghdad, Damascus, and Spain—slashing book costs long before Gutenberg.',
        openLoop: 'Look closely at what actually bound strangers across four thousand miles without modern banks or courts.',
        visual: {
          leftTitle: 'Physical Cargo',
          leftItems: [
            'Spun mulberry silk & spices',
            'Cobalt pigments & glassware',
            'Horses, jade & medicinal roots'
          ],
          rightTitle: 'Invisible Systems',
          rightItems: [
            'Flying-cash credit tallies',
            'Papermaking mills moving west',
            'Multilingual diaspora merchant guilds'
          ]
        }
      }
    ],
    chatCheckpoint: {
      countdownSec: 15,
      prompt: 'WHAT KEPT CARAVAN TRADERS HONORING PAPER RECEIPTS ACROSS EMPIRES?',
      options: [
        'A) Tightly knit diaspora merchant guilds whose family reputation guaranteed every contract',
        'B) Shared Roman gold courts operating inside Samarkand',
        'C) A single unified currency enforced from China to Italy'
      ],
      correctIndex: 0
    },
    resolution: {
      reveal: 'Answer A: Close-knit merchant networks like the Sogdians enforced contract trust through multi-city family agents—defrauding one oasis partner blackballed a trader across the entire continent.',
      flawEveryoneMisses: 'Modern observers assume early credit needed centralized Wall Street computers—forgetting that reputation networks built across bilingual family houses worked reliably across deserts for centuries.',
      whyItMatters: 'Trade routes are never just roads on sand; they are networks of shared trust, ideas, and human ingenuity.',
      nextStoryBridge: 'Ready for two rapid-fire live chat trivia questions before our next cold-open mystery drops?'
    }
  },
  {
    id: 'sar-diq-london-1666',
    title: 'The Spark That Woke London',
    subtitle: 'Fictional fire personas recount the real 1666 Pudding Lane conflagration',
    category: 'world-history',
    era: 'September 1666 · London',
    archetype: 'historical_banter',
    pacingProfile: 'rapid_dilemma',
    accentColor: '#df8f6b',
    audioBedPreference: 'ambient',
    disclaimer: {
      isFictionalPersona: true,
      badgeText: 'Fictional Characters · Real History',
      note: 'Sar and Diq are fictional fire personas; the underlying 1666 event is real.'
    },
    hook: {
      durationSec: 9,
      badge: 'SAR & DIQ · LONDON, 1666',
      headline: 'THE SPARK THAT WOKE LONDON',
      narration: 'Fictional fire personas over real history: Sar relives her wild run through 1666 London while Diq sneers and tries to talk her down.'
    },
    beats: [
      {
        beatNumber: 1,
        speaker: 'SAR',
        tone: 'boastful_ordeal',
        visualMode: 'wildfire_surge',
        accentColor: '#df8f6b',
        headline: 'Pudding Lane Was Tight, Dry, and Packed',
        dateLabel: 'September 2, 1666',
        location: 'Thomas Farriner’s Bakery',
        text: 'Pudding Lane was tight, hot, and crowded—my kind of party. One forgotten bakery ember and I was already racing straight up the pitched timber walls!',
        openLoop: 'The east wind picked up off the Thames and handed me an open corridor across wooden rooftops.',
        visual: {
          accentStat: '13,200',
          statLabel: 'timber houses packed inside medieval city walls',
          quote: 'One dry autumn gale off the river and the whole street lit up like an oven.',
          attribution: 'SAR · Wildfire Rush Persona'
        }
      },
      {
        beatNumber: 2,
        speaker: 'DIQ',
        tone: 'sneering_warning',
        visualMode: 'ember_glow',
        accentColor: '#83b8a2',
        headline: 'Loud Heat Burns Out Fast When Fuel Runs Dry',
        dateLabel: 'Days 1 – 2 · Riverfront',
        location: 'Thameside Warehouses',
        text: 'Oh, look at you, puffing your chest over dry pine and pitch barrels. Keep roaring without restraint—watch how fast you choke the moment someone pulls away your timber.',
        openLoop: 'He wanted me to slow down right as tar, hemp, and brandy warehouses caught along the wharf.',
        visual: {
          accentStat: '6 lives',
          statLabel: 'officially recorded deaths despite massive property loss',
          quote: 'Heat with a purpose shapes iron. Heat without discipline just leaves ash and an empty hearth.',
          attribution: 'DIQ · Controlled Flame Persona'
        }
      },
      {
        beatNumber: 3,
        speaker: 'SAR',
        tone: 'defiant_rush',
        visualMode: 'wildfire_surge',
        accentColor: '#df8f6b',
        headline: 'Roof Beams Fell Like Dominoes Until the Blast',
        dateLabel: 'September 5, 1666',
        location: 'Central London Firebreaks',
        text: 'Slow down? Every overhanging jetty above the narrow alleys felt handed to me on a silver platter—until naval crews began blasting whole houses clean out of my path.',
        openLoop: 'No wood, no bridge, no jump. Look closely at what actually ended the four-day blaze.',
        visual: {
          accentStat: '80%',
          statLabel: 'of the walled Old City consumed before firebreaks held',
          quote: 'Then the gunpowder charges blew open bare stone gaps—and the wind had nowhere left to carry me.',
          attribution: 'SAR · Wildfire Rush Persona'
        }
      }
    ],
    chatCheckpoint: {
      countdownSec: 15,
      prompt: 'WHAT FINALLY STOPPED THE SPREAD OF THE GREAT FIRE OF LONDON?',
      options: [
        'A) Pulling down and blasting buildings with gunpowder to create firebreaks',
        'B) Sudden September blizzards on day two',
        'C) Pressurized cast-iron water mains under every lane'
      ],
      correctIndex: 0
    },
    resolution: {
      speaker: 'DIQ',
      reveal: 'Real history check: Sar and Diq are fictional, but the Great Fire of 1666 really started near Thomas Farriner’s bakery on Pudding Lane and was halted once winds dropped and crews blasted wide firebreaks.',
      flawEveryoneMisses: 'Many summaries credit rain alone—forgetting that leather buckets failed for three days until wide gaps starved the fire of fuel.',
      whyItMatters: 'Post-1666 London rebuilt in brick and stone and pioneered organized fire insurance.',
      nextStoryBridge: 'Next up: Sar tries going wild inside a steel furnace—and Diq reminds her who sets the temperature.'
    }
  },
  {
    id: 'sar-diq-bessemer-1856',
    title: 'The Blast That Learned to Behave',
    subtitle: 'Wildfire impatience meets industrial precision in Victorian steelmaking',
    category: 'world-history',
    era: '1856 CE · Sheffield & London',
    archetype: 'historical_banter',
    pacingProfile: 'fast_investigative',
    accentColor: '#cfa35a',
    audioBedPreference: 'focus',
    disclaimer: {
      isFictionalPersona: true,
      badgeText: 'Fictional Characters · Real History',
      note: 'Sar and Diq dramatize uncontrolled combustion vs. metered industrial metallurgy.'
    },
    hook: {
      durationSec: 9,
      badge: 'SAR & DIQ · SHEFFIELD, 1856',
      headline: 'TWENTY MINUTES TO TURN BRITTLE IRON INTO RAILWAY STEEL',
      narration: 'Fictional fire personas over real history: Sar thinks roaring sparks win the furnace—until Diq uses a cold blast of air to tame her into forging steel.'
    },
    beats: [
      {
        beatNumber: 1,
        speaker: 'SAR',
        tone: 'boastful_ordeal',
        visualMode: 'wildfire_surge',
        accentColor: '#df8f6b',
        headline: 'A Plume of White-Hot Sparks Thirty Feet High',
        dateLabel: 'August 1856',
        location: 'Bessemer Converter Vessel',
        text: 'You call a kitchen hearth loud? Try shooting cold compressed air straight upward through molten pig iron—I erupted in a white plume that shook the ironworks rafters!',
        openLoop: 'Everyone thought blowing cold air through liquid iron would freeze it solid—instead it burned hotter without extra coal.',
        visual: {
          accentStat: '1,600°C',
          statLabel: 'exothermic spike from oxidizing silicon and carbon',
          quote: 'Thirty feet of white sparks blasting from the mouth of a tilted pear-shaped drum.',
          attribution: 'SAR · Wildfire Rush Persona'
        }
      },
      {
        beatNumber: 2,
        speaker: 'DIQ',
        tone: 'sneering_warning',
        visualMode: 'ember_glow',
        accentColor: '#83b8a2',
        headline: 'Untamed Heat Ruined Every Early Batch',
        dateLabel: '1856 – 1857',
        location: 'British Rail Foundries',
        text: 'Yes, very theatrical, Sar—and completely useless. Left to burn unchecked, you scorched every ounce of carbon out, trapped oxygen bubbles, and left brittle scrap that cracked under a hammer.',
        openLoop: 'Licensees demanded their money back—until one metallurgist added back an exact measured alloy.',
        visual: {
          accentStat: '90% drop',
          statLabel: 'in steel cost per ton once chemistry was metered',
          quote: 'Spectacle wrecks the ingot. Watching the flame spectrum drop—and tilting the vessel on time—builds bridges.',
          attribution: 'DIQ · Controlled Flame Persona'
        }
      },
      {
        beatNumber: 3,
        speaker: 'DIQ',
        tone: 'controlled_triumph',
        visualMode: 'comparison',
        accentColor: '#83b8a2',
        headline: 'Spiegeleisen & Stopwatch Precision Won the Age',
        dateLabel: '1858 Onward',
        location: 'Global Rail & Skyscrapers',
        text: 'Robert Mushet measured manganese-rich spiegeleisen to scrub trapped oxygen and restore precise carbon—cutting a 10-day steel bake down to 20 controlled minutes.',
        openLoop: 'What visual cue told workers the exact second to cut the air blast?',
        visual: {
          leftTitle: 'Uncontrolled Surge',
          leftItems: [
            'Over-oxidized brittle metal',
            'Random carbon burn-off',
            'Cracked test rails'
          ],
          rightTitle: 'Metered Converter',
          rightItems: [
            'Flame-drop visual cutoff',
            'Measured manganese alloy',
            '20-minute structural steel'
          ]
        }
      }
    ],
    chatCheckpoint: {
      countdownSec: 15,
      prompt: 'HOW DID BESSEMER OPERATORS KNOW WHEN TO STOP THE AIR BLAST?',
      options: [
        'A) Watching the converter flame color and sudden drop as carbon finished burning',
        'B) Dropping snowflakes inside the liquid iron vat',
        'C) Guessing once per hour by sundial'
      ],
      correctIndex: 0
    },
    resolution: {
      speaker: 'DIQ',
      reveal: 'Real history check: Sar and Diq are fictional, yet Henry Bessemer and Robert Mushet really revolutionized steelmaking by oxidizing impurities quickly, watching the flame drop, and dosing carbon precisely.',
      flawEveryoneMisses: 'Popular myths credit pure blast force—ignoring that early batches failed commercially until Mushet solved the oxygen-and-carbon balance.',
      whyItMatters: 'Controlled combustion—not louder fire—made affordable rail networks, ocean hulls, and steel-framed cities possible.',
      nextStoryBridge: 'One more clash in ancient waters: what happened when liquid fire actually burned on top of the sea?'
    }
  },
  {
    id: 'sar-diq-constantinople-674',
    title: 'The Flame That Refused to Drown',
    subtitle: 'Byzantine pressurized bronze siphons vs. Sar’s open-water boast',
    category: 'world-history',
    era: '674 – 678 CE · Sea of Marmara',
    archetype: 'historical_banter',
    pacingProfile: 'slow_psychological',
    accentColor: '#d99668',
    audioBedPreference: 'sacred',
    disclaimer: {
      isFictionalPersona: true,
      badgeText: 'Fictional Characters · Real History',
      note: 'Sar and Diq personify fire dynamics during the historical 674 CE naval defense.'
    },
    hook: {
      durationSec: 9,
      badge: 'SAR & DIQ · CONSTANTINOPLE, 674 CE',
      headline: 'WATER ONLY FED THE FIRE ACROSS THE HARBOR',
      narration: 'Fictional fire personas over real history: Sar brags she danced across open waves in 674 CE—until Diq points out the hidden brass pumps doing the real work.'
    },
    beats: [
      {
        beatNumber: 1,
        speaker: 'SAR',
        tone: 'boastful_ordeal',
        visualMode: 'wildfire_surge',
        accentColor: '#df8f6b',
        headline: 'Sailors Threw Buckets of Seawater—And Only Made Me Angrier',
        dateLabel: '674 CE · Golden Horn',
        location: 'Byzantine Harbor Waters',
        text: 'Picture warships splashing buckets of seawater to put me out—and watching me skim straight across the waves anyway, clinging to hulls and rigging like angry oil!',
        openLoop: 'Water spread petroleum fuel instead of smothering it—and the secret wasn’t magic.',
        visual: {
          accentStat: '674 CE',
          statLabel: 'first documented naval deployment off Constantinople',
          quote: 'Throw water on crude naphtha and quicklime—you only give the flame wider waves to ride.',
          attribution: 'SAR · Wildfire Rush Persona'
        }
      },
      {
        beatNumber: 2,
        speaker: 'DIQ',
        tone: 'sneering_warning',
        visualMode: 'ember_glow',
        accentColor: '#83b8a2',
        headline: 'You Never Left the Nozzle Without Brass Pumps and Preheating',
        dateLabel: 'Kallinikos’s System',
        location: 'Dromon Bow Siphon',
        text: 'Careful taking all the credit, Sar. Without heated bronze coils, a pressurized hand pump, and a swiveling nozzle aimed downwind, you’d have burned our own wooden flagship.',
        openLoop: 'Capturing a ship carrying Greek Fire still failed enemies who didn’t know the operating sequence.',
        visual: {
          accentStat: '3-stage',
          statLabel: 'pressurized cauldron, bronze siphon tube, pilot ignition',
          quote: 'Anyone can light pitch. Aiming pressurized liquid fire from a wooden deck without self-immolation takes discipline.',
          attribution: 'DIQ · Controlled Flame Persona'
        }
      },
      {
        beatNumber: 3,
        speaker: 'SAR',
        tone: 'reluctant_credit',
        visualMode: 'artifact',
        accentColor: '#cfa35a',
        headline: 'State Secret Guarded So Tightly It Outlived Its Recipe',
        dateLabel: '7th – 12th Century CE',
        location: 'Imperial Arsenals',
        text: 'Imperial workshops split production into sealed departments—so even when enemy fleets captured full cauldrons and copper pumps, they never mastered the pressurized mix.',
        openLoop: 'Which simple mineral substance helped quench Greek Fire when water failed?',
        visual: {
          artifactName: 'Cheirosiphon & Heated Naphtha Siphon',
          material: 'Pressurized bronze cylinder, leather bellows, refined petroleum base',
          provenance: 'Byzantine Imperial Fleet · Guarded State Monopoly',
          accentStat: '500+ yrs',
          statLabel: 'recipe security preserved naval supremacy'
        }
      }
    ],
    chatCheckpoint: {
      countdownSec: 15,
      prompt: 'WHY COULDN’T SAILORS EXTINGUISH GREEK FIRE WITH NORMAL SEAWATER?',
      options: [
        'A) The petroleum-based mix floated and spread burning fuel across the water surface',
        'B) Salt water turned into gunpowder inside wooden hulls',
        'C) Byzantine sailors froze the Bosporus Strait solid'
      ],
      correctIndex: 0
    },
    resolution: {
      speaker: 'DIQ',
      reveal: 'Real history check: Sar and Diq are fictional, while Byzantine Greek Fire really relied on petroleum/naphtha mixtures propelled by heated pressurized bronze siphons that floated on seawater—requiring sand, vinegar, or heavy hides to smother.',
      flawEveryoneMisses: 'Many stories focus only on the secret chemical formula—overlooking that the pressurized mechanical siphon and crew discipline were equally decisive.',
      whyItMatters: 'Compartmentalized engineering held an entire empire’s coastline for centuries.',
      nextStoryBridge: 'Stay in chat—two rapid-fire trivia questions drop next before another historical case opens.'
    }
  }
];

let customEpisodes: StoryEpisode[] = [];

function loadCustomFromStorage(): void {
  try {
    const raw = localStorage.getItem(CUSTOM_STORIES_KEY);
    if (!raw) {
      customEpisodes = [];
      return;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      customEpisodes = parsed.filter(Boolean);
    }
  } catch {
    customEpisodes = [];
  }
}

function saveCustomToStorage(): void {
  try {
    localStorage.setItem(CUSTOM_STORIES_KEY, JSON.stringify(customEpisodes));
  } catch {
    // ignore quota error
  }
}

function normalizeArchetype(raw: unknown): StoryArchetype {
  const s = String(raw || '').toLowerCase().trim();
  if (
    s === 'historical_heist' ||
    s === 'biblical_mystery' ||
    s === 'ethical_dilemma' ||
    s === 'survival_scenario' ||
    s === 'historical_banter'
  ) {
    return s;
  }
  return 'historical_anomaly';
}

function normalizePacing(raw: unknown): StoryPacingProfile {
  const s = String(raw || '').toLowerCase().trim();
  if (s === 'slow_psychological' || s === 'rapid_dilemma') return s;
  return 'fast_investigative';
}

function normalizeVisualMode(raw: unknown): StoryBeatVisualMode {
  const s = String(raw || '').toLowerCase().trim();
  if (
    s === 'evidence_card' ||
    s === 'signal_waveform' ||
    s === 'wildfire_surge' ||
    s === 'ember_glow' ||
    s === 'map' ||
    s === 'timeline' ||
    s === 'profile' ||
    s === 'comparison' ||
    s === 'artifact' ||
    s === 'document'
  ) {
    return s;
  }
  return 'evidence_card';
}

/**
 * Map an Evidence Board graphic pack onto the visual mode the stage already
 * knows how to draw.
 *
 * The engine has ten visual modes and they are the right primitives: `map` is a
 * floor plan, `profile` is a composite sketch, `evidence_card` is a note,
 * `artifact` is a stamp. So a pack does not need a new renderer to be useful —
 * it needs a mapping. This is that mapping, and it is why the pack layer can
 * ship before the DOM builders do.
 */
function visualModeForPack(pack: string): StoryBeatVisualMode {
  const p = String(pack || '').toLowerCase();
  if (p.includes('floorplan') || p.includes('trailmap')) return 'map';
  if (p.includes('sketch') || p.includes('silhouette')) return 'profile';
  if (p.includes('stamp')) return 'artifact';
  if (p.includes('document') || p.includes('card')) return 'document';
  if (p.includes('string')) return 'comparison';
  if (p.includes('board')) return 'evidence_card';
  return 'evidence_card';
}

function normalizeSpeaker(raw: unknown): StorySpeaker | undefined {
  const s = String(raw || '').toUpperCase().trim();
  if (s === 'SAR' || s === 'DIQ' || s === 'NARRATOR') return s;
  return undefined;
}

function validateAndNormalizeEpisode(raw: unknown, idx: number): { ep?: StoryEpisode; err?: string } {
  if (!raw || typeof raw !== 'object') return { err: `Story ${idx + 1}: not an object` };
  const obj = raw as Record<string, unknown>;

  const rawCat = String(obj.category || '').toLowerCase();
  const category: StoryCategory = rawCat === 'biblical' || rawCat === 'bible' ? 'biblical' : 'world-history';
  const archetype = normalizeArchetype(obj.archetype);
  const pacingProfile = normalizePacing(obj.pacing_profile || obj.pacingProfile);

  /* 1. New Hook-Loop JSON schema (story_id, hook, beats, chat_checkpoint, resolution) */
  if (obj.hook && Array.isArray(obj.beats)) {
    const hRaw = obj.hook as Record<string, unknown>;
    const title = String(obj.title || hRaw.headline || '').trim();
    if (title.length < 3) return { err: `Story ${idx + 1}: missing title or hook.headline` };
    const beats: StoryBeat[] = [];
    (obj.beats as Record<string, unknown>[]).forEach((b, bIdx) => {
      if (!b || typeof b !== 'object') return;
      const text = String(b.text || b.narration || '').trim();
      if (text.length < 10) return;
      const vRaw = (b.visual && typeof b.visual === 'object' ? b.visual : {}) as Record<string, unknown>;
      beats.push({
        beatNumber: Number(b.beat_number || b.beatNumber) || bIdx + 1,
        visualMode: normalizeVisualMode(b.visual_mode || b.visualMode || b.sceneType),
        speaker: normalizeSpeaker(b.speaker),
        tone: b.tone ? String(b.tone).trim() : undefined,
        accentColor: b.accent_color ? String(b.accent_color) : (b.accentColor ? String(b.accentColor) : undefined),
        headline: String(b.headline || (b.speaker ? `${String(b.speaker).toUpperCase()} · Perspective ${bIdx + 1}` : `Exhibit ${bIdx + 1}`)).trim(),
        dateLabel: b.dateLabel ? String(b.dateLabel) : (vRaw.dateLabel ? String(vRaw.dateLabel) : undefined),
        location: b.location ? String(b.location) : (vRaw.location ? String(vRaw.location) : undefined),
        text,
        openLoop: b.open_loop ? String(b.open_loop).trim() : (b.openLoop ? String(b.openLoop).trim() : undefined),
        visual: {
          dateLabel: vRaw.dateLabel ? String(vRaw.dateLabel) : undefined,
          location: vRaw.location ? String(vRaw.location) : undefined,
          quote: vRaw.quote ? String(vRaw.quote) : undefined,
          attribution: vRaw.attribution ? String(vRaw.attribution) : undefined,
          points: Array.isArray(vRaw.points) ? vRaw.points.map(String).slice(0, 6) : undefined,
          leftTitle: vRaw.leftTitle ? String(vRaw.leftTitle) : undefined,
          leftItems: Array.isArray(vRaw.leftItems) ? vRaw.leftItems.map(String).slice(0, 5) : undefined,
          rightTitle: vRaw.rightTitle ? String(vRaw.rightTitle) : undefined,
          rightItems: Array.isArray(vRaw.rightItems) ? vRaw.rightItems.map(String).slice(0, 5) : undefined,
          route: Array.isArray(vRaw.route) ? vRaw.route.map(String).slice(0, 7) : undefined,
          subjectName: vRaw.subjectName ? String(vRaw.subjectName) : undefined,
          role: vRaw.role ? String(vRaw.role) : undefined,
          eraSpan: vRaw.eraSpan ? String(vRaw.eraSpan) : undefined,
          artifactName: vRaw.artifactName ? String(vRaw.artifactName) : undefined,
          material: vRaw.material ? String(vRaw.material) : undefined,
          provenance: vRaw.provenance ? String(vRaw.provenance) : undefined,
          accentStat: vRaw.accentStat ? String(vRaw.accentStat) : undefined,
          statLabel: vRaw.statLabel ? String(vRaw.statLabel) : undefined,
          waveformLabel: vRaw.waveformLabel ? String(vRaw.waveformLabel) : undefined,
          waveformBars: Array.isArray(vRaw.waveformBars) ? vRaw.waveformBars.map(Number).slice(0, 14) : undefined
        }
      });
    });
    if (!beats.length) return { err: `Story "${title}": no valid beats found` };

    const cpRaw = (obj.chat_checkpoint || obj.chatCheckpoint || {}) as Record<string, unknown>;
    const cpOpts = Array.isArray(cpRaw.options) && cpRaw.options.length >= 2
      ? cpRaw.options.map(String).slice(0, 4)
      : ['A) Genuine historical anomaly', 'B) Deliberate forged decoy', 'C) Misread archive date'];
    const cpCorrect = Math.max(0, Math.min(cpOpts.length - 1, Number(cpRaw.correct_index ?? cpRaw.correctIndex ?? 0) || 0));

    const dRaw = (obj.disclaimer && typeof obj.disclaimer === 'object' ? obj.disclaimer : null) as Record<string, unknown> | null;
    const isFictional = Boolean(
      (dRaw && (dRaw.is_fictional_persona || dRaw.isFictionalPersona)) ||
      archetype === 'historical_banter'
    );
    const disclaimer: StoryDisclaimer | undefined = isFictional
      ? {
          isFictionalPersona: true,
          badgeText: String((dRaw && (dRaw.badge_text || dRaw.badgeText)) || 'Fictional Characters · Real History').trim(),
          note: dRaw && dRaw.note ? String(dRaw.note).trim() : undefined
        }
      : undefined;

    const resRaw = (obj.resolution || {}) as Record<string, unknown>;
    return {
      ep: {
        id: String(obj.story_id || obj.id || `custom_story_${Date.now()}_${idx}`),
        title,
        subtitle: String(obj.subtitle || hRaw.narration || 'Investigative documentary loop').trim(),
        category,
        era: String(obj.era || (isFictional ? 'Fictional Personas · Real History' : 'Investigative Archive')).trim(),
        archetype,
        pacingProfile,
        accentColor: String(obj.accent_color || obj.accentColor || beats[0].accentColor || '#cfa35a'),
        audioBedPreference: obj.audioBedPreference === 'ambient' || obj.audioBedPreference === 'focus' ? obj.audioBedPreference : 'sacred',
        disclaimer,
        hook: {
          durationSec: Math.max(6, Math.min(18, Number(hRaw.duration_sec || hRaw.durationSec) || 9)),
          badge: String(hRaw.on_screen_badge || hRaw.badge || `CASE #${idx + 1} · INVESTIGATION`).trim(),
          headline: String(hRaw.headline || title).trim(),
          narration: String(hRaw.narration || '').trim()
        },
        beats,
        chatCheckpoint: {
          countdownSec: Math.max(8, Math.min(30, Number(cpRaw.countdown_sec || cpRaw.countdownSec) || 15)),
          prompt: String(cpRaw.prompt || 'WHAT DOES THE EVIDENCE POINT TO?').trim(),
          options: cpOpts,
          correctIndex: cpCorrect
        },
        resolution: {
          speaker: normalizeSpeaker(resRaw.speaker),
          reveal: String(resRaw.reveal || 'Historical evidence narrows the outcome down to verifiable primary sources.').trim(),
          flawEveryoneMisses: String(resRaw.flaw_everyone_misses || resRaw.flawEveryoneMisses || 'Casual summaries overlook the primary chronological constraint inside the first exhibit.').trim(),
          whyItMatters: String(resRaw.why_it_matters || resRaw.whyItMatters || 'Cross-checking physical and textual evidence prevents surface-level myths.').trim(),
          nextStoryBridge: String(resRaw.next_story_bridge || resRaw.nextStoryBridge || 'Stay tuned—another mystery begins in moments.').trim()
        }
      }
    };
  }

  /* 1b. Evidence Board pack schema: { title, background, scenes:[{elements:[]}] }

     This is the shape the story-generation system prompt asks for. It used to
     fall through to the legacy `acts` branch and fail with "must include
     hook+beats or acts", so a story written to the brief was rejected outright.
     It is accepted here and mapped onto the existing StoryEpisode model: one
     scene becomes one beat, and the pack name picks the visual mode. */
  if (Array.isArray(obj.scenes) && obj.scenes.length) {
    const title = String(obj.title || '').trim();
    if (title.length < 3) return { err: `Story ${idx + 1}: missing "title"` };

    const packIssues = validatePackReferences(
      obj as Parameters<typeof validatePackReferences>[0]
    );
    const hardErrors = packIssues.filter((i) => i.severity === 'error');
    if (hardErrors.length) {
      /* A pack that does not exist used to be ignored, which rendered a blank
         scene with no explanation. It is now a named error. */
      return {
        err: `Story "${title}": ${hardErrors.map((i) => `${i.where}: ${i.message}`).join('; ')}`
      };
    }

    const beats: StoryBeat[] = [];
    (obj.scenes as Record<string, unknown>[]).forEach((scRaw, sIdx) => {
      if (!scRaw || typeof scRaw !== 'object') return;
      const sc = scRaw as Record<string, unknown>;
      const elements = Array.isArray(sc.elements) ? (sc.elements as Record<string, unknown>[]) : [];

      /* The scene's narration is the concatenation of its note bodies: that is
         what the reader speaks and what the beat text is used for. */
      const lines: string[] = [];
      let headline = '';
      let firstPack = '';
      elements.forEach((elRaw) => {
        if (!elRaw || typeof elRaw !== 'object') return;
        const el = elRaw as Record<string, unknown>;
        if (!firstPack && el.pack) firstPack = String(el.pack);
        const content = (el.content && typeof el.content === 'object' ? el.content : {}) as Record<string, unknown>;
        if (!headline && content.title) headline = String(content.title).trim();
        if (Array.isArray(content.body)) {
          content.body.forEach((line) => {
            const t = String(line || '').trim();
            if (t) lines.push(t);
          });
        }
        if (Array.isArray(content.highlights)) {
          content.highlights.forEach((h) => {
            const text = h && typeof h === 'object' ? String((h as Record<string, unknown>).text || '').trim() : '';
            if (text) lines.push(text);
          });
        }
      });

      const text = lines.join(' ').trim();
      if (text.length < 10) return;

      beats.push({
        beatNumber: beats.length + 1,
        visualMode: visualModeForPack(firstPack),
        headline: headline || `Exhibit ${beats.length + 1}`,
        text,
        openLoop: sc.transition_out ? String(sc.transition_out) : undefined,
        visual: {},
      });
    });

    if (!beats.length) return { err: `Story "${title}": no scene produced readable text` };

    const quality = checkStoryQuality(obj as Parameters<typeof checkStoryQuality>[0]);
    quality.forEach((q) => {
      /* Warnings are surfaced, not fatal: a story that is merely thin should
         still play. */
      if (q.severity === 'warning') console.warn(`[story] ${title} — ${q.where}: ${q.message}`);
    });

    return {
      ep: {
        id: String(obj.id || obj.story_id || `custom_board_${Date.now()}_${idx}`),
        title,
        subtitle: String(obj.subtitle || 'Evidence Board reconstruction').trim(),
        category,
        era: String(obj.era || 'Investigative Archive').trim(),
        archetype: 'historical_heist',
        pacingProfile,
        accentColor: String(obj.accent_color || obj.accentColor || '#cfa35a'),
        audioBedPreference: 'ambient',
        hook: {
          durationSec: 9,
          badge: String(obj.badge || 'CASE FILE · EVIDENCE BOARD').trim(),
          headline: title.toUpperCase(),
          narration: beats[0].text,
        },
        beats: beats.slice(0, 8),
        chatCheckpoint: {
          countdownSec: 15,
          prompt: String(obj.central_question || 'WHAT DOES THE EVIDENCE POINT TO?').trim(),
          options: [
            'A) The protocol was broken from the inside',
            'B) The loss was an accident of timing',
            'C) The record itself is unreliable',
          ],
          correctIndex: 0,
        },
        resolution: {
          reveal: String(obj.reveal || 'The evidence board closes with the case still open.').trim(),
          flawEveryoneMisses: String(
            obj.flaw || 'The reconstruction shows how long the breach went unchallenged.'
          ).trim(),
          whyItMatters: String(obj.why_it_matters || 'Chronology is what turns a rumour into a case.').trim(),
          nextStoryBridge: 'Stay in chat — the next case file opens shortly.',
        },
      },
    };
  }

  /* 2. Backward-compatible fallback for legacy { acts: [...] } JSON packs */
  const title = String(obj.title || '').trim();
  if (title.length < 3) return { err: `Story ${idx + 1}: missing "title"` };
  const rawActs = Array.isArray(obj.acts) ? obj.acts : [];
  if (!rawActs.length) return { err: `Story "${title}": must include hook+beats or acts` };

  const beats: StoryBeat[] = [];
  rawActs.forEach((rawAct: unknown) => {
    if (!rawAct || typeof rawAct !== 'object') return;
    const act = rawAct as Record<string, unknown>;
    const rawScenes = Array.isArray(act.scenes) ? act.scenes : [];
    rawScenes.forEach((scRaw: unknown) => {
      if (!scRaw || typeof scRaw !== 'object') return;
      const sc = scRaw as Record<string, unknown>;
      const text = String(sc.narration || sc.text || '').trim();
      if (text.length < 15) return;
      beats.push({
        beatNumber: beats.length + 1,
        visualMode: normalizeVisualMode(sc.sceneType || sc.type),
        headline: String(sc.headline || `Beat ${beats.length + 1}`).trim(),
        text,
        openLoop: sc.engagement ? String(sc.engagement).trim() : String(act.hook || '').trim() || undefined,
        visual: (sc.visual && typeof sc.visual === 'object' ? sc.visual : {}) as StorySceneVisual
      });
    });
  });

  if (!beats.length) return { err: `Story "${title}": no valid scenes found` };
  const cpFallbackPrompt = String(obj.centralQuestion || `WHAT EXPLAINS ${title.toUpperCase()}?`);

  return {
    ep: {
      id: String(obj.id || `custom_legacy_${Date.now()}_${idx}`),
      title,
      subtitle: String(obj.subtitle || 'Documentary chronicle').trim(),
      category,
      era: String(obj.era || 'Historical Archive').trim(),
      archetype,
      pacingProfile,
      accentColor: category === 'biblical' ? '#cfa35a' : '#5b9bd5',
      audioBedPreference: category === 'biblical' ? 'sacred' : 'ambient',
      hook: {
        durationSec: 9,
        badge: `${category === 'biblical' ? 'ARCHIVE' : 'CASE'} · ${String(obj.era || 'CHRONICLE').toUpperCase()}`,
        headline: title.toUpperCase(),
        narration: String(obj.centralQuestion || obj.subtitle || beats[0].text).trim()
      },
      beats: beats.slice(0, 5),
      chatCheckpoint: {
        countdownSec: 15,
        prompt: cpFallbackPrompt,
        options: [
          'A) Internal institutional & human choices shaped the outcome',
          'B) Pure chance or isolated weather alone changed history',
          'C) Contemporary chroniclers invented the entire event'
        ],
        correctIndex: 0
      },
      resolution: {
        reveal: String(obj.takeaway || 'Primary sources confirm interlocking human decisions drove the turning point.').trim(),
        flawEveryoneMisses: 'Surface retellings isolate a single dramatic date while overlooking the structural buildup leading up to it.',
        whyItMatters: String(obj.takeaway || 'Examining turning points sharpens how we read evidence.').trim(),
        nextStoryBridge: 'Stay in chat—next investigation drops right after this.'
      }
    }
  };
}

export function loadStoryLibrary(): Promise<void> {
  loadCustomFromStorage();
  /* Custom packs must be registered before any story is validated, or a story
     that references a user-uploaded pack would be rejected as unknown. */
  loadCustomPacks();

  const api = {
    getAllEpisodes: (category?: string): StoryEpisode[] => {
      const combined = BUILT_IN_EPISODES.concat(customEpisodes);
      const cat = String(category || 'all').toLowerCase();
      if (cat === 'all' || !cat) return combined;
      return combined.filter((e) => e.category === cat);
    },
    getCustomEpisodes: (): StoryEpisode[] => customEpisodes.slice(),
    getStats: () => {
      const all = BUILT_IN_EPISODES.concat(customEpisodes);
      let totalBeats = 0;
      let worldHistory = 0;
      let biblical = 0;
      const archSet = new Set<string>();
      all.forEach((ep) => {
        if (ep.category === 'biblical') biblical++;
        else worldHistory++;
        archSet.add(ep.archetype);
        totalBeats += ep.beats.length;
      });
      return {
        total: all.length,
        builtIn: BUILT_IN_EPISODES.length,
        custom: customEpisodes.length,
        worldHistory,
        biblical,
        totalBeats,
        archetypes: archSet.size
      };
    },
    importEpisodesJson: (jsonText: string) => {
      const errors: string[] = [];
      let added = 0;
      let skipped = 0;
      try {
        const parsed = JSON.parse(jsonText);
        const list = Array.isArray(parsed)
          ? parsed
          : (parsed && Array.isArray(parsed.episodes)
            ? parsed.episodes
            : (parsed && Array.isArray(parsed.stories)
              ? parsed.stories
              : (parsed && (parsed.title || parsed.hook) ? [parsed] : [])));
        if (!list.length) {
          return { added: 0, skipped: 0, errors: ['Expected an array of stories or { "stories": [...] }'] };
        }
        const existingTitles = new Set(
          BUILT_IN_EPISODES.concat(customEpisodes).map((e) => e.title.toLowerCase().trim())
        );
        list.forEach((item: unknown, idx: number) => {
          const res = validateAndNormalizeEpisode(item, idx);
          if (res.err) {
            errors.push(res.err);
            return;
          }
          if (res.ep) {
            const key = res.ep.title.toLowerCase().trim();
            if (existingTitles.has(key)) {
              skipped++;
              return;
            }
            existingTitles.add(key);
            customEpisodes.push(res.ep);
            added++;
          }
        });
        if (added > 0) saveCustomToStorage();
      } catch (e) {
        errors.push(e instanceof Error ? e.message : 'Invalid JSON');
      }
      return { added, skipped, errors };
    },
    clearCustomEpisodes: () => {
      customEpisodes = [];
      saveCustomToStorage();
    }
  };

  window.LNR_STORIES = api;
  try {
    window.dispatchEvent(new CustomEvent('lnr:stories-ready'));
  } catch {
    // ignore event failure
  }
  return Promise.resolve();
}
