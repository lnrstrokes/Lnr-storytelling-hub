# Install & Streaming Notice — canonical copy

**Use this text wherever a user is told to go live.** It is the same notice the app now shows on the home page and in the "go live" step of the studio wizard (`src/timer/install-notice.ts`). Keep the wording aligned; if you change it here, change it there.

---

## The notice (full, verbatim)

> **Install lnr Studio for the 100% experience.** Installed, it opens as its own full-screen app — no address bar, no tabs and no browser bars inside your screen cast — and it keeps working if the connection drops.
>
> **Android / Chrome:** menu (⋮) → *Install app*. **iPhone / Safari:** *Share* → *Add to Home Screen*. **Desktop Chrome or Edge:** the install icon in the address bar.
>
> **More than 50 YouTube subscribers? You do not need PRISM.** Open the YouTube app, tap Create (+) → Go Live → Screen Cast, and pick lnr Studio.
>
> **Under 50 subscribers, or mobile live not enabled yet?** Install PRISM Live Studio (free) and use its Screencast mode — it streams by RTMP, where the subscriber rule does not apply — or open studio.youtube.com in your phone browser and go live from there.

---

## Short form (comments, captions, community posts)

> Install the app for the full experience — full-screen, no browser bars in your cast. 50+ subs? Skip PRISM: YouTube app → + → Go Live → Screen Cast. Under 50? PRISM Live Studio's Screencast, or studio.youtube.com in your mobile browser.

## One-liner (bios, pinned comments, end cards)

> Install for the 100% experience · 50+ subs: Screen Cast, no PRISM needed · Under 50: PRISM Screencast or studio.youtube.com

---

## Why each half is worded the way it is

| Claim | Why it is safe to state | Where it comes from |
| --- | --- | --- |
| Installed = full-screen, no address bar in the cast | A PWA in `display: standalone` has no browser chrome, so nothing but the stage is captured | `public/manifest.webmanifest` sets `display: "standalone"`; the app already detects standalone launches |
| Works if the connection drops | The service worker caches the shell; content is local | `public/sw.js`, offline-first caching of the app shell |
| YouTube mobile live needs **more than 50 subscribers** | YouTube's own mobile live-streaming requirement; it is an account rule, not something a third-party app can bypass | YouTube mobile live-streaming help; independent 2026 comparisons |
| 50+ subs do **not** need PRISM | Screen Cast from the YouTube app is a first-party route that needs no extra software | YouTube app's Go Live flow |
| PRISM's Screencast works under 50 subs | PRISM Live Studio streams by RTMP / platform account, and RTMP is not gated on subscriber count | PRISM Live Studio mobile help (supported platforms, custom RTMP) |
| studio.youtube.com works under 50 subs | A stream started from YouTube Studio in a browser is treated as a desktop stream, which has no subscriber gate | YouTube Studio; widely documented workaround |
| Never "approved by YouTube" | No partnership or endorsement exists | Compliance rule already used in `LNR-Flow-Product-Video-Prompt.md` (workstation-only) |

## Two rules when reusing this

1. **Never promise monetisation, income, or "unlimited" anything.** Say what the app does: it renders content and makes the stream easy to start.
2. **Do not state tier limits from memory.** The numbers printed in the app's own onboarding card are the only ones to quote (Free $0, Pro $19/month or $190/year). If a limit changed in the product, it changes in the copy the same day.
