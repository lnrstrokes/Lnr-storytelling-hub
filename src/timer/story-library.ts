/* ============================================================
   lnr Studio — Documentary & Historical Storytelling Library
   Curated multi-act documentary episodes for continuous 24/7
   livestream narration with 6 reusable scene compositions:
     document | map | timeline | profile | comparison | artifact
   Zero external API dependencies — runs deterministically offline.
   ============================================================ */

export type StorySceneType =
  | 'document'
  | 'map'
  | 'timeline'
  | 'profile'
  | 'comparison'
  | 'artifact';

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
}

export interface StoryScene {
  sceneType: StorySceneType;
  headline: string;
  narration: string;
  engagement?: string;
  visual: StorySceneVisual;
}

export interface StoryAct {
  actNum: number;
  title: string;
  hook?: string;
  scenes: StoryScene[];
}

export interface StoryEpisode {
  id: string;
  title: string;
  subtitle: string;
  category: StoryCategory;
  era: string;
  centralQuestion: string;
  takeaway: string;
  acts: StoryAct[];
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
        totalActs: number;
        totalScenes: number;
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

const CUSTOM_STORIES_KEY = 'lnr_custom_stories_v1';

const BUILT_IN_EPISODES: StoryEpisode[] = [
  {
    id: 'rome-fall',
    title: 'The Fall of the Roman Empire',
    subtitle: 'How an empire built to endure forever unraveled from within and without',
    category: 'world-history',
    era: '27 BCE – 476 CE',
    centralQuestion: 'Did Rome collapse because of invading armies, or did internal fracture hollow it out first?',
    takeaway: 'Institutions survive crises when trust holds; Rome outlived its Western throne in law, language, and civic memory.',
    acts: [
      {
        actNum: 1,
        title: 'The World at Its Height',
        hook: 'From Hadrian’s rainy turf wall to the sun-baked Euphrates, one currency and one law held seventy million lives.',
        scenes: [
          {
            sceneType: 'map',
            headline: 'Fifty Thousand Miles of Stone Roads',
            narration: 'At the dawn of the second century, the Roman Mediterranean was less a frontier than an inland lake. Imperial surveyors paved fifty thousand miles of stone highway so grain fleets from Egypt, silver from Spain, and dispatches from the Rhine moved under a single banner.',
            engagement: 'Live chat: Which Roman engineering feat still shapes your city today?',
            visual: {
              dateLabel: 'c. 117 CE · Pax Romana',
              location: 'Britain to Mesopotamia',
              route: ['Londinium', 'Lugdunum', 'Rome', 'Alexandria', 'Antioch'],
              accentStat: '50,000 mi',
              statLabel: 'paved imperial highway network'
            }
          },
          {
            sceneType: 'profile',
            headline: 'Marcus Aurelius on the Frozen Danube',
            narration: 'Even at its zenith, holding the border meant endless vigilance. Emperor Marcus Aurelius spent his final winters by candlelight inside campaign tents along the Danube, writing private reminders about duty while plague and frontier raids tested the legions.',
            visual: {
              dateLabel: '161 – 180 CE',
              subjectName: 'Marcus Aurelius',
              role: 'Emperor & Stoic Philosopher',
              eraSpan: 'Frontier Campaigns on the Danube',
              quote: 'Waste no more time arguing about what a good ruler should be. Be one.'
            }
          }
        ]
      },
      {
        actNum: 2,
        title: 'The Cracks Begin',
        hook: 'When the silver inside every coin quietly shrank, trust in the treasury vanished.',
        scenes: [
          {
            sceneType: 'artifact',
            headline: 'The Shrinking Silver Denarius',
            narration: 'Warfare was expensive, and peace at the borders grew costlier still. Over fifty chaotic years in the third century, emperors trimmed the silver content of the denarius from over ninety percent down to a thin silver wash over copper.',
            engagement: 'Watch the numbers: coin debasement doubled soldier pay demands within a generation.',
            visual: {
              dateLabel: '235 – 284 CE',
              artifactName: 'Debased Antoninianus Coin',
              material: 'Bronze core with < 5% silver wash',
              provenance: 'Crisis of the Third Century Mints',
              accentStat: '< 5%',
              statLabel: 'pure silver left in late third-century coinage'
            }
          },
          {
            sceneType: 'timeline',
            headline: 'Twenty Emperors in Fifty Years',
            narration: 'Soldiers realized armies could crown commanders faster than the Senate could debate. Between 235 and 284, more than twenty rulers claimed the purple, most dying by mutiny or ambush before an heir could steady the frontier.',
            visual: {
              dateLabel: '235 – 284 CE',
              points: [
                '235 CE — Severus Alexander slain by mutinous legions on the Rhine',
                '260 CE — Empire fractures into Gallic and Palmyrene breakaways',
                '270 CE — Aurelian fortifies Rome with defensive brick walls',
                '284 CE — Diocletian divides rule to halt civil war'
              ]
            }
          }
        ]
      },
      {
        actNum: 3,
        title: 'Two Capitals, One Fragile Border',
        hook: 'To save an oversized state, Rome split its command—yet division seeded rivalry.',
        scenes: [
          {
            sceneType: 'comparison',
            headline: 'East Wealth vs. West Frontier Pressure',
            narration: 'Once Constantine built his eastern capital at Constantinople, wealth and tax revenue tilted steadily eastward. The eastern provinces boasted crowded trading ports and shorter borders, while the western half shouldered vast river frontiers with shrinking tax rolls.',
            visual: {
              dateLabel: '330 – 395 CE',
              leftTitle: 'Western Empire (Rome / Ravenna)',
              leftItems: [
                'Long Rhine & Danube borders',
                'Fewer wealthy port cities',
                'Reliance on federated foederati troops'
              ],
              rightTitle: 'Eastern Empire (Constantinople)',
              rightItems: [
                'Rich Syrian & Egyptian tax base',
                'Heavily fortified Bosporus capital',
                'Paid off threats or redirected them west'
              ]
            }
          },
          {
            sceneType: 'document',
            headline: 'Crossing the Danube in 376 CE',
            narration: 'Pushed westward by the sudden arrival of the Huns on the steppe, tens of thousands of Goths begged Rome for sanctuary inside the Danube line. Corrupt provincial officials starved and exploited the refugees, turning desperate allies into an undefeated army inside imperial soil.',
            visual: {
              dateLabel: '376 – 378 CE',
              location: 'Adrianople, Thrace',
              quote: 'They were ferrying across day and night without ceasing, so great was the multitude driven from their homes.',
              attribution: 'Ammianus Marcellinus · Res Gestae (c. 390 CE)'
            }
          }
        ]
      },
      {
        actNum: 4,
        title: 'The Turning Point: 410 and 476',
        hook: 'For eight hundred years no foreign army had breached Rome’s gates—until one summer night.',
        scenes: [
          {
            sceneType: 'timeline',
            headline: 'Three Nights That Shook the Mediterranean',
            narration: 'In August 410, Visigothic king Alaric entered Rome through the Salarian Gate after failed negotiations for land and grain. Across the sea in North Africa, Augustine heard the news and asked what remains standing when an earthly city falls.',
            engagement: 'Live chat: Why did 410 shock people even after the imperial court had left Rome?',
            visual: {
              dateLabel: '410 – 476 CE',
              points: [
                '410 CE — Alaric sacks Rome; eastern scholars mourn across the sea',
                '439 CE — Vandals capture Carthage, cutting off Rome’s grain lifeline',
                '455 CE — Second sack strips bronze tiles from the Capitol roofs',
                '476 CE — Odoacer deposes teenage emperor Romulus Augustulus'
              ]
            }
          },
          {
            sceneType: 'profile',
            headline: 'The Last Boy on the Western Throne',
            narration: 'By 476, real authority belonged to generals rather than emperors. Germanic commander Odoacer politely packed the imperial regalia off to Constantinople and pensioned young Romulus Augustulus to a seaside villa near Naples, ending western succession without burning the city.',
            visual: {
              dateLabel: 'September 476 CE',
              subjectName: 'Romulus Augustulus',
              role: 'Last Western Roman Emperor',
              eraSpan: 'Ruled 10 months · Exiled at 16',
              quote: 'He carried the names of both Rome’s founder and its first emperor, yet ruled only a shadow.'
            }
          }
        ]
      },
      {
        actNum: 5,
        title: 'What Survived the Fall',
        hook: 'An empire died in Ravenna, yet its eastern half endured another thousand years.',
        scenes: [
          {
            sceneType: 'document',
            headline: 'Law, Language, and the Eastern Survival',
            narration: 'The fall of Rome was never a lights-out midnight. Latin evolved into Italian, French, Spanish, and Portuguese; Roman civil law anchored European courts; and in Constantinople, emperors continued calling themselves Romans until 1453.',
            visual: {
              dateLabel: 'Legacy · 5th Century Onward',
              location: 'Mediterranean & Europe',
              quote: 'Rome fell politically in the West, yet became the grammar book, legal code, and calendar of the next millennium.',
              attribution: 'Historical Synthesis · Late Antiquity'
            }
          }
        ]
      }
    ]
  },
  {
    id: 'exodus-sinai',
    title: 'The Exodus & Sinai Covenant',
    subtitle: 'How enslaved brickmakers became a chartered nation in the wilderness',
    category: 'biblical',
    era: 'Bronze Age Sanctuary Narrative',
    centralQuestion: 'Why did liberation from Egypt require a covenant in the desert before entering Canaan?',
    takeaway: 'Freedom in scripture is never merely escape from bondage; it is formation into a just, worshipping community.',
    acts: [
      {
        actNum: 1,
        title: 'Memory in the Brick Pits',
        hook: 'Centuries after Joseph saved Egypt from famine, a new throne forgot his name.',
        scenes: [
          {
            sceneType: 'map',
            headline: 'Goshen to the Store Cities of the Delta',
            narration: 'In the fertile eastern Nile Delta, Hebrew families grew from seventy guests into a teeming population. Fearing their numbers, Pharaoh conscripted them into building the royal supply cities of Pithom and Rameses with sun-dried mudbrick and straw.',
            engagement: 'Live chat: Why does Exodus open by naming two modest midwives before Pharaoh?',
            visual: {
              dateLabel: 'Exodus Chapters 1–2',
              location: 'Eastern Nile Delta',
              route: ['Goshen', 'Pithom', 'Rameses', 'Midian', 'Mount Horeb'],
              accentStat: '430 yrs',
              statLabel: 'sojourn recalled in Israel’s collective memory'
            }
          },
          {
            sceneType: 'profile',
            headline: 'Forty Years in Midian Silence',
            narration: 'Raised in palace courts yet exiled after defending a laborer, Moses spent four decades herding sheep across barren Midian valleys. Leadership arrived not in royal armor, but beside an unconsumed thornbush on mountain slopes.',
            visual: {
              dateLabel: 'Exodus Chapters 2–4',
              subjectName: 'Moses of Midian',
              role: 'Shepherd, Mediator, Lawgiver',
              eraSpan: 'Palace Youth → Wilderness Exile → Deliverer',
              quote: 'Who am I that I should go to Pharaoh, and bring the Israelites out of Egypt?'
            }
          }
        ]
      },
      {
        actNum: 2,
        title: 'Plagues Against Pharaoh’s Order',
        hook: 'Each confrontation struck at an emblem of royal power and Nile prosperity.',
        scenes: [
          {
            sceneType: 'comparison',
            headline: 'Pharaoh’s Palace vs. The Passover Household',
            narration: 'Ten signs turned the Nile’s predictable rhythm upside down—blood in the irrigation canals, frogs, darkness at noon, and hail. On the final night, survival shifted from fortified palace stone to humble doorframes marked with hyssop.',
            visual: {
              dateLabel: 'Exodus Chapters 7–12',
              leftTitle: 'Imperial Egypt',
              leftItems: [
                'Wealth measured in storehouses & chariots',
                'Divine kingship claiming cosmic control',
                'Forced labor quotas without straw'
              ],
              rightTitle: 'Passover Table',
              rightItems: [
                'Sandals fastened, staff in hand',
                'Unleavened bread baked in haste',
                'Shared meal remembered every spring'
              ]
            }
          }
        ]
      },
      {
        actNum: 3,
        title: 'Through the Sea Into Testing',
        hook: 'Leaving Egypt took one night; unlearning Egypt inside the heart took forty years.',
        scenes: [
          {
            sceneType: 'timeline',
            headline: 'From Sea Crossing to Mount Sinai',
            narration: 'Cornered between sea waters and pursuing chariots, Israel crossed on dry ground by morning light. Yet within weeks in the arid Sinai peninsula, thirst and hunger tested their newborn freedom at Marah, Elim, and Rephidim.',
            visual: {
              dateLabel: 'The First Three Months',
              points: [
                'Yam Suph — Crossing at dawn; Miriam’s song along the shore',
                'Marah & Elim — Bitter water healed, twelve springs discovered',
                'Wilderness of Sin — Daily manna teaching trust one day at a time',
                'Rephidim — Water from the rock and defense against Amalek'
              ]
            }
          },
          {
            sceneType: 'document',
            headline: 'The Covenant Spoken on the Mountain',
            narration: 'At Sinai, deliverance received its constitution. Before commanding any sacrifice or statute, the Ten Words opened with memory: I am the Lord who brought you out of slavery—grounding moral law in mercy rather than fear.',
            engagement: 'Live chat: Which of the Ten Commandments speaks sharpest to modern life?',
            visual: {
              dateLabel: 'Exodus 19–20',
              location: 'Mount Sinai',
              quote: 'You yourselves have seen what I did to Egypt, and how I carried you on eagles’ wings and brought you to myself.',
              attribution: 'Exodus Chapter 19, Verse 4'
            }
          }
        ]
      },
      {
        actNum: 4,
        title: 'A Portable Sanctuary in the Dust',
        hook: 'Instead of an immovable pyramid, God chose a stitched tent that marched beside them.',
        scenes: [
          {
            sceneType: 'artifact',
            headline: 'Acacia Wood, Gold Leaf, and Woven Blue',
            narration: 'Craftsmen Bezalel and Oholiab shaped acacia timber, hammered bronze lamps, and dyed linen into the Tabernacle. Designed to fold onto wooden poles, this portable dwelling meant sacred presence belonged to every mile of the journey.',
            visual: {
              dateLabel: 'Exodus 25–40',
              artifactName: 'The Tabernacle & Ark of the Covenant',
              material: 'Acacia wood overlaid with gold, spun blue & scarlet linen',
              provenance: 'Constructed at the foot of Sinai from freewill offerings',
              accentStat: '330+ yrs',
              statLabel: 'served Israel from Sinai to Shiloh before Jerusalem'
            }
          }
        ]
      }
    ]
  },
  {
    id: 'silk-road',
    title: 'The Silk Road: Caravans That Connected Worlds',
    subtitle: 'How merchants, monks, and paper makers stitched East Asia to the Mediterranean',
    category: 'world-history',
    era: '130 BCE – 1453 CE',
    centralQuestion: 'What carried farther along desert caravan tracks: bolts of silk, or ideas that remade empires?',
    takeaway: 'No single empire controlled the Silk Road; its true engine was relays of oasis cities trading goods, scripts, and faith.',
    acts: [
      {
        actNum: 1,
        title: 'An Envoy Rides West',
        hook: 'In 138 BCE, a Han envoy left Chang’an expecting allies—and returned with a map of half the globe.',
        scenes: [
          {
            sceneType: 'profile',
            headline: 'Zhang Qian’s Thirteen-Year Odyssey',
            narration: 'Captured twice by nomadic Xiongnu riders, Han diplomat Zhang Qian escaped across the snow-choked Pamir Mountains into Central Asia. When he finally reached Chang’an thirteen years later, he brought reports of Fergana warhorses, Parthian coins, and Indian markets.',
            visual: {
              dateLabel: '138 – 125 BCE',
              subjectName: 'Zhang Qian',
              role: 'Han Imperial Envoy & Explorer',
              eraSpan: '13 years across Central Asia',
              quote: 'Beyond the western deserts lie kingdoms of walled cities, grapes, and towering horses.'
            }
          },
          {
            sceneType: 'map',
            headline: 'Oasis Relays Across Taklamakan and Pamir',
            narration: 'Few traders ever walked the full five thousand miles from Chang’an to Antioch. Instead, goods passed through chains of oasis bazaars—Dunhuang, Kashgar, Samarkand, and Merv—changing camels, languages, and currencies at every desert rim.',
            engagement: 'Live chat: Would you have joined a camel caravan across the Taklamakan desert?',
            visual: {
              dateLabel: 'High Trade Era · 200 – 900 CE',
              location: 'Eurasian Interior',
              route: ['Chang’an', 'Dunhuang', 'Kashgar', 'Samarkand', 'Merv', 'Antioch'],
              accentStat: '4,000+ mi',
              statLabel: 'overland relay corridor across desert & mountain passes'
            }
          }
        ]
      },
      {
        actNum: 2,
        title: 'More Precious Than Silk',
        hook: 'Paper, gunpowder, astrolabes, and spices traveled the same saddlebags as silk.',
        scenes: [
          {
            sceneType: 'artifact',
            headline: 'Mulberry Paper From Chang’an to Baghdad',
            narration: 'By the eighth century, papermaking workshops had spread from China into Samarkand and Baghdad’s bustling markets. Cheaper than parchment and tougher than Egyptian papyrus, rag paper ignited an explosion of libraries, ledgers, and poetry from Cordoba to Kyoto.',
            visual: {
              dateLabel: 'c. 751 – 900 CE',
              artifactName: 'Sogdian & Samarkand Rag Paper Leaf',
              material: 'Hemp, linen fibers, and mulberry bark pulp',
              provenance: 'Oasis Paper Mills of Transoxiana',
              accentStat: '5× cheaper',
              statLabel: 'than animal-skin vellum across medieval Mediterranean workshops'
            }
          },
          {
            sceneType: 'comparison',
            headline: 'Flowing West vs. Flowing East',
            narration: 'Caravans never moved one-way. Westbound packs carried silk, porcelain, paper, and magnetic needles; eastbound donkeys hauled Roman glassware, Mediterranean wool, alfalfa seed, walnuts, and silver coins stamped with distant kings.',
            visual: {
              dateLabel: 'Two-Way Cultural Exchange',
              leftTitle: 'Carried Westward',
              leftItems: [
                'Woven Han & Tang silks',
                'Mulberry & rag paper craft',
                'Tea bricks, rhubarb & porcelain',
                'Buddhist sutras & medical texts'
              ],
              rightTitle: 'Carried Eastward',
              rightItems: [
                'Roman & Byzantine blown glass',
                'Alfalfa, grapes & pomegranates',
                'Byzantine gold solidus & silver',
                'Nestorian, Islamic & Manichaean scripts'
              ]
            }
          }
        ]
      },
      {
        actNum: 3,
        title: 'Caves of a Thousand Manuscripts',
        hook: 'A walled-up desert library preserved ten centuries of forgotten voices.',
        scenes: [
          {
            sceneType: 'document',
            headline: 'Cave 17 at Dunhuang Oasis',
            narration: 'In 1900, a caretaker clearing sand inside the Mogao Caves at Dunhuang unsealed a hidden chamber packed floor-to-ceiling with forty thousand scrolls in Chinese, Tibetan, Sanskrit, Sogdian, and Hebrew—silent proof of how many worlds met beside one desert spring.',
            visual: {
              dateLabel: 'Sealed c. 1002 CE · Opened 1900',
              location: 'Mogao Grottoes, Dunhuang',
              quote: 'Inside a ten-foot-square stone room rested texts in eleven tongues—from tax receipts to the earliest dated printed book.',
              attribution: 'Dunhuang Library Cave Archive (868 CE Diamond Sutra)'
            }
          },
          {
            sceneType: 'timeline',
            headline: 'When Ships Replaced Caravans',
            narration: 'After Mongol peace briefly united the route in the thirteenth century, plague, fractured khanates, and new ocean caravels sailing around Africa gradually eclipsed the desert trails—turning once-mighty Samarkand into quiet turquoise memory.',
            visual: {
              dateLabel: '1250 – 1500 CE',
              points: [
                '1271 — Marco Polo leaves Venice toward Kublai Khan’s court',
                '1346 — Plague follows caravan ships from Crimea into Mediterranean ports',
                '1405 — Ming treasure fleets chart Indian Ocean spice lanes',
                '1498 — Vasco da Gama reaches Calicut by sea, bypassing overland tolls'
              ]
            }
          }
        ]
      }
    ]
  },
  {
    id: 'dead-sea-scrolls',
    title: 'Dead Sea Scrolls & the Qumran Cliffs',
    subtitle: 'How linen-wrapped clay jars answered two thousand years of textual mystery',
    category: 'biblical',
    era: '250 BCE – 1947 CE',
    centralQuestion: 'What happens to confidence in ancient scripture when a shepherd tosses a stone into a desert cave?',
    takeaway: 'Comparing Qumran manuscripts against medieval copies proved centuries of scribal transmission remained astonishingly faithful.',
    acts: [
      {
        actNum: 1,
        title: 'A Stray Stone in 1947',
        hook: 'Searching for a lost goat above the Dead Sea, young Bedouin herders heard pottery shatter.',
        scenes: [
          {
            sceneType: 'map',
            headline: 'Eleven Caves Above the Salt Sea',
            narration: 'Thirteen hundred feet below sea level, baked limestone cliffs border the barren western shore of the Dead Sea. Protected by scorching dry air, eleven caves near ancient Khirbet Qumran sheltered nearly a thousand parchment and papyrus manuscripts for two millennia.',
            engagement: 'Live chat: Have you ever seen fragments of the Dead Sea Scrolls in person or online?',
            visual: {
              dateLabel: 'Spring 1947 · Cave 1',
              location: 'Judean Desert Cliffs',
              route: ['Jerusalem', 'Jericho', 'Khirbet Qumran', 'Cave 1', 'Cave 4', 'Masada'],
              accentStat: '11 Caves',
              statLabel: '950+ manuscripts recovered across the cliffs'
            }
          },
          {
            sceneType: 'artifact',
            headline: 'The Great Isaiah Scroll in Cave 1',
            narration: 'Pulled from a tall cylindrical clay jar wrapped in bitumen-stained linen, the Great Isaiah Scroll unrolled to twenty-four feet of stitched sheepskin—containing all sixty-six chapters of Isaiah copied around 125 BCE, a full thousand years older than any complete Hebrew manuscript previously known.',
            visual: {
              dateLabel: 'Copied c. 125 BCE',
              artifactName: '1QIsaᵃ — Great Isaiah Scroll',
              material: '17 sheets of sewn sheepskin parchment, iron-carbon ink',
              provenance: 'Qumran Cave 1 · Complete 66 chapters',
              accentStat: '24 ft',
              statLabel: 'continuous preserved Hebrew biblical scroll'
            }
          }
        ]
      },
      {
        actNum: 2,
        title: 'Life at Khirbet Qumran',
        hook: 'Stepped plaster cisterns, inkwells, and dining halls reveal a disciplined desert community.',
        scenes: [
          {
            sceneType: 'profile',
            headline: 'Scribes of the Wilderness Covenant',
            narration: 'Archaeologists digging beside Cave 4 uncovered long plaster benches, bronze and ceramic inkwells, and ten ritual immersion pools fed by winter flash floods. Calling themselves the Yahad, the scribes retreated into the desert to copy scripture and prepare the way of the Lord.',
            visual: {
              dateLabel: 'c. 150 BCE – 68 CE',
              subjectName: 'The Qumran Scriptorium',
              role: 'Desert Monastic Scribes',
              eraSpan: 'Active during Second Temple Judaism',
              quote: 'In the wilderness prepare the way of the Lord; make straight in the desert a highway for our God.'
            }
          },
          {
            sceneType: 'comparison',
            headline: '125 BCE vs. 1008 CE: How Faithful Was the Text?',
            narration: 'Scholars braced for massive textual drift across a thousand-year gap between Qumran and the Leningrad Codex. Instead, word-by-word comparison in Isaiah showed remarkable alignment—most differences being minor spelling shifts, vowel letters, or single-word variants.',
            visual: {
              dateLabel: 'Textual Transmission Test',
              leftTitle: 'Qumran Scrolls (c. 125 BCE)',
              leftItems: [
                'Oldest surviving Hebrew Bible witnesses',
                'Plene spelling with extra vowel letters',
                'Hidden in clay jars before 68 CE Roman advance'
              ],
              rightTitle: 'Leningrad Codex (1008 CE)',
              rightItems: [
                '1,100+ years later Masoretic copy',
                'Nearly identical Isaiah chapter sequence',
                'Confirmed rigorous scribal precision'
              ]
            }
          }
        ]
      },
      {
        actNum: 3,
        title: 'Racing the Tenth Legion',
        hook: 'As Roman troops marched down from Jericho in 68 CE, scribes carried libraries into darkness.',
        scenes: [
          {
            sceneType: 'timeline',
            headline: 'Buried Before the Siege, Read in Our Century',
            narration: 'When Vespasian’s legions burned Qumran during the Jewish Revolt, every jar sealed inside Cave 1 and Cave 4 became a time capsule. Modern infrared imaging still coaxes faded ink off fragments smaller than a postage stamp.',
            visual: {
              dateLabel: '68 CE – Present',
              points: [
                '68 CE — Roman Tenth Legion destroys Qumran settlement',
                '1947 — Ta’amireh Bedouin uncover first seven scrolls in Cave 1',
                '1952 — Cave 4 yields 15,000+ fragments from 500 books',
                '2011+ — Multispectral imaging opens full digital archive to the world'
              ]
            }
          }
        ]
      }
    ]
  },
  {
    id: 'alexandria-library',
    title: 'The Library of Alexandria',
    subtitle: 'Inside the ancient world’s daring quest to collect every scroll ever written',
    category: 'world-history',
    era: 'c. 285 BCE – 391 CE',
    centralQuestion: 'Can a civilization gather every book in the world—and why did so much vanish?',
    takeaway: 'Knowledge is not lost in a single fire; it fades whenever funding, copying, and curiosity dry up.',
    acts: [
      {
        actNum: 1,
        title: 'A City Built for Every Book',
        hook: 'Inspectors boarded incoming cargo ships in Alexandria’s harbor looking not for spices, but scrolls.',
        scenes: [
          {
            sceneType: 'map',
            headline: 'Harbor Inspectors and the Pharos Beam',
            narration: 'Founded beside Egypt’s western Nile mouth, Alexandria linked Greek science to Egyptian memory. Royal clerks famously confiscated every book arriving on docked ships—returning fresh copies to captains while shelving the priceless originals in the Great Library.',
            visual: {
              dateLabel: 'c. 285 – 246 BCE',
              location: 'Ptolemaic Alexandria, Egypt',
              route: ['Athens', 'Rhodes', 'Alexandria Harbor', 'Mouseion', 'Serapeum'],
              accentStat: '400,000+',
              statLabel: 'estimated papyrus rolls cataloged at its peak'
            }
          },
          {
            sceneType: 'profile',
            headline: 'Eratosthenes Measures the Earth With a Shadow',
            narration: 'Chief librarian Eratosthenes never sailed around the planet, yet calculated Earth’s circumference using two shadows and camel caravan distances. By comparing noon sunlight inside a deep well at Syene with an obelisk shadow in Alexandria, he landed within roughly two percent of modern measurements.',
            engagement: 'Live chat: How amazing is measuring a planet using a stick’s shadow and geometry?',
            visual: {
              dateLabel: 'c. 240 BCE',
              subjectName: 'Eratosthenes of Cyrene',
              role: '3rd Chief Librarian · Father of Geography',
              eraSpan: 'c. 276 – 194 BCE',
              quote: 'If the shadow at Alexandria tilts seven degrees while Syene’s well shines straight down, Earth itself curves by one-fiftieth of a circle.'
            }
          }
        ]
      },
      {
        actNum: 2,
        title: 'Ordering Chaos With the Pinakes',
        hook: 'Before alphabetical shelves existed, a poet invented the ancestor of every library catalog.',
        scenes: [
          {
            sceneType: 'artifact',
            headline: 'Callimachus and the 120-Scroll Catalog',
            narration: 'Piles of unlabeled papyrus meant scholars could never find what they owned. Scholar-poet Callimachus sorted works by genre, author biography, opening line, and length—creating the Pinakes, the world’s first systematic bibliography.',
            visual: {
              dateLabel: 'c. 260 BCE',
              artifactName: 'The Pinakes (Tables of Eminent Authors)',
              material: '120-scroll alphabetical & subject index',
              provenance: 'Great Mouseion Hall, Alexandria',
              accentStat: '120 Scrolls',
              statLabel: 'indexing tragedy, law, history, astronomy, and medicine'
            }
          },
          {
            sceneType: 'timeline',
            headline: 'Four Centuries of Slow Diminishing Fires',
            narration: 'Myth blames a single dramatic blaze for Alexandria’s loss. In truth, the library declined over four centuries—harbor warehouse fires in 48 BCE, civil street wars under Aurelian in 272 CE, imperial defunding, and the closing of the Serapeum in 391 CE.',
            visual: {
              dateLabel: '48 BCE – 391 CE',
              points: [
                '48 BCE — Julius Caesar’s harbor fire burns docked ships & waterfront scroll depots',
                '272 CE — Palmyrene war devastates the royal Brucheion quarter',
                '391 CE — Patriarch Theophilus orders the sister Serapeum cleared',
                '415 CE — Philosopher Hypatia is slain, symbolizing twilight of pagan scholarship'
              ]
            }
          }
        ]
      },
      {
        actNum: 3,
        title: 'Why the Scrolls Still Echo',
        hook: 'A book survives only as long as someone values copying it to fresh pages.',
        scenes: [
          {
            sceneType: 'document',
            headline: 'Fragments Carried Through Baghdad and Byzantium',
            narration: 'Though most plays of Sophocles and star tables of Hipparchus perished, Euclid’s Elements, Archimedes’ treatises, and Ptolemy’s sky charts survived because copies had already fanned out to Athens, Constantinople, and later Baghdad.',
            visual: {
              dateLabel: 'Legacy · Transmission',
              location: 'Alexandria → Constantinople → Baghdad',
              quote: 'What escaped the Nile survived because distant scribes loved a text enough to copy it onto durable parchment.',
              attribution: 'Archival Lesson of Alexandria'
            }
          }
        ]
      }
    ]
  },
  {
    id: 'paul-mediterranean',
    title: 'Paul’s Voyages Across the Mediterranean',
    subtitle: 'How hand-carried letters turned Roman roads and harbor alleys into a global movement',
    category: 'biblical',
    era: '46 – 64 CE',
    centralQuestion: 'How did an imprisoned tentmaker from Tarsus outlast emperors using letters carried in leather satchels?',
    takeaway: 'Armed only with conviction, hospitality networks, and ink on papyrus, small house churches reshaped Mediterranean ethics.',
    acts: [
      {
        actNum: 1,
        title: 'Citizen of Two Worlds',
        hook: 'Fluent in Greek philosophy, raised in Jerusalem scripture, and holding Roman citizenship.',
        scenes: [
          {
            sceneType: 'profile',
            headline: 'Saul of Tarsus on Roman Highways',
            narration: 'Born in Cilician Tarsus where Stoic lectures filled colonnades, and trained in Jerusalem’s Pharisaic academies, Paul possessed a rare passport across cultural borders. After his dramatic turn near Damascus, every part of his background became a bridge.',
            visual: {
              dateLabel: 'c. 34 – 46 CE',
              subjectName: 'Paul of Tarsus',
              role: 'Tentmaker, Missionary, Epistle Writer',
              eraSpan: 'c. 5 – 65 CE',
              quote: 'To the Greeks I became a Greek, and to the weak I became weak, that by all means I might save some.'
            }
          },
          {
            sceneType: 'map',
            headline: 'Ten Thousand Miles by Sandaled Foot and Grain Ship',
            narration: 'Over three major journeys and a final prisoner voyage, Paul targeted bustling port crossroads—Antioch, Philippi, Thessalonica, Corinth, and Ephesus. Plant a message inside a harbor workshop, and sailors and merchants carried it down every coast.',
            engagement: 'Live chat: Which city from Acts stands out most to you—Philippi, Athens, Corinth, or Ephesus?',
            visual: {
              dateLabel: 'Acts Chapters 13–28',
              location: 'Eastern Mediterranean Basin',
              route: ['Antioch', 'Philippi', 'Athens', 'Corinth', 'Ephesus', 'Rome'],
              accentStat: '10,000+ mi',
              statLabel: 'logged across Roman highways & merchant vessels'
            }
          }
        ]
      },
      {
        actNum: 2,
        title: 'Workshop Philosophy & Midnight Letters',
        hook: 'While leather scraps sat beside awls and needles, couriers prepared to carry papyrus across the sea.',
        scenes: [
          {
            sceneType: 'comparison',
            headline: 'Marble Forums vs. Household Workshops',
            narration: 'Instead of building marble temples, Paul set up shop alongside tentmakers Aquila and Priscilla in Corinth’s artisan quarter. Sermons unfolded over evening bread while couriers like Phoebe and Tychicus carried urgent pastoral letters across treacherous seas.',
            visual: {
              dateLabel: 'Acts 18 · Romans 16',
              leftTitle: 'Imperial City Hierarchy',
              leftItems: [
                'Status divided free citizens & enslaved',
                'Public honor reserved for wealthy patrons',
                'Loyalty sworn to Caesar’s marble busts'
              ],
              rightTitle: 'House Church Fellowship',
              rightItems: [
                'Master and servant ate at one table',
                'Women couriers carried & read key letters',
                'Weekly gifts sent across sea for famine relief'
              ]
            }
          },
          {
            sceneType: 'document',
            headline: 'In Chains, Yet Writing Joy',
            narration: 'Shipwrecked off Malta after two stormy weeks without sun or stars, Paul eventually reached Rome under house guard. Even chained to a Praetorian soldier waiting imperial trial, he dictated Philippians—repeating rejoice sixteen times inside four short chapters.',
            visual: {
              dateLabel: 'c. 60 – 62 CE · Rome',
              location: 'Roman House Guard Quarters',
              quote: 'I want you to know, brothers, that what has happened to me has really served to advance the gospel.',
              attribution: 'Philippians Chapter 1, Verse 12'
            }
          }
        ]
      }
    ]
  },
  {
    id: 'gutenberg-press',
    title: 'Gutenberg’s Press: The Spark of 1450',
    subtitle: 'How adjustable metal type turned months of monastery ink into hours of printed pages',
    category: 'world-history',
    era: '1440 – 1550 CE',
    centralQuestion: 'Why did Gutenberg’s small workshop in Mainz trigger revolutions no king could contain?',
    takeaway: 'Information technology shifts history not by invention alone, but when cheap distribution lets ordinary readers compare ideas.',
    acts: [
      {
        actNum: 1,
        title: 'The Slow Bottleneck of the Scriptorium',
        hook: 'A single calfskin Bible could cost as much as a farmhouse and take a scribe two winters to finish.',
        scenes: [
          {
            sceneType: 'comparison',
            headline: 'Monastery Quill vs. Movable Metal Type',
            narration: 'In 1440, Europe’s books were still painstakingly copied line by line with goose quills. Goldsmith Johannes Gutenberg fused four older crafts—vineyard screw presses, oil-based ink, soft tin-antimony-lead alloy, and an adjustable hand mold—into a single rapid machine.',
            visual: {
              dateLabel: 'c. 1440 – 1455 CE',
              leftTitle: 'Hand-Copied Manuscript',
              leftItems: [
                '1 to 2 years for a single complete Bible',
                'Scribal errors crept in each generation',
                'Library collections numbered mere dozens'
              ],
              rightTitle: 'Mainz Movable Press',
              rightItems: [
                'Thousands of crisp identical letters cast daily',
                'Oil ink clung cleanly to metal letters',
                '20 million books printed by 1500'
              ]
            }
          },
          {
            sceneType: 'artifact',
            headline: 'The Forty-Two Line Bible',
            narration: 'By 1455, Gutenberg’s workshop produced roughly one hundred eighty copies of the forty-two-line Latin Bible, mixing crisp two-column Gothic blackletter type with hand-painted illuminated initials so buyers trusted the new machine.',
            engagement: 'Live chat: Would you trade digital screens for holding an original 1455 folio?',
            visual: {
              dateLabel: '1455 CE · Mainz',
              artifactName: '42-Line Gutenberg Bible Folio',
              material: 'Rag paper & vellum, linseed-soot ink, 290 distinct metal glyphs',
              provenance: 'Mainz Workshop (49 surviving copies today)',
              accentStat: '20M+',
              statLabel: 'volumes circulating across 250 European towns by 1500'
            }
          }
        ]
      },
      {
        actNum: 2,
        title: 'Ideas Outrun Censors',
        hook: 'Once presses dotted every port city, shutting down one workshop never silenced a book.',
        scenes: [
          {
            sceneType: 'map',
            headline: 'From the Rhine Down Every Trade Corridor',
            narration: 'After debt foreclosed Gutenberg’s Mainz shop, his apprentices dispersed down the Rhine and across the Alps—setting up presses in Strasbourg, Venice, Paris, Antwerp, and London within twenty-five years.',
            visual: {
              dateLabel: '1458 – 1495 CE',
              location: 'European Printing Network',
              route: ['Mainz', 'Strasbourg', 'Basel', 'Venice', 'Paris', 'London'],
              accentStat: '250 Cities',
              statLabel: 'operating active printing presses before 1501'
            }
          },
          {
            sceneType: 'document',
            headline: 'Aldus Manutius Invents the Pocket Classic',
            narration: 'In Venice, scholar-printer Aldus Manutius shrank heavy lectern volumes into pocket-sized octavos set in slanted italic type—making Greek philosophy and Latin verse affordable to students on the move.',
            visual: {
              dateLabel: '1501 CE · Venice',
              location: 'Aldine Press Workshop',
              quote: 'Books no longer needed heavy oak desks; a scholar could slip Virgil or Homer into a traveling cloak.',
              attribution: 'Renaissance Publishing Revolution'
            }
          }
        ]
      }
    ]
  },
  {
    id: 'constantinople-1453',
    title: 'Constantinople 1453: The Walls of a Millennium',
    subtitle: 'Fifty-three days between medieval stone battlements and gunpowder cannons',
    category: 'world-history',
    era: 'April – May 1453 CE',
    centralQuestion: 'What finally brought down fortifications that had repelled twenty-three sieges across a thousand years?',
    takeaway: 'May 1453 closed the medieval world in Europe, shifted spice routes toward the Atlantic, and carried Greek manuscripts into Renaissance Italy.',
    acts: [
      {
        actNum: 1,
        title: 'Two Emperors Face the Straits',
        hook: 'A twenty-one-year-old sultan forged the largest cannon Europe had ever heard.',
        scenes: [
          {
            sceneType: 'map',
            headline: 'The Golden Horn and the Triple Walls',
            narration: 'Protected on three sides by deep waters and along its landward flank by the massive triple Theodosian Walls, Constantinople had withstood Arab, Avar, Bulgar, and Rus fleets for over a thousand years. By 1453, however, barely seven thousand defenders guarded twelve miles of stone.',
            visual: {
              dateLabel: 'April 1453',
              location: 'Bosporus & Golden Horn',
              route: ['Edirne Foundry', 'Rumeli Hisari', 'Theodosian Walls', 'Golden Horn', 'Hagia Sophia'],
              accentStat: '1,123 yrs',
              statLabel: 'capital continuity from Constantine I to Constantine XI'
            }
          },
          {
            sceneType: 'artifact',
            headline: 'Orban’s Twenty-Seven-Foot Bronze Bombard',
            narration: 'Hungarian founder Orban cast a monstrous bronze cannon dragged slowly from Edirne by sixty oxen. Launching twelve-hundred-pound granite spheres, the bombard cracked stone towers before cooling for three hours between shots.',
            engagement: 'Live chat: Could medieval stone walls ever survive industrial-scale artillery?',
            visual: {
              dateLabel: 'Spring 1453',
              artifactName: 'The Basilica Bronze Bombard',
              material: 'Cast bronze barrel · 1,200 lb stone spheres',
              provenance: 'Ottoman Siege Batteries outside St. Romanus Gate',
              accentStat: '1,200 lb',
              statLabel: 'stone cannonball impacting the Theodosian walls'
            }
          }
        ]
      },
      {
        actNum: 2,
        title: 'Ships Over the Hills',
        hook: 'When a heavy iron chain blocked the harbor mouth, Mehmed’s engineers sailed galleys over greased timber roads.',
        scenes: [
          {
            sceneType: 'timeline',
            headline: 'Fifty-Three Days of Ingenuity and Valor',
            narration: 'Barred from entering the Golden Horn by a floating iron chain, Sultan Mehmed ordered seventy ships hauled over greased wooden skids behind Galata’s hills—stunning defenders at dawn with Ottoman sails inside their own inner harbor.',
            visual: {
              dateLabel: 'April 6 – May 29, 1453',
              points: [
                'April 6 — Siege opens across four miles of the Theodosian land wall',
                'April 22 — Seventy Ottoman vessels dragged overland into the Golden Horn',
                'May 28 — Final twilight liturgy echoes inside Hagia Sophia',
                'May 29 — Final dawn assault breaches walls near the St. Romanus Gate'
              ]
            }
          },
          {
            sceneType: 'document',
            headline: 'A Sea Route Imperative Changes the Globe',
            narration: 'Fleeing scholars carried Greek Plato, Aristotle, and New Testament manuscripts directly to Florence and Venice. Meanwhile, steep Ottoman tariffs on Eastern spices spurred Iberian navigators to seek sea lanes west and south—opening the Age of Voyages.',
            visual: {
              dateLabel: 'Aftermath · 1453 – 1498',
              location: 'Istanbul to Florence & Lisbon',
              quote: 'A single city’s fall turned European minds back to classical Greek while turning European hulls out onto open oceans.',
              attribution: 'Early Modern Transition Synthesis'
            }
          }
        ]
      }
    ]
  }
];

let customEpisodes: StoryEpisode[] = [];

function loadCustomFromStorage(): void {
  try {
    const raw = localStorage.getItem(CUSTOM_STORIES_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      customEpisodes = parsed.filter((ep) => ep && typeof ep.title === 'string' && Array.isArray(ep.acts) && ep.acts.length > 0);
    }
  } catch {
    customEpisodes = [];
  }
}

function saveCustomToStorage(): void {
  try {
    localStorage.setItem(CUSTOM_STORIES_KEY, JSON.stringify(customEpisodes));
  } catch {
    // ignore storage quota failure
  }
}

function normalizeSceneType(raw: unknown): StorySceneType {
  const s = String(raw || '').toLowerCase().trim();
  if (s === 'map' || s === 'timeline' || s === 'profile' || s === 'comparison' || s === 'artifact') return s;
  return 'document';
}

function validateAndNormalizeEpisode(raw: unknown, idx: number): { ep?: StoryEpisode; err?: string } {
  if (!raw || typeof raw !== 'object') return { err: `Episode ${idx + 1}: not an object` };
  const obj = raw as Record<string, unknown>;
  const title = String(obj.title || '').trim();
  if (title.length < 3) return { err: `Episode ${idx + 1}: missing "title"` };
  const rawActs = Array.isArray(obj.acts) ? obj.acts : [];
  if (!rawActs.length) return { err: `Episode "${title}": must include at least 1 act` };

  const acts: StoryAct[] = [];
  for (let aIdx = 0; aIdx < rawActs.length; aIdx++) {
    const rawAct = rawActs[aIdx] as Record<string, unknown>;
    if (!rawAct || typeof rawAct !== 'object') continue;
    const rawScenes = Array.isArray(rawAct.scenes) ? rawAct.scenes : [];
    const scenes: StoryScene[] = [];
    for (let sIdx = 0; sIdx < rawScenes.length; sIdx++) {
      const sc = rawScenes[sIdx] as Record<string, unknown>;
      if (!sc || typeof sc !== 'object') continue;
      const headline = String(sc.headline || sc.title || `Scene ${sIdx + 1}`).trim();
      const narration = String(sc.narration || sc.text || '').trim();
      if (narration.length < 15) continue;
      const vRaw = (sc.visual && typeof sc.visual === 'object' ? sc.visual : {}) as Record<string, unknown>;
      scenes.push({
        sceneType: normalizeSceneType(sc.sceneType || sc.type),
        headline,
        narration,
        engagement: sc.engagement ? String(sc.engagement).trim() : undefined,
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
          statLabel: vRaw.statLabel ? String(vRaw.statLabel) : undefined
        }
      });
    }
    if (scenes.length) {
      acts.push({
        actNum: Number(rawAct.actNum) || (aIdx + 1),
        title: String(rawAct.title || `Act ${aIdx + 1}`).trim(),
        hook: rawAct.hook ? String(rawAct.hook).trim() : undefined,
        scenes
      });
    }
  }

  if (!acts.length) return { err: `Episode "${title}": no valid scenes with narration found` };
  const rawCat = String(obj.category || '').toLowerCase();
  const category: StoryCategory = rawCat === 'biblical' || rawCat === 'bible' ? 'biblical' : 'world-history';

  return {
    ep: {
      id: String(obj.id || `custom_${Date.now()}_${idx}`),
      title,
      subtitle: String(obj.subtitle || 'Custom documentary narrative').trim(),
      category,
      era: String(obj.era || 'Historical Chronicle').trim(),
      centralQuestion: String(obj.centralQuestion || `How did ${title} unfold and why does it still matter?`).trim(),
      takeaway: String(obj.takeaway || 'History rewards looking closely at human choices, consequences, and continuity.').trim(),
      acts
    }
  };
}

export function loadStoryLibrary(): Promise<void> {
  loadCustomFromStorage();

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
      let totalActs = 0;
      let totalScenes = 0;
      let worldHistory = 0;
      let biblical = 0;
      all.forEach((ep) => {
        if (ep.category === 'biblical') biblical++;
        else worldHistory++;
        totalActs += ep.acts.length;
        ep.acts.forEach((a) => { totalScenes += a.scenes.length; });
      });
      return {
        total: all.length,
        builtIn: BUILT_IN_EPISODES.length,
        custom: customEpisodes.length,
        worldHistory,
        biblical,
        totalActs,
        totalScenes
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
          : (parsed && Array.isArray(parsed.episodes) ? parsed.episodes : (parsed && parsed.title ? [parsed] : []));
        if (!list.length) {
          return { added: 0, skipped: 0, errors: ['Expected an array of episodes or { "episodes": [...] }'] };
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
