#!/usr/bin/env python3
"""Screenshot the question-source toggle, desktop and mobile."""
import os
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:3000"
OUT = "/workspace/lnr-storytelling-hub/evidence"
os.makedirs(OUT, exist_ok=True)

with sync_playwright() as pw:
    b = pw.chromium.launch(args=["--no-sandbox"])
    for label, vp in [("desktop", {"width": 1440, "height": 1000}),
                      ("mobile", {"width": 390, "height": 844})]:
        ctx = b.new_context(viewport=vp, device_scale_factor=2)
        p = ctx.new_page()
        p.goto(BASE, wait_until="domcontentloaded")
        p.evaluate("() => { try{localStorage.clear()}catch(e){}; try{sessionStorage.clear()}catch(e){} }")
        p.reload(wait_until="domcontentloaded")
        p.wait_for_timeout(3000)
        p.wait_for_function("() => !!window.LNR_QUESTION_SOURCE", timeout=25000)
        p.evaluate("""() => {
            const s = document.querySelector('[data-page-link="studio"]'); if (s) s.click();
        }""")
        p.wait_for_timeout(500)
        p.evaluate("() => { const t = document.getElementById('wizTab2'); if (t) t.click(); }")
        p.wait_for_timeout(500)
        p.set_input_files("#setupQuizImportInput", os.path.join(OUT, "plain_array.json"))
        p.wait_for_timeout(1500)
        p.evaluate("() => { const r = document.getElementById('qSourceRow'); if (r) r.scrollIntoView({block:'center'}); }")
        p.wait_for_timeout(600)
        p.screenshot(path=os.path.join(OUT, f"04_toggle_{label}.png"))
        # overflow check
        ov = p.evaluate("""() => {
            const d = document.documentElement;
            return { scrollW: d.scrollWidth, clientW: d.clientWidth, overflow: d.scrollWidth > d.clientWidth + 1 };
        }""")
        print(label, ov)
        ctx.close()
    b.close()
