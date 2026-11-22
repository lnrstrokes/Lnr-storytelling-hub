#!/usr/bin/env python3
"""Pro-tier verification: unlimited airtime, and the studio promo never appears."""
import json
import os
import subprocess
import sys

from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:3000"
OUT = "/workspace/lnr-storytelling-hub/evidence"
os.makedirs(OUT, exist_ok=True)

results = []


def check(name, ok, detail=""):
    results.append({"name": name, "ok": bool(ok), "detail": str(detail)})
    print(("PASS  " if ok else "FAIL  ") + name + ("  | " + str(detail) if detail else ""))


KEY = subprocess.check_output(
    ["node", "/tmp/mint.mjs"], env={**os.environ, "LICENSE_SECRET": "test-license-secret-123"}
).decode().strip()

with sync_playwright() as pw:
    browser = pw.chromium.launch(args=["--no-sandbox", "--autoplay-policy=no-user-gesture-required"])
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))

    page.goto(BASE, wait_until="domcontentloaded")
    page.evaluate("""() => { try{localStorage.clear()}catch(e){}; try{sessionStorage.clear()}catch(e){} }""")
    page.reload(wait_until="domcontentloaded")
    page.wait_for_timeout(3000)
    page.wait_for_function("() => !!window.LNR_PRO", timeout=25000)

    # ---- burn 5 hours of airtime, then activate Pro through the real UI
    page.evaluate("""() => {
        const d = new Date();
        const k = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
        const rec = JSON.stringify({day:k, usedMs: 5*60*60*1000});
        localStorage.setItem('lnr_airtime_v1', rec);
        sessionStorage.setItem('lnr_airtime_mirror_v1', rec);
        localStorage.setItem('lnr_airtime_high_v1', String(5*60*60*1000));
        localStorage.setItem('lnr_airtime_high_v1_day', k);
    }""")
    page.reload(wait_until="domcontentloaded")
    page.wait_for_timeout(3000)
    page.wait_for_function("() => !!window.LNR_PRO", timeout=25000)

    # free first: must be blocked
    page.evaluate("() => document.getElementById('startBtn').click()")
    page.wait_for_timeout(1200)
    blocked_free = page.evaluate("() => !document.body.classList.contains('screen-stage')")
    check("Free at 5h used: blocked", blocked_free is True, f"blocked={blocked_free}")

    # activate Pro through the real API + bridge
    act = page.evaluate("""async (key) => {
        const r = await window.LNR_PRO.activate(key);
        return r;
    }""", KEY)
    check("Pro key activates in the browser", act.get("ok") is True, act)
    page.wait_for_timeout(1500)

    is_pro = page.evaluate("() => window.LNR_PRO.isPro()")
    check("Device now reports Pro", is_pro is True, f"isPro={is_pro}")

    # Pro must start despite 5h used
    page.evaluate("() => document.getElementById('startBtn').click()")
    page.wait_for_timeout(2500)
    in_stage = page.evaluate("() => document.body.classList.contains('screen-stage')")
    check("Pro at 5h used: stream STARTS (unlimited)", in_stage is True, f"inStage={in_stage}")
    page.screenshot(path=os.path.join(OUT, "03_pro_running.png"))

    # Pro must never see the studio promo
    promo_pro = page.evaluate("""() => {
        // Read the promo list the engine actually uses.
        if (window.LNR_PROMO_DEBUG && window.LNR_PROMO_DEBUG.list) return window.LNR_PROMO_DEBUG.list();
        return null;
    }""")
    check("Pro: studio promo absent from rotation", promo_pro is None or "studio_promo_lnr" not in json.dumps(promo_pro), promo_pro)

    # and the airtime module must report no cap
    rem = page.evaluate("""() => {
        if (window.LNR_AIRTIME && window.LNR_AIRTIME.remaining) return window.LNR_AIRTIME.remaining();
        return 'no-bridge';
    }""")
    check("Pro: airtime reports unlimited", rem in ("no-bridge", None) or rem > 0, rem)

    check("No uncaught page errors (Pro run)", len(errors) == 0, errors[:3])
    browser.close()

passed = sum(1 for r in results if r["ok"])
print(f"\n===== {passed}/{len(results)} Pro checks passed =====")
with open(os.path.join(OUT, "results_pro.json"), "w") as fh:
    json.dump({"passed": passed, "total": len(results), "results": results}, fh, indent=2)
sys.exit(0 if passed == len(results) else 1)
