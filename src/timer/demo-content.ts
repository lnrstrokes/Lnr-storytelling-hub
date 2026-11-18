/* ============================================================
   lnr Studio — Built-in Short Demo Content (5 items per engine)
   Provides an immediate live showcase for visitors while keeping
   curated full-length banks exclusive to Admin & custom imports.
   ============================================================ */

export interface DemoPlayerRecord {
  player_id: string;
  name: string;
  club: string;
  nationality: string;
  position: string;
  number: string;
  era: 'Active' | 'Legend';
  accent: [string, string];
}

export interface DemoPlayerQuizRecord {
  quiz_id: string;
  category: string;
  mode: 'clues' | 'blur_reveal' | 'zoom_crop' | 'silhouette';
  question: string;
  clues: string[];
  answer_player_id: string;
  reveal_text: string;
  insight: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
}

export const DEMO_BIBLE_QUESTIONS: Array<[string, [string, string, string, string], number, string, string, string]> = [
  [
    'Who led the Israelites across the Jordan River into Canaan?',
    ['Moses', 'Joshua', 'Caleb', 'Gideon'],
    1,
    'Joshua 3:14-17',
    'The priests carried the Ark of the Covenant as the river stopped flowing.',
    'Easy',
  ],
  [
    'Which Old Testament prophet was fed by ravens beside the brook Cherith?',
    ['Elijah', 'Elisha', 'Isaiah', 'Amos'],
    0,
    '1 Kings 17:4-6',
    'Ravens brought Elijah bread and meat every morning and evening during the drought.',
    'Medium',
  ],
  [
    'In which town did Jesus perform His first recorded miracle at a wedding?',
    ['Bethlehem', 'Capernaum', 'Cana', 'Bethany'],
    2,
    'John 2:1-11',
    'Jesus turned six stone water jars into fine wine at a wedding feast in Cana of Galilee.',
    'Easy',
  ],
  [
    'Who climbed a sycamore-fig tree in Jericho just to see Jesus pass by?',
    ['Bartimaeus', 'Zacchaeus', 'Nicodemus', 'Simon Peter'],
    1,
    'Luke 19:1-6',
    'Zacchaeus was a chief tax collector who welcomed Jesus joyfully into his home.',
    'Easy',
  ],
  [
    'Which island did the Apostle Paul survive a shipwreck on during his voyage to Rome?',
    ['Cyprus', 'Crete', 'Patmos', 'Malta'],
    3,
    'Acts 27:39-28:1',
    'All 276 people aboard reached the shore of Malta safely after the storm.',
    'Medium',
  ],
];

export const DEMO_HISTORY_QUESTIONS: Array<[string, [string, string, string, string], number, string, string, string]> = [
  [
    'Which ancient North African city fought Rome in the three Punic Wars?',
    ['Alexandria', 'Carthage', 'Cyrene', 'Memphis'],
    1,
    '264–146 BCE',
    'Carthage was a maritime powerhouse across the western Mediterranean led by figures like Hannibal.',
    'Medium',
  ],
  [
    'In what year did Johannes Gutenberg introduce movable-type printing in Europe?',
    ['c. 1390', 'c. 1440', 'c. 1517', 'c. 1605'],
    1,
    'Mainz, c. 1440 CE',
    'The Gutenberg press drastically reduced book costs and accelerated the European Renaissance.',
    'Medium',
  ],
  [
    'Which civilization engineered stone cities high in the Andes without iron tools or wheeled carts?',
    ['Maya', 'Aztec', 'Inca', 'Olmec'],
    2,
    'Andean Civilization, 15th c.',
    'Inca builders used precision dry-stone masonry and an extensive mountain road network.',
    'Easy',
  ],
  [
    'Which canal officially linked the Mediterranean Sea to the Red Sea in 1869?',
    ['Panama Canal', 'Kiel Canal', 'Suez Canal', 'Erie Canal'],
    2,
    'Opened November 1869',
    'The Suez Canal cut maritime travel between Europe and Asia by thousands of kilometers.',
    'Easy',
  ],
  [
    'Who became the first human to orbit the Earth in April 1961?',
    ['Neil Armstrong', 'Yuri Gagarin', 'John Glenn', 'Alan Shepard'],
    1,
    'Vostok 1, 1961',
    'Yuri Gagarin completed one full orbit aboard Vostok 1 in 108 minutes.',
    'Easy',
  ],
];

export const DEMO_PLAYERS: DemoPlayerRecord[] = [
  {
    player_id: 'DEMO01',
    name: 'Didier Drogba',
    club: 'Chelsea',
    nationality: 'Ivory Coast',
    position: 'Forward',
    number: '11',
    era: 'Legend',
    accent: ['#034694', '#dba111'],
  },
  {
    player_id: 'DEMO02',
    name: 'Andres Iniesta',
    club: 'Barcelona',
    nationality: 'Spain',
    position: 'Midfielder',
    number: '8',
    era: 'Legend',
    accent: ['#a50044', '#004d98'],
  },
  {
    player_id: 'DEMO03',
    name: 'Son Heung-min',
    club: 'Tottenham Hotspur',
    nationality: 'South Korea',
    position: 'Forward',
    number: '7',
    era: 'Active',
    accent: ['#e5e9f0', '#132257'],
  },
  {
    player_id: 'DEMO04',
    name: 'Paolo Maldini',
    club: 'AC Milan',
    nationality: 'Italy',
    position: 'Defender',
    number: '3',
    era: 'Legend',
    accent: ['#fb090b', '#141414'],
  },
  {
    player_id: 'DEMO05',
    name: 'Bukayo Saka',
    club: 'Arsenal',
    nationality: 'England',
    position: 'Winger',
    number: '7',
    era: 'Active',
    accent: ['#ef0107', '#063672'],
  },
];

export const DEMO_PLAYER_QUIZZES: DemoPlayerQuizRecord[] = [
  {
    quiz_id: 'DQ001',
    category: 'Football · Demo',
    mode: 'clues',
    question: 'Guess the player!',
    clues: [
      'I joined Chelsea from Marseille in 2004 and won four Premier League titles.',
      'I scored the 88th-minute equalizer and winning penalty in the 2012 Champions League Final.',
      'I wore #11 at Stamford Bridge and captained the Ivory Coast.',
    ],
    answer_player_id: 'DEMO01',
    reveal_text: 'Didier Drogba',
    insight: 'Scored 10 goals in 10 major cup finals for Chelsea.',
    difficulty: 'Easy',
  },
  {
    quiz_id: 'DQ002',
    category: 'Football · Demo',
    mode: 'blur_reveal',
    question: 'Guess the midfield icon!',
    clues: [
      'I came through La Masia and formed an iconic trio with Xavi and Busquets.',
      'I scored the extra-time winner in the 2010 FIFA World Cup Final.',
      'I wore #8 for Barcelona for over 15 senior seasons.',
    ],
    answer_player_id: 'DEMO02',
    reveal_text: 'Andres Iniesta',
    insight: 'Won 9 La Liga titles and 4 Champions League trophies with Barcelona.',
    difficulty: 'Easy',
  },
  {
    quiz_id: 'DQ003',
    category: 'Football · Demo',
    mode: 'clues',
    question: 'Guess the player!',
    clues: [
      'I started my senior career in the Bundesliga with Hamburger SV and Bayer Leverkusen.',
      'I won the 2021-22 Premier League Golden Boot without taking a single penalty kick.',
      'I wear #7 as captain of both Tottenham Hotspur and South Korea.',
    ],
    answer_player_id: 'DEMO03',
    reveal_text: 'Son Heung-min',
    insight: 'Won the 2020 FIFA Puskas Award for his solo goal against Burnley.',
    difficulty: 'Easy',
  },
  {
    quiz_id: 'DQ004',
    category: 'Football · Demo',
    mode: 'zoom_crop',
    question: 'Guess the legendary defender!',
    clues: [
      'I spent my entire 25-year senior club career with one Italian giant.',
      'I lifted the European Cup / Champions League five times between 1989 and 2007.',
      'My club retired my famous #3 shirt in honor of my family legacy.',
    ],
    answer_player_id: 'DEMO04',
    reveal_text: 'Paolo Maldini',
    insight: 'Made 902 official appearances for AC Milan across 25 seasons.',
    difficulty: 'Medium',
  },
  {
    quiz_id: 'DQ005',
    category: 'Football · Demo',
    mode: 'silhouette',
    question: 'Guess the star!',
    clues: [
      'I graduated from Hale End and broke into the Arsenal first team as a teenager.',
      'I was named Arsenal Player of the Season in back-to-back campaigns.',
      'I cut inside onto my left foot wearing #7 for club and country.',
    ],
    answer_player_id: 'DEMO05',
    reveal_text: 'Bukayo Saka',
    insight: 'Twice voted England Men\'s Player of the Year before turning 23.',
    difficulty: 'Easy',
  },
];

if (typeof window !== 'undefined') {
  (window as unknown as { LNR_DEMO?: unknown }).LNR_DEMO = {
    bible: DEMO_BIBLE_QUESTIONS,
    history: DEMO_HISTORY_QUESTIONS,
    players: DEMO_PLAYERS,
    playerQuizzes: DEMO_PLAYER_QUIZZES,
  };
}
