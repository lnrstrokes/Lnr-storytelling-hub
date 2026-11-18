/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState, ChangeEvent } from 'react';
import {
  Home,
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  Sparkles,
  Volume2,
  VolumeX,
  Settings,
  Music,
  Upload,
  FileCode,
  HelpCircle,
  Church,
  Download,
  Copy,
  ExternalLink,
  CheckCircle2,
  X,
  Smartphone,
  Monitor,
  Maximize2,
  Tv,
  Layers,
  Radio,
  Video,
  Brain,
  Flame,
  Award,
  ChevronRight,
  ShieldCheck,
  Share2,
  Eye,
  EyeOff,
  Cast,
  Image as ImageIcon,
  Trash2,
  MessageSquare,
  Lock,
  ShieldAlert,
  Mail
} from 'lucide-react';
import {
  encryptData,
  decryptData,
  startAntiDebuggingGuard,
  stopAntiDebuggingGuard,
  toggleAntiInspectionListeners
} from './utils/securityProtection';

interface QuizQuestion {
  id: string;
  category: string;
  difficulty: 'Easy' | 'Medium' | 'Hard' | string;
  question: string;
  imageUrl?: string;
  options: {
    letter: 'A' | 'B' | 'C' | 'D';
    text: string;
  }[];
  correctLetter: 'A' | 'B' | 'C' | 'D';
  reference?: string;
  scripture?: string;
  insight: string;
}

function shuffleArray<T>(array: T[]): T[] {
  const shallow = [...array];
  for (let i = shallow.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shallow[i], shallow[j]] = [shallow[j], shallow[i]];
  }
  return shallow;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

// Character-dependent font sizing:
// Longer texts -> Normal / compact font
// Smaller texts -> Medium font
function getQuestionFontClass(text: string): 'font-medium-text' | 'font-regular-text' | 'font-normal-text' {
  const len = text ? text.trim().length : 0;
  if (len < 65) return 'font-medium-text';
  if (len <= 110) return 'font-regular-text';
  return 'font-normal-text';
}

function getOptionFontClass(text: string): 'font-medium-text' | 'font-normal-text' {
  const len = text ? text.trim().length : 0;
  if (len < 26) return 'font-medium-text';
  return 'font-normal-text';
}

const donghuaSeedQuestions: QuizQuestion[] = [
  {
    id: 'd1',
    category: 'Renegade Immortal',
    difficulty: 'Hard',
    question: 'What supreme celestial treasure did Wang Lin obtain in Mount Heng that housed the soul of Situ Nan?',
    imageUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80',
    options: [
      { letter: 'A', text: 'Ancient God Blood Furnace' },
      { letter: 'B', text: 'Heaven Defying Bead' },
      { letter: 'C', text: 'One-Billion Soul Flag' },
      { letter: 'D', text: 'Thunder Celestial Sword' }
    ],
    correctLetter: 'B',
    reference: 'Renegade Immortal Ep. 1 / Ch. 1',
    insight: 'The Heaven Defying Bead is a mysterious ancient treasure missing the element of wood, which allowed Wang Lin to enter the time-dilation bead space.'
  },
  {
    id: 'd2',
    category: 'Renegade Immortal',
    difficulty: 'Medium',
    question: 'Which profound domain did Wang Lin cultivate by living as a mortal woodcarver to observe life, death, and reincarnation?',
    imageUrl: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=800&q=80',
    options: [
      { letter: 'A', text: 'Slaughter Domain' },
      { letter: 'B', text: 'Karma Domain' },
      { letter: 'C', text: 'Life and Death Domain' },
      { letter: 'D', text: 'True and False Domain' }
    ],
    correctLetter: 'C',
    reference: 'Renegade Immortal Ep. 52 (Mortal Reincarnation Arc)',
    insight: 'Wang Lin spent decades carving wooden figures in the mortal world to comprehend the boundary of life and death, achieving his Soul Formation breakthrough.'
  },
  {
    id: 'd3',
    category: 'Renegade Immortal',
    difficulty: 'Hard',
    question: 'Whose royal ancient lineage and physical body memories did Wang Lin inherit inside the Land of the Ancient God?',
    imageUrl: 'https://images.unsplash.com/photo-1544967082-d9d25d867d66?auto=format&fit=crop&w=800&q=80',
    options: [
      { letter: 'A', text: 'Ancient God Tu Si' },
      { letter: 'B', text: 'Celestial Emperor Bai Fan' },
      { letter: 'C', text: 'Ancient Demon Bei Luo' },
      { letter: 'D', text: 'Sovereign of the Sea of Devils' }
    ],
    correctLetter: 'A',
    reference: 'Land of the Ancient God Arc',
    insight: 'Wang Lin took the body inheritance of the 8-star royal Ancient God Tu Si, transforming his physical vessel into an invincible ancient god flesh.'
  },
  {
    id: 'd4',
    category: 'Renegade Immortal',
    difficulty: 'Medium',
    question: 'Who was Wang Lin’s beloved wife, for whose resurrection he spent millennia waging war against the Heavenly Dao?',
    imageUrl: 'https://images.unsplash.com/photo-1532012164546-f432f2e3777f?auto=format&fit=crop&w=800&q=80',
    options: [
      { letter: 'A', text: 'Li Muwan' },
      { letter: 'B', text: 'Liu Mei' },
      { letter: 'C', text: 'Mu Bingmei' },
      { letter: 'D', text: 'Xu Liguo' }
    ],
    correctLetter: 'A',
    reference: 'Sea of Devils & Suzaku Arc',
    insight: 'Li Muwan was an alchemist from the Pill Valley. Her tragic death became the eternal driving force behind Wang Lin defying the heavens to reclaim her soul.'
  },
  {
    id: 'd5',
    category: 'Battle Through the Heavens',
    difficulty: 'Easy',
    question: 'What type of special essence flame did Xiao Yan first refine with the help of Ya Lao in the Desert?',
    imageUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80',
    options: [
      { letter: 'A', text: 'Green Lotus Core Flame' },
      { letter: 'B', text: 'Purifying Lotus Demon Flame' },
      { letter: 'C', text: 'Bone Chilling Flame' },
      { letter: 'D', text: 'Three Thousand Burning Flame' }
    ],
    correctLetter: 'A',
    reference: 'BTTH Ep. 24 (Taguer Desert)',
    insight: 'Xiao Yan refined the Green Lotus Core Flame ranking 19th on the Heavenly Flame list using the Mantra of Flame technique.'
  },
  {
    id: 'd6',
    category: 'Solo Leveling',
    difficulty: 'Medium',
    question: 'What title was bestowed upon Sung Jinwoo after completing the secret Job Change Quest in the Cartenon Temple?',
    options: [
      { letter: 'A', text: 'Shadow Monarch' },
      { letter: 'B', text: 'Ruler of the Dead' },
      { letter: 'C', text: 'Necromancer / Shadow Sovereign' },
      { letter: 'D', text: 'Monarch of Destruction' }
    ],
    correctLetter: 'C',
    reference: 'Solo Leveling Ch. 45',
    insight: 'Sung Jinwoo initially unlocked the Necromancer job class, which immediately upgraded to Shadow Monarch due to his accumulated extra stats.'
  },
  {
    id: 'd7',
    category: 'Perfect World',
    difficulty: 'Hard',
    question: 'Which innate supreme treasure bone was stolen from Shi Hao during his childhood by his own aunt?',
    options: [
      { letter: 'A', text: 'Supreme Human Bone' },
      { letter: 'B', text: 'Kunpeng Primitive Rune' },
      { letter: 'C', text: 'True Dragon Bone' },
      { letter: 'D', text: 'Phoenix Rebirth Bone' }
    ],
    correctLetter: 'A',
    reference: 'Perfect World Ep. 3',
    insight: 'Shi Hao was born with a Supreme Bone, which was forcibly excavated and implanted into his cousin Shi Yi, forcing Shi Hao to regrow an even stronger bone later.'
  }
];

export interface QuizPack {
  id: string;
  name: string;
  category: string;
  questionCount: number;
  isPremium?: boolean;
  questions?: QuizQuestion[];
}

export interface MelodyTrack {
  id: string;
  name: string;
  category: string;
  icon: string;
  description: string;
  freqs: number[];
  filterFreq: number;
  oscType: OscillatorType;
  resonance: number;
}

const gamingLoreSeedQuestions: QuizQuestion[] = [
  {
    id: 'g1',
    category: 'Minecraft',
    difficulty: 'Easy',
    question: 'Which two items must be combined in a crafting grid to produce an Eye of Ender?',
    imageUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80',
    options: [
      { letter: 'A', text: 'Ender Pearl + Blaze Powder' },
      { letter: 'B', text: 'Ender Pearl + Ghast Tear' },
      { letter: 'C', text: 'Eye of Spider + Blaze Rod' },
      { letter: 'D', text: 'Nether Star + Obsidian' }
    ],
    correctLetter: 'A',
    reference: 'Minecraft Mechanics',
    insight: 'Eyes of Ender are essential to locate Strongholds and activate the End Portal frame to reach the Ender Dragon.'
  },
  {
    id: 'g2',
    category: 'Elden Ring',
    difficulty: 'Hard',
    question: 'Who shattered the Elden Ring into Great Runes following the Night of the Black Knives?',
    imageUrl: 'https://images.unsplash.com/photo-1544967082-d9d25d867d66?auto=format&fit=crop&w=800&q=80',
    options: [
      { letter: 'A', text: 'Queen Marika the Eternal' },
      { letter: 'B', text: 'Radagon of the Golden Order' },
      { letter: 'C', text: 'General Radahn' },
      { letter: 'D', text: 'Ranni the Witch' }
    ],
    correctLetter: 'A',
    reference: 'Elden Ring Lore (Lands Between)',
    insight: 'Queen Marika shattered the Elden Ring with her hammer, prompting Radagon’s desperate attempt to repair it and triggering the Shattering war.'
  },
  {
    id: 'g3',
    category: 'Zelda Lore',
    difficulty: 'Medium',
    question: 'In The Legend of Zelda universe, which sacred artifact is composed of Power, Wisdom, and Courage?',
    imageUrl: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=800&q=80',
    options: [
      { letter: 'A', text: 'The Triforce' },
      { letter: 'B', text: 'The Master Sword' },
      { letter: 'C', text: 'The Ocarina of Time' },
      { letter: 'D', text: 'The Sacred Bell' }
    ],
    correctLetter: 'A',
    reference: 'Zelda: Ocarina of Time & Hyrule Historia',
    insight: 'Left by the Golden Goddesses Din, Nayru, and Farore, the Triforce grants the wish of whoever touches it.'
  },
  {
    id: 'g4',
    category: 'Retro Gaming',
    difficulty: 'Easy',
    question: 'Which legendary game creator designed Super Mario Bros, Donkey Kong, and The Legend of Zelda at Nintendo?',
    imageUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=800&q=80',
    options: [
      { letter: 'A', text: 'Shigeru Miyamoto' },
      { letter: 'B', text: 'Hideo Kojima' },
      { letter: 'C', text: 'Satoru Iwata' },
      { letter: 'D', text: 'Shinji Mikami' }
    ],
    correctLetter: 'A',
    reference: 'Nintendo History',
    insight: 'Shigeru Miyamoto joined Nintendo in 1977 and revolutionized interactive game design across four decades.'
  },
  {
    id: 'g5',
    category: 'Cyberpunk & Sci-Fi',
    difficulty: 'Medium',
    question: 'In CD Projekt Red’s Cyberpunk 2077, whose rockstar consciousness is stored on the prototype Relic biochip inside V’s neural port?',
    imageUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=800&q=80',
    options: [
      { letter: 'A', text: 'Johnny Silverhand' },
      { letter: 'B', text: 'Morgan Blackhand' },
      { letter: 'C', text: 'Adam Smasher' },
      { letter: 'D', text: 'Saburo Arasaka' }
    ],
    correctLetter: 'A',
    reference: 'Cyberpunk 2077 Lore',
    insight: 'Johnny Silverhand, voiced and motion-captured by Keanu Reeves, was the legendary rockerboy frontman of Samurai.'
  }
];

const worldHistorySeedQuestions: QuizQuestion[] = [
  {
    id: 'h1',
    category: 'Ancient History',
    difficulty: 'Medium',
    question: 'Which legendary Carthaginian general led war elephants across the Alps during the Second Punic War?',
    imageUrl: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=800&q=80',
    options: [
      { letter: 'A', text: 'Scipio Africanus' },
      { letter: 'B', text: 'Hannibal Barca' },
      { letter: 'C', text: 'Hamilcar Barca' },
      { letter: 'D', text: 'Pyrrhus of Epirus' }
    ],
    correctLetter: 'B',
    reference: 'Second Punic War (218 BC)',
    insight: 'Hannibal famously crossed the treacherous Pyrenees and Alps with tens of thousands of infantry and war elephants to surprise the Roman Republic.'
  },
  {
    id: 'h2',
    category: 'Renaissance',
    difficulty: 'Easy',
    question: 'In which Italian city did the Renaissance cultural and artistic rebirth predominantly begin in the 14th century?',
    imageUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80',
    options: [
      { letter: 'A', text: 'Venice' },
      { letter: 'B', text: 'Rome' },
      { letter: 'C', text: 'Florence' },
      { letter: 'D', text: 'Milan' }
    ],
    correctLetter: 'C',
    reference: 'European Renaissance History',
    insight: 'Florence, powered by the patronage of the Medici family and pioneering masters like Brunelleschi and Giotto, was the cradle of the Renaissance.'
  },
  {
    id: 'h3',
    category: 'Space Exploration',
    difficulty: 'Medium',
    question: 'Which Apollo lunar mission commander uttered the famous words: "That’s one small step for man, one giant leap for mankind"?',
    imageUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80',
    options: [
      { letter: 'A', text: 'Buzz Aldrin' },
      { letter: 'B', text: 'Neil Armstrong' },
      { letter: 'C', text: 'Michael Collins' },
      { letter: 'D', text: 'Alan Shepard' }
    ],
    correctLetter: 'B',
    reference: 'Apollo 11 (July 20, 1969)',
    insight: 'Neil Armstrong stepped onto the lunar surface at the Sea of Tranquility on July 20, 1969, marking humanity’s first extraterrestrial touchdown.'
  },
  {
    id: 'h4',
    category: 'Silk Road',
    difficulty: 'Hard',
    question: 'Which Venetian merchant and explorer spent 17 years in China serving the court of Kublai Khan of the Mongol Yuan dynasty?',
    imageUrl: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=800&q=80',
    options: [
      { letter: 'A', text: 'Marco Polo' },
      { letter: 'B', text: 'Ibn Battuta' },
      { letter: 'C', text: 'Ferdinand Magellan' },
      { letter: 'D', text: 'Vasco da Gama' }
    ],
    correctLetter: 'A',
    reference: 'The Travels of Marco Polo (c. 1300)',
    insight: 'Marco Polo recorded his epic travels along the Silk Road, introducing European audiences to paper money, porcelain, and Chinese civilization.'
  },
  {
    id: 'h5',
    category: 'Industrial Revolution',
    difficulty: 'Easy',
    question: 'Whose 1776 commercial perfection of the condenser steam engine fundamentally accelerated the Industrial Revolution?',
    imageUrl: 'https://images.unsplash.com/photo-1532012164546-f432f2e3777f?auto=format&fit=crop&w=800&q=80',
    options: [
      { letter: 'A', text: 'James Watt' },
      { letter: 'B', text: 'Thomas Newcomen' },
      { letter: 'C', text: 'George Stephenson' },
      { letter: 'D', text: 'Eli Whitney' }
    ],
    correctLetter: 'A',
    reference: 'History of Technology & Mechanical Engineering',
    insight: 'James Watt introduced the separate condenser, vastly multiplying thermal efficiency and transforming manufacturing, trains, and mining.'
  }
];

const seedQuestions: QuizQuestion[] = [
  {
    id: 'q1',
    category: 'Old Testament',
    difficulty: 'Hard',
    question: 'Who was the oldest man recorded in the Bible, living to the age of 969 years?',
    imageUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80',
    options: [
      { letter: 'A', text: 'Enoch' },
      { letter: 'B', text: 'Noah' },
      { letter: 'C', text: 'Methuselah' },
      { letter: 'D', text: 'Jared' }
    ],
    correctLetter: 'C',
    scripture: 'Genesis 5:27',
    insight: 'Methuselah died in the very year of the Great Flood. His name prophetically implies "when he dies, it shall be sent".'
  },
  {
    id: 'q2',
    category: 'New Testament',
    difficulty: 'Medium',
    question: 'On the road to which city was Saul blinded by a heavenly light and converted to Christ?',
    imageUrl: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=800&q=80',
    options: [
      { letter: 'A', text: 'Jerusalem' },
      { letter: 'B', text: 'Damascus' },
      { letter: 'C', text: 'Antioch' },
      { letter: 'D', text: 'Rome' }
    ],
    correctLetter: 'B',
    scripture: 'Acts 9:3–5',
    insight: 'Jesus spoke to Saul: "Saul, Saul, why persecutest thou me?" leading to his historic transformation into the Apostle Paul.'
  },
  {
    id: 'q3',
    category: 'Old Testament',
    difficulty: 'Medium',
    question: 'Which female judge and prophetess led Israel to victory alongside Barak against Sisera?',
    imageUrl: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=800&q=80',
    options: [
      { letter: 'A', text: 'Deborah' },
      { letter: 'B', text: 'Ruth' },
      { letter: 'C', text: 'Miriam' },
      { letter: 'D', text: 'Huldah' }
    ],
    correctLetter: 'A',
    scripture: 'Judges 4:4–9',
    insight: 'Deborah held court under the Palm of Deborah in Mount Ephraim, bringing peace to Israel for forty years.'
  },
  {
    id: 'q4',
    category: 'Gospels',
    difficulty: 'Hard',
    question: 'How many silver coins was Judas Iscariot paid to betray Jesus Christ?',
    imageUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80',
    options: [
      { letter: 'A', text: '20 Pieces of Silver' },
      { letter: 'B', text: '30 Pieces of Silver' },
      { letter: 'C', text: '50 Pieces of Silver' },
      { letter: 'D', text: '100 Pieces of Silver' }
    ],
    correctLetter: 'B',
    scripture: 'Matthew 26:15',
    insight: 'Thirty pieces of silver was the exact price of an injured servant prescribed in Exodus 21:32 and foretold in Zechariah 11:12.'
  },
  {
    id: 'q5',
    category: 'Prophets',
    difficulty: 'Medium',
    question: 'Which prophet was commanded by God to marry Gomer as a living picture of Israel’s unfaithfulness?',
    imageUrl: 'https://images.unsplash.com/photo-1544967082-d9d25d867d66?auto=format&fit=crop&w=800&q=80',
    options: [
      { letter: 'A', text: 'Amos' },
      { letter: 'B', text: 'Hosea' },
      { letter: 'C', text: 'Joel' },
      { letter: 'D', text: 'Micah' }
    ],
    correctLetter: 'B',
    scripture: 'Hosea 1:2–3',
    insight: 'Hosea’s enduring love for his unfaithful wife symbolized God’s relentless, redeeming covenant grace toward His people.'
  },
  {
    id: 'q6',
    category: 'Old Testament',
    difficulty: 'Easy',
    question: 'What river did Joshua and the Israelites cross on dry ground to enter the Promised Land?',
    imageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
    options: [
      { letter: 'A', text: 'Nile River' },
      { letter: 'B', text: 'Euphrates' },
      { letter: 'C', text: 'Jordan River' },
      { letter: 'D', text: 'Tigris' }
    ],
    correctLetter: 'C',
    scripture: 'Joshua 3:15–17',
    insight: 'The waters upstream piled up in a heap near Adam, while the priests carrying the Ark of the Covenant stood firm in the riverbed.'
  },
  {
    id: 'q7',
    category: 'Wisdom',
    difficulty: 'Medium',
    question: 'According to Proverbs 9:10, what is declared to be the very beginning of wisdom?',
    imageUrl: 'https://images.unsplash.com/photo-1532012164546-f432f2e3777f?auto=format&fit=crop&w=800&q=80',
    options: [
      { letter: 'A', text: 'Human Experience' },
      { letter: 'B', text: 'The Fear of the Lord' },
      { letter: 'C', text: 'Abundant Wealth' },
      { letter: 'D', text: 'Academic Study' }
    ],
    correctLetter: 'B',
    scripture: 'Proverbs 9:10',
    insight: 'The fear of the Lord is reverent awe and surrender to His holy character, which unlocks understanding of the Holy One.'
  },
  {
    id: 'q8',
    category: 'New Testament',
    difficulty: 'Hard',
    question: 'Who was the high priest who presided over the Sanhedrin trial of Jesus?',
    imageUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80',
    options: [
      { letter: 'A', text: 'Annas' },
      { letter: 'B', text: 'Caiaphas' },
      { letter: 'C', text: 'Gamaliel' },
      { letter: 'D', text: 'Nicodemus' }
    ],
    correctLetter: 'B',
    scripture: 'Matthew 26:57',
    insight: 'Joseph Caiaphas served as high priest from AD 18 to 36 and infamously argued that one man should die for the nation.'
  },
  {
    id: 'q9',
    category: 'Old Testament',
    difficulty: 'Hard',
    question: 'What weapon did Samson use to strike down 1,000 Philistine warriors at Lehi?',
    imageUrl: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=800&q=80',
    options: [
      { letter: 'A', text: 'Bronze Spear' },
      { letter: 'B', text: 'Iron Broadsword' },
      { letter: 'C', text: 'Jawbone of a Donkey' },
      { letter: 'D', text: 'Shepherd’s Sling' }
    ],
    correctLetter: 'C',
    scripture: 'Judges 15:15',
    insight: 'Samson declared: "With a donkey’s jawbone I have made donkeys of them; with a donkey’s jawbone I have killed a thousand men."'
  },
  {
    id: 'q10',
    category: 'New Testament',
    difficulty: 'Easy',
    question: 'On the island of Patmos, who received the prophetic revelations of the Book of Revelation?',
    imageUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80',
    options: [
      { letter: 'A', text: 'Apostle Peter' },
      { letter: 'B', text: 'Apostle John' },
      { letter: 'C', text: 'Apostle Paul' },
      { letter: 'D', text: 'Stephen the Martyr' }
    ],
    correctLetter: 'B',
    scripture: 'Revelation 1:9',
    insight: 'John was exiled to Patmos during Emperor Domitian’s reign "for the word of God, and for the testimony of Jesus Christ."'
  }
];

export const SAMPLE_PACKS: QuizPack[] = [
  {
    id: 'ot-1',
    name: 'Old Testament Trivia (10 Questions)',
    category: 'Biblical Study',
    questionCount: 10,
    isPremium: false,
    questions: seedQuestions
  },
  {
    id: 'gaming-1',
    name: 'Retro Gaming Lore (5 Questions)',
    category: 'Gaming Trivia',
    questionCount: 5,
    isPremium: false,
    questions: gamingLoreSeedQuestions
  },
  {
    id: 'history-1',
    name: 'World History Milestones (5 Questions)',
    category: 'History Deep-Dives',
    questionCount: 5,
    isPremium: false,
    questions: worldHistorySeedQuestions
  },
  {
    id: 'anime-1',
    name: 'Renegade Immortal & Anime Lore (7 Questions)',
    category: 'Anime & Donghua',
    questionCount: 7,
    isPremium: false,
    questions: donghuaSeedQuestions
  },
  {
    id: 'premium-1',
    name: 'AI-Generated Custom Pack ✨ (Premium)',
    category: 'Any Creator Niche',
    questionCount: 50,
    isPremium: true
  }
];

export const MELODY_CATEGORIES: MelodyTrack[] = [
  {
    id: 'Gaming Synth',
    name: 'Gaming Synth',
    category: 'Electronic',
    icon: '🎮',
    description: 'Upbeat, retro, electronic synth chords',
    freqs: [261.63, 329.63, 392.00, 523.25, 659.25],
    filterFreq: 1800,
    oscType: 'triangle',
    resonance: 2.8
  },
  {
    id: 'Lo-Fi Focus',
    name: 'Lo-Fi Focus',
    category: 'Ambient Chill',
    icon: '📚',
    description: 'Chill, study-friendly, ambient warm tone',
    freqs: [174.61, 220.00, 261.63, 329.63, 392.00],
    filterFreq: 680,
    oscType: 'sine',
    resonance: 1.6
  },
  {
    id: 'Cinematic Worship',
    name: 'Cinematic Worship',
    category: 'Sacred Pads',
    icon: '⛪',
    description: 'Pads, orchestral, reverent progression',
    freqs: [138.59, 174.61, 207.65, 261.63, 311.13],
    filterFreq: 980,
    oscType: 'triangle',
    resonance: 2.2
  },
  {
    id: 'Deep Ambient',
    name: 'Deep Ambient',
    category: 'Drone & Space',
    icon: '🌌',
    description: 'Drone, space, 432Hz deep meditation',
    freqs: [65.41, 130.81, 196.00, 293.66, 432.00],
    filterFreq: 520,
    oscType: 'sine',
    resonance: 2.5
  },
  {
    id: 'High-Energy Trivia',
    name: 'High-Energy Trivia',
    category: 'Game Show',
    icon: '⚡',
    description: 'Fast-paced, game-show fanfare momentum',
    freqs: [220.00, 277.18, 329.63, 440.00, 554.37],
    filterFreq: 1600,
    oscType: 'sawtooth',
    resonance: 3.2
  },
  {
    id: 'Silence / Custom Audio',
    name: 'Silence / Custom Audio',
    category: 'External Mic/Music',
    icon: '🔇',
    description: 'Muted synth for creators using own mic/music',
    freqs: [],
    filterFreq: 800,
    oscType: 'sine',
    resonance: 1.0
  }
];

const dbName = 'faithstream-hub-v2';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(dbName, 1);
    r.onupgradeneeded = () => {
      if (!r.result.objectStoreNames.contains('media')) {
        r.result.createObjectStore('media');
      }
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function saveMedia(key: string, blob: Blob): Promise<void> {
  const d = await openDb();
  return new Promise((res, rej) => {
    const t = d.transaction('media', 'readwrite');
    t.objectStore('media').put(blob, key);
    t.oncomplete = () => res();
    t.onerror = () => rej(t.error);
  });
}

async function loadMedia(key: string): Promise<Blob | undefined> {
  const d = await openDb();
  return new Promise((res, rej) => {
    const r = d.transaction('media').objectStore('media').get(key);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

async function removeMedia(key: string): Promise<void> {
  const d = await openDb();
  return new Promise(res => {
    const t = d.transaction('media', 'readwrite');
    t.objectStore('media').delete(key);
    t.oncomplete = () => res();
  });
}

export default function App() {
  // NAVIGATION VIEW: 'gateway' (Hub) | 'stage' (Dedicated broadcast stage)
  const [view, setView] = useState<'gateway' | 'stage'>('gateway');

  // SELECTED ENGINE: Exactly 2 engines
  const [engine, setEngine] = useState<'quiz' | 'video'>('quiz');

  // HIDE PANEL MODE: Crucial requirement for clean casting!
  const [panelHidden, setPanelHidden] = useState(false);

  // SCREEN CAST STATE
  const [isCasting, setIsCasting] = useState(false);

  // Church & Ministry Branding (Defaulted to lnr)
  const [church, setChurch] = useState<string>(() => {
    const saved = localStorage.getItem('fs_church');
    if (!saved || saved.toLowerCase().includes('blessing') || saved.toLowerCase().includes('chigozie')) {
      return 'lnr';
    }
    return saved;
  });
  const [lowerThird, setLowerThird] = useState<string>(() => {
    const saved = localStorage.getItem('fs_lower');
    if (!saved || saved.toLowerCase().includes('blessing') || saved.toLowerCase().includes('chigozie')) {
      return 'LNR LIVE WORSHIP & SCRIPTURE CHALLENGE';
    }
    return saved;
  });
  const [website, setWebsite] = useState<string>(() => localStorage.getItem('fs_site') || 'www.lnrstudio.com');
  const [givingCta, setGivingCta] = useState<string>(() => localStorage.getItem('fs_giving') || 'Support lnr • Connect online');
  const [watermark, setWatermark] = useState<string>(() => localStorage.getItem('fs_watermark') || 'LNR');
  const [ticker, setTicker] = useState<string>(
    () => localStorage.getItem('fs_ticker') || 'lnr Studio • Connect in live chat • Type your answer A, B, C, or D'
  );

  // Viewport Settings
  const [aspectRatio, setAspectRatio] = useState<'portrait' | 'landscape'>('portrait');
  const [fullscreenClean, setFullscreenClean] = useState(false);

  // Engine 1: Quiz State
  const [questions, setQuestions] = useState<QuizQuestion[]>(() => {
    try {
      const saved = localStorage.getItem('fs_quiz_questions');
      return saved ? JSON.parse(saved) : seedQuestions;
    } catch {
      return seedQuestions;
    }
  });
  const [qIndex, setQIndex] = useState(0);
  const [qSeconds, setQSeconds] = useState(20);
  const [qRunning, setQRunning] = useState(false);
  const [selectedOpt, setSelectedOpt] = useState<'A' | 'B' | 'C' | 'D' | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [showQuestionImages, setShowQuestionImages] = useState(true);
  const [customStageBgUrl, setCustomStageBgUrl] = useState('');

  // Progressive Auto-Advance Timer State
  const [revealSeconds, setRevealSeconds] = useState(6);
  const [isRevealPhase, setIsRevealPhase] = useState(false);
  const [autoProgress, setAutoProgress] = useState(true);

  // Engine 2: Video State
  const [videoUrl, setVideoUrl] = useState('');
  const [videoName, setVideoName] = useState('Built-in Celestial Worship Background');
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [autoLoop, setAutoLoop] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const ambientCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Dual-Engine Audio State
  const [padActive, setPadActive] = useState(false);
  const [padStyle, setPadStyle] = useState('Gaming Synth');
  const [padVolume, setPadVolume] = useState(65);
  const [selectedPackId, setSelectedPackId] = useState<string>('ot-1');
  const [previewingCategory, setPreviewingCategory] = useState<string | null>(null);
  const previewTimeoutRef = useRef<any>(null);

  const [audioUrl, setAudioUrl] = useState('');
  const [audioName, setAudioName] = useState('Custom Backing Audio');
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioVolume, setAudioVolume] = useState(70);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [masterVolume, setMasterVolume] = useState(85);
  const [muted, setMuted] = useState(false);
  const [sfxEnabled, setSfxEnabled] = useState(true);

  const audioCtx = useRef<AudioContext | null>(null);
  const padGainRef = useRef<GainNode | null>(null);
  const padOscsRef = useRef<OscillatorNode[]>([]);

  // Modals & Notifications
  const [modal, setModal] = useState<'' | 'audio' | 'brand' | 'json' | 'help' | 'youtube' | 'install' | 'quizImages' | 'security' | 'premiumPack'>('');
  const [jsonInput, setJsonInput] = useState('');
  const [aiTopicInput, setAiTopicInput] = useState('Renegade Immortal Wang Lin Cultivation');
  const [toast, setToast] = useState('');

  // PWA Install Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalledPWA, setIsInstalledPWA] = useState(false);
  const [isIOSDevice, setIsIOSDevice] = useState(false);

  // Listen for PWA beforeinstallprompt event (Google Chrome & Android)
  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalledPWA(isStandalone);

    const ua = window.navigator.userAgent.toLowerCase();
    setIsIOSDevice(/iphone|ipad|ipod/.test(ua));

    const handlePrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleInstalled = () => {
      setIsInstalledPWA(true);
      setDeferredPrompt(null);
      notify('lnr Studio installed to your device!');
    };

    window.addEventListener('beforeinstallprompt', handlePrompt);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handlePrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const handleTriggerInstall = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          notify('Installing lnr Studio to your device...');
          setDeferredPrompt(null);
          return;
        }
      } catch (err) {
        console.warn('PWA install prompt error:', err);
      }
    }
    setModal('install');
  };

  // Security & Anti-Reverse Engineering Safeguards State
  const [securityAntiDebug, setSecurityAntiDebug] = useState(true);
  const [securityAntiInspect, setSecurityAntiInspect] = useState(true);
  const [securityDataEncryption, setSecurityDataEncryption] = useState(true);

  // Anti-Debugging Guard Effect
  useEffect(() => {
    if (securityAntiDebug) {
      startAntiDebuggingGuard();
    } else {
      stopAntiDebuggingGuard();
    }
  }, [securityAntiDebug]);

  // Anti-Inspection Keylock Effect
  useEffect(() => {
    toggleAntiInspectionListeners(securityAntiInspect);
    return () => toggleAntiInspectionListeners(false);
  }, [securityAntiInspect]);

  // Current Question
  const currentQ = questions[qIndex % questions.length] || seedQuestions[0];

  // CRITICAL REQUIREMENT: Is content organized and actively playing?
  const isActivelyPlaying = engine === 'quiz' ? qRunning : videoPlaying;

  // Persist branding to localStorage
  useEffect(() => {
    localStorage.setItem('fs_church', church);
    localStorage.setItem('fs_lower', lowerThird);
    localStorage.setItem('fs_site', website);
    localStorage.setItem('fs_giving', givingCta);
    localStorage.setItem('fs_watermark', watermark);
    localStorage.setItem('fs_ticker', ticker);
    localStorage.setItem('fs_quiz_questions', JSON.stringify(questions));
  }, [church, lowerThird, website, givingCta, watermark, ticker, questions]);

  // Screen WakeLock API: Prevents device screen from turning off during 24/7 broadcasting
  useEffect(() => {
    let wakeLockSentinel: any = null;
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator && (isActivelyPlaying || isCasting)) {
          wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
        }
      } catch {}
    };
    requestWakeLock();
    return () => {
      if (wakeLockSentinel) wakeLockSentinel.release().catch(() => {});
    };
  }, [isActivelyPlaying, isCasting]);

  // Load IndexedDB media on launch
  useEffect(() => {
    (async () => {
      try {
        const vBlob = await loadMedia('fs-broadcast-video');
        if (vBlob) {
          setVideoUrl(URL.createObjectURL(vBlob));
          setVideoName('Saved local sermon video');
        }
        const aBlob = await loadMedia('fs-custom-audio');
        if (aBlob) {
          setAudioUrl(URL.createObjectURL(aBlob));
          setAudioName('Saved local backing track');
        }
        const bgBlob = await loadMedia('fs-custom-stage-bg');
        if (bgBlob) {
          setCustomStageBgUrl(URL.createObjectURL(bgBlob));
        }
      } catch {}
    })();
  }, []);

  // Toast auto-dismiss
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  const notify = (msg: string) => setToast(msg);

  // Web Audio SFX (Ticking clock, Success fanfare, Chime, Lifeline)
  const playSfx = (type: 'tick' | 'chime' | 'fanfare' | 'lifeline') => {
    if (!sfxEnabled || muted) return;
    try {
      if (!audioCtx.current) {
        const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioCtx.current = new AudioCtxClass();
      }
      const ctx = audioCtx.current;
      if (ctx.state === 'suspended') ctx.resume();

      const now = ctx.currentTime;
      const eff = (masterVolume / 100);

      if (type === 'tick') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(950, now);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.05);
        gain.gain.setValueAtTime(0.18 * eff, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.05);
      } else if (type === 'chime') {
        [523.25, 659.25, 783.99].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.07);
          gain.gain.setValueAtTime(0, now + idx * 0.07);
          gain.gain.linearRampToValueAtTime(0.09 * eff, now + idx * 0.07 + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.07 + 0.35);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.07);
          osc.stop(now + idx * 0.07 + 0.4);
        });
      } else if (type === 'fanfare') {
        [440, 554.37, 659.25, 880].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + idx * 0.09);
          gain.gain.setValueAtTime(0, now + idx * 0.09);
          gain.gain.linearRampToValueAtTime(0.12 * eff, now + idx * 0.09 + 0.03);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.09 + 0.7);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.09);
          osc.stop(now + idx * 0.09 + 0.75);
        });
      } else if (type === 'lifeline') {
        [600, 450, 300].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.1);
          gain.gain.setValueAtTime(0.08 * eff, now + idx * 0.1);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.2);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.1);
          osc.stop(now + idx * 0.1 + 0.22);
        });
      }
    } catch {}
  };

  // Expanded Background Audio Engine (Web Audio Procedural Synthesis)
  const startPadSynth = (style = padStyle) => {
    try {
      if (style === 'Silence / Custom Audio') {
        stopPadSynth();
        return;
      }

      if (!audioCtx.current) {
        const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioCtx.current = new AudioCtxClass();
      }
      const ctx = audioCtx.current;

      const launchOscs = () => {
        // Stop any currently running pad oscillators cleanly
        padOscsRef.current.forEach(o => {
          try { o.stop(); } catch {}
        });
        padOscsRef.current = [];

        // Find melody definition or fallback to sacred pad
        const melodyDef = MELODY_CATEGORIES.find(m => m.id === style || m.name === style);
        const freqs = melodyDef?.freqs?.length ? melodyDef.freqs : [138.59, 174.61, 207.65, 261.63, 311.13];

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(melodyDef?.filterFreq || 1100, ctx.currentTime);
        filter.Q.value = melodyDef?.resonance || 2.2;

        const padGain = ctx.createGain();
        const effVol = muted ? 0 : (padVolume / 100) * (masterVolume / 100) * 0.22;
        padGain.gain.setValueAtTime(0.0001, ctx.currentTime);
        padGain.gain.linearRampToValueAtTime(effVol, ctx.currentTime + 0.35);

        filter.connect(padGain);
        padGain.connect(ctx.destination);
        padGainRef.current = padGain;

        freqs.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          osc.type = melodyDef?.oscType || (idx % 2 === 0 ? 'sine' : 'triangle');
          osc.frequency.setValueAtTime(freq, ctx.currentTime);
          osc.detune.setValueAtTime((idx - 2) * 5, ctx.currentTime);
          osc.connect(filter);
          osc.start();
          padOscsRef.current.push(osc);
        });

        setPadActive(true);
      };

      if (ctx.state === 'suspended') {
        ctx.resume().then(launchOscs).catch(launchOscs);
      } else {
        launchOscs();
      }
    } catch {
      notify('Audio synthesizer unavailable.');
    }
  };

  const stopPadSynth = () => {
    if (!audioCtx.current || !padGainRef.current) {
      setPadActive(false);
      return;
    }
    const ctx = audioCtx.current;
    const gain = padGainRef.current;
    gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
    setTimeout(() => {
      padOscsRef.current.forEach(o => {
        try { o.stop(); } catch {}
      });
      padOscsRef.current = [];
      setPadActive(false);
    }, 550);
  };

  // Dynamic Audio Preview & Selection (Plays 3-second instant preview)
  const handleSelectMelodyCategory = (catName: string, autoPreview = true) => {
    setPadStyle(catName);
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
      previewTimeoutRef.current = null;
    }

    if (catName === 'Silence / Custom Audio') {
      stopPadSynth();
      setPreviewingCategory(null);
      notify('Audio set to Silence / Custom (External mic/music mode)');
      return;
    }

    if (autoPreview) {
      setPreviewingCategory(catName);
      startPadSynth(catName);
      notify(`▶ 3-Second Audio Preview: ${catName}`);
      previewTimeoutRef.current = setTimeout(() => {
        stopPadSynth();
        setPreviewingCategory(null);
      }, 3200);
    } else {
      startPadSynth(catName);
      notify(`Soundscape active: ${catName}`);
    }
  };

  // Obfuscated contact email resolver (protected from web crawlers & scrapers)
  const getContactEmail = (): string => {
    try {
      // Base64 decoded 'lnrstrokes@gmail.com'
      return atob('bG5yc3Ryb2tlc0BnbWFpbC5jb20=');
    } catch {
      return ['lnrstrokes', 'gmail.com'].join('@');
    }
  };

  // Direct contact handler for Custom Premium Packs (Custom email to creator concierge)
  const handleContactPremiumPack = (customTopic?: string) => {
    const email = getContactEmail();
    const topic = customTopic || aiTopicInput || 'Custom Creator Stream Pack';
    const subject = encodeURIComponent(`[FaithStream Live] Custom Premium Pack Request - ${topic}`);
    const body = encodeURIComponent(
      `Hello FaithStream Creator Concierge,\n\n` +
      `I would like to order a Custom Premium Pack for my live broadcast.\n\n` +
      `• Channel / Stream Name: \n` +
      `• Target Niche / Topic: ${topic}\n` +
      `• Desired Number of Questions: [50 / 100 / 250 / 500 questions]\n` +
      `• Preferred Platform: [YouTube Live, Twitch, Kick, Other]\n` +
      `• Custom Visual Illustrations & Artwork: [Yes / No]\n` +
      `• Reference Citations Required: [Yes / No]\n\n` +
      `Please reply with pricing, delivery turnaround, and pack activation details.\n\n` +
      `Thank you!`
    );

    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
    notify('Opening email to request Custom Premium Pack...');
    setModal('premiumPack');
  };

  // Pack Selector Handler (Instant sample load or Direct to Premium Email)
  const handleSelectPack = (packId: string) => {
    setSelectedPackId(packId);
    if (packId === 'premium-1') {
      handleContactPremiumPack('AI-Generated Custom Pack');
      return;
    }
    const targetPack = SAMPLE_PACKS.find(p => p.id === packId);
    if (targetPack && targetPack.questions && targetPack.questions.length > 0) {
      setQuestions(targetPack.questions);
      setQIndex(0);
      handleResetQuestion();
      notify(`Loaded ${targetPack.name}!`);
    }
  };

  // Sync Pad Volume (Boosted gain factor)
  useEffect(() => {
    if (padGainRef.current && audioCtx.current) {
      const effVol = muted ? 0 : (padVolume / 100) * (masterVolume / 100) * 0.20;
      padGainRef.current.gain.setValueAtTime(effVol, audioCtx.current.currentTime);
    }
  }, [padVolume, masterVolume, muted]);

  // Sync Backing MP3 Audio
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = muted ? 0 : (audioVolume / 100) * (masterVolume / 100);
      if (audioPlaying) audioRef.current.play().catch(() => setAudioPlaying(false));
      else audioRef.current.pause();
    }
  }, [audioPlaying, audioUrl, audioVolume, masterVolume, muted]);

  // Video loop handling
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.loop = autoLoop;
      if (videoPlaying) videoRef.current.play().catch(() => setVideoPlaying(false));
      else videoRef.current.pause();
    }
  }, [videoPlaying, videoUrl, autoLoop]);

  // Progressive Quiz Timer Effect (Thinking Phase -> Answer Reveal Phase -> Auto Advance / Auto Shuffle Loop)
  useEffect(() => {
    if (!qRunning) return;

    if (!isRevealPhase) {
      const t = setInterval(() => {
        setQSeconds(s => {
          if (s <= 1) {
            setIsRevealPhase(true);
            setRevealed(true);
            setRevealSeconds(6);
            playSfx('fanfare');
            return 0;
          }
          // Play clock tick sound on every countdown second
          playSfx('tick');
          return s - 1;
        });
      }, 1000);
      return () => clearInterval(t);
    } else {
      const t = setInterval(() => {
        setRevealSeconds(rs => {
          if (rs <= 1) {
            if (autoProgress) {
              // Advance to next question
              setQIndex(prevIndex => {
                const nextIndex = prevIndex + 1;
                if (nextIndex >= questions.length) {
                  // AUTO-SHUFFLE ON DATASET END: Guarantees continuous 24/7 streaming!
                  setQuestions(qs => shuffleArray(qs));
                  notify('🔀 Quiz set finished! Auto-shuffled dataset for continuous 24/7 stream.');
                  return 0;
                }
                return nextIndex;
              });
              setSelectedOpt(null);
              setRevealed(false);
              setIsRevealPhase(false);
              setQSeconds(20);
              playSfx('chime');
            } else {
              setQRunning(false);
            }
            return 6;
          }
          return rs - 1;
        });
      }, 1000);
      return () => clearInterval(t);
    }
  }, [qRunning, isRevealPhase, autoProgress, questions.length]);

  // Ambient Celestial Worship Canvas (Fallback when no video is loaded)
  useEffect(() => {
    const canvas = ambientCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let t = 0;

    const render = () => {
      t += 0.015;
      const w = (canvas.width = 720);
      const h = (canvas.height = 1280);

      // Deep celestial gradient
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#060c14');
      grad.addColorStop(0.4, '#1b2636');
      grad.addColorStop(0.75, '#281c0e');
      grad.addColorStop(1, '#05070a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Warm divine glow
      ctx.save();
      ctx.globalAlpha = 0.38;
      for (let i = 0; i < 3; i++) {
        const cx = w * 0.5 + Math.sin(t * 0.5 + i) * 120;
        const cy = h * 0.35 + Math.cos(t * 0.4 + i) * 60;
        const rad = ctx.createRadialGradient(cx, cy, 20, cx, cy, 380);
        rad.addColorStop(0, 'rgba(235, 196, 120, 0.5)');
        rad.addColorStop(0.6, 'rgba(180, 130, 60, 0.15)');
        rad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = rad;
        ctx.beginPath();
        ctx.arc(cx, cy, 380, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Floating starlight particles
      ctx.save();
      for (let j = 0; j < 32; j++) {
        const px = (Math.sin(j * 90 + t * 0.25) * 0.5 + 0.5) * w;
        const py = (j * 40 + t * 30) % h;
        const r = (Math.sin(j + t) * 0.5 + 0.5) * 2.5 + 1.2;
        ctx.fillStyle = j % 2 === 0 ? 'rgba(247, 216, 150, 0.7)' : 'rgba(160, 200, 255, 0.5)';
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, []);

  // Next Question
  const handleNextQuestion = () => {
    setQIndex(prevIndex => {
      const nextIndex = prevIndex + 1;
      if (nextIndex >= questions.length) {
        setQuestions(qs => shuffleArray(qs));
        notify('🔀 Auto-shuffled question dataset for continuous 24/7 stream!');
        return 0;
      }
      return nextIndex;
    });
    setQSeconds(20);
    setRevealSeconds(6);
    setIsRevealPhase(false);
    setSelectedOpt(null);
    setRevealed(false);
    setQRunning(true);
    playSfx('chime');
  };

  // Reset Current Question
  const handleResetQuestion = () => {
    setQSeconds(20);
    setRevealSeconds(6);
    setIsRevealPhase(false);
    setSelectedOpt(null);
    setRevealed(false);
    setQRunning(false);
  };

  // Video File Upload
  async function handleVideoUpload(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('video/')) return notify('Please select a valid video file (MP4, WebM).');
    await saveMedia('fs-broadcast-video', f);
    const blob = await loadMedia('fs-broadcast-video');
    if (blob) {
      setVideoUrl(URL.createObjectURL(blob));
      setVideoName(f.name);
      setVideoPlaying(true);
      notify('Video saved and looping.');
    }
  }

  // Audio File Upload
  async function handleAudioUpload(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('audio/')) return notify('Please select an audio file (MP3, WAV).');
    await saveMedia('fs-custom-audio', f);
    const blob = await loadMedia('fs-custom-audio');
    if (blob) {
      setAudioUrl(URL.createObjectURL(blob));
      setAudioName(f.name);
      setAudioPlaying(true);
      notify('Backing audio loaded and playing.');
    }
  }

  // Upload Question Image (For Current Question)
  async function handleQuestionImageUpload(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) return notify('Please select an image file (JPG, PNG, WebP).');
    const localUrl = URL.createObjectURL(f);
    const updated = [...questions];
    updated[qIndex % updated.length] = {
      ...updated[qIndex % updated.length],
      imageUrl: localUrl
    };
    setQuestions(updated);
    notify(`Custom image added to Question ${qIndex + 1}!`);
  }

  // Upload Stage Wallpaper / Background Image
  async function handleStageBgUpload(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) return notify('Please select an image file (JPG, PNG, WebP).');
    await saveMedia('fs-custom-stage-bg', f);
    const blob = await loadMedia('fs-custom-stage-bg');
    if (blob) {
      setCustomStageBgUrl(URL.createObjectURL(blob));
      notify('Custom stage background applied!');
    }
  }

  // Screen Cast / Screen Share Trigger
  const handleStartScreenCast = async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { displaySurface: 'browser' },
          audio: true
        });
        setIsCasting(true);
        notify('Screen Cast active! You are now sharing this broadcast stage.');
        stream.getVideoTracks()[0].onended = () => {
          setIsCasting(false);
          notify('Screen Cast ended.');
        };
      } else {
        setModal('youtube');
      }
    } catch {
      setModal('youtube');
    }
  };

  // Import JSON Questions (Supports both Encrypted .lnr payloads & standard raw JSON)
  const handleImportJson = async () => {
    try {
      let rawText = jsonInput.trim();
      if (!rawText) throw new Error('Please paste a valid JSON or encrypted payload.');
      if (rawText.startsWith('LNR_ENC:')) {
        rawText = await decryptData(rawText);
      }
      const parsed = JSON.parse(rawText);
      if (!Array.isArray(parsed) || !parsed.length) throw new Error('Input must be a valid array of questions.');
      if (!parsed[0].question || !parsed[0].correctLetter) {
        throw new Error('Each object must have "question", "options", and "correctLetter".');
      }
      setQuestions(parsed);
      setQIndex(0);
      handleResetQuestion();
      setModal('');
      setJsonInput('');
      notify(`Loaded ${parsed.length} custom quiz questions!`);
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Invalid JSON or encrypted payload format.');
    }
  };

  // Export Quiz Pack (Encrypted .lnr or Raw JSON)
  const handleExportPack = async (encrypt: boolean = securityDataEncryption) => {
    try {
      let payload = JSON.stringify(questions, null, 2);
      let fileName = 'lnr_studio_quiz_pack.json';
      if (encrypt) {
        payload = await encryptData(payload);
        fileName = 'lnr_studio_quiz_pack.lnr';
      }
      const blob = new Blob([payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      notify(encrypt ? '🔒 Exported AES-GCM Encrypted Pack (.lnr)' : 'Exported JSON Quiz Pack!');
    } catch {
      notify('Export failed.');
    }
  };

  // Copy ChatGPT AI Prompt for any niche or video topic
  const handleCopyAiPrompt = (topic = aiTopicInput) => {
    const promptText = `Generate 10 high-stakes interactive livestream quiz questions for YouTube Live chat about: "${topic || 'General Knowledge & Lore'}".
Format strictly as a valid JSON array where each object has these exact keys:
[
  {
    "id": "q1",
    "category": "${topic || 'General'}",
    "difficulty": "Medium",
    "question": "Engaging, high-clarity trivia question?",
    "imageUrl": "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80",
    "options": [
      { "letter": "A", "text": "First choice" },
      { "letter": "B", "text": "Second choice" },
      { "letter": "C", "text": "Third choice" },
      { "letter": "D", "text": "Fourth choice" }
    ],
    "correctLetter": "C",
    "reference": "Episode / Chapter / Source Reference (e.g. Ep. 72 or Genesis 5:27)",
    "insight": "Fascinating context or lore commentary explaining the correct answer."
  }
]
Output ONLY raw valid JSON with no markdown backticks.`;
    navigator.clipboard?.writeText(promptText).then(() => {
      notify(`AI Prompt for "${topic || 'your niche'}" copied!`);
    });
  };

  // Picture-in-Picture / Clean window
  const handlePopout = async () => {
    try {
      if (videoRef.current && document.pictureInPictureEnabled) {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        } else {
          await videoRef.current.requestPictureInPicture();
          notify('Picture-in-Picture window opened.');
        }
      } else {
        setFullscreenClean(true);
      }
    } catch {
      setFullscreenClean(true);
    }
  };

  // Circular timer circumference
  const timerRadius = 22;
  const timerCircumference = 2 * Math.PI * timerRadius;
  const timerOffset = timerCircumference - (qSeconds / 20) * timerCircumference;

  // =========================================================================
  // VIEWPORT STAGE RENDERER (Shared between normal stage & clean OBS window)
  // =========================================================================
  const renderViewportStage = (isClean = false) => {
    return (
      <div
        className={`stage-frame ${aspectRatio === 'portrait' ? 'portrait' : 'landscape'}`}
        style={isClean ? { maxHeight: '96vh', height: '96vh', width: aspectRatio === 'portrait' ? 'auto' : '96vw' } : {}}
      >
        {/* Stage Background: Video, Custom Stage Wallpaper, or Celestial Loop Canvas */}
        <div className="stage-bg-layer">
          {videoUrl && engine === 'video' ? (
            <video
              ref={videoRef}
              src={videoUrl}
              muted={muted}
              playsInline
              onEnded={() => {
                if (autoLoop && videoRef.current) {
                  videoRef.current.currentTime = 0;
                  videoRef.current.play().catch(() => {});
                }
              }}
            />
          ) : customStageBgUrl && engine === 'quiz' ? (
            <img
              src={customStageBgUrl}
              alt="Stage Backdrop"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <canvas ref={ambientCanvasRef} className="ambient-canvas-fill" />
          )}
        </div>

        <div className="stage-overlay-shade" />

        {/* Top Badges (Only show LIVE ON AIR when active, never show Preview Ready) */}
        <div className="stage-watermark">{watermark || 'FAITH'}</div>
        {isActivelyPlaying && (
          <div className="stage-live-pill on-air">
            <i /> LIVE ON AIR
          </div>
        )}

        {/* Screen Cast Active Pill */}
        {isCasting && (
          <div className="cast-active-pill">
            <Cast size={12} />
            <span>CASTING TO YOUTUBE</span>
          </div>
        )}

        {/* --------------------------------------------------------------- */}
        {/* ENGINE 1: UNIVERSAL INTERACTIVE QUIZ CONTENT                    */}
        {/* --------------------------------------------------------------- */}
        {engine === 'quiz' && (
          <div className="quiz-viewport-stage">
            {/* Live Chat Engagement Callout (Explicitly highlights chat voting) */}
            <div className="live-chat-callout-banner">
              <MessageSquare size={13} color="#f7d896" />
              <span>TYPE <b>A</b>, <b>B</b>, <b>C</b>, or <b>D</b> IN YOUTUBE LIVE CHAT TO GUESS!</span>
            </div>

            {/* Progressive Phase Countdown Bar */}
            <div className="progressive-countdown-bar">
              {isRevealPhase ? (
                <>
                  <span className="active">✦ ANSWER REVEALED</span>
                  <span>NEXT QUESTION IN {revealSeconds}S...</span>
                </>
              ) : (
                <>
                  <span>✦ THINKING PHASE</span>
                  <span>CHAT VOTING OPEN ({qSeconds}S)</span>
                </>
              )}
            </div>

            {/* Meta Row: Category, Difficulty, Question count */}
            <div className="quiz-meta-row">
              <span className="quiz-tag gold">{currentQ.category}</span>
              <span className="quiz-tag">{currentQ.difficulty}</span>
              <span className="quiz-tag" style={{ border: '1px solid #785a26' }}>
                Q {qIndex + 1} / {questions.length}
              </span>
            </div>

            {/* Optional Question Image Illustration */}
            {showQuestionImages && currentQ.imageUrl && (
              <div className="quiz-image-box">
                <img src={currentQ.imageUrl} alt="Question Illustration" />
                <span className="quiz-image-tag">Biblical Illustration</span>
              </div>
            )}

            {/* Big Question Box with Character-Dependent Font Sizing */}
            <div className="quiz-question-box">
              <div className="quiz-question-kicker">PREPARE YOUR ANSWER</div>
              <h1 className={`quiz-question-text ${getQuestionFontClass(currentQ.question)}`}>
                {currentQ.question}
              </h1>
            </div>

            {/* 4 Options Grid (A, B, C, D) with Character-Dependent Font Sizing */}
            <div className="quiz-options-list">
              {currentQ.options.map(opt => {
                const isSelected = selectedOpt === opt.letter;
                const isCorrect = revealed && opt.letter === currentQ.correctLetter;

                let optClass = 'quiz-opt-btn';
                if (isSelected) optClass += ' selected';
                if (isCorrect) optClass += ' correct';

                return (
                  <button
                    key={opt.letter}
                    className={optClass}
                    disabled={revealed}
                    onClick={() => {
                      setSelectedOpt(opt.letter);
                      playSfx('chime');
                    }}
                  >
                    <span className="opt-badge">{opt.letter}</span>
                    <span className={`quiz-opt-text ${getOptionFontClass(opt.text)}`}>{opt.text}</span>
                    {isCorrect && <CheckCircle2 size={18} color="#22c55e" style={{ marginLeft: 'auto', flexShrink: 0 }} />}
                  </button>
                );
              })}
            </div>

            {/* Reveal Answer Card (Universal for any niche or biblical stream) */}
            {revealed && (
              <div className="quiz-reveal-card">
                <div className="reveal-head">
                  <CheckCircle2 size={16} />
                  <span>VERIFIED CORRECT ANSWER</span>
                </div>
                <h3 className={`reveal-answer ${currentQ.options.find(o => o.letter === currentQ.correctLetter)?.text && currentQ.options.find(o => o.letter === currentQ.correctLetter)!.text.length > 25 ? 'font-normal-text' : 'font-medium-text'}`}>
                  Option {currentQ.correctLetter}: {currentQ.options.find(o => o.letter === currentQ.correctLetter)?.text}
                </h3>
                {(currentQ.reference || currentQ.scripture) && (
                  <div className="reveal-scripture-ref">
                    ✦ Source / Reference: {currentQ.reference || currentQ.scripture}
                  </div>
                )}
                <div className={`reveal-insight ${currentQ.insight && currentQ.insight.length > 85 ? 'font-normal-text' : 'font-medium-text'}`}>
                  {currentQ.insight}
                </div>
              </div>
            )}
          </div>
        )}

        {/* --------------------------------------------------------------- */}
        {/* ENGINE 2: VIDEO LOOP BROADCAST OVERLAYS                         */}
        {/* --------------------------------------------------------------- */}
        {engine === 'video' && (
          <>
            <div className="lower-third-overlay">
              <div className="lower-third-church">LIVE AT {church}</div>
              <h2 className="lower-third-title">{lowerThird}</h2>
              <div className="lower-third-sub">
                {website} • {givingCta}
              </div>
            </div>

            <div className="stage-ticker-bar">
              <div className="ticker-slide-track">
                <div className="ticker-phrase">
                  <span>✦</span> {ticker}
                </div>
                <div className="ticker-phrase">
                  <span>✦</span> {ticker}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  // =========================================================================
  // MAIN RENDER
  // =========================================================================
  return (
    <div className="fs-app">
      {/* Hidden Audio Elements */}
      {audioUrl && <audio ref={audioRef} src={audioUrl} loop />}

      {/* Clean Fullscreen OBS Window Mode */}
      {fullscreenClean && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 3000,
            background: '#04070c',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}
        >
          {/* External Header Bar: Completely OUTSIDE the livestream screen */}
          <div
            style={{
              width: '100%',
              padding: '10px 16px',
              background: '#090e16',
              borderBottom: '1px solid #1c2738',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              zIndex: 10
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Tv size={16} color="#d4af37" />
              <span style={{ fontSize: 12.5, fontWeight: 800, color: '#f7d896' }}>
                OBS Clean Source Viewport
              </span>
            </div>
            <button
              style={{
                background: '#1a2434',
                color: '#fff',
                border: '1px solid #2e3e56',
                padding: '7px 14px',
                borderRadius: 8,
                fontWeight: 800,
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer'
              }}
              onClick={() => setFullscreenClean(false)}
            >
              <X size={14} /> Exit OBS Clean View
            </button>
          </div>

          {/* Clean Livestream screen in center with ZERO buttons overlapping */}
          <div
            style={{
              flex: 1,
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '12px',
              overflow: 'hidden'
            }}
          >
            {renderViewportStage(true)}
          </div>
        </div>
      )}

      {/* FLOATING SHOW PANEL BUTTON: Appears when user clicks "Hide Panel" for clean screen casting */}
      {view === 'stage' && panelHidden && (
        <button
          className="floating-show-panel-btn"
          onClick={() => setPanelHidden(false)}
          title="Restore Studio Controls"
        >
          <Eye size={16} />
          <span>Show Studio Controls</span>
        </button>
      )}

      {/* TOP QUICK PILLS (Header Utility Bar) */}
      {!panelHidden && (
        <nav className="top-pill-bar">
          <button className="nav-pill accent" onClick={handleTriggerInstall}>
            <Download size={13} />
            <span>{isInstalledPWA ? 'App Installed ✓' : 'Install Mobile App'}</span>
          </button>

          <button className={`nav-pill ${padActive || audioPlaying ? 'active' : ''}`} onClick={() => setModal('audio')}>
            <Music size={13} />
            <span>Audio &amp; Music</span>
          </button>

          <button className="nav-pill" onClick={() => setModal('json')}>
            <FileCode size={13} />
            <span>Upload JSON</span>
          </button>

          <button className="nav-pill" onClick={() => setModal('quizImages')}>
            <ImageIcon size={13} />
            <span>Quiz Images &amp; Art</span>
          </button>

          <button className="nav-pill" onClick={() => setModal('help')}>
            <HelpCircle size={13} />
            <span>How To Use</span>
          </button>

          <button className="nav-pill" onClick={() => setModal('brand')}>
            <Church size={13} />
            <span>Brand &amp; Overlays</span>
          </button>

          <button className={`nav-pill ${modal === 'security' ? 'active' : ''}`} onClick={() => setModal('security')}>
            <Lock size={13} />
            <span>PWA Security</span>
          </button>

          <button className="nav-pill" onClick={() => handleContactPremiumPack('Creator Support / Bespoke Pack')} title="Contact Concierge & Order Custom Packs">
            <Mail size={13} />
            <span>Contact Concierge</span>
          </button>
        </nav>
      )}

      {/* ================================================================== */}
      {/* 1. GATEWAY / HUB VIEW (Matching the video reference architecture)  */}
      {/* ================================================================== */}
      {view === 'gateway' && (
        <main className="gateway-container">
          <header className="gateway-hero">
            <div className="gateway-badge">
              <Radio size={13} />
              <span>UNIVERSAL BROADCASTING &amp; QUIZ STUDIO</span>
            </div>
            <h1 className="gateway-title">
              {church} <span>Live Gateway</span>
            </h1>
            <p className="gateway-sub">
              Transform your content into high-stakes live challenges and 24/7 automated streams. Select an engine below to broadcast seamlessly to YouTube.
            </p>
          </header>

          {/* 2 PRIMARY ENGINES */}
          <div className="engines-grid">
            {/* ENGINE #1: INTERACTIVE LIVE QUIZ */}
            <article className="engine-card featured">
              <span className="engine-card-corner-tag">ENGINE #1 • INTERACTIVE LIVE QUIZ</span>
              <div className="engine-icon-wrap">
                <Brain size={26} />
              </div>
              <h2 className="engine-card-name">The Universal Quiz Engine for Creators</h2>
              <p className="engine-card-desc">
                Transform your content into high-stakes, 4-choice interactive challenges. Perfect for gaming trivia, history deep-dives, anime lore, educational recaps, or biblical study. Driven by simple, lightweight JSON data.
              </p>

              {/* Pack Selector UI (BACS Freemium Hook & Premium Anchor) */}
              <div className="pack-selector-container">
                <div className="pack-selector-label">
                  <span>Pack Selector &amp; Niche Presets</span>
                  <span style={{ fontSize: 10, color: '#93c5fd' }}>
                    Active: {questions.length} Questions
                  </span>
                </div>

                <select
                  className="pack-select-dropdown"
                  value={selectedPackId}
                  onChange={e => handleSelectPack(e.target.value)}
                >
                  {SAMPLE_PACKS.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.isPremium ? '✨ (Premium)' : '(Free Sample)'}
                    </option>
                  ))}
                </select>

                <div className="pack-actions-row">
                  <button
                    type="button"
                    className="btn-action-freemium"
                    onClick={() => setModal('json')}
                    title="Upload your own JSON questions (Free, instant)"
                  >
                    <Upload size={14} />
                    <span>⬆ Upload Your Own JSON</span>
                  </button>

                  <button
                    type="button"
                    className="btn-action-premium"
                    onClick={() => handleContactPremiumPack()}
                    title="Unlock AI-generated custom packs for any niche"
                  >
                    <Sparkles size={14} />
                    <span>✨ Unlock Premium Custom Packs</span>
                  </button>
                </div>
              </div>

              {/* Feature Bullets */}
              <div className="engine-features-list">
                <div className="engine-feature-item">
                  <CheckCircle2 size={14} />
                  <span>Custom image artwork &amp; video illustration support</span>
                </div>
                <div className="engine-feature-item">
                  <CheckCircle2 size={14} />
                  <span>Verified reference answers &amp; context insights</span>
                </div>
                <div className="engine-feature-item">
                  <CheckCircle2 size={14} />
                  <span>Zero-latency rendering for seamless live streaming</span>
                </div>
              </div>

              <div className="engine-actions-row">
                <button
                  className="btn-launch-engine"
                  onClick={() => {
                    setEngine('quiz');
                    setView('stage');
                    setQRunning(true);
                    setPanelHidden(false);
                    playSfx('chime');
                  }}
                >
                  <Play size={15} fill="currentColor" />
                  <span>START LIVE QUIZ</span>
                </button>
                <button
                  className="btn-engine-tool"
                  onClick={() => setModal('quizImages')}
                  title="Quiz Image & Background Settings"
                >
                  <ImageIcon size={16} />
                </button>
                <button
                  className="btn-engine-tool"
                  onClick={() => setModal('json')}
                  title="Upload Custom Quiz JSON or Select Preset"
                >
                  <Upload size={16} />
                </button>
              </div>
            </article>

            {/* ENGINE #2: 24/7 BROADCAST LOOP */}
            <article className="engine-card">
              <span className="engine-card-corner-tag">ENGINE #2 • 24/7 BROADCAST LOOP</span>
              <div className="engine-icon-wrap">
                <Video size={26} />
              </div>
              <h2 className="engine-card-name">Automated 24/7 Media Broadcasting</h2>
              <p className="engine-card-desc">
                Broadcast pre-recorded footage, gameplay, or educational content continuously. Features customizable lower-third title cards, scrolling text tickers, and seamless screen-casting to YouTube.
              </p>

              {/* Feature Bullets */}
              <div className="engine-features-list">
                <div className="engine-feature-item">
                  <CheckCircle2 size={14} />
                  <span>Seamless continuous video looping in-browser</span>
                </div>
                <div className="engine-feature-item">
                  <CheckCircle2 size={14} />
                  <span>Plays 24/7 on the app while you screen-cast to YouTube</span>
                </div>
                <div className="engine-feature-item">
                  <CheckCircle2 size={14} />
                  <span>&ldquo;Hide Panel&rdquo; mode for a clean, professional mobile broadcast</span>
                </div>
              </div>

              <div className="engine-actions-row">
                <button
                  className="btn-launch-engine"
                  onClick={() => {
                    setEngine('video');
                    setView('stage');
                    setVideoPlaying(true);
                    setPanelHidden(false);
                    playSfx('chime');
                  }}
                >
                  <Video size={16} />
                  <span>LAUNCH VIDEO STREAM LOOP</span>
                </button>
                <label className="btn-engine-tool" title="Upload Local Broadcast Video (MP4)">
                  <Upload size={16} />
                  <input type="file" accept="video/*" style={{ display: 'none' }} onChange={handleVideoUpload} />
                </label>
              </div>
            </article>
          </div>
        </main>
      )}

      {/* ================================================================== */}
      {/* 2. DEDICATED STAGE VIEW (Screen View when engine is launched)     */}
      {/* ================================================================== */}
      {view === 'stage' && (
        <main className={`stage-view-wrapper ${panelHidden ? 'panel-hidden' : ''}`}>
          {/* Stage Top Bar: Home, Title, Tools (Hidden when panelHidden is true) */}
          {!panelHidden && (
            <div className="stage-top-bar">
              <button
                className="btn-home"
                onClick={() => {
                  setView('gateway');
                  setQRunning(false);
                  setVideoPlaying(false);
                  setPanelHidden(false);
                }}
                title="Return to Studio Gateway"
              >
                <Home size={15} />
                <span>Hub</span>
              </button>

              <div className="stage-title-wrap">
                <h2>{engine === 'quiz' ? `${currentQ?.category ? currentQ.category.toUpperCase() : 'INTERACTIVE'} QUIZ LIVE` : '24/7 BROADCAST LOOP'}</h2>
                <small>{engine === 'quiz' ? `Question ${qIndex + 1} of ${questions.length}` : church}</small>
              </div>

              <div className="stage-top-actions">
                <button
                  className={`btn-stage-tool ${aspectRatio === 'portrait' ? 'active' : ''}`}
                  onClick={() => setAspectRatio(a => (a === 'portrait' ? 'landscape' : 'portrait'))}
                  title={aspectRatio === 'portrait' ? 'Switch to Landscape 16:9' : 'Switch to Portrait 9:16'}
                >
                  {aspectRatio === 'portrait' ? <Smartphone size={16} /> : <Monitor size={16} />}
                </button>

                {/* HIDE PANEL BUTTON (User explicit request) */}
                <button
                  className="btn-stage-tool"
                  onClick={() => {
                    setPanelHidden(true);
                    notify('Panels hidden for clean screen casting! Tap the floating button anytime to restore controls.');
                  }}
                  title="Hide Controls (Clean Screen Cast Mode)"
                >
                  <EyeOff size={16} />
                </button>

                <button
                  className="btn-stage-tool"
                  onClick={() => setFullscreenClean(true)}
                  title="Clean OBS Window Capture"
                >
                  <Tv size={16} />
                </button>
                <button
                  className="btn-stage-tool"
                  onClick={() => setModal('brand')}
                  title="Church &amp; Overlay Settings"
                >
                  <Settings size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Master Viewport Monitor (No squinting, crystal clear) */}
          {renderViewportStage()}

          {/* Transport Controller & CONDITIONAL LIVESTREAM UNLOCK BAR (Hidden when panelHidden is true) */}
          {!panelHidden && (
            <section className="stage-control-panel">
              <div className="stage-controller-row">
                {/* Circular Timer for Quiz, or Play Button */}
                {engine === 'quiz' ? (
                  <div className="timer-dial-wrap">
                    <svg width="52" height="52">
                      <circle
                        cx="26"
                        cy="26"
                        r={timerRadius}
                        fill="transparent"
                        stroke="#223042"
                        strokeWidth="4"
                      />
                      <circle
                        cx="26"
                        cy="26"
                        r={timerRadius}
                        fill="transparent"
                        stroke={qSeconds <= 5 ? '#ef4444' : '#d4af37'}
                        strokeWidth="4"
                        strokeDasharray={timerCircumference}
                        strokeDashoffset={timerOffset}
                        strokeLinecap="round"
                        style={{ transition: 'stroke-dashoffset 0.8s linear, stroke 0.3s ease' }}
                      />
                    </svg>
                    <span className="timer-number">{qSeconds}</span>
                  </div>
                ) : null}

                <button
                  className="btn-transport-play"
                  onClick={() => {
                    if (engine === 'quiz') {
                      if (qRunning) setQRunning(false);
                      else {
                        setQRunning(true);
                        playSfx('chime');
                      }
                    } else {
                      if (videoPlaying) {
                        videoRef.current?.pause();
                        setVideoPlaying(false);
                      } else {
                        videoRef.current?.play().then(() => setVideoPlaying(true)).catch(() => {});
                        setVideoPlaying(true);
                      }
                    }
                  }}
                  title={isActivelyPlaying ? 'Pause Playback' : 'Start Playback'}
                >
                  {isActivelyPlaying ? <Pause size={22} /> : <Play size={22} fill="currentColor" />}
                </button>

                <div className="controller-info">
                  <b>
                    {engine === 'quiz'
                      ? (qRunning ? `Question ${qIndex + 1}: ${qSeconds}s Remaining` : 'Quiz Timer Paused')
                      : (videoPlaying ? '24/7 Sermon Loop Playing' : 'Video Loop Paused')}
                  </b>
                  <small>
                    {isActivelyPlaying
                      ? 'Content is actively playing. Ready to screen cast to YouTube!'
                      : 'Click Play to start playback and unlock Livestreaming.'}
                  </small>
                </div>

                <div className="controller-tools">
                  {/* HIDE PANEL BUTTON IN CONTROLLER */}
                  <button
                    className="btn-stage-tool"
                    onClick={() => {
                      setPanelHidden(true);
                      notify('Controls hidden. Stage is now clear for YouTube screen cast.');
                    }}
                    title="Hide Panel"
                  >
                    <EyeOff size={15} />
                  </button>

                  {engine === 'quiz' && (
                    <>
                      {/* Image Upload for Current Question */}
                      <label className="btn-stage-tool" title="Upload Image for this Question">
                        <ImageIcon size={15} />
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={handleQuestionImageUpload}
                        />
                      </label>
                      <button
                        className="btn-stage-tool"
                        onClick={handleResetQuestion}
                        title="Reset Question Timer"
                      >
                        <RotateCcw size={15} />
                      </button>
                      <button
                        className="btn-stage-tool"
                        onClick={() => {
                          setRevealed(true);
                          setQRunning(false);
                          playSfx('fanfare');
                        }}
                        title="Reveal Answer"
                      >
                        <Sparkles size={15} />
                      </button>
                      <button
                        className="btn-stage-tool"
                        onClick={handleNextQuestion}
                        title="Next Question"
                      >
                        <SkipForward size={15} />
                      </button>
                    </>
                  )}

                  {engine === 'video' && (
                    <>
                      <label className="btn-stage-tool" title="Upload New Sermon Video (MP4)">
                        <Upload size={15} />
                        <input type="file" accept="video/*" style={{ display: 'none' }} onChange={handleVideoUpload} />
                      </label>
                      <button
                        className={`btn-stage-tool ${autoLoop ? 'active' : ''}`}
                        onClick={() => setAutoLoop(l => !l)}
                        title="Continuous Loop"
                      >
                        <RotateCcw size={15} />
                      </button>
                    </>
                  )}

                  <button
                    className="btn-stage-tool"
                    onClick={() => setMuted(m => !m)}
                    title={muted ? 'Unmute Audio' : 'Mute Audio'}
                  >
                    {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
                  </button>
                </div>
              </div>

              {/* ------------------------------------------------------------- */}
              {/* CONDITIONAL LIVESTREAM BUTTON (Crucial Requirement!)          */}
              {/* ------------------------------------------------------------- */}
              <div className="livestream-unlock-slot">
                {isActivelyPlaying ? (
                  <button
                    className="btn-live-unlocked"
                    onClick={() => setModal('youtube')}
                  >
                    <Radio size={18} />
                    <span>Go Live / Screen Cast to YouTube (Unlocked)</span>
                  </button>
                ) : (
                  <div
                    className="btn-live-locked"
                    onClick={() => notify('Start playback first to unlock the Go Live button!')}
                  >
                    <Play size={14} />
                    <span>Start Playback to Enable YouTube Livestreaming</span>
                  </div>
                )}
              </div>
            </section>
          )}
        </main>
      )}

      {/* ================================================================== */}
      {/* MODALS                                                             */}
      {/* ================================================================== */}

      {/* 1. YOUTUBE GO LIVE & SCREEN CAST MODAL */}
      {modal === 'youtube' && (
        <div className="fs-modal-backdrop" onClick={() => setModal('')}>
          <div className="fs-modal-content" onClick={e => e.stopPropagation()}>
            <div className="fs-modal-head">
              <h3>
                <Radio size={20} color="#ef4444" />
                <span>Go Live &amp; YouTube Screen Cast</span>
              </h3>
              <button className="btn-close-modal" onClick={() => setModal('')}>
                <X size={16} />
              </button>
            </div>

            <p style={{ fontSize: 13, color: '#c7d6e4', lineHeight: 1.5, margin: '0 0 16px' }}>
              Your 24/7 video or quiz engine plays continuously in the background while the YouTube app connects via screen cast!
            </p>

            {/* Quick Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
              {/* Launch YouTube Screen Cast in Browser */}
              <button
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  background: 'linear-gradient(135deg, #1e40af, #1d4ed8)',
                  color: '#fff',
                  padding: '13px 18px',
                  borderRadius: 10,
                  font: '900 13px Manrope',
                  border: 0,
                  boxShadow: '0 4px 14px rgba(30, 64, 175, 0.4)'
                }}
                onClick={handleStartScreenCast}
              >
                <Cast size={16} />
                <span>{isCasting ? 'Stop Screen Cast' : 'Connect In-Browser Screen Cast'}</span>
              </button>

              <a
                href="https://studio.youtube.com/channel/live/livestreaming"
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  background: 'linear-gradient(135deg, #ef4444, #b91c1c)',
                  color: '#fff',
                  padding: '12px 18px',
                  borderRadius: 10,
                  font: '900 13px Manrope',
                  textDecoration: 'none',
                  boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)'
                }}
              >
                <ExternalLink size={16} />
                <span>Open YouTube Live Studio</span>
              </a>

              <button
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  background: '#192434',
                  border: '1px solid #33445c',
                  color: '#f7d896',
                  padding: '11px 16px',
                  borderRadius: 10,
                  font: '800 12px Manrope'
                }}
                onClick={handlePopout}
              >
                <Tv size={15} />
                <span>Pop-Out Clean Window (For OBS / Screen Cast)</span>
              </button>
            </div>

            {/* Mobile YouTube Screen Cast Instructions */}
            <div style={{ background: '#0a0e15', border: '1px solid #1f2b3a', borderRadius: 10, padding: 14 }}>
              <b style={{ fontSize: 11, color: '#f7d896', textTransform: 'uppercase', letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Smartphone size={14} /> How To Connect Through YouTube Mobile Screen Cast
              </b>
              <ol style={{ fontSize: 12, color: '#9cb1c5', paddingLeft: 18, margin: '8px 0 0', lineHeight: 1.6 }}>
                <li>Open the <b>YouTube Mobile App</b> on your phone.</li>
                <li>Tap the <b>Create (+)</b> button at the bottom and choose <b>Go Live</b>.</li>
                <li>In the top-right corner of the YouTube app, tap the <b>Screen Cast icon (phone with arrow)</b>.</li>
                <li>Enter your broadcast title: <i>&ldquo;{lowerThird}&rdquo;</i>.</li>
                <li>Tap <b>Next</b>, then switch back to this <b>FaithStream Studio</b> app tab.</li>
                <li>Tap <b>&ldquo;Hide Panel&rdquo;</b> on this screen so only your pristine sermon loop or Bible quiz displays!</li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* 2. QUIZ IMAGES & ARTWORK MODAL */}
      {modal === 'quizImages' && (
        <div className="fs-modal-backdrop" onClick={() => setModal('')}>
          <div className="fs-modal-content" onClick={e => e.stopPropagation()}>
            <div className="fs-modal-head">
              <h3>
                <ImageIcon size={20} color="#d4af37" />
                <span>Quiz Images &amp; Stage Backdrops</span>
              </h3>
              <button className="btn-close-modal" onClick={() => setModal('')}>
                <X size={16} />
              </button>
            </div>

            <p style={{ fontSize: 12.5, color: '#9cb1c5', lineHeight: 1.5, margin: '0 0 14px' }}>
              Add visual biblical artwork, historical artifacts, or custom question illustrations to your quiz questions, or upload a custom stage background wallpaper.
            </p>

            {/* Toggle Sample Question Images */}
            <div style={{ background: '#0a0e15', border: '1px solid #1f2b3a', borderRadius: 10, padding: 14, marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <b style={{ fontSize: 12.5, color: '#fff', display: 'block' }}>Display Question Illustrations</b>
                  <span style={{ fontSize: 11, color: '#8c9ea8' }}>Renders biblical art above the question box</span>
                </div>
                <input
                  type="checkbox"
                  style={{ width: 20, height: 20, accentColor: '#d4af37' }}
                  checked={showQuestionImages}
                  onChange={e => setShowQuestionImages(e.target.checked)}
                />
              </div>
            </div>

            {/* Upload Current Question Image */}
            <div style={{ background: '#0a0e15', border: '1px solid #1f2b3a', borderRadius: 10, padding: 14, marginBottom: 14 }}>
              <b style={{ fontSize: 12.5, color: '#f7d896', display: 'block', marginBottom: 6 }}>
                1. Upload Image for Question {qIndex + 1}
              </b>
              <p style={{ fontSize: 11, color: '#8c9ea8', margin: '0 0 10px' }}>
                Current Question: &ldquo;{currentQ.question}&rdquo;
              </p>
              {currentQ.imageUrl && (
                <div style={{ width: '100%', height: 110, borderRadius: 8, overflow: 'hidden', marginBottom: 10 }}>
                  <img src={currentQ.imageUrl} alt="Current" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              )}
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '10px',
                  border: '1.5px dashed #3b4d66',
                  borderRadius: 8,
                  cursor: 'pointer',
                  background: '#121a24',
                  color: '#d4af37',
                  fontSize: 12,
                  fontWeight: 700
                }}
              >
                <Upload size={15} />
                <span>Choose Image for Question {qIndex + 1} (JPG, PNG)</span>
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleQuestionImageUpload} />
              </label>
            </div>

            {/* Upload Stage Background Wallpaper */}
            <div style={{ background: '#0a0e15', border: '1px solid #1f2b3a', borderRadius: 10, padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <b style={{ fontSize: 12.5, color: '#f7d896' }}>2. Custom Stage Background Wallpaper</b>
                {customStageBgUrl && (
                  <button
                    style={{ background: 'transparent', border: 0, color: '#ef4444', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}
                    onClick={async () => {
                      await removeMedia('fs-custom-stage-bg');
                      setCustomStageBgUrl('');
                      notify('Removed custom stage background.');
                    }}
                  >
                    <Trash2 size={12} /> Remove
                  </button>
                )}
              </div>
              <p style={{ fontSize: 11, color: '#8c9ea8', margin: '0 0 10px' }}>
                Replaces the ambient celestial loop with your custom church or event wallpaper.
              </p>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '10px',
                  border: '1.5px dashed #3b4d66',
                  borderRadius: 8,
                  cursor: 'pointer',
                  background: '#121a24',
                  color: '#d4af37',
                  fontSize: 12,
                  fontWeight: 700
                }}
              >
                <Upload size={15} />
                <span>Upload Custom Stage Backdrop Wallpaper</span>
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleStageBgUpload} />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* 3. DUAL-ENGINE AUDIO & MUSIC MODAL */}
      {modal === 'audio' && (
        <div className="fs-modal-backdrop" onClick={() => setModal('')}>
          <div className="fs-modal-content" onClick={e => e.stopPropagation()}>
            <div className="fs-modal-head">
              <h3>
                <Music size={20} color="#d4af37" />
                <span>Audio &amp; Music Engine</span>
              </h3>
              <button className="btn-close-modal" onClick={() => setModal('')}>
                <X size={16} />
              </button>
            </div>

            <p style={{ fontSize: 12.5, color: '#9cb1c5', lineHeight: 1.5, margin: '0 0 14px' }}>
              Select an ambient background melody, chord pad, or upload a custom backing track for your live broadcast.
            </p>

            {/* Synthesizer Pad & Melody Engine */}
            <div style={{ background: '#0a0e15', border: '1px solid #1f2b3a', borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <b style={{ fontSize: 13, color: '#f7d896' }}>1. Synthesizer Melodies &amp; Worship Chords</b>
                <button
                  type="button"
                  style={{
                    background: padActive ? '#2e210e' : '#172230',
                    border: `1px solid ${padActive ? '#d4af37' : '#33445c'}`,
                    color: padActive ? '#f7d896' : '#fff',
                    padding: '6px 12px',
                    borderRadius: 8,
                    fontSize: 11,
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                  onClick={() => (padActive ? stopPadSynth() : handleSelectMelodyCategory(padStyle, false))}
                >
                  {padActive ? 'Stop Soundscape' : 'Start Soundscape'}
                </button>
              </div>

              <div className="fs-field">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <label style={{ margin: 0 }}>Melody Category</label>
                  {previewingCategory && (
                    <span className="melody-preview-tag">
                      🔊 Previewing: {previewingCategory}
                    </span>
                  )}
                </div>
                <select
                  value={padStyle}
                  onChange={e => handleSelectMelodyCategory(e.target.value, true)}
                >
                  {MELODY_CATEGORIES.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.icon} {m.name} — {m.description}
                    </option>
                  ))}
                </select>
              </div>

              {/* Additional Tunes Grid (1-Tap Audition & Select) */}
              <div className="melody-categories-grid" style={{ marginTop: 8, marginBottom: 12 }}>
                {MELODY_CATEGORIES.map(m => {
                  const isActive = padStyle === m.id;
                  const isPreviewing = previewingCategory === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      className={`melody-card-btn ${isActive ? 'active' : ''}`}
                      onClick={() => handleSelectMelodyCategory(m.id, true)}
                    >
                      <div className="melody-card-head">
                        <span className="melody-card-title">
                          <span>{m.icon}</span>
                          <span>{m.name}</span>
                        </span>
                        {isPreviewing ? (
                          <span className="melody-preview-tag">🔊 Playing</span>
                        ) : isActive ? (
                          <span style={{ fontSize: 9, fontWeight: 800, color: '#22c55e' }}>Selected</span>
                        ) : null}
                      </div>
                      <p className="melody-card-desc">{m.description}</p>
                    </button>
                  );
                })}
              </div>

              <div className="fs-field">
                <label>Pad Volume: {padVolume}%</label>
                <div className="slider-row">
                  <Volume2 size={16} color="#889" />
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={padVolume}
                    onChange={e => setPadVolume(+e.target.value)}
                  />
                  <span style={{ fontSize: 11, width: 34, textAlign: 'right' }}>{padVolume}%</span>
                </div>
              </div>
            </div>

            {/* Custom Backing MP3 Track Engine */}
            <div style={{ background: '#0a0e15', border: '1px solid #1f2b3a', borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <b style={{ fontSize: 13, color: '#f7d896', display: 'block', marginBottom: 10 }}>
                2. Custom Backing MP3 Track
              </b>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '12px',
                  border: '1.5px dashed #33445c',
                  borderRadius: 10,
                  cursor: 'pointer',
                  background: '#121a24',
                  color: '#d4af37',
                  fontSize: 12,
                  fontWeight: 700
                }}
              >
                <Upload size={16} />
                <span>{audioName}</span>
                <input type="file" accept="audio/*" style={{ display: 'none' }} onChange={handleAudioUpload} />
              </label>

              {audioUrl && (
                <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
                  <button
                    style={{
                      background: '#1d2a3c',
                      border: '1px solid #3b506e',
                      color: '#fff',
                      padding: '8px 14px',
                      borderRadius: 8,
                      fontSize: 11,
                      fontWeight: 800
                    }}
                    onClick={() => setAudioPlaying(p => !p)}
                  >
                    {audioPlaying ? 'Pause MP3' : 'Play MP3'}
                  </button>
                  <button
                    style={{
                      background: 'transparent',
                      border: 0,
                      color: '#ef4444',
                      fontSize: 11,
                      fontWeight: 700
                    }}
                    onClick={async () => {
                      await removeMedia('fs-custom-audio');
                      setAudioUrl('');
                      setAudioName('Custom Backing Audio');
                      setAudioPlaying(false);
                    }}
                  >
                    Remove Track
                  </button>
                </div>
              )}

              <div className="fs-field" style={{ marginTop: 12 }}>
                <label>MP3 Volume: {audioVolume}%</label>
                <div className="slider-row">
                  <Volume2 size={16} color="#889" />
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={audioVolume}
                    onChange={e => setAudioVolume(+e.target.value)}
                  />
                  <span style={{ fontSize: 11, width: 34, textAlign: 'right' }}>{audioVolume}%</span>
                </div>
              </div>
            </div>

            {/* Master Volume & Audition Sound Test */}
            <div style={{ background: '#0a0e15', border: '1px solid #1f2b3a', borderRadius: 12, padding: 14, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <b style={{ fontSize: 12.5, color: '#f7d896' }}>Audition &amp; Verify Audio Output</b>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    style={{
                      background: '#1d2a3c',
                      border: '1px solid #3b506e',
                      color: '#f7d896',
                      padding: '6px 10px',
                      borderRadius: 8,
                      fontSize: 11,
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      cursor: 'pointer'
                    }}
                    onClick={() => playSfx('tick')}
                  >
                    <Volume2 size={13} /> Test Timer Tick
                  </button>
                  <button
                    style={{
                      background: '#1d2a3c',
                      border: '1px solid #3b506e',
                      color: '#f7d896',
                      padding: '6px 10px',
                      borderRadius: 8,
                      fontSize: 11,
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      cursor: 'pointer'
                    }}
                    onClick={() => playSfx('fanfare')}
                  >
                    <Volume2 size={13} /> Test Fanfare Chime
                  </button>
                </div>
              </div>
              <p style={{ fontSize: 11, color: '#8c9ea8', margin: 0 }}>
                Click &ldquo;Test Fanfare Chime&rdquo; to verify Web Audio is unmuted and audible on your device or screen cast stream.
              </p>
            </div>

            {/* Master & SFX Toggles */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700 }}>
                <input
                  type="checkbox"
                  checked={sfxEnabled}
                  onChange={e => setSfxEnabled(e.target.checked)}
                />
                <span>Enable Sound FX (Clock Tick, Chimes, Fanfares)</span>
              </label>
              <button
                style={{
                  background: '#141c28',
                  border: '1px solid #28374a',
                  color: muted ? '#ef4444' : '#22c55e',
                  padding: '6px 12px',
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
                onClick={() => setMuted(m => !m)}
              >
                {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                <span>{muted ? 'Muted' : 'Unmuted'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. JSON UPLOAD & AI PROMPT MODAL */}
      {modal === 'json' && (
        <div className="fs-modal-backdrop" onClick={() => setModal('')}>
          <div className="fs-modal-content" onClick={e => e.stopPropagation()}>
            <div className="fs-modal-head">
              <h3>
                <FileCode size={20} color="#d4af37" />
                <span>Universal Quiz JSON &amp; Niche Hub</span>
              </h3>
              <button className="btn-close-modal" onClick={() => setModal('')}>
                <X size={16} />
              </button>
            </div>

            <p style={{ fontSize: 12.5, color: '#9cb1c5', lineHeight: 1.5, margin: '0 0 14px' }}>
              Generate interactive livestream quiz questions tailored to <b>any uploaded video, anime/Donghua recap, gaming lore, or biblical study</b>.
            </p>

            {/* 1. Quick 1-Click Preset Packs */}
            <div style={{ background: '#0a0e15', border: '1px solid #1f2b3a', borderRadius: 10, padding: 12, marginBottom: 14 }}>
              <b style={{ fontSize: 11.5, color: '#f7d896', textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 8 }}>
                Quick Niche Starter Presets:
              </b>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6 }}>
                <button
                  style={{
                    background: '#152132',
                    border: '1px solid #294060',
                    color: '#93c5fd',
                    padding: '8px 12px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                  onClick={() => {
                    setQuestions(donghuaSeedQuestions);
                    setQIndex(0);
                    handleResetQuestion();
                    setModal('');
                    notify('Loaded Renegade Immortal & Donghua Lore Quiz!');
                  }}
                >
                  <span>⚔️ Renegade Immortal &amp; Donghua Lore</span>
                  <span style={{ fontSize: 10, color: '#60a5fa' }}>4 Questions</span>
                </button>

                <button
                  style={{
                    background: '#211a0f',
                    border: '1px solid #5a4422',
                    color: '#fde68a',
                    padding: '8px 12px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                  onClick={() => {
                    setQuestions(seedQuestions);
                    setQIndex(0);
                    handleResetQuestion();
                    setModal('');
                    notify('Loaded Bible & Scripture Challenge Quiz!');
                  }}
                >
                  <span>📖 Bible &amp; Scripture Challenge</span>
                  <span style={{ fontSize: 10, color: '#f59e0b' }}>10 Questions</span>
                </button>

                <button
                  style={{
                    background: '#16231c',
                    border: '1px solid #285438',
                    color: '#86efac',
                    padding: '8px 12px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                  onClick={() => {
                    setQuestions(gamingLoreSeedQuestions);
                    setQIndex(0);
                    handleResetQuestion();
                    setModal('');
                    notify('Loaded Retro Gaming & Lore Quiz!');
                  }}
                >
                  <span>🎮 Retro Gaming &amp; Lore</span>
                  <span style={{ fontSize: 10, color: '#4ade80' }}>5 Questions</span>
                </button>
              </div>
            </div>

            {/* 2. Universal AI Prompt Generator */}
            <div style={{ background: '#0a0e15', border: '1px solid #1f2b3a', borderRadius: 10, padding: 12, marginBottom: 14 }}>
              <b style={{ fontSize: 11.5, color: '#f7d896', textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 6 }}>
                Generate Custom Quiz JSON with ChatGPT:
              </b>
              <p style={{ fontSize: 11, color: '#8c9ea8', margin: '0 0 8px' }}>
                Type your video title or niche topic, then copy the prompt:
              </p>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <input
                  style={{
                    flex: 1,
                    background: '#121822',
                    border: '1px solid #263548',
                    borderRadius: 8,
                    padding: '8px 10px',
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 600
                  }}
                  value={aiTopicInput}
                  onChange={e => setAiTopicInput(e.target.value)}
                  placeholder="e.g. Renegade Immortal Ep 75, Minecraft Nether, Sunday Sermon"
                />
                <button
                  style={{
                    background: '#22190d',
                    border: '1px solid #785a26',
                    color: '#f7d896',
                    padding: '8px 12px',
                    borderRadius: 8,
                    fontSize: 11.5,
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    whiteSpace: 'nowrap'
                  }}
                  onClick={() => handleCopyAiPrompt(aiTopicInput)}
                >
                  <Copy size={13} />
                  <span>Copy Prompt</span>
                </button>
              </div>
            </div>

            {/* 3. Paste and Import Custom JSON */}
            <div className="fs-field">
              <label>Paste Custom JSON Array</label>
              <textarea
                rows={6}
                value={jsonInput}
                onChange={e => setJsonInput(e.target.value)}
                placeholder='[{"id":"q1","category":"Renegade Immortal","difficulty":"Medium","question":"What divine artifact...?","imageUrl":"https://...","options":[{"letter":"A","text":"Option 1"},{"letter":"B","text":"Option 2"},{"letter":"C","text":"Option 3"},{"letter":"D","text":"Option 4"}],"correctLetter":"B","reference":"Ep. 1","insight":"Historical context."}]'
              />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                style={{
                  flex: 1,
                  background: 'linear-gradient(135deg, #e3c47f, #b88d3e)',
                  color: '#0a0d14',
                  border: 0,
                  padding: '11px',
                  borderRadius: 10,
                  font: '900 13px Manrope'
                }}
                onClick={handleImportJson}
              >
                Import Custom JSON
              </button>
              <button
                style={{
                  background: '#192434',
                  border: '1px solid #33445c',
                  color: '#cbd5e1',
                  padding: '11px 16px',
                  borderRadius: 10,
                  fontSize: 12,
                  fontWeight: 800
                }}
                onClick={() => {
                  setQuestions(seedQuestions);
                  setQIndex(0);
                  handleResetQuestion();
                  setModal('');
                  notify('Reset to default seed questions.');
                }}
              >
                Reset Default
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PREMIUM CUSTOM PACKS MODAL (BACS Premium Anchor) */}
      {modal === 'premiumPack' && (
        <div className="fs-modal-backdrop" onClick={() => setModal('')}>
          <div className="fs-modal-content" onClick={e => e.stopPropagation()}>
            <div className="fs-modal-head">
              <h3>
                <Sparkles size={20} color="#c084fc" />
                <span>✨ Premium Custom Packs &amp; Niche Expansion</span>
              </h3>
              <button className="btn-close-modal" onClick={() => setModal('')}>
                <X size={16} />
              </button>
            </div>

            <p style={{ fontSize: 12.5, color: '#c4b5fd', lineHeight: 1.5, margin: '0 0 14px' }}>
              Scale your livestreams to any creator niche. Generate unlimited high-yield, 4-choice interactive challenges with verified reference answers and zero latency.
            </p>

            {/* Direct Email Concierge Card (Does not expose raw email address) */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.22), rgba(79, 70, 229, 0.22))',
              border: '1.5px solid rgba(168, 85, 247, 0.6)',
              borderRadius: 12,
              padding: 14,
              marginBottom: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 8
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <b style={{ fontSize: 13, color: '#f3e8ff', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Mail size={16} color="#c084fc" />
                  <span>Direct Creator Email Concierge</span>
                </b>
                <span style={{ fontSize: 9.5, background: '#581c87', color: '#e9d5ff', padding: '2px 8px', borderRadius: 12, fontWeight: 800 }}>
                  Priority Setup
                </span>
              </div>
              <p style={{ fontSize: 11.5, color: '#d8b4fe', margin: 0, lineHeight: 1.45 }}>
                Order a custom 50–500 question pack tailored to your stream, channel lore, book, or exam curriculum. One click prepares your email with pre-filled specifications.
              </p>
              <button
                type="button"
                style={{
                  background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                  border: 0,
                  color: '#fff',
                  padding: '11px 16px',
                  borderRadius: 10,
                  fontSize: 12.5,
                  fontWeight: 900,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(124, 58, 237, 0.45)',
                  marginTop: 4
                }}
                onClick={() => handleContactPremiumPack(aiTopicInput)}
              >
                <Mail size={15} />
                <span>Request Custom Pack via Email Concierge</span>
              </button>
            </div>

            {/* Value Highlights */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8, marginBottom: 16 }}>
              <div style={{ background: '#131127', border: '1px solid #3b2d6e', borderRadius: 10, padding: 10, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 16 }}>⚡</span>
                <div>
                  <b style={{ fontSize: 12, color: '#e9d5ff', display: 'block' }}>50 to 500+ Question Progressive Banks</b>
                  <p style={{ fontSize: 11, color: '#a78bfa', margin: '2px 0 0' }}>Continuous auto-shuffle ensures your stream never stops when datasets finish.</p>
                </div>
              </div>

              <div style={{ background: '#131127', border: '1px solid #3b2d6e', borderRadius: 10, padding: 10, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 16 }}>🔍</span>
                <div>
                  <b style={{ fontSize: 12, color: '#e9d5ff', display: 'block' }}>Verified Citations &amp; Context Insights</b>
                  <p style={{ fontSize: 11, color: '#a78bfa', margin: '2px 0 0' }}>Episode timestamps, scripture books, and historical facts build audience authority.</p>
                </div>
              </div>

              <div style={{ background: '#131127', border: '1px solid #3b2d6e', borderRadius: 10, padding: 10, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 16 }}>🚀</span>
                <div>
                  <b style={{ fontSize: 12, color: '#e9d5ff', display: 'block' }}>Instant Livestream Compatibility</b>
                  <p style={{ fontSize: 11, color: '#a78bfa', margin: '2px 0 0' }}>Runs smoothly in-browser for OBS window capture and YouTube mobile screen sharing.</p>
                </div>
              </div>
            </div>

            {/* Instant Free Sample Switcher */}
            <div style={{ background: '#0a0e15', border: '1px solid #1f2b3a', borderRadius: 10, padding: 12, marginBottom: 14 }}>
              <b style={{ fontSize: 11.5, color: '#f7d896', textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 8 }}>
                Or Instant Load Any Niche Sample:
              </b>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 6 }}>
                {SAMPLE_PACKS.filter(p => !p.isPremium).map(p => (
                  <button
                    key={p.id}
                    type="button"
                    style={{
                      background: '#152132',
                      border: '1px solid #2a3e5c',
                      color: '#cbd5e1',
                      padding: '8px 10px',
                      borderRadius: 8,
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                    onClick={() => {
                      handleSelectPack(p.id);
                      setModal('');
                    }}
                  >
                    <div style={{ color: '#93c5fd', fontWeight: 800 }}>{p.name.split(' (')[0]}</div>
                    <div style={{ fontSize: 9.5, color: '#64748b' }}>{p.questionCount} Questions</div>
                  </button>
                ))}
              </div>
            </div>

            {/* AI Custom Pack JSON Prompt */}
            <div style={{ background: '#0a0e15', border: '1px solid #1f2b3a', borderRadius: 10, padding: 12, marginBottom: 14 }}>
              <b style={{ fontSize: 11.5, color: '#c084fc', textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 6 }}>
                Instant AI Pack Generator Prompt:
              </b>
              <p style={{ fontSize: 11, color: '#94a3b8', margin: '0 0 8px' }}>
                Copy this exact schema prompt to generate custom packs in ChatGPT, Gemini, or Claude:
              </p>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  style={{
                    flex: 1,
                    background: '#121822',
                    border: '1px solid #263548',
                    borderRadius: 8,
                    padding: '8px 10px',
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 600
                  }}
                  value={aiTopicInput}
                  onChange={e => setAiTopicInput(e.target.value)}
                  placeholder="Enter topic: e.g. Elden Ring Lore, AP World History, Medical Terminology"
                />
                <button
                  type="button"
                  style={{
                    background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                    border: 0,
                    color: '#fff',
                    padding: '8px 14px',
                    borderRadius: 8,
                    fontSize: 11.5,
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    whiteSpace: 'nowrap'
                  }}
                  onClick={() => handleCopyAiPrompt(aiTopicInput)}
                >
                  <Copy size={13} />
                  <span>Copy AI Prompt</span>
                </button>
              </div>
            </div>

            {/* Direct Paste & Activate */}
            <div className="fs-field">
              <label>Paste Your Custom JSON Questions Array</label>
              <textarea
                rows={4}
                value={jsonInput}
                onChange={e => setJsonInput(e.target.value)}
                placeholder='[{"id":"p1","category":"Elden Ring","difficulty":"Hard","question":"Who shattered the Elden Ring?","options":[{"letter":"A","text":"Marika"},{"letter":"B","text":"Radahn"},{"letter":"C","text":"Godrick"},{"letter":"D","text":"Malenia"}],"correctLetter":"A","reference":"Lore Chapter 1","insight":"Marika shattered it."}]'
              />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                style={{
                  flex: 1,
                  background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                  color: '#fff',
                  border: 0,
                  padding: '12px',
                  borderRadius: 10,
                  font: '900 13px Manrope',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(124, 58, 237, 0.4)'
                }}
                onClick={() => {
                  handleImportJson();
                  if (jsonInput.trim()) setModal('');
                }}
              >
                ✨ Import &amp; Activate Custom Pack
              </button>
              <button
                type="button"
                style={{
                  background: '#192434',
                  border: '1px solid #33445c',
                  color: '#cbd5e1',
                  padding: '12px 18px',
                  borderRadius: 10,
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
                onClick={() => setModal('')}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. BRAND & OVERLAYS MODAL */}
      {modal === 'brand' && (
        <div className="fs-modal-backdrop" onClick={() => setModal('')}>
          <div className="fs-modal-content" onClick={e => e.stopPropagation()}>
            <div className="fs-modal-head">
              <h3>
                <Church size={20} color="#d4af37" />
                <span>Brand &amp; Stream Overlays</span>
              </h3>
              <button className="btn-close-modal" onClick={() => setModal('')}>
                <X size={16} />
              </button>
            </div>

            <div className="fs-field">
              <label>Church / Ministry Name</label>
              <input value={church} onChange={e => setChurch(e.target.value)} />
            </div>

            <div className="fs-field">
              <label>Lower-Third Headline Banner</label>
              <input value={lowerThird} onChange={e => setLowerThird(e.target.value)} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="fs-field">
                <label>Watermark Initials</label>
                <input value={watermark} onChange={e => setWatermark(e.target.value)} />
              </div>
              <div className="fs-field">
                <label>Donation / Giving Subtext</label>
                <input value={givingCta} onChange={e => setGivingCta(e.target.value)} />
              </div>
            </div>

            <div className="fs-field">
              <label>Website URL</label>
              <input value={website} onChange={e => setWebsite(e.target.value)} />
            </div>

            <div className="fs-field">
              <label>Scrolling Scripture Ticker</label>
              <textarea
                rows={3}
                value={ticker}
                onChange={e => setTicker(e.target.value)}
              />
            </div>

            <button
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #e3c47f, #b88d3e)',
                color: '#0a0d14',
                border: 0,
                padding: '11px',
                borderRadius: 10,
                font: '900 13px Manrope'
              }}
              onClick={() => {
                setModal('');
                notify('Overlays saved successfully.');
              }}
            >
              Save Overlays
            </button>
          </div>
        </div>
      )}

      {/* 6. HOW TO USE MODAL */}
      {modal === 'help' && (
        <div className="fs-modal-backdrop" onClick={() => setModal('')}>
          <div className="fs-modal-content" onClick={e => e.stopPropagation()}>
            <div className="fs-modal-head">
              <h3>
                <HelpCircle size={20} color="#d4af37" />
                <span>How To Broadcast</span>
              </h3>
              <button className="btn-close-modal" onClick={() => setModal('')}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 13, color: '#c7d6e4', lineHeight: 1.55 }}>
              <div>
                <b style={{ color: '#f7d896', display: 'block', marginBottom: 2 }}>Step 1: Choose Your Engine</b>
                Select either <b>Interactive Bible Quiz</b> for live chat participation or <b>24/7 Video &amp; Sermon Loop</b> for continuous sermon broadcasting.
              </div>

              <div>
                <b style={{ color: '#f7d896', display: 'block', marginBottom: 2 }}>Step 2: Start Playback</b>
                Click the <b>Play (▶)</b> button on the stage controller. Content must be actively playing to unlock the broadcast button.
              </div>

              <div>
                <b style={{ color: '#f7d896', display: 'block', marginBottom: 2 }}>Step 3: Hide Panel for Clean Screen Cast</b>
                Click <b>&ldquo;Hide Panel&rdquo; (Eye icon)</b> to remove all control bars, making your screen 100% clean for screen mirroring or casting!
              </div>

              <div>
                <b style={{ color: '#f7d896', display: 'block', marginBottom: 2 }}>Step 4: Go Live to YouTube Mobile</b>
                Open your YouTube mobile app, tap <b>+</b>, choose <b>Go Live</b>, tap the phone <b>Screen Cast icon</b> in the top right, and switch back to this app to stream!
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. INSTALL MOBILE APP (PWA) MODAL */}
      {modal === 'install' && (
        <div className="fs-modal-backdrop" onClick={() => setModal('')}>
          <div className="fs-modal-content" onClick={e => e.stopPropagation()}>
            <div className="fs-modal-head">
              <h3>
                <Smartphone size={20} color="#d4af37" />
                <span>Install lnr Studio PWA</span>
              </h3>
              <button className="btn-close-modal" onClick={() => setModal('')}>
                <X size={16} />
              </button>
            </div>

            <p style={{ fontSize: 13, color: '#c7d6e4', lineHeight: 1.5, margin: '0 0 14px' }}>
              lnr Studio is built as a zero-cost Progressive Web App (PWA) with offline support, local IndexedDB caching, and direct standalone window launch on Android, iOS, Windows, and Mac.
            </p>

            {/* Direct 1-Click Install Button if supported by browser */}
            {deferredPrompt && !isInstalledPWA && (
              <button
                style={{
                  width: '100%',
                  background: 'linear-gradient(135deg, #e3c47f, #b88d3e)',
                  color: '#0a0d14',
                  border: 0,
                  padding: '12px',
                  borderRadius: 10,
                  font: '900 13px Manrope',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  marginBottom: 14,
                  cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(212, 175, 55, 0.4)'
                }}
                onClick={async () => {
                  try {
                    await deferredPrompt.prompt();
                    const choice = await deferredPrompt.userChoice;
                    if (choice.outcome === 'accepted') {
                      notify('lnr Studio installed!');
                      setDeferredPrompt(null);
                      setModal('');
                    }
                  } catch (err) {
                    console.warn(err);
                  }
                }}
              >
                <Download size={16} />
                <span>Install to Home Screen Now</span>
              </button>
            )}

            {isInstalledPWA && (
              <div style={{ background: '#12251a', border: '1px solid #22c55e', color: '#86efac', padding: '10px 14px', borderRadius: 8, fontSize: 12, fontWeight: 800, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle2 size={16} />
                <span>lnr Studio is already running in Standalone PWA mode.</span>
              </div>
            )}

            <div style={{ background: '#0a0e15', border: '1px solid #1f2b3a', borderRadius: 10, padding: 14, fontSize: 12.5, lineHeight: 1.6, color: '#9cb1c5' }}>
              <b style={{ color: '#f7d896', display: 'block', marginBottom: 6 }}>How to Install:</b>
              <div>• <b>Google Chrome (Android / Desktop):</b> Look for the <b>Install App</b> icon in the address bar (or tap <b>⋮ (3 dots) &rarr; &ldquo;Install app&rdquo;</b>).</div>
              <div style={{ marginTop: 6 }}>• <b>Safari (iPhone / iPad):</b> Tap the <b>Share</b> button in the bottom navigation bar &rarr; scroll down &rarr; tap <b>&ldquo;Add to Home Screen&rdquo;</b>.</div>
              <div style={{ marginTop: 6 }}>• <b>Edge / Opera:</b> Click the <b>App Available</b> install button on the right side of the address bar.</div>
            </div>
          </div>
        </div>
      )}

      {/* 8. PWA SECURITY & ANTI-REVERSE ENGINEERING MODAL */}
      {modal === 'security' && (
        <div className="fs-modal-backdrop" onClick={() => setModal('')}>
          <div className="fs-modal-content" onClick={e => e.stopPropagation()}>
            <div className="fs-modal-head">
              <h3>
                <Lock size={20} color="#d4af37" />
                <span>PWA Anti-Reverse Engineering &amp; Security</span>
              </h3>
              <button className="btn-close-modal" onClick={() => setModal('')}>
                <X size={16} />
              </button>
            </div>

            <div style={{ background: '#0b1017', border: '1px solid #1f2b3a', borderRadius: 12, padding: 14, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, color: '#f7d896', fontWeight: 800, fontSize: 13 }}>
                <ShieldAlert size={16} color="#eab308" />
                <span>Client-Side Security Matrix Active</span>
              </div>
              <p style={{ fontSize: 11.5, color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>
                Terser mangling &amp; minification are configured for production builds (`sourcemap: false`, console stripping). Control runtime safeguards below.
              </p>
            </div>

            {/* Safeguard 1: Anti-Debugging Traps */}
            <div className="fs-field" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: '#141c28', borderRadius: 10, border: '1px solid #233246', marginBottom: 12 }}>
              <div>
                <strong style={{ fontSize: 12.5, color: '#fff', display: 'block' }}>Anti-Debugging Inspector Guard</strong>
                <small style={{ fontSize: 10.5, color: '#8c9ea8', display: 'block', marginTop: 2 }}>
                  Triggers obfuscated debugger traps to disrupt step-by-step inspector tracing.
                </small>
              </div>
              <input
                type="checkbox"
                checked={securityAntiDebug}
                onChange={e => {
                  setSecurityAntiDebug(e.target.checked);
                  notify(e.target.checked ? 'Anti-Debugging Guard enabled.' : 'Anti-Debugging Guard disabled.');
                }}
                style={{ width: 18, height: 18, accentColor: '#d4af37', cursor: 'pointer' }}
              />
            </div>

            {/* Safeguard 2: Anti-Inspection Keylock */}
            <div className="fs-field" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: '#141c28', borderRadius: 10, border: '1px solid #233246', marginBottom: 12 }}>
              <div>
                <strong style={{ fontSize: 12.5, color: '#fff', display: 'block' }}>Broadcast Anti-Inspection Keylock</strong>
                <small style={{ fontSize: 10.5, color: '#8c9ea8', display: 'block', marginTop: 2 }}>
                  Blocks F12, Ctrl+Shift+I/J/U, and Right-Click context menus during stream sessions.
                </small>
              </div>
              <input
                type="checkbox"
                checked={securityAntiInspect}
                onChange={e => {
                  setSecurityAntiInspect(e.target.checked);
                  notify(e.target.checked ? 'Anti-Inspection keylock enabled.' : 'Anti-Inspection keylock disabled.');
                }}
                style={{ width: 18, height: 18, accentColor: '#d4af37', cursor: 'pointer' }}
              />
            </div>

            {/* Safeguard 3: Web Crypto AES-GCM Encrypted Pack Export */}
            <div className="fs-field" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: '#141c28', borderRadius: 10, border: '1px solid #233246', marginBottom: 16 }}>
              <div>
                <strong style={{ fontSize: 12.5, color: '#fff', display: 'block' }}>AES-GCM Web Crypto Data Encryption</strong>
                <small style={{ fontSize: 10.5, color: '#8c9ea8', display: 'block', marginTop: 2 }}>
                  Encrypts custom quiz datasets into tamper-proof .lnr encrypted payloads.
                </small>
              </div>
              <input
                type="checkbox"
                checked={securityDataEncryption}
                onChange={e => setSecurityDataEncryption(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: '#d4af37', cursor: 'pointer' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button
                style={{
                  background: 'linear-gradient(135deg, #e3c47f, #b88d3e)',
                  color: '#0a0d14',
                  border: 0,
                  padding: '11px',
                  borderRadius: 10,
                  font: '900 12px Manrope',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6
                }}
                onClick={() => handleExportPack(true)}
              >
                <Lock size={14} />
                <span>Export Encrypted .lnr</span>
              </button>
              <button
                style={{
                  background: '#192434',
                  border: '1px solid #33445c',
                  color: '#cbd5e1',
                  padding: '11px',
                  borderRadius: 10,
                  font: '800 12px Manrope',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6
                }}
                onClick={() => handleExportPack(false)}
              >
                <Download size={14} />
                <span>Export Raw JSON</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST ALERT */}
      {toast && (
        <div className="fs-toast-alert">
          <CheckCircle2 size={16} />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}
