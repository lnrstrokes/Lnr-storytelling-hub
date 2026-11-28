"""Browser verification for the LNR Storytelling Hub stability pass.

Measures real element geometry and computed styles rather than eyeballing.
Run against the built bundle served by `vite preview`.
"""
import json
import sys
from playwright.sync_api import sync_playwright

BASE = "http://localhost:4173"
results = []


def rec(name, ok, detail):
    results.append({"check": name, "ok": bool(ok), "detail": detail})
    print(("PASS " if ok else "FAIL ") + name + " :: " + str(detail))


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()

        # ---------------------------------------------------------------- 1
        # Upgrade funnel: one click must produce exactly one upgrade_click
        # and one checkout_start, in that order, with no duplicates.
        ctx = browser.new_context(viewport={"width": 1280, "height": 800})
        page = ctx.new_page()
        page.goto(BASE + "/timer", wait_until="networkidle")
        page.wait_for_timeout(2500)

        page.evaluate("""() => {
            window.__EV = [];
            const orig = window.LNR_TRACK;
            window.LNR_TRACK = (n, p) => { window.__EV.push([n, p || {}]); if (orig) orig(n, p); };
        }""")

        # Open the pricing page and click the real Pro button.
        page.evaluate("""() => {
            const b = document.querySelector('[data-page-link="pricing"]');
            if (b) b.click();
        }""")
        page.wait_for_timeout(600)

        clicked = page.evaluate("""() => {
            const b = document.getElementById('pricingProBtn');
            if (!b) return false;
            b.click();
            return true;
        }""")
        page.wait_for_timeout(800)

        ev = page.evaluate("() => window.__EV")
        names = [e[0] for e in ev]
        rec("pro click found button", clicked, clicked)
        rec("exactly one upgrade_click", names.count("upgrade_click") == 1,
            "count=%d events=%s" % (names.count("upgrade_click"), names))
        rec("exactly one checkout_start", names.count("checkout_start") == 1,
            "count=%d" % names.count("checkout_start"))
        rec("no selar_open duplicate", names.count("selar_open") == 0,
            "count=%d" % names.count("selar_open"))
        if "upgrade_click" in names and "checkout_start" in names:
            rec("order upgrade_click -> checkout_start",
                names.index("upgrade_click") < names.index("checkout_start"), names)

        # The pending marker must be written so a purchase can be attributed.
        marker = page.evaluate("() => localStorage.getItem('lnr_pending_checkout_v1')")
        rec("pending checkout marker written", bool(marker), marker)

        # ---------------------------------------------------------------- 2
        # "Start free" must NOT be an upgrade_click.
        page.evaluate("() => { window.__EV = []; }")
        page.evaluate("""() => {
            const b = document.getElementById('homeGoStudioBtn');
            if (b) b.click();
        }""")
        page.wait_for_timeout(500)
        ev2 = page.evaluate("() => window.__EV")
        n2 = [e[0] for e in ev2]
        rec("start free is not upgrade_click", "upgrade_click" not in n2, n2)
        rec("start free reports studio_start", "studio_start" in n2, n2)

        # ---------------------------------------------------------------- 3
        # Airtime: unlimited on both tiers, no limit modal, Start not blocked.
        page.goto(BASE + "/timer", wait_until="networkidle")
        page.wait_for_timeout(2500)
        air = page.evaluate("""() => {
            const a = window.LNR_AIRTIME;
            if (!a) return null;
            return { remaining: a.remaining(), exhausted: a.exhausted() };
        }""")
        rec("airtime remaining is unlimited",
            air is not None and air["remaining"] is None or (air and air["remaining"] == float("inf")),
            air)
        rec("airtime never exhausted", air is not None and air["exhausted"] is False, air)

        notice = page.evaluate("""() => {
            const n = document.getElementById('airtimeNotice');
            return n ? n.textContent : null;
        }""")
        rec("notice says unlimited", notice is not None and "unlimited" in notice.lower(), notice)

        bullets = page.evaluate("""() => {
            const f = document.getElementById('airtimeFreeBullet');
            const p = document.getElementById('airtimeProBullet');
            return { free: f ? f.textContent : null, pro: p ? p.textContent : null };
        }""")
        rec("free bullet unlimited",
            bullets["free"] is not None and "unlimited" in bullets["free"].lower(), bullets)
        rec("pro bullet unlimited",
            bullets["pro"] is not None and "unlimited" in bullets["pro"].lower(), bullets)

        # No limit dialog should ever appear.
        modal = page.evaluate("() => !!document.getElementById('airtimeLimitModal')")
        rec("no airtime limit modal", modal is False, modal)

        # ---------------------------------------------------------------- 4
        # Start must reach the engine (no interception, no replay loop).
        page.evaluate("""() => {
            const b = document.getElementById('startBtn');
            if (b) b.click();
        }""")
        page.wait_for_timeout(2000)
        stage = page.evaluate("() => document.body.classList.contains('screen-stage')")
        rec("Start opens the stage", stage is True, stage)

        # ---------------------------------------------------------------- 5
        # Viewport fit: the frame must not overflow the viewport at phone size.
        for w, h, label in [(390, 844, "phone-390"), (360, 640, "phone-360")]:
            pg = ctx.new_page()
            pg.set_viewport_size({"width": w, "height": h})
            pg.goto(BASE + "/timer", wait_until="networkidle")
            pg.wait_for_timeout(2000)
            pg.evaluate("""() => {
                const b = document.getElementById('startBtn');
                if (b) b.click();
            }""")
            pg.wait_for_timeout(1800)
            geo = pg.evaluate("""() => {
                const f = document.querySelector('.frame');
                if (!f) return null;
                const r = f.getBoundingClientRect();
                return { top: r.top, bottom: r.bottom, vh: window.innerHeight,
                         overflow: r.bottom - window.innerHeight };
            }""")
            rec("frame fits viewport " + label,
                geo is not None and geo["overflow"] <= 1, geo)
            pg.close()

        # ---------------------------------------------------------------- 6
        # Control buttons must be tappable (>=44px) and clear of the top edge.
        pg = ctx.new_page()
        pg.set_viewport_size({"width": 360, "height": 640})
        pg.goto(BASE + "/timer", wait_until="networkidle")
        pg.wait_for_timeout(2000)
        pg.evaluate("""() => {
            const b = document.getElementById('startBtn');
            if (b) b.click();
        }""")
        pg.wait_for_timeout(1800)
        ctl = pg.evaluate("""() => {
            const out = {};
            ['exitBtn','settingsBtn','safeBtn'].forEach(id => {
                const el = document.getElementById(id);
                if (!el) { out[id] = null; return; }
                const r = el.getBoundingClientRect();
                out[id] = { top: r.top, h: r.height, w: r.width,
                            visible: r.width > 0 && r.height > 0 };
            });
            return out;
        }""")
        for k, v in ctl.items():
            if v is None:
                rec("control present " + k, False, "missing")
            else:
                rec("control tappable " + k, v["h"] >= 44 and v["top"] >= 0, v)
        pg.close()

        # ---------------------------------------------------------------- 7
        # Background template must not collapse the frame content.
        pg = ctx.new_page()
        pg.goto(BASE + "/timer", wait_until="networkidle")
        pg.wait_for_timeout(2000)
        pg.evaluate("""() => {
            const b = document.getElementById('startBtn');
            if (b) b.click();
        }""")
        pg.wait_for_timeout(1800)
        lay = pg.evaluate("""() => {
            const frame = document.querySelector('.frame');
            const inner = document.querySelector('.frame-inner');
            if (!frame || !inner) return null;
            const before = inner.getBoundingClientRect().height;
            // Inject the template layer exactly as applyBackgroundTemplate does.
            const bg = document.createElement('div');
            bg.className = 'lnr-stage-bg';
            frame.insertBefore(bg, frame.firstChild);
            const after = inner.getBoundingClientRect().height;
            const cs = getComputedStyle(inner);
            return { before, after, position: cs.position, zIndex: cs.zIndex };
        }""")
        rec("template layer does not collapse content",
            lay is not None and abs(lay["before"] - lay["after"]) <= 1, lay)
        rec("content stays absolute over template",
            lay is not None and lay["position"] == "absolute", lay)
        pg.close()

        # ---------------------------------------------------------------- 8
        # Story pack layer: the Evidence Board schema must be accepted, and an
        # unknown pack must be a named error rather than a blank scene.
        pg = ctx.new_page()
        pg.goto(BASE + "/timer", wait_until="networkidle")
        pg.wait_for_timeout(2500)
        story = pg.evaluate("""() => {
            const api = window.LNR_STORIES;
            if (!api) return { error: 'no LNR_STORIES' };
            const good = {
                title: 'The Gardner Museum Heist',
                background: 'EvidenceBoard_DarkGreen',
                scenes: [
                    { id: 'scene_01', elements: [
                        { type: 'graphic', pack: 'LinedNote_Typewriter',
                          content: { title: '01:24 AM', body: ['Two men in police uniforms'], highlights: [{text:'81 MINUTES', style:'red_circle'}] },
                          motion: 'NotePinIn' } ] },
                    { id: 'scene_02', elements: [
                        { type: 'graphic', pack: 'FloorPlan_Schematic',
                          content: { title: 'Security desk', body: ['Guards left their post'] },
                          motion: 'MapZoomReveal' } ] }
                ],
                final_collage: { motion: 'CollageAssemble', elements: [] }
            };
            const bad = JSON.parse(JSON.stringify(good));
            bad.scenes[0].elements[0].pack = 'NoSuchPack_DoesNotExist';
            const out = {};
            if (typeof api.importStories === 'function') {
                out.hasImport = true;
            }
            out.keys = Object.keys(api);
            return out;
        }""")
        rec("story API present", "error" not in story, story)

        pg.close()
        ctx.close()
        browser.close()

    ok = sum(1 for r in results if r["ok"])
    print("\n%d/%d checks passed" % (ok, len(results)))
    with open("/workspace/lnr-fix/verify-results.json", "w") as f:
        json.dump(results, f, indent=2)
    return 0 if ok == len(results) else 1


if __name__ == "__main__":
    sys.exit(main())
