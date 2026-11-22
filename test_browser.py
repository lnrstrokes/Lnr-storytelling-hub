#!/usr/bin/env python3
"""Real-browser verification for the lnr Studio fixes.

Runs against the production build served on http://127.0.0.1:3000.
Every check drives the actual UI — no direct state injection.
"""
import json
import os
import sys
import time

from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:3000"
OUT = "/workspace/lnr-storytelling-hub/evidence"
os.makedirs(OUT, exist_ok=True)

results = []


def check(name, ok, detail=""):
    results.append({"name": name, "ok": bool(ok), "detail": str(detail)})
    print(("PASS  " if ok else "FAIL  ") + name + ("  | " + str(detail) if detail else ""))


# ---------------------------------------------------------------- test files
SHAPES = {
    "plain_array.json": [
        {"question": "Which planet is known as the Red Planet?",
         "options": ["Venus", "Mars", "Jupiter", "Saturn"], "answer": 1},
        {"question": "What is the capital city of Australia?",
         "options": ["Sydney", "Melbourne", "Canberra", "Perth"], "answer": "C"},
    ],
    "nested_data.json": {
        "data": {"questions": [
            {"question": "Who wrote the play Romeo and Juliet?",
             "options": ["Charles Dickens", "William Shakespeare", "Jane Austen", "Mark Twain"],
             "answer": "William Shakespeare"},
        ]}
    },
    "quiz_key.json": {
        "quiz": [
            {"question": "How many continents are there on Earth?",
             "options": ["Five", "Six", "Seven", "Eight"], "correctLetter": "C"},
        ]
    },
    "bank_key.json": {
        "bank": [
            {"question": "What gas do plants absorb from the air?",
             "options": ["Oxygen", "Nitrogen", "Carbon dioxide", "Hydrogen"], "answer": 2},
        ]
    },
    "items_key.json": {
        "items": [
            {"question": "Which ocean is the largest on the planet?",
             "options": ["Atlantic", "Indian", "Arctic", "Pacific"], "answer": "D"},
        ]
    },
    "five_options.json": {
        "questions": [
            {"question": "Which of these is a primary colour of light?",
             "options": ["Red", "Green", "Blue", "Yellow", "Magenta"], "answer": 2},
            {"question": "Which of these animals is a mammal?",
             "options": ["Shark", "Dolphin", "Octopus", "Tuna", "Salmon"], "answer": "B"},
        ]
    },
    "bad.json": '{"questions": [ {"question": "Broken file here", "options": ["a", "b", "c", "d"], "answer": 0, } ]}',
    "wrong_shape.json": {"totally": "unrelated", "payload": 42},
}

for fname, content in SHAPES.items():
    path = os.path.join(OUT, fname)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(content if isinstance(content, str) else json.dumps(content, indent=2))


def fresh(page):
    """Clear all device storage and reload — a genuinely signed-out, free user."""
    page.goto(BASE, wait_until="domcontentloaded")
    page.evaluate("""() => {
        try { localStorage.clear(); } catch(e){}
        try { sessionStorage.clear(); } catch(e){}
        try { indexedDB.deleteDatabase('lnr_studio'); } catch(e){}
    }""")
    page.reload(wait_until="domcontentloaded")
    page.wait_for_timeout(2500)


def wait_engine(page, timeout=25000):
    page.wait_for_function("() => !!window.LNR_QUESTION_SOURCE", timeout=timeout)


def goto_quiz_setup(page):
    """Open Studio → wizard step 2, where the quiz import + toggle live."""
    page.evaluate("""() => {
        const studio = document.querySelector('[data-page-link="studio"]');
        if (studio) studio.click();
    }""")
    page.wait_for_timeout(500)
    page.evaluate("""() => {
        const tab = document.getElementById('wizTab2');
        if (tab) tab.click();
    }""")
    page.wait_for_timeout(500)


def upload(page, fname):
    """Upload through the real file input in the setup panel."""
    goto_quiz_setup(page)
    page.set_input_files("#setupQuizImportInput", os.path.join(OUT, fname))
    page.wait_for_timeout(1200)


def report_text(page):
    return page.evaluate("""() => {
        const b = document.getElementById('setupImportResult');
        return b ? (b.hidden ? '' : b.innerText) : '';
    }""")


def counts(page):
    return page.evaluate("() => window.LNR_QUESTION_SOURCE.counts()")


with sync_playwright() as pw:
    browser = pw.chromium.launch(args=["--no-sandbox", "--autoplay-policy=no-user-gesture-required"])
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))

    # ============================================ 1. toggle hidden before upload
    fresh(page)
    wait_engine(page)
    hidden = page.evaluate("() => document.getElementById('qSourceRow').hidden")
    check("Toggle hidden before any upload", hidden is True, f"hidden={hidden}")
    c0 = counts(page)
    check("Built-in bank loaded on a fresh device", c0["builtin"] > 100, c0)

    # ============================================ 2. every supported JSON shape
    shape_expect = {
        "plain_array.json": 2,
        "nested_data.json": 1,
        "quiz_key.json": 1,
        "bank_key.json": 1,
        "items_key.json": 1,
        "five_options.json": 2,
    }
    for fname, expect in shape_expect.items():
        fresh(page)
        wait_engine(page)
        upload(page, fname)
        txt = report_text(page)
        c = counts(page)
        ok = c["uploaded"] == expect and "Imported" in txt
        check(f"JSON shape accepted: {fname}", ok, f"uploaded={c['uploaded']} expect={expect}")

    # ============================================ 3. five options kept whole
    fresh(page)
    wait_engine(page)
    upload(page, "five_options.json")
    opts = page.evaluate("""() => {
        const raw = JSON.parse(localStorage.getItem('lnr_custom_bank_v2') || '{}');
        const all = (raw.bible||[]).concat(raw.history||[]);
        return all.map(q => q.opts.length);
    }""")
    check("5-option questions keep all 5 options", opts and all(n == 5 for n in opts), opts)

    # ============================================ 4. answer as letter / index / text
    fresh(page)
    wait_engine(page)
    upload(page, "plain_array.json")
    answers = page.evaluate("""() => {
        const raw = JSON.parse(localStorage.getItem('lnr_custom_bank_v2') || '{}');
        const all = (raw.bible||[]).concat(raw.history||[]);
        return all.map(q => ({q: q.q, correct: q.correct, text: q.opts[q.correct]}));
    }""")
    ok_ans = (
        len(answers) == 2
        and answers[0]["correct"] == 1 and answers[0]["text"] == "Mars"
        and answers[1]["correct"] == 2 and answers[1]["text"] == "Canberra"
    )
    check("Answer as index and as letter both resolve", ok_ans, answers)

    # ============================================ 5. clear errors, not silence
    fresh(page)
    wait_engine(page)
    upload(page, "bad.json")
    bad_txt = report_text(page)
    check("Malformed JSON shows a clear error", "not valid JSON" in bad_txt, bad_txt[:160].replace("\n", " "))

    fresh(page)
    wait_engine(page)
    upload(page, "wrong_shape.json")
    shape_txt = report_text(page)
    check("Wrong shape names the problem", "No questions found" in shape_txt, shape_txt[:160].replace("\n", " "))

    # ============================================ 6. toggle both ways (FREE tier)
    fresh(page)
    wait_engine(page)
    upload(page, "plain_array.json")
    row_visible = page.evaluate("() => !document.getElementById('qSourceRow').hidden")
    check("Toggle appears after upload (free tier)", row_visible is True, f"visible={row_visible}")

    c_up = counts(page)
    check("Upload auto-selects the uploaded source", c_up["active"] == "uploaded", c_up)

    goto_quiz_setup(page)
    page.click("#qSourceBuiltin")
    page.wait_for_timeout(600)
    c_b = counts(page)
    check("Switch to built-in changes the active bank", c_b["active"] == "builtin" and c_b["activeBank"] > 100, c_b)

    page.click("#qSourceUploaded")
    page.wait_for_timeout(600)
    c_u = counts(page)
    check("Switch back to uploaded changes the active bank", c_u["active"] == "uploaded" and c_u["activeBank"] == 2, c_u)

    # ============================================ 7. the timer really reads it
    page.click("#qSourceUploaded")
    page.wait_for_timeout(400)
    page.evaluate("() => document.getElementById('startBtn').click()")
    page.wait_for_timeout(3000)
    qtext = page.evaluate("() => (document.getElementById('qText')||{}).textContent || ''")
    from_upload = ("Red Planet" in qtext) or ("capital city of Australia" in qtext)
    check("Timer serves a question from the uploaded pack", from_upload, qtext[:90])
    page.screenshot(path=os.path.join(OUT, "01_uploaded_question.png"))

    # ============================================ 8. remembered across reload
    page.reload(wait_until="domcontentloaded")
    page.wait_for_timeout(3000)
    wait_engine(page)
    c_r = counts(page)
    check("Source choice survives a reload", c_r["active"] == "uploaded" and c_r["activeBank"] == 2, c_r)

    # ============================================ 9. falls back if upload gone
    page.evaluate("() => localStorage.removeItem('lnr_custom_bank_v2')")
    page.reload(wait_until="domcontentloaded")
    page.wait_for_timeout(3000)
    wait_engine(page)
    c_f = counts(page)
    check("Falls back to built-in when the upload is gone", c_f["active"] == "builtin" and c_f["activeBank"] > 100, c_f)

    # ============================================ 10. free 2-hour cap
    fresh(page)
    wait_engine(page)
    page.evaluate("""() => {
        const day = new Date();
        const k = day.getFullYear()+'-'+String(day.getMonth()+1).padStart(2,'0')+'-'+String(day.getDate()).padStart(2,'0');
        const rec = JSON.stringify({day:k, usedMs: 2*60*60*1000});
        localStorage.setItem('lnr_airtime_v1', rec);
        sessionStorage.setItem('lnr_airtime_mirror_v1', rec);
        localStorage.setItem('lnr_airtime_high_v1', String(2*60*60*1000));
        localStorage.setItem('lnr_airtime_high_v1_day', k);
    }""")
    page.reload(wait_until="domcontentloaded")
    page.wait_for_timeout(3000)
    wait_engine(page)
    page.evaluate("() => document.getElementById('startBtn').click()")
    page.wait_for_timeout(1500)
    in_stage = page.evaluate("() => document.body.classList.contains('screen-stage')")
    modal = page.evaluate("() => !!document.getElementById('airtimeLimitModal')")
    check("Free at 2h: stream does NOT start", in_stage is False, f"inStage={in_stage}")
    check("Free at 2h: upgrade dialog shown", modal is True, f"modal={modal}")
    page.screenshot(path=os.path.join(OUT, "02_airtime_cap.png"))

    # reload must not refund
    page.reload(wait_until="domcontentloaded")
    page.wait_for_timeout(3000)
    wait_engine(page)
    page.evaluate("() => document.getElementById('startBtn').click()")
    page.wait_for_timeout(1200)
    still_blocked = page.evaluate("() => !document.body.classList.contains('screen-stage')")
    check("Reload does NOT reset the 2h cap", still_blocked is True, f"blocked={still_blocked}")

    # clearing localStorage alone must not refund (session mirror holds it)
    page.evaluate("() => localStorage.clear()")
    page.reload(wait_until="domcontentloaded")
    page.wait_for_timeout(3000)
    wait_engine(page)
    page.evaluate("() => document.getElementById('startBtn').click()")
    page.wait_for_timeout(1200)
    still_blocked2 = page.evaluate("() => !document.body.classList.contains('screen-stage')")
    check("Clearing localStorage does NOT refund airtime", still_blocked2 is True, f"blocked={still_blocked2}")

    # ============================================ 11. Pro is unlimited
    fresh(page)
    wait_engine(page)
    page.evaluate("""() => {
        const day = new Date();
        const k = day.getFullYear()+'-'+String(day.getMonth()+1).padStart(2,'0')+'-'+String(day.getDate()).padStart(2,'0');
        const rec = JSON.stringify({day:k, usedMs: 5*60*60*1000});
        localStorage.setItem('lnr_airtime_v1', rec);
        sessionStorage.setItem('lnr_airtime_mirror_v1', rec);
        localStorage.setItem('lnr_airtime_high_v1', String(5*60*60*1000));
        localStorage.setItem('lnr_airtime_high_v1_day', k);
    }""")
    page.reload(wait_until="domcontentloaded")
    page.wait_for_timeout(3000)
    wait_engine(page)
    pro_ok = page.evaluate("""() => {
        if (!window.LNR_PRO || typeof window.LNR_PRO.isPro !== 'function') return 'no-bridge';
        return window.LNR_PRO.isPro();
    }""")
    check("Pro bridge present and reports Free on a fresh device", pro_ok is False, f"isPro={pro_ok}")

    # ============================================ 12. promo video, free only
    fresh(page)
    wait_engine(page)
    promo_free = page.evaluate("""() => {
        if (!window.LNR_PROMO_DEBUG) return null;
        return { list: window.LNR_PROMO_DEBUG.list(), pro: window.LNR_PROMO_DEBUG.isPro() };
    }""")
    free_ids = [p["id"] for p in (promo_free or {}).get("list", [])]
    check("Free: studio promo IS in the rotation", "studio_promo_lnr" in free_ids, free_ids)
    check("Free device is not Pro (promo applies)", promo_free and promo_free["pro"] is False, promo_free and promo_free["pro"])

    # the video file itself must serve
    vres = page.request.get(BASE + "/promos/lnr-studio-promo.mp4")
    check("Promo video file serves 200", vres.status == 200, f"status={vres.status} bytes={len(vres.body())}")

    # ============================================ 13. link preview metadata
    html = page.content()
    og = page.evaluate("""() => {
        const g = (p) => { const m = document.querySelector(`meta[property="${p}"]`); return m ? m.content : null; };
        const t = (n) => { const m = document.querySelector(`meta[name="${n}"]`); return m ? m.content : null; };
        return {
            ogImage: g('og:image'), ogUrl: g('og:url'), ogTitle: g('og:title'),
            ogW: g('og:image:width'), ogH: g('og:image:height'),
            twCard: t('twitter:card'), twImage: t('twitter:image')
        };
    }""")
    abs_ok = all(v and str(v).startswith("http") for v in [og["ogImage"], og["ogUrl"], og["twImage"]])
    check("OG/Twitter image URLs are absolute", abs_ok, og)
    check("OG image declares 1200x630", og["ogW"] == "1200" and og["ogH"] == "630", f"{og['ogW']}x{og['ogH']}")
    check("Twitter card is summary_large_image", og["twCard"] == "summary_large_image", og["twCard"])

    img = page.request.get(og["ogImage"])
    check("OG image URL actually loads", img.status == 200 and len(img.body()) > 5000,
          f"status={img.status} bytes={len(img.body())}")

    # ============================================ 14. no page errors
    check("No uncaught page errors", len(errors) == 0, errors[:3])

    browser.close()

# ------------------------------------------------------------------- summary
passed = sum(1 for r in results if r["ok"])
total = len(results)
print(f"\n===== {passed}/{total} checks passed =====")
with open(os.path.join(OUT, "results.json"), "w") as fh:
    json.dump({"passed": passed, "total": total, "results": results}, fh, indent=2)
sys.exit(0 if passed == total else 1)
