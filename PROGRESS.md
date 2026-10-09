# Beyonders redesign — progress log

## Done (verified: `npm run lint` clean, `npm run build` passes, headless-browser smoke tests passed)
- Map-first `/wetland`: Time Machine playback (play/pause/replay, 0.5/1/2x, step, onset/peak/recession), real-date timeline with labelled gaps, peak moment, four modes, uncertainty drawn on the map (solid / light / hatched), hover + click investigation, Evidence Stack, Challenge, SAR Detective, Detection Sensitivity, Lock comparison (split), Change Story, Data Chain, Why Radar, Provenance, Return to overview, keyboard (Space, arrows, Esc), responsive bottom sheet.
- Data tiers: SHOWCASE / LOCAL_RUN / SANDBOX with explicit labels; static showcase loader (`src/lib/showcase.ts`) and `pipeline/export_showcase.py` (self-tested on a throwaway fixture, removed).
- Landing page, phenomena registry, global-page links, README section, classic dashboard preserved at `/wetland/classic`.
- Scientific code untouched: no changes to pipeline stages, API routes, constants, dates, thresholds.

## Added in session 2
- Independent check drawer (optical/HLS evidence; local run via API, showcase via reference.json). `npm test`: 5 passing unit tests for the evidence language, no new dependencies.

## Not done / needs you
1. **Real featured case**: the real run is gitignored and was not in the repo. Run `python pipeline/export_showcase.py --run-id <id>` locally and commit `public/showcase/featured/` (see public/showcase/README.md). Radar mode shows real layers only after this (or with a local run).
2. Python pipeline tests were not run here (needs your venv).
3. Not yet built: global map → site fly-in transition, SAR Detective for showcase is region-level, split view lacks swipe gesture polish, WetlandPulse chart not reused.
4. Console shows a harmless 404 for `/showcase/featured/manifest.json` until the case is exported.
## Next steps to continue
- Export showcase and review `/wetland` with real data (Independent check drawer reads `reference.json`).
- Add global-map fly-in to the site; showcase radar for non-exported dates.

## Session 3 — legacy real run 3b01cdb5674a44ea9c6c3d17ec8c07b8
**What was done**
- `pipeline/legacy_showcase.py` (stdlib only) + hook in `export_showcase.py` (`--legacy-dir` optional). Modern-run export path unchanged (regression-tested).
- Verifies `last_attempt.json`: run_id, status COMPLETE, data_source NISAR, mode real, product NISAR_L2_GCOV_PROVISIONAL_V1, no seed, 7 ordered unique scene dates == observation_count, selected_date among them.
- Acquisition dates come only from the manifest's scene names (2026-06-30, 07-12, 07-24, 08-17, 08-29, 09-10, 09-22; baseline 06-18 median of 5).
- Boundary exported only because a committed file (`pipeline/data/tanguar_haor_adb_boundary.geojson`) matches the manifest's boundary-source string and site bounds.
- Each loose derived file is exported ONLY if consistent with the manifest (dates, site, geometry inside study bounds, peak/selected date, sensitivity tied to pulse peak area). Otherwise skipped with the reason recorded in `public/showcase/featured/manifest.json` (`legacy.skipped`) and shown in the Provenance drawer.
- App: handles `completeness` = METADATA_ONLY / PARTIAL / FULL. Dates without exported results are dashed + disabled, playback/step/jumps/keyboard skip them, radar says when no preview exists, tier badge shows "ACQUISITIONS ONLY" / "PARTIAL EXPORT".
- Tests: `npm test` (5), `python3 -m unittest pipeline.test_legacy_showcase` (7), lint, build all pass. Browser: real label shown, no simulated labels, no app console errors (only offline tile/font DNS failures in the sandbox).

**Result for this run (as found in the repo copy of pipeline/output)**: METADATA_ONLY. Exported: manifest facts, 7 real acquisition dates, verified Tanguar Haor boundary, limitations. NOT exported: pulse, patches, sensitivity (the loose files fail verification: pulse says "Hakaluki Haor", has dates 2026-06-18 and 2026-08-05 that are not acquisitions of this run, lacks 2026-09-22, peak 07-24 != selected 08-29; patches are at ~91.5E 24.65N, ~55 km outside the run's study bounds, dated 07-24). Those files come from the "Demo files" commit, not from this run.

**Still unavailable from the legacy run**: per-date candidate regions and areas, temporal pulse, threshold sweep, radar previews (HH/HV/Δ), HLS/optical evidence, any validation. Raw TIFFs are never published.
**To get the full case**: if your local `runs/<id>/` folder holds the genuine derived files they will pass verification and export automatically; otherwise re-export from the run's real saved outputs (no reprocessing needed if they exist) or reprocess once with the current pipeline, then `python pipeline/export_showcase.py --run-id <id>`.
