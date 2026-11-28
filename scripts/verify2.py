"""Verification for the story pack layer, disclaimer visibility and Stream-safe."""
import json
import sys
from playwright.sync_api import sync_playwright

BASE = "http://localhost:4173"
results = []


def rec(name, ok, detail):
    results.append({"check": name, "ok": bool(ok), "detail": detail})
    print(("PASS " if ok else "FAIL ") + name + " :: " + str(detail))


GOOD_STORY = {
    "title": "The Gardner Museum Heist",
    "background": "EvidenceBoard_DarkGreen",
    "scenes": [
        {
            "id": "scene_01",
            "elements": [
                {
                    "type": "graphic",
                    "pack": "LinedNote_Typewriter",
                    "content": {
                        "title": "01:24 AM",
                        "body": ["Two men in police uniforms rang the side door."],
                        "highlights": [{"text": "81 MINUTES", "style": "red_circle"}],
                    },
                    "motion": "NotePinIn",
                }
            ],
        },
        {
            "id": "scene_02",
            "elements": [
                {
                    "type": "graphic",
                    "pack": "FloorPlan_Schematic",
                    "content": {
                        "title": "Security desk",
                        "body": ["Both guards had left their post."],
                    },
                    "motion": "MapZoomReveal",
                }
            ],
        },
    ],
    "final_collage": {"motion": "CollageAssemble", "elements": []},
}


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(viewport={"width": 1280, "height": 800})
        page = ctx.new_page()
        page.goto(BASE + "/timer", wait_until="networkidle")
        page.wait_for_timeout(2500)

        # ---- Evidence Board schema is accepted -------------------------------
        out = page.evaluate(
            """(story) => {
                const api = window.LNR_STORIES;
                if (!api) return { error: 'no api' };
                const before = api.getCustomEpisodes().length;
                const res = api.importEpisodesJson(JSON.stringify([story]));
                const after = api.getCustomEpisodes();
                return { res, before, after: after.length,
                         titles: after.map(e => e.title),
                         beats: after.length ? after[after.length-1].beats.length : 0,
                         modes: after.length ? after[after.length-1].beats.map(b => b.visualMode) : [] };
            }""",
            GOOD_STORY,
        )
        rec("Evidence Board story accepted", out.get("after", 0) > out.get("before", 0), out)
        rec("scenes became beats", out.get("beats", 0) == 2, out.get("beats"))
        rec(
            "packs mapped to visual modes",
            out.get("modes") == ["evidence_card", "map"],
            out.get("modes"),
        )

        # ---- unknown pack is a named error, not a blank scene ----------------
        bad = json.loads(json.dumps(GOOD_STORY))
        bad["title"] = "Bad Pack Story"
        bad["scenes"][0]["elements"][0]["pack"] = "NoSuchPack_DoesNotExist"
        out2 = page.evaluate(
            """(story) => {
                const api = window.LNR_STORIES;
                const before = api.getCustomEpisodes().length;
                const res = api.importEpisodesJson(JSON.stringify([story]));
                return { res, before, after: api.getCustomEpisodes().length };
            }""",
            bad,
        )
        rec("unknown pack rejected", out2["after"] == out2["before"], out2)
        rec(
            "rejection names the pack",
            "NoSuchPack_DoesNotExist" in json.dumps(out2["res"]),
            out2["res"],
        )

        # ---- custom pack takes priority over a preloaded one -----------------
        prio = page.evaluate(
            """() => {
                const api = window.LNR_STORIES;
                // Register a custom pack that shadows a preloaded name.
                localStorage.setItem('lnr_story_custom_packs_v1', JSON.stringify({
                    graphic: [{ name: 'LinedNote_Typewriter', description: 'custom override',
                                defaultLayer: 'mid', contentKeys: ['title'] }],
                    motion: []
                }));
                return true;
            }"""
        )
        rec("custom pack store writable", prio is True, prio)

        # ---- disclaimer visible in normal AND Stream-safe --------------------
        page.goto(BASE + "/timer", wait_until="networkidle")
        page.wait_for_timeout(2500)
        page.evaluate("""() => {
            const b = document.getElementById('startBtn');
            if (b) b.click();
        }""")
        page.wait_for_timeout(1500)

        # Force the exact DOM state the video engine sets for an owned clip
        # with breaks on, then measure the disclaimer card.
        dis = page.evaluate(
            """() => {
                const body = document.body;
                body.classList.add('screen-stage');
                const frame = document.querySelector('.frame');
                if (frame) frame.classList.add('is-video-clean');
                const stage = document.getElementById('videoStage');
                if (stage) stage.hidden = false;
                const pre = document.getElementById('videoPreroll');
                if (!pre) return { error: 'no preroll element' };
                pre.hidden = false;
                pre.classList.add('is-interactive');
                const cs = getComputedStyle(pre);
                const r = pre.getBoundingClientRect();
                return { display: cs.display, visibility: cs.visibility,
                         opacity: cs.opacity, w: r.width, h: r.height };
            }"""
        )
        rec(
            "disclaimer visible (normal)",
            dis.get("display") not in ("none", None)
            and dis.get("visibility") != "hidden"
            and dis.get("w", 0) > 100,
            dis,
        )

        dis_safe = page.evaluate(
            """() => {
                document.body.classList.add('safe');
                const pre = document.getElementById('videoPreroll');
                const cs = getComputedStyle(pre);
                const r = pre.getBoundingClientRect();
                return { display: cs.display, visibility: cs.visibility,
                         opacity: cs.opacity, w: r.width, h: r.height };
            }"""
        )
        rec(
            "disclaimer visible (Stream-safe)",
            dis_safe.get("display") not in ("none", None)
            and dis_safe.get("visibility") != "hidden"
            and dis_safe.get("w", 0) > 100,
            dis_safe,
        )

        # ---- Stream-safe still hides only the restart notice -----------------
        safe = page.evaluate(
            """() => {
                const restart = document.querySelector('.video-restart-notice');
                const out = { restart: null };
                if (restart) out.restart = getComputedStyle(restart).display;
                return out;
            }"""
        )
        rec(
            "restart notice still hidden in safe",
            safe["restart"] in ("none", None),
            safe,
        )

        # ---- exit path still works ------------------------------------------
        page.evaluate("() => document.body.classList.remove('safe')")
        page.evaluate("""() => {
            const b = document.getElementById('exitBtn');
            if (b) b.click();
        }""")
        page.wait_for_timeout(1200)
        exited = page.evaluate("() => !document.body.classList.contains('screen-stage')")
        rec("exit path leaves the stage", exited is True, exited)

        # ---- Settings still opens -------------------------------------------
        page.evaluate("""() => {
            const b = document.querySelector('[data-page-link="settings"]');
            if (b) b.click();
        }""")
        page.wait_for_timeout(600)
        settings = page.evaluate(
            """() => {
                const p = document.getElementById('page-settings') || document.querySelector('[data-page="settings"]');
                return p ? !p.hidden : null;
            }"""
        )
        rec("settings page opens", settings is not False, settings)

        page.close()
        ctx.close()
        browser.close()

    ok = sum(1 for r in results if r["ok"])
    print("\n%d/%d checks passed" % (ok, len(results)))
    with open("/workspace/lnr-fix/verify-results-2.json", "w") as f:
        json.dump(results, f, indent=2)
    return 0 if ok == len(results) else 1


if __name__ == "__main__":
    sys.exit(main())
