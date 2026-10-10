"""End-to-end browser checks for the real Tanguar Haor showcase. No new npm dependency: uses Python Playwright.

    npm run build && npx next start -p 3140 &        # in one shell
    python tests/e2e/wetland_smoke.py http://localhost:3140

Exits non-zero if any check fails. Network failures for remote map tiles are ignored (offline CI),
every other console/page error fails the run.
"""
import sys
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3140"
results, errors = [], []

def check(name, ok, detail=""):
    results.append((name, bool(ok), detail)); print(("PASS " if ok else "FAIL ") + name + (f"  [{detail}]" if detail else ""))

with sync_playwright() as p:
    browser = p.chromium.launch(); page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))
    page.on("console", lambda m: errors.append(m.text[:160]) if m.type == "error" and "ERR_NAME_NOT_RESOLVED" not in m.text and "ERR_INTERNET_DISCONNECTED" not in m.text else None)
    page.on("response", lambda r: errors.append(f"HTTP {r.status} {r.url}") if r.status >= 400 and BASE in r.url else None)

    page.goto(BASE + "/wetland"); page.wait_for_selector(".wx-obs", timeout=20000); page.wait_for_timeout(2500)
    text = page.inner_text("body")
    check("real showcase badge", "Real NISAR showcase" in text and page.get_attribute(".wx-root", "data-tier") == "SHOWCASE")
    check("case is Tanguar Haor (no Hakaluki)", "Tanguar Haor" in text and "Hakaluki" not in text)
    check("seven real acquisition dates", page.locator(".wx-obs").count() == 7, str(page.locator(".wx-obs").count()))
    check("24-day gap labelled, nothing between dates", "24-day gap" in text)
    check("295 regions drawn at the peak", page.locator("path.wx-patch").count() == 295, str(page.locator("path.wx-patch").count()))
    check("peak 24.48 km2 shown", "24.48" in page.inner_text(".wx-rail"))
    check("no 'confirmed flood' claim", "confirmed flood" not in text.lower() or "not confirmed flood" in text.lower())

    # timeline + playback only through real dates
    seen = []
    page.click(".wx-obs >> nth=0"); page.wait_for_timeout(900); seen.append(page.inner_text(".wx-now strong"))
    page.click(".wx-play"); 
    for _ in range(14):
        page.wait_for_timeout(800); d = page.inner_text(".wx-now strong")
        if not seen or d != seen[-1]: seen.append(d)
    page.click(".wx-play") if page.locator(".wx-play[aria-pressed=true]").count() else None
    real = {"Jun 30, 2026", "Jul 12, 2026", "Jul 24, 2026", "Aug 17, 2026", "Aug 29, 2026", "Sep 10, 2026", "Sep 22, 2026"}
    check("playback visits only real acquisition dates", set(seen) <= real and len(seen) >= 4, " > ".join(seen))
    page.click(".wx-obs >> nth=4"); page.wait_for_timeout(1200)
    check("scrubbing syncs date and region count", "Aug 29, 2026" in page.inner_text(".wx-now") and "295" in page.inner_text(".wx-now"))

    # modes
    for mode in ("Radar", "Detection", "Explain", "Motion"):
        page.click(f".wx-modes button[data-mode='{mode.upper()}']"); page.wait_for_timeout(500)
        check(f"mode {mode} selectable", page.get_attribute(f".wx-modes button[data-mode='{mode.upper()}']", "aria-checked") == "true")
    page.click(".wx-modes button[data-mode='RADAR']"); page.wait_for_timeout(1500)
    check("radar view states which layer is shown", "HH" in page.inner_text(".wx-radar__now") and "2026-08-29" in page.inner_text(".wx-radar__now"))
    check("radar image overlay loaded", page.locator(".leaflet-wxRadar-pane img").count() == 1)
    page.click(".wx-radar__row >> nth=1 >> button >> nth=2"); page.wait_for_timeout(800)
    check("HV change layer selectable", "HV" in page.inner_text(".wx-radar__now") and "Change" in page.inner_text(".wx-radar__now"))
    page.click(".wx-modes button[data-mode='MOTION']")

    # investigate a region + challenge
    page.locator("path.wx-patch").nth(40).click(force=True); page.wait_for_timeout(700)
    drawer = page.inner_text(".wx-drawer").lower()
    check("Why this region? opens with evidence", "why this region?" in drawer and "what do we actually know?" in drawer and "limitation" in drawer)
    check("evidence uses pipeline semantics", "previous date" in drawer and "compact footprint" in drawer)
    page.evaluate("document.querySelector('.wx-drawer__body').scrollTop = 99999"); page.click("text=Challenge this detection"); page.wait_for_timeout(400)
    d2 = page.inner_text(".wx-drawer")
    check("challenge lists real checks + no field truth", "Can we trust this change?" in d2 and "No field truth" in d2 and "threshold" in d2.lower())
    check("no confidence score invented", "%" not in "".join(page.locator(".wx-status").all_inner_texts()) and "confidence" not in d2.lower())

    def open_tool(label):
        page.click(f".wx-dock__btn[aria-label='{label}']"); page.wait_for_timeout(500); return page.inner_text(".wx-drawer")
    t = open_tool("Does it survive?")
    check("sensitivity shows stored sweep + SENSITIVE verdict", "Sensitive to the cutoff" in t and "10.9" in t and "53.7" in t and "not re-run" in t, t[:0])
    check("sensitivity does not claim recompute", "recomputes" not in t.lower())
    t = open_tool("Independent check")
    check("independent check inconclusive, coverage visible", "Inconclusive" in t and "0.3%" in t and "20.0%" in t)
    check("zero scores not emphasised", "Raw comparison numbers (not meaningful at this coverage)" in t and page.locator("details.wx-raw[open]").count() == 0)
    check("optical evidence images present", page.locator(".wx-optical-imgs img").count() >= 4, str(page.locator(".wx-optical-imgs img").count()))
    t = open_tool("What happened?"); check("story from loaded values", "295 candidate regions covering 24.48" in t and "rather than confirmed flooding" in t)
    t = open_tool("Data chain"); check("data chain has six steps", page.locator(".wx-chain li").count() == 6)
    page.click(".wx-chain li button >> nth=3"); check("data chain step expands", page.locator(".wx-chain__tech").count() == 1)
    t = open_tool("Why radar?"); check("why radar explains clouds", "Cloud" in t)
    t = open_tool("Provenance"); tl = t.lower(); check("provenance separates observed/derived/context", "observed" in tl and "derived" in tl and "context" in tl and "nisar_l2_gcov_provisional_v1" in tl)
    t = open_tool("SAR Detective"); page.mouse.click(760, 400); page.wait_for_timeout(500); t = page.inner_text(".wx-drawer")
    check("SAR Detective labels region averages", "Region average" in t or "No detector result" in t)
    check("detective never claims per-pixel", "single raster cell" not in t.lower())
    open_tool("Lock comparison"); page.select_option(".wx-form label:nth-child(1) select", index=0); page.select_option(".wx-form label:nth-child(2) select", index=4)
    page.click("text=Lock these two dates"); page.wait_for_timeout(1500)
    check("lock comparison shows two labelled dates", page.locator(".wx-split").count() == 1 and "Jun 30" in page.inner_text(".wx-split-label--l") and "Aug 29" in page.inner_text(".wx-split-label--r"))
    page.focus(".wx-split"); page.keyboard.press("ArrowRight"); check("split divider keyboard accessible", int(page.get_attribute(".wx-split", "aria-valuenow")) > 50)
    page.click("text=Reset comparison"); check("comparison resets", page.locator(".wx-split").count() == 0)
    page.click(".wx-drawer__bar button"); check("drawer closes", page.locator(".wx-drawer").count() == 0)
    page.click("text=Return to overview"); page.wait_for_timeout(800); check("return to overview clears state", page.locator(".wx-drawer").count() == 0 and "Aug 29, 2026" in page.inner_text(".wx-now"))

    # keyboard: regions are not Tab stops, and a keyboard path to investigate a region exists
    page.click("text=Return to overview"); page.wait_for_timeout(500)
    check("map regions are not keyboard tab stops", page.evaluate("[...document.querySelectorAll('path.wx-patch')].every(p => p.getAttribute('tabindex') === '-1')"))
    page.focus(".wx-dock__btn[aria-label='Why this region?']"); page.keyboard.press("Enter"); page.wait_for_timeout(400)
    page.locator(".wx-regions button").first.focus(); page.keyboard.press("Enter"); page.wait_for_timeout(500)
    check("keyboard user can investigate a region from the list", "can we trust" in page.inner_text(".wx-drawer").lower() or "what do we actually know" in page.inner_text(".wx-drawer").lower())
    page.keyboard.press("Escape"); page.wait_for_timeout(300)
    # keyboard focus + accessible names
    nameless = page.evaluate("[...document.querySelectorAll('.wx-root button')].filter(b => !(b.innerText || '').trim() && !b.getAttribute('aria-label')).length")
    check("every icon-only control has an accessible name", nameless == 0, str(nameless))

    # narrower viewports
    for w, h in ((1100, 760), (820, 900), (390, 800)):
        page.set_viewport_size({"width": w, "height": h}); page.wait_for_timeout(700)
        over = page.evaluate("document.documentElement.scrollWidth > innerWidth")
        check(f"no horizontal overflow at {w}px", not over)
        page.screenshot(path=f"/tmp/e2e_wetland_{w}.png")
    page.set_viewport_size({"width": 1440, "height": 900})
    page.screenshot(path="/tmp/e2e_wetland_1440.png")
    browser.close()

bad = [r for r in results if not r[1]]
print(f"\n{len(results) - len(bad)}/{len(results)} checks passed; application errors: {errors or 'none'}")
sys.exit(1 if bad or errors else 0)
