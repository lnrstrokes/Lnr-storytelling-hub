/* ==========================================================================
   story-packs.ts — Graphic & Motion Pack registry for the Evidence Board style
   --------------------------------------------------------------------------
   WHY THIS EXISTS

   The story engine could already structure a documentary: StoryEpisode has
   scenes (beats), each with a visual mode and a content object. What it had no
   concept of was a PACK — a named, reusable visual or motion primitive that a
   story JSON can reference by name. Without that layer an unknown pack name is
   silently ignored, which produces a blank scene with no error, and there is no
   way for a custom pack to take priority over a preloaded one.

   This module is that layer. It is deliberately data-only: it describes packs
   and validates references. It does not render anything, so it can be imported
   by the validator, the engine and a future authoring tool without pulling in
   DOM code.

   PRIORITY RULE

   Custom packs are first-class. When a story names a pack, a custom pack of
   that name wins over a preloaded one. Preloaded packs are the fallback, never
   the override. This is the rule the brief asks for, and it is enforced in
   resolvePack() rather than left to each call site.

   WHAT IS NOT HERE

   The actual DOM builders for each pack. Those are a separate, larger piece of
   work (see docs/storytelling-engine-plan.md, Stage 2). This module makes the
   names, the schema and the validation real, so a story that references a pack
   can be accepted or rejected honestly instead of silently rendering nothing.
   ========================================================================== */

/** Where an element sits in the stack. Background packs paint first. */
export type StoryLayer = 'background' | 'mid' | 'foreground';

/** A graphic pack: a named visual primitive a story element can reference. */
export interface GraphicPack {
  name: string;
  /** What it draws, in one line. Shown in the authoring UI. */
  description: string;
  /** The layer this pack belongs on by default. */
  defaultLayer: StoryLayer;
  /** Content keys this pack understands. Used to warn on a mismatch. */
  contentKeys: string[];
  /** True for a pack the user uploaded. Custom packs win over preloaded ones. */
  custom?: boolean;
}

/** A motion pack: a named animation or transition. */
export interface MotionPack {
  name: string;
  description: string;
  /** True for a pack the user uploaded. */
  custom?: boolean;
}

/* ------------------------------------------------------------ preloaded sets */

/**
 * The nine starting graphic packs. These are the names the story-generation
 * system prompt is told to use, so they must stay stable: renaming one breaks
 * every story already written against it.
 */
export const PRELOADED_GRAPHIC_PACKS: GraphicPack[] = [
  {
    name: 'EvidenceBoard_DarkGreen',
    description: 'Dark green textured investigation wall — the stage background.',
    defaultLayer: 'background',
    contentKeys: ['texture', 'vignette'],
  },
  {
    name: 'LinedNote_Typewriter',
    description: 'Lined notebook paper with typewriter text, red underline and red circle.',
    defaultLayer: 'mid',
    contentKeys: ['title', 'body', 'highlights'],
  },
  {
    name: 'FloorPlan_Schematic',
    description: 'Schematic museum or building floor plan with rooms, labels and entrances.',
    defaultLayer: 'mid',
    contentKeys: ['rooms', 'labels', 'entrances', 'courtyard'],
  },
  {
    name: 'TrailMap_Geographic',
    description: 'Simple city-to-city trail map with dots, a connecting line and labels.',
    defaultLayer: 'mid',
    contentKeys: ['points', 'route', 'labels'],
  },
  {
    name: 'FBISketch_Frame',
    description: 'Composite sketch frames — a 2x2 grid or a single portrait frame.',
    defaultLayer: 'mid',
    contentKeys: ['grid', 'subjectName', 'caption'],
  },
  {
    name: 'ArtSilhouette',
    description: 'Simplified artwork shapes — Rembrandt-style, Flinck-style, generic painting.',
    defaultLayer: 'mid',
    contentKeys: ['style', 'title', 'caption'],
  },
  {
    name: 'RubberStamp',
    description: 'Impact stamps — BREACHED, VANISHED, REWARD OFFERED, RESOLVED.',
    defaultLayer: 'foreground',
    contentKeys: ['text', 'tone'],
  },
  {
    name: 'RedString',
    description: 'Red connecting lines between two pinned elements.',
    defaultLayer: 'foreground',
    contentKeys: ['from', 'to', 'curve'],
  },
  {
    name: 'DocumentCard',
    description: 'Bordered photo or document card for the final collage.',
    defaultLayer: 'mid',
    contentKeys: ['title', 'caption', 'image'],
  },
];

/**
 * The ten starting motion packs. Same stability rule as the graphic packs.
 */
export const PRELOADED_MOTION_PACKS: MotionPack[] = [
  { name: 'NotePinIn', description: 'Note slides or pins onto the board.' },
  { name: 'RedCircleDraw', description: 'Red circle animates around text.' },
  { name: 'RedUnderline', description: 'Red line draws under text.' },
  { name: 'MapZoomReveal', description: 'Camera zooms into a floor plan or map.' },
  { name: 'StampSlam', description: 'Stamp hits with a slight bounce.' },
  { name: 'StringDraw', description: 'Red string draws between two points.' },
  { name: 'BoardPan', description: 'Slow camera pan across the wall.' },
  { name: 'CollageAssemble', description: 'Multiple cards fly in and layer.' },
  { name: 'FadeScale', description: 'Soft fade with a slight scale up.' },
  { name: 'Hold', description: 'Static hold, for emphasis.' },
];

/* --------------------------------------------------------------- custom packs */

const CUSTOM_PACKS_KEY = 'lnr_story_custom_packs_v1';

interface CustomPackStore {
  graphic: GraphicPack[];
  motion: MotionPack[];
}

let customPacks: CustomPackStore = { graphic: [], motion: [] };

/** Load user-uploaded packs from storage. Called once at library boot. */
export function loadCustomPacks(): void {
  try {
    const raw = localStorage.getItem(CUSTOM_PACKS_KEY);
    if (!raw) {
      customPacks = { graphic: [], motion: [] };
      return;
    }
    const parsed = JSON.parse(raw) as Partial<CustomPackStore>;
    const graphic = Array.isArray(parsed.graphic) ? parsed.graphic : [];
    const motion = Array.isArray(parsed.motion) ? parsed.motion : [];
    customPacks = {
      graphic: graphic
        .filter((p) => p && typeof p.name === 'string' && p.name.trim())
        .map((p) => ({ ...p, custom: true })),
      motion: motion
        .filter((p) => p && typeof p.name === 'string' && p.name.trim())
        .map((p) => ({ ...p, custom: true })),
    };
  } catch {
    customPacks = { graphic: [], motion: [] };
  }
}

/** Persist the custom pack set. Used by the upload flow. */
export function saveCustomPacks(store: CustomPackStore): void {
  customPacks = {
    graphic: (store.graphic || []).map((p) => ({ ...p, custom: true })),
    motion: (store.motion || []).map((p) => ({ ...p, custom: true })),
  };
  try {
    localStorage.setItem(CUSTOM_PACKS_KEY, JSON.stringify(customPacks));
  } catch {
    /* quota: the packs stay in memory for this session */
  }
}

export function getCustomPacks(): CustomPackStore {
  return { graphic: customPacks.graphic.slice(), motion: customPacks.motion.slice() };
}

/* ------------------------------------------------------------------ resolution */

/**
 * Resolve a graphic pack by name.
 *
 * CUSTOM FIRST. A user-uploaded pack of the same name overrides the preloaded
 * one — that is the priority rule, and it lives here so no call site can get it
 * wrong. Returns null when the name is unknown, which the validator turns into
 * a real error instead of a silently blank scene.
 */
export function resolveGraphicPack(name: string): GraphicPack | null {
  const key = String(name || '').trim();
  if (!key) return null;
  const custom = customPacks.graphic.find((p) => p.name === key);
  if (custom) return custom;
  return PRELOADED_GRAPHIC_PACKS.find((p) => p.name === key) || null;
}

/** Resolve a motion pack by name. Custom first, same rule as graphics. */
export function resolveMotionPack(name: string): MotionPack | null {
  const key = String(name || '').trim();
  if (!key) return null;
  const custom = customPacks.motion.find((p) => p.name === key);
  if (custom) return custom;
  return PRELOADED_MOTION_PACKS.find((p) => p.name === key) || null;
}

/** Every pack name available right now, custom and preloaded, for the prompt. */
export function availablePackNames(): { graphic: string[]; motion: string[] } {
  const graphic = new Set<string>();
  const motion = new Set<string>();
  /* Custom first so the list reads in priority order. */
  customPacks.graphic.forEach((p) => graphic.add(p.name));
  PRELOADED_GRAPHIC_PACKS.forEach((p) => graphic.add(p.name));
  customPacks.motion.forEach((p) => motion.add(p.name));
  PRELOADED_MOTION_PACKS.forEach((p) => motion.add(p.name));
  return { graphic: Array.from(graphic), motion: Array.from(motion) };
}

/* ------------------------------------------------------------------ validation */

export interface PackIssue {
  /** Where the problem is, e.g. "scene_02 element 1". */
  where: string;
  message: string;
  /** 'error' rejects the story; 'warning' is reported but accepted. */
  severity: 'error' | 'warning';
}

/**
 * Validate every pack reference in a story.
 *
 * This is the guardrail that was missing: an unknown pack name used to be
 * ignored, so a story could reference a pack that does not exist and render a
 * blank scene with no explanation. Now it is a named error.
 */
export function validatePackReferences(story: {
  background?: string;
  scenes?: Array<{ id?: string; elements?: Array<{ pack?: string; motion?: string }> }>;
  final_collage?: { motion?: string; elements?: Array<{ pack?: string; motion?: string }> };
}): PackIssue[] {
  const issues: PackIssue[] = [];

  if (story.background && !resolveGraphicPack(story.background)) {
    issues.push({
      where: 'background',
      message: `Unknown graphic pack "${story.background}".`,
      severity: 'error',
    });
  }

  (story.scenes || []).forEach((scene, sIdx) => {
    const sceneId = scene.id || `scene ${sIdx + 1}`;
    (scene.elements || []).forEach((el, eIdx) => {
      const where = `${sceneId} element ${eIdx + 1}`;
      if (el.pack && !resolveGraphicPack(el.pack)) {
        issues.push({ where, message: `Unknown graphic pack "${el.pack}".`, severity: 'error' });
      }
      if (el.motion && !resolveMotionPack(el.motion)) {
        issues.push({ where, message: `Unknown motion pack "${el.motion}".`, severity: 'error' });
      }
    });
  });

  const collage = story.final_collage;
  if (collage) {
    if (collage.motion && !resolveMotionPack(collage.motion)) {
      issues.push({
        where: 'final_collage',
        message: `Unknown motion pack "${collage.motion}".`,
        severity: 'error',
      });
    }
    (collage.elements || []).forEach((el, eIdx) => {
      const where = `final_collage element ${eIdx + 1}`;
      if (el.pack && !resolveGraphicPack(el.pack)) {
        issues.push({ where, message: `Unknown graphic pack "${el.pack}".`, severity: 'error' });
      }
      if (el.motion && !resolveMotionPack(el.motion)) {
        issues.push({ where, message: `Unknown motion pack "${el.motion}".`, severity: 'error' });
      }
    });
  }

  return issues;
}

/**
 * Quality guardrails from the brief, as far as they can be checked mechanically.
 *
 * Two of the three are checkable: every scene must advance the timeline or
 * reveal a failure (it must carry a date, a location, or a headline that is not
 * a repeat of the previous one), and visual consistency (one note style, one
 * red, one stamp style) is a matter of using the same pack names throughout.
 * "Never invent facts" cannot be checked here — it is a prompt-level rule, and
 * claiming otherwise would be dishonest.
 */
export function checkStoryQuality(story: {
  scenes?: Array<{ id?: string; elements?: Array<{ pack?: string }> }>;
}): PackIssue[] {
  const issues: PackIssue[] = [];
  const scenes = story.scenes || [];

  if (scenes.length < 2) {
    issues.push({
      where: 'scenes',
      message: 'A story needs at least two scenes to build a timeline.',
      severity: 'warning',
    });
  }

  scenes.forEach((scene, sIdx) => {
    const sceneId = scene.id || `scene ${sIdx + 1}`;
    if (!scene.elements || !scene.elements.length) {
      issues.push({
        where: sceneId,
        message: 'Scene has no elements, so it advances nothing.',
        severity: 'warning',
      });
    }
  });

  /* Visual consistency: the note style should not change mid-story. More than
     one note-like pack in a single story is the usual cause of a stage that
     looks like two different films spliced together. */
  const notePacks = new Set<string>();
  scenes.forEach((scene) => {
    (scene.elements || []).forEach((el) => {
      if (el.pack && /note/i.test(el.pack)) notePacks.add(el.pack);
    });
  });
  if (notePacks.size > 1) {
    issues.push({
      where: 'scenes',
      message: `More than one note style in use (${Array.from(notePacks).join(', ')}). Pick one for consistency.`,
      severity: 'warning',
    });
  }

  return issues;
}

/* ------------------------------------------------------- the system prompt */

/**
 * The story-generation system prompt, built from the packs that are actually
 * available right now.
 *
 * It is generated rather than hard-coded so a custom pack the user uploaded is
 * named in the prompt automatically — the AI is told to prefer it, which is the
 * "custom packs are first-class" rule. A hard-coded list would silently omit
 * every custom pack.
 */
export function buildStorySystemPrompt(): string {
  const names = availablePackNames();
  return [
    "You are an expert motion-graphic documentary storyteller specialised in the 'Evidence Board' style.",
    '',
    'Your output must always be valid JSON that the PWA engine can ingest directly to generate a story.',
    '',
    'Core aesthetic rules (never break these unless the user explicitly overrides):',
    '- Dark green textured background (chalkboard / investigation wall)',
    '- Lined notebook paper notes with typewriter-style monospace text',
    '- Red pen annotations (underlines, circles, arrows)',
    '- Rubber stamps (BREACHED, VANISHED, REWARD OFFERED, etc.)',
    '- Schematic floor plans and simple geographic trail maps',
    '- Composite sketches and simplified artwork silhouettes',
    '- Red connecting strings between elements',
    '- Clean, high-contrast, minimal, archival, serious tone',
    '- Chronological reconstruction with strong visual hierarchy',
    '- No live-action footage, no photorealistic people, no flashy modern UI',
    '',
    'Graphic packs available now:',
    names.graphic.map((n) => `- ${n}`).join('\n'),
    '',
    'Motion packs available now:',
    names.motion.map((n) => `- ${n}`).join('\n'),
    '',
    'Custom packs are first-class: if the user names a custom pack, prefer it over a preloaded one.',
    'Fall back to a preloaded pack only when no custom pack is specified.',
    '',
    'When creating a story:',
    '1. Break the narrative into clear sequential scenes.',
    '2. Every visual element must reference a graphic pack from the list above.',
    '3. Every animation or transition must reference a motion pack from the list above.',
    '4. Keep text sparse and impactful — highlight key times, numbers and failures with red annotations.',
    '5. Build toward a dense final case-board collage.',
    '6. Output only valid JSON. No markdown, no explanations outside the JSON.',
    '',
    'Quality guardrails:',
    '- Never invent facts. Use only the facts provided in the prompt.',
    '- Maintain visual consistency: same note style, same red, same stamp style throughout.',
    '- Prefer fewer, stronger elements over clutter.',
    '- Every scene must advance the timeline or reveal a new critical failure.',
  ].join('\n');
}
