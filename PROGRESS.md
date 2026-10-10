# Beyonders progress log

## Atlas redesign (current)
Done: design tokens + self-hosted fonts; masthead / left context rail / instrument-style mode switch / icon tool dock / single investigation-drawer frame; evidence wording aligned with pipeline definitions; honest Independent check for the inconclusive case; Explore page reorganised into A browse / B processed cases / C advanced processing; landing; map colours aligned to semantic palette; stale Hakaluki labels removed from the active case (sandbox renamed to a fictional demonstration wetland).
Verified: lint, build, unit tests, Python tests, 63 browser checks (41 wetland + 22 explore). Real showcase untouched (identical to committed).

## Known gaps
- Remote map tiles/GIBS mosaic cannot be loaded in an offline test sandbox; those layers were verified structurally, not visually.
- The local-run API answers 404 when no local run exists (existing route, unchanged); the browser logs it as a network line, the UI treats it as "no local run".
- Forests/volcanoes are declared only (planned).
- SAR Detective in the static showcase is region-level by design (no per-pixel raster is published).
