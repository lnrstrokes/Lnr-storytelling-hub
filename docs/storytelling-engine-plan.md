# Evidence Board Storytelling Engine — Implementation Plan

Status: **Stage 1 shipped** (schema + pack registry + validation). Stages 2–5 planned.

---

## 1. What the engine already supports

The brief assumes the engine needs building from scratch. It does not. The
existing story engine is closer to the target than it looks, and the gap is
narrower and more specific than "add a storytelling engine".

### Already present

| Capability | Where | Notes |
|---|---|---|
| Scene model | `story-library.ts:76` `StoryBeat` | `beatNumber`, `visualMode`, `headline`, `text`, `openLoop`, `visual` |
| Per-scene content object | `story-library.ts:46` `StorySceneVisual` | 20 optional fields: `dateLabel`, `location`, `quote`, `points`, `route`, `subjectName`, `artifactName`, `accentStat`, … |
| Ten visual modes | `story-library.ts:24` `StoryBeatVisualMode` | `evidence_card`, `map`, `timeline`, `profile`, `comparison`, `artifact`, `document`, `signal_waveform`, `wildfire_surge`, `ember_glow` |
| Episode model | `story-library.ts:105` `StoryEpisode` | hook → beats → chat checkpoint → resolution |
| JSON ingestion | `story-library.ts:1480` `validateAndNormalizeEpisode` | Two schemas already accepted |
| Custom story storage | `story-library.ts:146` | `lnr_custom_stories_v2` in localStorage |
| Import API | `window.LNR_STORIES.importEpisodesJson` | Returns `{added, skipped, errors}` |

### The important finding

**The ten visual modes are already the right primitives.** `map` is a floor
plan. `profile` is a composite sketch. `evidence_card` is a lined note.
`artifact` is a rubber stamp. The engine can already *structure* an Evidence
Board story — it just has no vocabulary for naming the visual treatment.

So the gap is not "build a renderer". It is "add a pack layer between the story
JSON and the DOM".

---

## 2. The gap

### 2.1 No pack concept (the core gap)

There was no registry of named graphic or motion packs. Consequences:

- A story could reference `"pack": "LinedNote_Typewriter"` and the name was
  **silently ignored** — the scene rendered blank with no error.
- No way for a custom pack to take priority over a preloaded one.
- No way to tell the AI which packs exist, so a generated story could reference
  packs that were never implemented.

### 2.2 The brief's JSON shape was rejected outright

The `{scenes: [{elements: []}]}` shape from the system prompt fell through to
the legacy `acts` branch and failed with:

```
Story "X": must include hook+beats or acts
```

A story written exactly to the brief could not be imported at all.

### 2.3 Missing schema fields

The brief's suggested improvements — `layer`, `anchor`, `variables`, `camera`,
`audio` — had no representation anywhere.

---

## 3. What Stage 1 shipped

### 3.1 `src/timer/story-packs.ts` (new, 404 lines)

The pack layer, deliberately **data-only** so it can be imported by the
validator, the engine and a future authoring tool without pulling in DOM code.

- `PRELOADED_GRAPHIC_PACKS` — the 9 packs from the brief, each with
  `defaultLayer` and `contentKeys`.
- `PRELOADED_MOTION_PACKS` — the 10 motion packs.
- `resolveGraphicPack()` / `resolveMotionPack()` — **custom first**, preloaded
  as fallback. The priority rule lives in one place so no call site can get it
  wrong.
- `validatePackReferences()` — an unknown pack is now a named error.
- `checkStoryQuality()` — the two guardrails that are mechanically checkable.
- `buildStorySystemPrompt()` — generates the system prompt from the packs that
  are *actually available*, so a custom pack is named in the prompt
  automatically. A hard-coded list would silently omit every custom pack.

### 3.2 Evidence Board ingestion (`story-library.ts:1593`)

A third branch in `validateAndNormalizeEpisode`, before the legacy `acts`
fallback. It:

- validates every pack reference and **rejects** the story with a named error
  if one is unknown;
- maps each scene to a beat, concatenating note bodies and highlights into the
  narration the reader speaks;
- maps the pack name to a visual mode via `visualModeForPack()`
  (`story-library.ts:1484`) — `FloorPlan`/`TrailMap` → `map`, `Sketch`/
  `Silhouette` → `profile`, `Stamp` → `artifact`, `Document`/`Card` →
  `document`;
- surfaces quality warnings without rejecting a merely-thin story.

### 3.3 Verified behaviour

| Check | Result |
|---|---|
| Evidence Board story accepted | `{added: 1, skipped: 0, errors: []}` |
| Scenes became beats | 2 |
| Packs mapped to visual modes | `['evidence_card', 'map']` |
| Unknown pack rejected | `added: 0`, error names the pack |
| Custom pack store writable | yes |

---

## 4. Remaining stages

### Stage 2 — Pack renderers (~600 lines)

The DOM builders. Each graphic pack becomes a function that returns an element
styled to match the aesthetic. This is the largest piece and the one that makes
the style actually *look* like the reference.

- `EvidenceBoard_DarkGreen` — CSS gradient + noise texture, no image asset.
- `LinedNote_Typewriter` — repeating-linear-gradient for the ruled lines,
  monospace text, absolutely-positioned red annotation spans.
- `FloorPlan_Schematic` — inline SVG, rooms as rects, labels as text.
- `TrailMap_Geographic` — inline SVG polyline + circles.
- `FBISketch_Frame` — CSS grid, 2×2 or single.
- `ArtSilhouette` — inline SVG paths.
- `RubberStamp` — rotated bordered text with a distressed mask.
- `RedString` — SVG path between two anchors.
- `DocumentCard` — bordered card with an image slot.

Motion packs are CSS `@keyframes` + `animation-delay`, driven by the existing
`delay` field. No animation library needed.

### Stage 3 — Renderer integration (~250 lines)

Wire the pack renderers into the story stage. The stage currently switches on
`visualMode`; it needs to switch on `pack` when one is present and fall back to
`visualMode` otherwise. This keeps every existing built-in episode working
unchanged.

### Stage 4 — Custom pack upload (~200 lines)

A file input that accepts a pack manifest, validates it against the
`GraphicPack`/`MotionPack` shape, and calls `saveCustomPacks()`. The registry
already handles priority; this is only the UI and the validation.

### Stage 5 — Authoring starter (~280 lines)

A "copy the system prompt" button that calls `buildStorySystemPrompt()`, plus a
paste-JSON box that runs `importEpisodesJson` and shows the errors inline. This
is what makes the feature usable by someone who is not editing files.

---

## 5. Schema extensions (additive, all optional)

These are the brief's suggested improvements. All are optional so every
existing story keeps working.

```jsonc
{
  "variables": { "heist_date": "1990-03-18", "total_value": 500000000 },
  "scenes": [{
    "camera": { "zoom": 1.4, "pan_to": { "x": 0.3, "y": 0.6 }, "focus_element": 0 },
    "elements": [{
      "layer": "mid",                       // background | mid | foreground
      "anchor": { "x": 0.5, "y": 0.4 },     // for RedString endpoints
      "position": { "x": 0.5, "y": 0.4 }
    }]
  }],
  "audio": { "ambient": "room_tone", "sfx": [{ "at": 2.1, "pack": "StampSlam" }] }
}
```

`layer` is the one that matters most: without it, elements stack in DOM order,
which is why a stamp can end up behind a note.

---

## 6. Quality guardrails — what is enforced and what is not

| Guardrail | Enforced? | How |
|---|---|---|
| Never invent facts | **No** | Prompt-level only. Cannot be checked mechanically, and claiming otherwise would be dishonest. |
| Visual consistency | Partly | `checkStoryQuality()` warns when more than one note style is used in a story. |
| Every scene advances the timeline | Partly | Warns on a scene with no elements, and on a story with fewer than two scenes. |
| Prefer fewer, stronger elements | **No** | Subjective. |

The two "No" rows are prompt rules, not code rules. They are in
`buildStorySystemPrompt()` and that is the honest place for them.

---

## 7. Pack expansion roadmap

After the 19 starting packs:

- `TimelineBar` — horizontal timeline with events.
- `SecurityLog` — dot-matrix printout look.
- `EmptyFrame` — for "still hanging empty" moments.
- `RewardPoster`.
- Motion: `TypewriterReveal`, `PaperFlip`, `RedStringSnap`.

Each is a new entry in the registry plus one renderer function. The registry is
already built to take them.
