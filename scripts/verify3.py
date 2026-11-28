"""Verify the purchase event fires on a verified activation, matched to the click.

Events are read from window.dataLayer, which is where LNR_TRACK actually sends
them (it forwards to gtag). Wrapping LNR_TRACK does not work: the module
reassigns it after load, so a wrapper installed later is discarded.
"""
import json
import sys
from playwright.sync_api import sync_playwright

BASE = "https://lnr-storytelling-hub.vercel.app"
results = []


def rec(name, ok, detail):
    results.append({"check": name, "ok": bool(ok), "detail": detail})
    print(("PASS " if ok else "FAIL ") + name + " :: " + str(detail))


def events(page):
    """Every gtag event name recorded in dataLayer, in order."""
    raw = page.evaluate("() => (window.dataLayer || []).map(a => Array.from(a))")
    out = []
    for entry in raw:
        # gtag pushes ['event', name, params]
        if len(entry) >= 2 and entry[0] == "event":
            out.append((entry[1], entry[2] if len(entry) > 2 else {}))
    return out


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(viewport={"width": 1280, "height": 800})
        page = ctx.new_page()

        page.route(
            "**/api/verify-license*",
            lambda route: route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps(
                    {
                        "ok": True,
                        "license": {
                            "v": 1,
                            "tier": "pro",
                            "plan": "pro_monthly",
                            "watermark": "LNR",
                            "site": "",
                            "brand": "LNR",
                            "email": "",
                            "lockBrand": False,
                            "iat": 1700000000000,
                            "exp": 4102444800000,
                        },
                    }
                ),
            ),
        )

        page.goto(BASE + "/timer", wait_until="networkidle")
        page.wait_for_timeout(3000)

        # The checkout opens a new tab. Block it so the page under test is not
        # navigated away — otherwise the activation below runs on the Selar tab
        # and the dataLayer we read belongs to the wrong document.
        page.evaluate("() => { window.open = () => null; }")

        # 1. Click the real Pro button.
        page.evaluate(
            """() => {
                const b = document.querySelector('[data-page-link="pricing"]');
                if (b) b.click();
            }"""
        )
        page.wait_for_timeout(500)
        page.evaluate(
            """() => {
                const b = document.getElementById('pricingProBtn');
                if (b) b.click();
            }"""
        )
        page.wait_for_timeout(900)

        marker = page.evaluate("() => localStorage.getItem('lnr_pending_checkout_v1')")
        rec("marker written by click", bool(marker), marker)

        ev_click = events(page)
        n_click = [e[0] for e in ev_click]
        rec("one upgrade_click on the Pro button", n_click.count("upgrade_click") == 1, n_click)
        rec("one checkout_start on the Pro button", n_click.count("checkout_start") == 1, n_click)
        if "upgrade_click" in n_click and "checkout_start" in n_click:
            rec(
                "order upgrade_click -> checkout_start",
                n_click.index("upgrade_click") < n_click.index("checkout_start"),
                n_click,
            )

        # 2. Activate a key -> purchase must fire, matched to the marker.
        #    Read the dataLayer INSIDE the same evaluate: activation can trigger
        #    a reload, and a separate read afterwards would land on a fresh
        #    document whose dataLayer is empty.
        act = page.evaluate(
            """async () => {
                const api = window.LNR_PRO;
                if (!api || typeof api.activate !== 'function') return { error: 'no LNR_PRO.activate' };
                const res = await api.activate('LNRPRO.TESTKEY123');
                const dl = (window.dataLayer || []).map(a => Array.from(a))
                    .filter(a => a[0] === 'event')
                    .map(a => [a[1], a[2] || {}]);
                return { res, dl, marker: localStorage.getItem('lnr_pending_checkout_v1') };
            }"""
        )
        page.wait_for_timeout(400)

        ev = [(e[0], e[1]) for e in act.get("dl", [])]
        names = [e[0] for e in ev]
        purchase = [e for e in ev if e[0] == "purchase"]
        rec("activation succeeded", act.get("res", {}).get("ok") is True, act.get("res"))
        rec("purchase event fired", len(purchase) == 1, names)
        rec("marker consumed on activation", act.get("marker") is None, act.get("marker"))
        if purchase:
            params = purchase[0][1]
            rec("purchase carries checkout_ref", bool(params.get("checkout_ref")), params)
            rec("purchase carries plan", params.get("plan") == "pro", params)
            rec("purchase carries value", params.get("value") == 19, params)

        # 3. Marker consumed: a second activation must not double-count.
        page.evaluate(
            """async () => {
                const api = window.LNR_PRO;
                if (api && api.deactivate) api.deactivate();
            }"""
        )
        page.wait_for_timeout(400)
        second = page.evaluate(
            """async () => {
                const api = window.LNR_PRO;
                if (api && api.activate) await api.activate('LNRPRO.TESTKEY123');
                return (window.dataLayer || []).map(a => Array.from(a))
                    .filter(a => a[0] === 'event')
                    .map(a => a[1]);
            }"""
        )
        page.wait_for_timeout(300)
        n2 = second
        rec("no second purchase (marker consumed)", n2.count("purchase") == 0, n2)
        rec("unattributed reported instead", "purchase_unattributed" in n2, n2)

        page.close()
        ctx.close()
        browser.close()

    ok = sum(1 for r in results if r["ok"])
    print("\n%d/%d checks passed" % (ok, len(results)))
    return 0 if ok == len(results) else 1


if __name__ == "__main__":
    sys.exit(main())
