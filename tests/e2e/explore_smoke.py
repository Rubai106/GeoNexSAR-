"""Browser checks for the landing page and the global Explore page (real showcase, no local run).

    python tests/e2e/explore_smoke.py http://localhost:3140
The one tolerated network response is the local-run API answering 404 when no local pipeline run exists.
"""
import sys
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3140"
results, errors = [], []
def check(name, ok, detail=""):
    results.append(bool(ok)); print(("PASS " if ok else "FAIL ") + name + (f"  [{detail}]" if detail else ""))

with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 1440, "height": 900})
    pg.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))
    pg.on("console", lambda m: errors.append(m.text[:140]) if m.type == "error" and "ERR_NAME_NOT_RESOLVED" not in m.text and "404" not in m.text else None)
    pg.on("response", lambda r: errors.append(f"HTTP {r.status} {r.url}") if r.status >= 400 and BASE in r.url and "/api/wetland/nisar-detections" not in r.url else None)

    pg.goto(BASE + "/"); t = pg.inner_text("body")
    check("landing: clear first action", "Open the Tanguar Haor case" in t and "Explore NISAR worldwide" in t)
    check("landing: forests and volcanoes marked planned", pg.locator(".ld-phen em").count() == 2 and "Planned" in t)
    check("landing: no invented statistics", "km²" not in t)
    fonts = pg.evaluate("getComputedStyle(document.querySelector('.ld h1')).fontFamily")
    check("landing: display serif with system fallback", "Playfair Display" in fonts and "serif" in fonts, fonts[:60])
    pg.click("text=Open the Tanguar Haor case"); pg.wait_for_url("**/wetland"); check("landing -> case navigation", pg.url.endswith("/wetland"))

    pg.goto(BASE + "/wetland/global"); pg.wait_for_selector(".atlas-featured", timeout=20000); pg.wait_for_timeout(2500); t = pg.inner_text("body")
    check("explore: three goals offered", all(x in t for x in ("Explore worldwide observations", "Explore processed cases", "Process another place")))
    check("explore: featured Tanguar case easy to find", "Tanguar Haor, Bangladesh" in t and "24.48" in t and "295" in t)
    check("explore: independent check shown as inconclusive", "inconclusive" in t.lower() and "0.3%" in t)
    check("explore: no Hakaluki describing the active case", "Wetland story: Hakaluki" not in t)
    check("explore: footprints described as observations, not detections", "Satellite coverage only. Nothing is detected here." in t)
    check("explore: processing flagged advanced, steps in order", "C · Advanced" in t.replace("C · ADVANCED", "C · Advanced") and pg.locator(".atlas-steps li").count() == 5)
    check("explore: browsing vs launching distinguished", "Change detection runs only when you launch processing" in t)
    check("explore: Python/Earthdata guidance only in the processing section", pg.locator("#process").inner_text().count("Earthdata") >= 1 and "Earthdata" not in pg.locator(".atlas-featured").inner_text() and "Earthdata" not in pg.locator("#observe").inner_text())
    check("explore: missing local run is not shown as a red error", pg.locator(".global-source-pill--error").count() == 0 or "Local run" not in "".join(pg.locator(".global-source-pill--error").all_inner_texts()))
    check("explore: no 'Python environment' error banner", "python environment" not in t.lower() and "could not load detector output" not in t.lower())
    pg.click("text=Show on the world map"); pg.wait_for_timeout(1500); check("explore: locate case control works (no crash)", pg.locator("#global-nisar-map").count() == 1)
    pg.click(".atlas-featured >> text=Open the case"); pg.wait_for_url("**/wetland"); check("explore -> case navigation", True)
    pg.goto(BASE + "/wetland"); pg.wait_for_selector(".wx-nav", timeout=20000); pg.click("text=Explore NISAR worldwide"); pg.wait_for_url("**/wetland/global"); check("case -> explore navigation", True)
    for w in (1100, 820, 390):
        pg.set_viewport_size({"width": w, "height": 900}); pg.wait_for_timeout(600)
        check(f"explore: no horizontal overflow at {w}px", not pg.evaluate("document.documentElement.scrollWidth > innerWidth"))
    pg.set_viewport_size({"width": 1440, "height": 900}); pg.goto(BASE + "/wetland/classic"); pg.wait_for_timeout(3000)
    check("classic view still loads", pg.locator("body").inner_text() != "" and "Hakaluki" not in pg.locator("header").first.inner_text())
    b.close()
bad = results.count(False)
print(f"\n{len(results) - bad}/{len(results)} checks passed; application errors: {errors or 'none'}")
sys.exit(1 if bad or errors else 0)
